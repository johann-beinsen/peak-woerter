// Rules of Pfad, shared by the server check and the board in the browser.

export const neighbours = (n: number, c: number) => {
  const r = Math.floor(c / n), k = c % n;
  const out: number[] = [];
  if (r > 0) out.push(c - n);
  if (r < n - 1) out.push(c + n);
  if (k > 0) out.push(c - 1);
  if (k < n - 1) out.push(c + 1);
  return out;
};

export const adjacent = (n: number, a: number, b: number) => neighbours(n, a).includes(b);

/** Checks a line against the rules (not against a stored solution). */
export function checkPath(n: number, dots: number[], path: number[]): string | null {
  if (path.length !== n * n) return "Noch nicht alle Felder sind besucht.";
  const seen = new Set<number>();
  for (const c of path) {
    if (!Number.isInteger(c) || c < 0 || c >= n * n || seen.has(c)) return "Jedes Feld nur einmal.";
    seen.add(c);
  }
  for (let i = 1; i < path.length; i++) if (!adjacent(n, path[i - 1], path[i])) return "Die Linie muss zusammenhängen.";
  if (path[0] !== dots[0] || path[path.length - 1] !== dots[dots.length - 1]) return "Die Linie läuft von der 1 bis zur letzten Zahl.";
  let next = 0;
  for (const c of path) {
    const d = dots.indexOf(c);
    if (d === -1) continue;
    if (d !== next) return "Die Zahlen der Reihe nach verbinden.";
    next++;
  }
  return null;
}
