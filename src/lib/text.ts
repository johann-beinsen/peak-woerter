// Normalisation used for duplicate detection: case, whitespace, quotes and
// invisible characters must not create a "new" word.
export function normalizeTerm(input: string): string {
  return input
    .normalize("NFC")
    .replace(/[­​-‍﻿]/g, "") // soft hyphen, zero-width
    .replace(/[„“”"‚‘’'«»]/g, "")
    .replace(/\s[-‐‑]+\s/g, " ") // a spaced hyphen is a dash
    .replace(/[,;:–—…]+/g, " ") // inner punctuation must not make two spellings of a saying differ
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "")
    .toLocaleLowerCase("de-DE");
}

// Display form: trimmed, single spaces, no surrounding quotes.
export function cleanTerm(input: string): string {
  return input.normalize("NFC").replace(/[­​-‍﻿]/g, "").replace(/\s+/g, " ").trim().replace(/^[„“”"‚‘’'«»]+|[„“”"‚‘’'«»]+$/g, "");
}

export function slugify(input: string): string {
  const s = normalizeTerm(input)
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= 60) return s || "wort";
  const cut = s.slice(0, 60);
  const at = cut.lastIndexOf("-");
  return at > 20 ? cut.slice(0, at) : cut;
}

export const MAX_TERM = 200;

/** Sayings and idioms: explicitly typed, or (fallback) more than one word. */
export function isPhrase(w: { term: string; partOfSpeech?: string | null }): boolean {
  if (w.partOfSpeech === "REDEWENDUNG" || w.partOfSpeech === "SPRICHWORT") return true;
  if (w.partOfSpeech) return false;
  return /\s/.test(w.term.trim());
}

/** Guess a type for a new entry: a long or punctuated multi-word entry is a saying. */
export function guessPartOfSpeech(term: string): "SPRICHWORT" | "REDEWENDUNG" | null {
  const words = term.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  return words.length >= 4 || /[,;:!?]/.test(term) ? "SPRICHWORT" : "REDEWENDUNG";
}

/** Viewport-relative headline size from the longest word and the total length (sayings wrap). */
export function headlineSize(term: string, maxRem = 4.75, minRem = 1.9): string {
  const longest = Math.max(1, ...term.split(/\s+/).map((x) => [...x].length));
  const total = Math.max(1, [...term].length);
  const vw = Math.min(10, 150 / longest, 55 / Math.sqrt(total));
  return `clamp(${minRem}rem, ${vw.toFixed(1)}vw, ${maxRem}rem)`;
}

// IPA is stored without brackets; strip what people paste.
export function cleanIpa(input: string): string {
  return input.normalize("NFC").trim().replace(/^[\[/]+|[\]/]+$/g, "").trim();
}

/** Lowercase a–z spelling for letter games: ä → ae, ß → ss. Other characters stay. */
export function foldLetters(input: string): string {
  return input.normalize("NFC").toLocaleLowerCase("de-DE").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
}

export function letterCount(term: string): number {
  return [...term.normalize("NFC")].filter((c) => /\p{L}/u.test(c)).length;
}
