// Pfad: a grid with numbered dots. Draw one line from 1 to the last number,
// through the numbers in order, that visits every cell exactly once.
// The generator draws a random path through the whole grid first, then places
// numbers on it until that path is the only solution. Any valid line wins, so
// the server only checks the rules; the time from opening to solving is the score.
import { z } from "zod";
import { AppError } from "../errors";
import { fresh, pick, type Rand, type PuzzleKind } from "./types";
import { checkPath, neighbours } from "./pfadRules";

export { checkPath, neighbours };

type P = { n: number; dots: number[]; solution: number[]; wordId: string; term: string; slug: string };
type S = { startedAt: number; path: number[] | null };
export type PfadView = { n: number; dots: number[]; startedAt: number; path: number[] | null; word: { term: string; slug: string } | null };

/**
 * Random path through every cell: start with a snake and apply many "backbite"
 * moves (the end steps to a neighbour and the loop it closes is reversed).
 */
export function randomPath(n: number, rand: Rand, steps = n * n * 40): number[] {
  const p: number[] = [];
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) p.push(r * n + (r % 2 ? n - 1 - k : k));
  const pos = new Int32Array(n * n);
  const index = () => p.forEach((c, i) => (pos[c] = i));
  index();
  for (let s = 0; s < steps; s++) {
    if (rand() < 0.5) {
      p.reverse();
      index();
    }
    const end = p[p.length - 1];
    const options = neighbours(n, end).filter((c) => c !== p[p.length - 2]);
    const v = options[Math.floor(rand() * options.length)];
    const i = pos[v];
    // Reverse the tail after v: the old end now sits next to v.
    for (let a = i + 1, b = p.length - 1; a < b; a++, b--) [p[a], p[b]] = [p[b], p[a]];
    for (let a = i + 1; a < p.length; a++) pos[p[a]] = a;
  }
  return p;
}

export type SolveResult = { solutions: number[][]; complete: boolean };

/**
 * Finds up to `limit` lines through the dots. `complete` is false when the node
 * budget ran out before the search was done (then uniqueness is unknown).
 * Pruning: unvisited cells must stay connected, and no unvisited cell other
 * than the final dot may be left with fewer than two ways in and out.
 */
export function solve(n: number, dots: number[], limit = 2, budget = 400_000): SolveResult {
  const N = n * n;
  const dotOf = new Int32Array(N).fill(-1);
  dots.forEach((c, i) => (dotOf[c] = i));
  const last = dots[dots.length - 1];
  const nb = Array.from({ length: N }, (_, c) => neighbours(n, c));
  const used = new Uint8Array(N);
  const path: number[] = [];
  const solutions: number[][] = [];
  let nodes = 0;
  let out = false;
  const stamp = new Int32Array(N);
  let mark = 0;

  const ok = (head: number) => {
    // Dead ends.
    for (let c = 0; c < N; c++) {
      if (used[c]) continue;
      let deg = 0;
      for (const m of nb[c]) if (!used[m] || m === head) deg++;
      if (deg === 0) return false;
      if (deg === 1 && c !== last) return false;
    }
    // Connectivity of what is left, starting next to the head.
    mark++;
    const stack: number[] = [];
    for (const m of nb[head]) if (!used[m]) {
      stack.push(m);
      stamp[m] = mark;
      break;
    }
    let reached = 0;
    while (stack.length) {
      const c = stack.pop()!;
      reached++;
      for (const m of nb[c]) if (!used[m] && stamp[m] !== mark) {
        stamp[m] = mark;
        stack.push(m);
      }
    }
    return reached === N - path.length;
  };

  const go = (head: number, next: number) => {
    if (solutions.length >= limit || out) return;
    if (++nodes > budget) {
      out = true;
      return;
    }
    if (path.length === N) {
      if (head === last) solutions.push([...path]);
      return;
    }
    if (!ok(head)) return;
    for (const m of nb[head]) {
      if (used[m]) continue;
      const d = dotOf[m];
      if (d !== -1 && d !== next) continue;
      if (m === last && path.length !== N - 1) continue;
      used[m] = 1;
      path.push(m);
      go(m, d === -1 ? next : next + 1);
      path.pop();
      used[m] = 0;
    }
  };

  used[dots[0]] = 1;
  path.push(dots[0]);
  go(dots[0], 1);
  return { solutions, complete: !out };
}

/**
 * Numbers for a random path: every cell starts numbered, then numbers are taken
 * away in random order as long as the path stays the only solution (like the
 * givens of a sudoku). Searches that run out of budget count as "not unique".
 */
export function makePfad(n: number, rand: Rand): { dots: number[]; solution: number[] } | null {
  const solution = randomPath(n, rand);
  const N = n * n;
  const on = new Set(Array.from({ length: N }, (_, i) => i));
  const dotsOf = () => [...on].sort((a, b) => a - b).map((i) => solution[i]);
  const order = Array.from({ length: N - 2 }, (_, i) => i + 1);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const i of order) {
    on.delete(i);
    const r = solve(n, dotsOf());
    if (!r.complete || r.solutions.length !== 1) on.add(i);
  }
  const dots = dotsOf();
  return checkPath(n, dots, solution) ? null : { dots, solution };
}

export const pfad: PuzzleKind<P, S, PfadView> = {
  generate(words, rand, recent) {
    if (!words.length) return null;
    let n = rand() < 0.6 ? 6 : 7;
    let made = makePfad(n, rand);
    if (!made && n === 7) made = makePfad((n = 6), rand);
    if (!made) return null;
    // A word from the archive waits at the end of the line.
    const w = pick(fresh(words, recent), rand);
    return { wordId: w.id, puzzle: { n, ...made, wordId: w.id, term: w.term, slug: w.slug } };
  },
  initial: (_p, now) => ({ startedAt: now, path: null }),
  view: (p, s, finished) => ({ n: p.n, dots: p.dots, startedAt: s.startedAt, path: s.path, word: finished ? { term: p.term, slug: p.slug } : null }),
  move(p, s, input, now) {
    const { path } = z.object({ path: z.array(z.number().int()).max(p.n * p.n) }).parse(input);
    const err = checkPath(p.n, p.dots, path);
    if (err) throw new AppError(err);
    const durationMs = Math.max(0, now - s.startedAt);
    return { state: { ...s, path }, finished: true, won: true, score: Math.round(durationMs / 1000), durationMs };
  },
};
