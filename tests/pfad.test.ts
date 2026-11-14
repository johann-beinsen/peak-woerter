import { describe, expect, it } from "vitest";
import { checkPath, makePfad, pfad, randomPath, solve } from "@/lib/puzzles/pfad";
import { compareResults, resultLabel } from "@/lib/puzzles/group";
import type { PoolWord } from "@/lib/puzzles/types";

// Small seeded random source, so failures can be reproduced.
const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

describe("Pfad", () => {
  it("der Zufallsweg besucht jedes Feld genau einmal", () => {
    for (let s = 1; s <= 20; s++) {
      const p = randomPath(6, seeded(s));
      expect(checkPath(6, [p[0], p[p.length - 1]], p)).toBeNull();
    }
  });

  it("erzeugte Rätsel haben genau eine Lösung, nicht zu viele Zahlen", () => {
    for (const n of [6, 7]) {
      for (let s = 1; s <= 6; s++) {
        const r = makePfad(n, seeded(s * 31 + n))!;
        expect(checkPath(n, r.dots, r.solution)).toBeNull();
        const found = solve(n, r.dots, 2, 5_000_000);
        expect(found.complete).toBe(true);
        expect(found.solutions).toEqual([r.solution]);
        expect(r.dots.length).toBeLessThanOrEqual(n * n / 2);
      }
    }
  });

  it("prüft die Regeln: lückenlos, jedes Feld einmal, Zahlen der Reihe nach", () => {
    // 2×2: 0 1 / 2 3
    expect(checkPath(2, [0, 2], [0, 1, 3, 2])).toBeNull();
    expect(checkPath(2, [0, 2], [0, 1, 3])).toMatch(/alle Felder/);
    expect(checkPath(2, [0, 2], [0, 3, 1, 2])).toMatch(/zusammenhängen/);
    expect(checkPath(2, [0, 2], [0, 1, 1, 2])).toMatch(/einmal/);
    expect(checkPath(2, [0, 3, 2], [0, 1, 3, 2])).toBeNull();
    expect(checkPath(2, [0, 1, 3], [0, 2, 3, 1])).toMatch(/Reihe nach|letzten Zahl/);
  });

  it("Zug: gültige Linie gewinnt mit Zeit, ungültige wird abgelehnt, Lösung bleibt verborgen", () => {
    const words: PoolWord[] = [{ id: "w1", term: "Nebel", slug: "nebel", partOfSpeech: null, definition: null, categories: [] }];
    const g = pfad.generate(words, seeded(7), new Set())!;
    expect(g.wordId).toBe("w1");
    const p = g.puzzle;
    const s = pfad.initial(p, 1_000);
    const view = pfad.view(p, s, false);
    expect(JSON.stringify(view)).not.toContain(JSON.stringify(p.solution));
    expect(view.word).toBeNull();
    expect(() => pfad.move(p, s, { path: p.solution.slice(0, -1) }, 5_000)).toThrow(/Felder/);
    const won = pfad.move(p, s, { path: p.solution }, 84_000);
    expect(won).toMatchObject({ finished: true, won: true, durationMs: 83_000, score: 83 });
    expect(pfad.view(p, won.state, true).word).toEqual({ term: "Nebel", slug: "nebel" });
  });

  it("Rangliste: schnellste Zeit vorn", () => {
    const f = (ms: number) => ({ finished: true, won: true, score: Math.round(ms / 1000), durationMs: ms, updatedAt: new Date(0) });
    expect(resultLabel("pfad", f(83_000))).toBe("1:23");
    expect([f(90_000), f(45_000)].sort((a, b) => compareResults("pfad", a, b))[0].durationMs).toBe(45_000);
  });
});
