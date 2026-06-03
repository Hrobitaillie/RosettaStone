import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { v4 as uuid } from "uuid";

export type Language = {
  id: string;
  name: string;
  flag: string | null;
  alphabet: string | null;
  translation_language: string;
  created_at: number;
};

export type Word = {
  id: string;
  language_id: string;
  original: string;
  transcription: string | null;
  translation: string;
  category: string | null;
  level: string | null;
  notes: string | null;
  is_favorite: boolean;
  created_at: number;
};

export type Conjugation = { form_name: string; form_value: string };

export type Verb = {
  id: string;
  language_id: string;
  infinitive: string;
  romanization: string | null;
  translation: string;
  notes: string | null;
  is_favorite: boolean;
  conjugations: Conjugation[];
  created_at: number;
};

export type Note = {
  id: string;
  language_id: string;
  title: string;
  category: string | null;
  content: string | null;
  examples: string | null;
  created_at: number;
};

interface RosettaDB extends DBSchema {
  languages: {
    key: string;
    value: Language;
    indexes: { "by-created": number };
  };
  words: {
    key: string;
    value: Word;
    indexes: { "by-lang": string; "by-created": number };
  };
  verbs: {
    key: string;
    value: Verb;
    indexes: { "by-lang": string; "by-created": number };
  };
  notes: {
    key: string;
    value: Note;
    indexes: { "by-lang": string; "by-created": number };
  };
}

const DB_NAME = "rosettastone";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<RosettaDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<RosettaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RosettaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("languages")) {
          const langs = db.createObjectStore("languages", { keyPath: "id" });
          langs.createIndex("by-created", "created_at");
        }
        if (!db.objectStoreNames.contains("words")) {
          const words = db.createObjectStore("words", { keyPath: "id" });
          words.createIndex("by-lang", "language_id");
          words.createIndex("by-created", "created_at");
        }
        if (!db.objectStoreNames.contains("verbs")) {
          const verbs = db.createObjectStore("verbs", { keyPath: "id" });
          verbs.createIndex("by-lang", "language_id");
          verbs.createIndex("by-created", "created_at");
        }
        if (!db.objectStoreNames.contains("notes")) {
          const notes = db.createObjectStore("notes", { keyPath: "id" });
          notes.createIndex("by-lang", "language_id");
          notes.createIndex("by-created", "created_at");
        }
      },
    });
  }
  return dbPromise;
}

export function newId(): string {
  return uuid();
}

export function now(): number {
  return Date.now();
}

/* ---------- LANGUAGES ---------- */

export async function listLanguages(): Promise<Language[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex("languages", "by-created");
  return rows;
}

export async function upsertLanguage(
  input: Partial<Language> & {
    name: string;
    flag?: string | null;
    alphabet?: string | null;
    translation_language: string;
  },
): Promise<Language> {
  const db = await getDB();
  if (input.id) {
    const existing = await db.get("languages", input.id);
    if (!existing) throw new Error("Langue introuvable");
    const updated: Language = {
      ...existing,
      name: input.name,
      flag: input.flag ?? null,
      alphabet: input.alphabet ?? null,
      translation_language: input.translation_language,
    };
    await db.put("languages", updated);
    return updated;
  }
  const created: Language = {
    id: newId(),
    name: input.name,
    flag: input.flag ?? null,
    alphabet: input.alphabet ?? null,
    translation_language: input.translation_language,
    created_at: now(),
  };
  await db.add("languages", created);
  return created;
}

export async function deleteLanguage(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["languages", "words", "verbs", "notes"], "readwrite");
  await tx.objectStore("languages").delete(id);
  for (const store of ["words", "verbs", "notes"] as const) {
    const idx = tx.objectStore(store).index("by-lang");
    let cursor = await idx.openCursor(IDBKeyRange.only(id));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  }
  await tx.done;
}

/* ---------- WORDS ---------- */

export async function listWords(languageId: string): Promise<Word[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex("words", "by-lang", languageId);
  return rows.sort((a, b) => b.created_at - a.created_at);
}

export async function findDuplicates(languageId: string, original: string): Promise<Word[]> {
  const rows = await listWords(languageId);
  const target = original.trim().toLowerCase();
  return rows.filter((w) => w.original.trim().toLowerCase() === target);
}

export async function upsertWord(
  input: Partial<Word> & {
    language_id: string;
    original: string;
    translation: string;
  },
): Promise<Word> {
  const db = await getDB();
  if (input.id) {
    const existing = await db.get("words", input.id);
    if (!existing) throw new Error("Mot introuvable");
    const updated: Word = {
      ...existing,
      original: input.original,
      transcription: input.transcription ?? null,
      translation: input.translation,
      category: input.category ?? null,
      level: input.level ?? null,
      notes: input.notes ?? null,
    };
    await db.put("words", updated);
    return updated;
  }
  const created: Word = {
    id: newId(),
    language_id: input.language_id,
    original: input.original,
    transcription: input.transcription ?? null,
    translation: input.translation,
    category: input.category ?? null,
    level: input.level ?? null,
    notes: input.notes ?? null,
    is_favorite: false,
    created_at: now(),
  };
  await db.add("words", created);
  return created;
}

export async function deleteWord(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("words", id);
}

export async function toggleWordFavorite(id: string, value: boolean): Promise<void> {
  const db = await getDB();
  const existing = await db.get("words", id);
  if (!existing) return;
  await db.put("words", { ...existing, is_favorite: value });
}

/* ---------- VERBS ---------- */

export async function listVerbs(languageId: string): Promise<Verb[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex("verbs", "by-lang", languageId);
  return rows.sort((a, b) => b.created_at - a.created_at);
}

export async function upsertVerb(
  input: Partial<Verb> & {
    language_id: string;
    infinitive: string;
    translation: string;
    conjugations?: Conjugation[];
  },
): Promise<Verb> {
  const db = await getDB();
  if (input.id) {
    const existing = await db.get("verbs", input.id);
    if (!existing) throw new Error("Verbe introuvable");
    const updated: Verb = {
      ...existing,
      infinitive: input.infinitive,
      romanization: input.romanization ?? null,
      translation: input.translation,
      notes: input.notes ?? null,
      conjugations: input.conjugations ?? [],
    };
    await db.put("verbs", updated);
    return updated;
  }
  const created: Verb = {
    id: newId(),
    language_id: input.language_id,
    infinitive: input.infinitive,
    romanization: input.romanization ?? null,
    translation: input.translation,
    notes: input.notes ?? null,
    is_favorite: false,
    conjugations: input.conjugations ?? [],
    created_at: now(),
  };
  await db.add("verbs", created);
  return created;
}

export async function deleteVerb(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("verbs", id);
}

export async function toggleVerbFavorite(id: string, value: boolean): Promise<void> {
  const db = await getDB();
  const existing = await db.get("verbs", id);
  if (!existing) return;
  await db.put("verbs", { ...existing, is_favorite: value });
}

/* ---------- NOTES ---------- */

export async function listNotes(languageId: string): Promise<Note[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex("notes", "by-lang", languageId);
  return rows.sort((a, b) => b.created_at - a.created_at);
}

export async function upsertNote(
  input: Partial<Note> & {
    language_id: string;
    title: string;
  },
): Promise<Note> {
  const db = await getDB();
  if (input.id) {
    const existing = await db.get("notes", input.id);
    if (!existing) throw new Error("Note introuvable");
    const updated: Note = {
      ...existing,
      title: input.title,
      category: input.category ?? null,
      content: input.content ?? null,
      examples: input.examples ?? null,
    };
    await db.put("notes", updated);
    return updated;
  }
  const created: Note = {
    id: newId(),
    language_id: input.language_id,
    title: input.title,
    category: input.category ?? null,
    content: input.content ?? null,
    examples: input.examples ?? null,
    created_at: now(),
  };
  await db.add("notes", created);
  return created;
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("notes", id);
}

/* ---------- STATS ---------- */

export type Stats = {
  languages: number;
  words: number;
  verbs: number;
  notes: number;
  thisWeek: number;
  recent: { id: string; original: string; translation: string }[];
};

export async function getStats(languageId?: string): Promise<Stats> {
  const db = await getDB();
  const [langs, allWords, allVerbs, allNotes] = await Promise.all([
    db.getAll("languages"),
    db.getAll("words"),
    db.getAll("verbs"),
    db.getAll("notes"),
  ]);
  const filterByLang = <T extends { language_id: string }>(rows: T[]) =>
    languageId ? rows.filter((r) => r.language_id === languageId) : rows;

  const words = filterByLang(allWords);
  const verbs = filterByLang(allVerbs);
  const notes = filterByLang(allNotes);

  const weekAgo = Date.now() - 7 * 86400000;
  const thisWeek = words.filter((w) => w.created_at >= weekAgo).length;
  const recent = [...words]
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, 5)
    .map((w) => ({ id: w.id, original: w.original, translation: w.translation }));

  return {
    languages: langs.length,
    words: words.length,
    verbs: verbs.length,
    notes: notes.length,
    thisWeek,
    recent,
  };
}

/* ---------- EXPORT / IMPORT ---------- */

export async function exportAll(): Promise<string> {
  const db = await getDB();
  const [languages, words, verbs, notes] = await Promise.all([
    db.getAll("languages"),
    db.getAll("words"),
    db.getAll("verbs"),
    db.getAll("notes"),
  ]);
  return JSON.stringify(
    {
      version: 1,
      exported_at: new Date().toISOString(),
      languages,
      words,
      verbs,
      notes,
    },
    null,
    2,
  );
}

export async function importAll(json: string, mode: "merge" | "replace" = "merge"): Promise<void> {
  const data = JSON.parse(json);
  const db = await getDB();
  const tx = db.transaction(["languages", "words", "verbs", "notes"], "readwrite");
  if (mode === "replace") {
    await Promise.all([
      tx.objectStore("languages").clear(),
      tx.objectStore("words").clear(),
      tx.objectStore("verbs").clear(),
      tx.objectStore("notes").clear(),
    ]);
  }
  for (const l of data.languages ?? []) await tx.objectStore("languages").put(l);
  for (const w of data.words ?? []) await tx.objectStore("words").put(w);
  for (const v of data.verbs ?? []) await tx.objectStore("verbs").put(v);
  for (const n of data.notes ?? []) await tx.objectStore("notes").put(n);
  await tx.done;
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["languages", "words", "verbs", "notes"], "readwrite");
  await Promise.all([
    tx.objectStore("languages").clear(),
    tx.objectStore("words").clear(),
    tx.objectStore("verbs").clear(),
    tx.objectStore("notes").clear(),
  ]);
  await tx.done;
}
