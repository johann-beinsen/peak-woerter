"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RotateCcw, Undo2 } from "lucide-react";
import type { PlayResult } from "@/lib/puzzles/play";
import { adjacent, checkPath } from "@/lib/puzzles/pfadRules";
import { dayLabel, MoveError, ShareButton, useMove } from "./common";

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const KEY_STEP: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

/**
 * Draw with finger or mouse from the 1: back over the line takes steps back,
 * touching an earlier cell cuts the line there. Arrow keys work too.
 * The browser checks the rules first; the server checks again and stops the clock.
 */
export function Pfad({ initial, day, serverNow }: { initial: PlayResult<"pfad">; day: string; serverNow: number }) {
  const { result, error, setError, pending, send } = useMove("pfad", initial);
  const v = result.view;
  const { n, dots } = v;
  const N = n * n;
  const done = result.finished;
  const [path, setPath] = useState<number[]>(v.path ?? []);
  const board = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const sent = useRef<string | null>(null);

  // Running clock, corrected for the difference between server and device time.
  const [offset] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(t);
  }, [done, offset]);

  const dotIndex = (c: number) => dots.indexOf(c);
  const reached = path.filter((c) => dotIndex(c) !== -1).length; // numbers on the line so far

  const step = (p: number[], c: number): number[] => {
    if (!p.length) return c === dots[0] ? [c] : p;
    const end = p[p.length - 1];
    if (c === end) return p;
    if (p.length > 1 && c === p[p.length - 2]) return p.slice(0, -1);
    const at = p.indexOf(c);
    if (at !== -1) return p.slice(0, at + 1);
    if (!adjacent(n, end, c)) return p;
    const d = dotIndex(c);
    const next = p.filter((x) => dotIndex(x) !== -1).length;
    if (d !== -1 && d !== next) return p; // numbers in order
    if (d === dots.length - 1 && p.length !== N - 1) return p; // the last number closes the line
    return [...p, c];
  };

  /** Walks there one cell at a time, so a fast straight swipe does not skip cells. */
  const walk = (p: number[], c: number): number[] => {
    if (!p.length) return step(p, c);
    let cur = p;
    for (let guard = 0; guard < N; guard++) {
      const end = cur[cur.length - 1];
      if (end === c || cur.includes(c) || adjacent(n, end, c)) return step(cur, c);
      const [er, ec, tr, tc] = [Math.floor(end / n), end % n, Math.floor(c / n), c % n];
      if (er !== tr && ec !== tc) return cur; // diagonal: wait for the pointer
      const nextCell = er === tr ? end + Math.sign(tc - ec) : end + n * Math.sign(tr - er);
      const moved = step(cur, nextCell);
      if (moved === cur) return cur;
      cur = moved;
    }
    return cur;
  };

  const cellAt = (x: number, y: number) => {
    const r = board.current!.getBoundingClientRect();
    const col = Math.floor(((x - r.left) / r.width) * n);
    const row = Math.floor(((y - r.top) / r.height) * n);
    return col < 0 || row < 0 || col >= n || row >= n ? null : row * n + col;
  };

  const update = (next: number[]) => {
    setError(null);
    setPath(next);
  };

  // Complete and correct: send it once.
  useEffect(() => {
    if (done || pending || path.length !== N || checkPath(n, dots, path)) return;
    const key = path.join(",");
    if (sent.current === key) return;
    sent.current = key;
    void send({ path });
  }, [path, done, pending, N, n, dots, send]);

  const onKey = (e: React.KeyboardEvent) => {
    if (done) return;
    if (e.key === "Backspace") {
      e.preventDefault();
      return update(path.slice(0, -1));
    }
    const d = KEY_STEP[e.key];
    if (!d) return;
    e.preventDefault();
    if (!path.length) return update([dots[0]]);
    const end = path[path.length - 1];
    const r = Math.floor(end / n) + d[0], c = (end % n) + d[1];
    if (r >= 0 && c >= 0 && r < n && c < n) update(step(path, r * n + c));
  };

  const centre = (c: number) => `${(c % n) + 0.5},${Math.floor(c / n) + 0.5}`;
  const elapsed = done ? (result.durationMs ?? 0) : Math.max(0, now - v.startedAt);
  const share = `Peake Pfad ${dayLabel(day)}: ${n}×${n} in ${clock(result.durationMs ?? 0)}`;

  return (
    <div className="mt-6">
      <div className="mx-auto flex max-w-[28rem] items-baseline justify-between">
        <p className="tabular text-sm text-ink-2">
          {n}×{n} · {reached} von {dots.length} Zahlen · {path.length} von {N} Feldern
        </p>
        <p className="display tabular text-2xl" aria-label={`Zeit ${clock(elapsed)}`}>
          {clock(elapsed)}
        </p>
      </div>

      <div
        ref={board}
        role="application"
        aria-label={`Pfad, ${n} mal ${n} Felder. Mit den Pfeiltasten von der 1 aus zeichnen, Rücktaste nimmt einen Schritt zurück.`}
        tabIndex={done ? -1 : 0}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          if (done) return;
          const c = cellAt(e.clientX, e.clientY);
          if (c === null) return;
          // Start at the 1, at the end of the line, or cut the line at a touched cell.
          if (!path.length && c !== dots[0]) return setError("Fang bei der 1 an.");
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          update(path.includes(c) ? path.slice(0, path.indexOf(c) + 1) : walk(path, c));
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const c = cellAt(e.clientX, e.clientY);
          if (c !== null) setPath((p) => walk(p, c));
        }}
        onPointerUp={() => (drawing.current = false)}
        onPointerCancel={() => (drawing.current = false)}
        className="relative mx-auto mt-3 aspect-square w-full max-w-[28rem] touch-none select-none overflow-hidden rounded-[20px] border-2 border-line bg-table-2 outline-none focus-visible:ring-2 focus-visible:ring-ink"
        style={{ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)` }}
      >
        {Array.from({ length: N }, (_, c) => {
          const on = path.includes(c);
          return <span key={c} className={`border-[0.5px] border-line/70 transition-colors ${on ? "bg-[color-mix(in_srgb,#0b7476_22%,transparent)]" : ""}`} aria-hidden />;
        })}

        <svg viewBox={`0 0 ${n} ${n}`} className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          {path.length > 1 && (
            <polyline points={path.map(centre).join(" ")} fill="none" stroke="#0b7476" strokeWidth={0.42} strokeLinecap="round" strokeLinejoin="round" />
          )}
          {path.length === 1 && <circle cx={(path[0] % n) + 0.5} cy={Math.floor(path[0] / n) + 0.5} r={0.21} fill="#0b7476" />}
          {dots.map((c, i) => (
            <g key={c}>
              <circle cx={(c % n) + 0.5} cy={Math.floor(c / n) + 0.5} r={0.3} className={i < reached ? "fill-[#0b7476]" : "fill-ink"} stroke="var(--table)" strokeWidth={0.05} />
              <text x={(c % n) + 0.5} y={Math.floor(c / n) + 0.5} dy="0.35em" textAnchor="middle" fontSize={0.32} fontWeight={800} className="fill-table">
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <MoveError error={error} />

      {done ? (
        <div className="mt-6 space-y-3 text-center">
          <p className="text-lg font-bold">Gelöst in {clock(result.durationMs ?? 0)}.</p>
          {v.word && (
            <p>
              Am Ende des Pfads wartet:{" "}
              <Link href={`/wort/${v.word.slug}`} className="display text-3xl hover:underline">
                {v.word.term}
              </Link>
            </p>
          )}
          <ShareButton text={share} />
        </div>
      ) : (
        <div className="mx-auto mt-4 flex max-w-[28rem] flex-wrap items-center justify-between gap-2">
          <p className="hint">Die Zeit läuft seit dem ersten Öffnen.</p>
          <span className="flex gap-2">
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => update(path.slice(0, -1))} disabled={!path.length || pending}>
              <Undo2 size={16} aria-hidden /> Zurück
            </button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => update([])} disabled={!path.length || pending}>
              <RotateCcw size={16} aria-hidden /> Neu
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
