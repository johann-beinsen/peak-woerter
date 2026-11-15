import { beforeEach, describe, expect, it } from "vitest";
import { db, setup } from "./helpers";
import { castVote } from "@/lib/voting";
import { findDuplicate, submitWord } from "@/lib/words";
import { guessPartOfSpeech, isPhrase, normalizeTerm, slugify } from "@/lib/text";
import { listPublicWords } from "@/lib/queries";
import { toCard } from "@/lib/cards";

let u: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  u = await setup();
});

async function accept(term: string) {
  const w = await submitWord(db, { term, userId: u.a });
  await castVote(db, { wordId: w.id, userId: u.a, value: "YES" });
  await castVote(db, { wordId: w.id, userId: u.b, value: "YES" });
  return w;
}

describe("Sprichwörter", () => {
  it("Satzzeichen im Inneren ändern die Normalisierung nicht", () => {
    const a = normalizeTerm("Wer zuletzt lacht, lacht am besten.");
    expect(a).toBe("wer zuletzt lacht lacht am besten");
    expect(normalizeTerm("Wer zuletzt lacht – lacht am besten")).toBe(a);
    expect(normalizeTerm("Wer zuletzt lacht;lacht am besten!")).toBe(a);
    expect(normalizeTerm("Wer zuletzt lacht - lacht am besten")).toBe(a);
    expect(normalizeTerm("E-Mail")).toBe("e-mail");
  });

  it("lange Slugs werden an einer Wortgrenze gekürzt", () => {
    const s = slugify("Wer zuletzt lacht, lacht am besten, aber nur wenn er auch wirklich bis zum Ende durchhält");
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s).not.toMatch(/-$/);
    expect(s.startsWith("wer-zuletzt-lacht-lacht-am-besten")).toBe(true);
    expect(slugify("Mumpitz")).toBe("mumpitz");
  });

  it("erkennt Sprüche an Art oder Leerzeichen", () => {
    expect(isPhrase({ term: "Mumpitz", partOfSpeech: null })).toBe(false);
    expect(isPhrase({ term: "Hals über Kopf", partOfSpeech: null })).toBe(true);
    expect(isPhrase({ term: "Hals über Kopf", partOfSpeech: "ADVERB" })).toBe(false);
    expect(isPhrase({ term: "Quatsch", partOfSpeech: "SPRICHWORT" })).toBe(true);
    expect(guessPartOfSpeech("Mumpitz")).toBeNull();
    expect(guessPartOfSpeech("Hals über Kopf")).toBe("REDEWENDUNG");
    expect(guessPartOfSpeech("Wer zuletzt lacht, lacht am besten")).toBe("SPRICHWORT");
  });

  it("eine Dublette mit anderem Komma wird erkannt; neue Sprüche bekommen eine Art", async () => {
    const w = await submitWord(db, { term: "Wer zuletzt lacht, lacht am besten", userId: u.a });
    expect((await db.word.findUniqueOrThrow({ where: { id: w.id } })).partOfSpeech).toBe("SPRICHWORT");
    const d = await findDuplicate(db, "wer zuletzt lacht lacht am besten");
    expect(d.kind).toBe("word");
    await expect(submitWord(db, { term: "Wer zuletzt lacht – lacht am besten", userId: u.b })).rejects.toThrow();
  });

  it("Suche: alle Wörter in beliebiger Reihenfolge, Art-Filter", async () => {
    await accept("jemandem einen Bären aufbinden");
    await accept("Mumpitz");
    const find = async (q: string, art?: "wort" | "spruch") => (await listPublicWords(db, { q, sort: "az", art })).map((w) => w.term);
    expect(await find("bären aufbinden")).toEqual(["jemandem einen Bären aufbinden"]);
    expect(await find("aufbinden, bären")).toEqual(["jemandem einen Bären aufbinden"]);
    expect(await find("bären mumpitz")).toEqual([]);
    expect((await listPublicWords(db, { sort: "az", art: "spruch" })).map((w) => w.term)).toEqual(["jemandem einen Bären aufbinden"]);
    expect((await listPublicWords(db, { sort: "az", art: "wort" })).map((w) => w.term)).toEqual(["Mumpitz"]);
  });

  it("Karte zeigt bei Sprüchen die Wortzahl statt der Buchstaben", () => {
    expect(toCard({ term: "Hals über Kopf" }).values?.[0]).toEqual(["Wörter", 3]);
    expect(toCard({ term: "Mumpitz" }).values?.[0]).toEqual(["Buchstaben", 7]);
  });
});
