import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { v4 as uuid } from "uuid";

/* ============================================================
 * Types
 * ========================================================== */

export type Level = "débutant" | "intermédiaire" | "avancé";
export type AccentColor = "lime" | "pink" | "mint" | "lavender" | "peach";
export type ThemeMode = "dark" | "light";

export type Language = {
  id: string;
  name: string;
  /** Short glyph shown in the round avatar (e.g. "한", "あ", "A"). */
  icon: string;
  /** Legacy flag emoji — kept for backwards-compat / fallback. */
  flag: string | null;
  alphabet: string | null;
  translation_language: string;
  level: Level;
  created_at: number;
};

/** Spaced-repetition state embedded on reviewable items. */
export type Srs = {
  reps: number; // consecutive successes (resets to 0 on a lapse)
  reviews: number; // total reviews
  success: number; // total correct answers
  ease: number; // SM-2 ease factor
  interval: number; // current interval in days
  due: number | null; // timestamp of next review; null = never reviewed (new)
  last_reviewed: number | null;
};

export type WordExample = { original: string; translation: string };

/** An additional sense for homonyms / multi-meaning words ("2 sens"). */
export type WordMeaning = {
  translation: string;
  category: string | null;
  example_original: string | null;
  example_translation: string | null;
  note: string | null;
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
  /** Extra senses beyond `translation` (homonyms / multiple meanings). */
  meanings: WordMeaning[];
  examples: WordExample[];
  /** Related word strings (originals), resolved lazily by the UI. */
  related: string[];
  is_favorite: boolean;
  srs: Srs;
  created_at: number;
};

export type Conjugation = { form_name: string; form_value: string; romanization?: string | null };

export type Verb = {
  id: string;
  language_id: string;
  infinitive: string;
  romanization: string | null;
  translation: string;
  is_irregular: boolean;
  notes: string | null;
  is_favorite: boolean;
  conjugations: Conjugation[];
  srs: Srs;
  created_at: number;
};

export type Note = {
  id: string;
  language_id: string;
  title: string;
  category: string | null;
  content: string | null; // markdown
  examples: string | null;
  created_at: number;
  updated_at: number;
};

export type ExerciseType =
  | "apprentissage"
  | "flashcards"
  | "traduction"
  | "qcm"
  | "conjugaison"
  | "romanisation"
  | "mix"
  | "review";

export type SessionMistake = { id: string; original: string; translation: string };

export type Session = {
  id: string;
  language_id: string;
  type: ExerciseType;
  total: number;
  correct: number;
  xp: number;
  mistakes: SessionMistake[];
  created_at: number;
};

export type Settings = {
  profile_name: string;
  theme: ThemeMode;
  accent: AccentColor;
  cards_per_day: number;
  daily_reminder: boolean;
};

export type Profile = {
  xp: number;
  streak: number;
  last_active: string | null; // "YYYY-MM-DD"
  activity: Record<string, number>; // "YYYY-MM-DD" -> activity count
};

export type PerLanguageSettings = {
  show_romanization: boolean;
  hide_translation_in_review: boolean;
  auto_audio: boolean;
};

/* ============================================================
 * Schema
 * ========================================================== */

interface RosettaDB extends DBSchema {
  languages: { key: string; value: Language; indexes: { "by-created": number } };
  words: { key: string; value: Word; indexes: { "by-lang": string; "by-created": number } };
  verbs: { key: string; value: Verb; indexes: { "by-lang": string; "by-created": number } };
  notes: { key: string; value: Note; indexes: { "by-lang": string; "by-created": number } };
  sessions: { key: string; value: Session; indexes: { "by-lang": string; "by-created": number } };
  meta: { key: string; value: unknown };
}

const DB_NAME = "rosettastone";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<RosettaDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<RosettaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RosettaDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
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
        // v2 additions
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains("sessions")) {
            const sessions = db.createObjectStore("sessions", { keyPath: "id" });
            sessions.createIndex("by-lang", "language_id");
            sessions.createIndex("by-created", "created_at");
          }
          if (!db.objectStoreNames.contains("meta")) {
            db.createObjectStore("meta");
          }
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

const DAY = 86400000;

export function dayKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function freshSrs(): Srs {
  return { reps: 0, reviews: 0, success: 0, ease: 2.5, interval: 0, due: null, last_reviewed: null };
}

/* ============================================================
 * Normalisation (fill defaults for rows created in older versions)
 * ========================================================== */

function normSrs(s: Partial<Srs> | undefined): Srs {
  if (!s) return freshSrs();
  return {
    reps: s.reps ?? 0,
    reviews: s.reviews ?? 0,
    success: s.success ?? 0,
    ease: s.ease ?? 2.5,
    interval: s.interval ?? 0,
    due: s.due ?? null,
    last_reviewed: s.last_reviewed ?? null,
  };
}

function normLanguage(l: Language): Language {
  return {
    ...l,
    icon: l.icon || l.flag || (l.name ? l.name.slice(0, 1).toUpperCase() : "🌐"),
    flag: l.flag ?? null,
    alphabet: l.alphabet ?? null,
    level: (l.level as Level) ?? "débutant",
  };
}

function normWord(w: Word): Word {
  return {
    ...w,
    transcription: w.transcription ?? null,
    category: w.category ?? null,
    level: w.level ?? null,
    notes: w.notes ?? null,
    meanings: w.meanings ?? [],
    examples: w.examples ?? [],
    related: w.related ?? [],
    is_favorite: !!w.is_favorite,
    srs: normSrs(w.srs),
  };
}

function normVerb(v: Verb): Verb {
  return {
    ...v,
    romanization: v.romanization ?? null,
    is_irregular: !!v.is_irregular,
    notes: v.notes ?? null,
    is_favorite: !!v.is_favorite,
    conjugations: v.conjugations ?? [],
    srs: normSrs(v.srs),
  };
}

function normNote(n: Note): Note {
  return {
    ...n,
    category: n.category ?? null,
    content: n.content ?? null,
    examples: n.examples ?? null,
    updated_at: n.updated_at ?? n.created_at,
  };
}

/* ============================================================
 * LANGUAGES
 * ========================================================== */

export async function listLanguages(): Promise<Language[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex("languages", "by-created");
  return rows.map(normLanguage);
}

export async function getLanguage(id: string): Promise<Language | null> {
  const db = await getDB();
  const l = await db.get("languages", id);
  return l ? normLanguage(l) : null;
}

export async function upsertLanguage(
  input: Partial<Language> & { name: string; translation_language: string },
): Promise<Language> {
  const db = await getDB();
  if (input.id) {
    const existing = await db.get("languages", input.id);
    if (!existing) throw new Error("Langue introuvable");
    const updated: Language = normLanguage({
      ...existing,
      name: input.name,
      icon: input.icon ?? existing.icon,
      flag: input.flag ?? existing.flag ?? null,
      alphabet: input.alphabet ?? null,
      translation_language: input.translation_language,
      level: (input.level as Level) ?? existing.level ?? "débutant",
    });
    await db.put("languages", updated);
    return updated;
  }
  const created: Language = {
    id: newId(),
    name: input.name,
    icon: input.icon || (input.name ? input.name.slice(0, 1).toUpperCase() : "🌐"),
    flag: input.flag ?? null,
    alphabet: input.alphabet ?? null,
    translation_language: input.translation_language,
    level: (input.level as Level) ?? "débutant",
    created_at: now(),
  };
  await db.add("languages", created);
  return created;
}

export async function deleteLanguage(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["languages", "words", "verbs", "notes", "sessions"], "readwrite");
  await tx.objectStore("languages").delete(id);
  for (const store of ["words", "verbs", "notes", "sessions"] as const) {
    const idx = tx.objectStore(store).index("by-lang");
    let cursor = await idx.openCursor(IDBKeyRange.only(id));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  }
  await tx.done;
}

export type LanguageProgress = {
  words: number;
  verbs: number;
  notes: number;
  mastered: number;
  percent: number;
};

export async function getLanguageProgress(id: string): Promise<LanguageProgress> {
  const db = await getDB();
  const [words, verbs, notes] = await Promise.all([
    db.getAllFromIndex("words", "by-lang", id),
    db.getAllFromIndex("verbs", "by-lang", id),
    db.getAllFromIndex("notes", "by-lang", id),
  ]);
  const normed = words.map(normWord);
  const mastered = normed.filter((w) => masteryOf(w) === "mastered" || masteryOf(w) === "mature").length;
  const percent = normed.length ? Math.round((mastered / normed.length) * 100) : 0;
  return { words: normed.length, verbs: verbs.length, notes: notes.length, mastered, percent };
}

/* ============================================================
 * WORDS
 * ========================================================== */

export async function listWords(languageId: string): Promise<Word[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex("words", "by-lang", languageId);
  return rows.map(normWord).sort((a, b) => b.created_at - a.created_at);
}

export async function getWord(id: string): Promise<Word | null> {
  const db = await getDB();
  const w = await db.get("words", id);
  return w ? normWord(w) : null;
}

export async function searchWords(languageId: string, q: string): Promise<Word[]> {
  const rows = await listWords(languageId);
  const term = q.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((w) =>
    [w.original, w.transcription, w.translation, w.category, w.notes, ...w.meanings.map((m) => m.translation)]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(term)),
  );
}

export async function findDuplicates(languageId: string, original: string): Promise<Word[]> {
  const rows = await listWords(languageId);
  const target = original.trim().toLowerCase();
  if (!target) return [];
  return rows.filter((w) => w.original.trim().toLowerCase() === target);
}

export async function findWordByOriginal(languageId: string, original: string): Promise<Word | null> {
  const rows = await findDuplicates(languageId, original);
  return rows[0] ?? null;
}

export type WordInput = Partial<Word> & {
  language_id: string;
  original: string;
  translation: string;
};

export async function upsertWord(input: WordInput): Promise<Word> {
  const db = await getDB();
  if (input.id) {
    const existing = await db.get("words", input.id);
    if (!existing) throw new Error("Mot introuvable");
    const updated: Word = normWord({
      ...existing,
      original: input.original,
      transcription: input.transcription ?? null,
      translation: input.translation,
      category: input.category ?? null,
      level: input.level ?? null,
      notes: input.notes ?? null,
      meanings: input.meanings ?? existing.meanings ?? [],
      examples: input.examples ?? existing.examples ?? [],
      related: input.related ?? existing.related ?? [],
    });
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
    meanings: input.meanings ?? [],
    examples: input.examples ?? [],
    related: input.related ?? [],
    is_favorite: false,
    srs: freshSrs(),
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

/* ============================================================
 * VERBS
 * ========================================================== */

export async function listVerbs(languageId: string): Promise<Verb[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex("verbs", "by-lang", languageId);
  return rows.map(normVerb).sort((a, b) => b.created_at - a.created_at);
}

export async function getVerb(id: string): Promise<Verb | null> {
  const db = await getDB();
  const v = await db.get("verbs", id);
  return v ? normVerb(v) : null;
}

export type VerbInput = Partial<Verb> & {
  language_id: string;
  infinitive: string;
  translation: string;
};

export async function upsertVerb(input: VerbInput): Promise<Verb> {
  const db = await getDB();
  if (input.id) {
    const existing = await db.get("verbs", input.id);
    if (!existing) throw new Error("Verbe introuvable");
    const updated: Verb = normVerb({
      ...existing,
      infinitive: input.infinitive,
      romanization: input.romanization ?? null,
      translation: input.translation,
      is_irregular: input.is_irregular ?? existing.is_irregular ?? false,
      notes: input.notes ?? null,
      conjugations: input.conjugations ?? existing.conjugations ?? [],
    });
    await db.put("verbs", updated);
    return updated;
  }
  const created: Verb = {
    id: newId(),
    language_id: input.language_id,
    infinitive: input.infinitive,
    romanization: input.romanization ?? null,
    translation: input.translation,
    is_irregular: input.is_irregular ?? false,
    notes: input.notes ?? null,
    is_favorite: false,
    conjugations: input.conjugations ?? [],
    srs: freshSrs(),
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

/* ============================================================
 * NOTES
 * ========================================================== */

export async function listNotes(languageId: string): Promise<Note[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex("notes", "by-lang", languageId);
  return rows.map(normNote).sort((a, b) => b.created_at - a.created_at);
}

export async function getNote(id: string): Promise<Note | null> {
  const db = await getDB();
  const n = await db.get("notes", id);
  return n ? normNote(n) : null;
}

export type NoteInput = Partial<Note> & { language_id: string; title: string };

export async function upsertNote(input: NoteInput): Promise<Note> {
  const db = await getDB();
  if (input.id) {
    const existing = await db.get("notes", input.id);
    if (!existing) throw new Error("Note introuvable");
    const updated: Note = normNote({
      ...existing,
      title: input.title,
      category: input.category ?? null,
      content: input.content ?? null,
      examples: input.examples ?? null,
      updated_at: now(),
    });
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
    updated_at: now(),
  };
  await db.add("notes", created);
  return created;
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("notes", id);
}

/* ============================================================
 * SPACED REPETITION
 * ========================================================== */

export type Mastery = "new" | "learning" | "mature" | "mastered";

export function masteryOf(item: { srs: Srs }): Mastery {
  const { srs } = item;
  if (!srs.reviews) return "new";
  if (srs.interval >= 30 && srs.reps >= 4) return "mastered";
  if (srs.interval >= 14) return "mature";
  return "learning";
}

export function successRate(item: { srs: Srs }): number {
  if (!item.srs.reviews) return 0;
  return Math.round((item.srs.success / item.srs.reviews) * 100);
}

/** SM-2-ish update. `correct` true = remembered, false = lapse. */
export function nextSrs(srs: Srs, correct: boolean): Srs {
  const ts = Date.now();
  const reviews = srs.reviews + 1;
  const success = srs.success + (correct ? 1 : 0);
  let { ease, interval, reps } = srs;
  if (correct) {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 3;
    else interval = Math.round(interval * ease);
    ease = Math.min(2.8, ease + 0.1);
  } else {
    reps = 0;
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
  }
  return {
    reps,
    reviews,
    success,
    ease,
    interval,
    due: ts + interval * DAY,
    last_reviewed: ts,
  };
}

export async function gradeWord(id: string, correct: boolean): Promise<Word> {
  const db = await getDB();
  const existing = await db.get("words", id);
  if (!existing) throw new Error("Mot introuvable");
  const updated = normWord({ ...existing, srs: nextSrs(normSrs(existing.srs), correct) });
  await db.put("words", updated);
  await recordActivity(1);
  return updated;
}

export async function gradeVerb(id: string, correct: boolean): Promise<Verb> {
  const db = await getDB();
  const existing = await db.get("verbs", id);
  if (!existing) throw new Error("Verbe introuvable");
  const updated = normVerb({ ...existing, srs: nextSrs(normSrs(existing.srs), correct) });
  await db.put("verbs", updated);
  await recordActivity(1);
  return updated;
}

export type DueBuckets = { new: Word[]; learning: Word[]; due: Word[]; all: Word[]; total: number };

/** Words that are due today, bucketed for the Révision screen. */
export async function getDueCards(languageId: string): Promise<DueBuckets> {
  const words = await listWords(languageId);
  const ts = Date.now();
  const isNew: Word[] = [];
  const learning: Word[] = [];
  const due: Word[] = [];
  for (const w of words) {
    if (!w.srs.reviews) isNew.push(w);
    else if (w.srs.due != null && w.srs.due <= ts) {
      if (masteryOf(w) === "learning") learning.push(w);
      else due.push(w);
    }
  }
  const all = [...isNew, ...learning, ...due];
  return { new: isNew, learning, due, all, total: all.length };
}

export async function getMasteryCounts(
  languageId: string,
): Promise<{ new: number; learning: number; mature: number; mastered: number }> {
  const words = await listWords(languageId);
  const counts = { new: 0, learning: 0, mature: 0, mastered: 0 };
  for (const w of words) counts[masteryOf(w)]++;
  return counts;
}

/**
 * Ordered review queue: due/lapsed words first (most fragile first),
 * then new words, capped at `limit`.
 */
export async function buildReviewQueue(languageId: string, limit = 20): Promise<Word[]> {
  const { new: isNew, learning, due } = await getDueCards(languageId);
  const fragileFirst = [...learning, ...due].sort((a, b) => successRate(a) - successRate(b));
  return [...fragileFirst, ...isNew].slice(0, limit);
}

/* ============================================================
 * EXERCISES — question builders
 * ========================================================== */

export type ExerciseDirection = "original->translation" | "translation->original" | "romanization->translation";

export type Flashcard = { word: Word; front: string; back: string };
export type TranslationQuestion = {
  word: Word;
  prompt: string;
  answer: string;
  direction: ExerciseDirection;
};
export type QcmQuestion = { word: Word; prompt: string; choices: string[]; answerIndex: number };
export type ConjugationQuestion = {
  verb: Verb;
  form_name: string;
  prompt: string;
  answer: string;
  romanization: string | null;
};
export type RomanisationQuestion = { word: Word; prompt: string; answer: string };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick the pool used by an exercise: prioritises fragile/due words, falls back to all. */
async function exercisePool(languageId: string, limit: number): Promise<Word[]> {
  const words = await listWords(languageId);
  if (!words.length) return [];
  const ranked = [...words].sort((a, b) => {
    const ar = a.srs.reviews ? successRate(a) : 50;
    const br = b.srs.reviews ? successRate(b) : 50;
    return ar - br;
  });
  return shuffle(ranked.slice(0, Math.max(limit, Math.min(words.length, limit * 2)))).slice(0, limit);
}

export async function buildFlashcards(
  languageId: string,
  limit = 20,
  direction: ExerciseDirection = "original->translation",
): Promise<Flashcard[]> {
  const pool = await exercisePool(languageId, limit);
  return pool.map((word) => ({
    word,
    front: direction === "translation->original" ? word.translation : word.original,
    back: direction === "translation->original" ? word.original : word.translation,
  }));
}

export async function buildTranslation(
  languageId: string,
  limit = 12,
  direction: ExerciseDirection = "original->translation",
): Promise<TranslationQuestion[]> {
  const pool = await exercisePool(languageId, limit);
  return pool.map((word) => ({
    word,
    prompt: direction === "translation->original" ? word.translation : word.original,
    answer: direction === "translation->original" ? word.original : word.translation,
    direction,
  }));
}

export async function buildQcm(languageId: string, limit = 10): Promise<QcmQuestion[]> {
  const all = await listWords(languageId);
  const pool = await exercisePool(languageId, limit);
  return pool.map((word) => {
    const sameCat = all.filter((w) => w.id !== word.id && w.category === word.category && w.translation);
    const others = all.filter((w) => w.id !== word.id && w.translation !== word.translation);
    const distractPool = (sameCat.length >= 3 ? sameCat : others);
    const distractors = shuffle(distractPool)
      .map((w) => w.translation)
      .filter((t, i, a) => a.indexOf(t) === i && t !== word.translation)
      .slice(0, 3);
    const choices = shuffle([word.translation, ...distractors]);
    return { word, prompt: word.original, choices, answerIndex: choices.indexOf(word.translation) };
  });
}

export async function buildConjugation(languageId: string, limit = 10): Promise<ConjugationQuestion[]> {
  const verbs = await listVerbs(languageId);
  const withForms = verbs.filter((v) => v.conjugations.some((c) => c.form_value.trim()));
  const out: ConjugationQuestion[] = [];
  for (const verb of shuffle(withForms)) {
    const forms = verb.conjugations.filter((c) => c.form_value.trim());
    const form = forms[Math.floor(Math.random() * forms.length)];
    out.push({
      verb,
      form_name: form.form_name,
      prompt: `${verb.infinitive} · ${form.form_name}`,
      answer: form.form_value,
      romanization: form.romanization ?? null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function buildRomanisation(languageId: string, limit = 10): Promise<RomanisationQuestion[]> {
  const pool = (await exercisePool(languageId, limit * 2)).filter((w) => w.transcription);
  return pool.slice(0, limit).map((word) => ({
    word,
    prompt: word.transcription as string,
    answer: word.translation,
  }));
}

/** Lenient answer comparison for typed exercises. */
export function answersMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[.,!?;:'"()]/g, "")
      .replace(/\s+/g, " ");
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  // Accept any comma/slash-separated alternative ("élève, étudiant")
  const parts = nb.split(/[,/]/).map((p) => p.trim());
  return parts.includes(na);
}

/* ============================================================
 * SESSIONS / STATS / PROFILE
 * ========================================================== */

const META_SETTINGS = "settings";
const META_PROFILE = "profile";
const META_LANG_PREFIX = "langsettings:";

const DEFAULT_SETTINGS: Settings = {
  profile_name: "Apprenant",
  theme: "dark",
  accent: "lime",
  cards_per_day: 20,
  daily_reminder: true,
};

const DEFAULT_PROFILE: Profile = { xp: 0, streak: 0, last_active: null, activity: {} };

const DEFAULT_LANG_SETTINGS: PerLanguageSettings = {
  show_romanization: true,
  hide_translation_in_review: false,
  auto_audio: false,
};

export async function getSettings(): Promise<Settings> {
  const db = await getDB();
  const s = (await db.get("meta", META_SETTINGS)) as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const db = await getDB();
  const next = { ...(await getSettings()), ...patch };
  await db.put("meta", next, META_SETTINGS);
  return next;
}

export async function getProfile(): Promise<Profile> {
  const db = await getDB();
  const p = (await db.get("meta", META_PROFILE)) as Partial<Profile> | undefined;
  return { ...DEFAULT_PROFILE, ...(p ?? {}), activity: p?.activity ?? {} };
}

async function putProfile(p: Profile): Promise<void> {
  const db = await getDB();
  await db.put("meta", p, META_PROFILE);
}

/** Records today's activity, maintaining the daily streak. */
export async function recordActivity(count = 1): Promise<Profile> {
  const profile = await getProfile();
  const today = dayKey();
  const yesterday = dayKey(Date.now() - DAY);
  let streak = profile.streak;
  if (profile.last_active !== today) {
    streak = profile.last_active === yesterday ? profile.streak + 1 : 1;
  }
  if (streak === 0) streak = 1;
  const activity = { ...profile.activity, [today]: (profile.activity[today] ?? 0) + count };
  const next: Profile = { ...profile, streak, last_active: today, activity };
  await putProfile(next);
  return next;
}

export async function addXp(amount: number): Promise<Profile> {
  const profile = await getProfile();
  const next = { ...profile, xp: profile.xp + amount };
  await putProfile(next);
  return next;
}

export async function getLangSettings(languageId: string): Promise<PerLanguageSettings> {
  const db = await getDB();
  const s = (await db.get("meta", META_LANG_PREFIX + languageId)) as
    | Partial<PerLanguageSettings>
    | undefined;
  return { ...DEFAULT_LANG_SETTINGS, ...(s ?? {}) };
}

export async function updateLangSettings(
  languageId: string,
  patch: Partial<PerLanguageSettings>,
): Promise<PerLanguageSettings> {
  const db = await getDB();
  const next = { ...(await getLangSettings(languageId)), ...patch };
  await db.put("meta", next, META_LANG_PREFIX + languageId);
  return next;
}

export async function addSession(
  input: Omit<Session, "id" | "created_at">,
): Promise<Session> {
  const db = await getDB();
  const session: Session = { ...input, id: newId(), created_at: now() };
  await db.add("sessions", session);
  await addXp(session.xp);
  await recordActivity(Math.max(1, session.total));
  return session;
}

export async function listSessions(languageId?: string): Promise<Session[]> {
  const db = await getDB();
  const rows = languageId
    ? await db.getAllFromIndex("sessions", "by-lang", languageId)
    : await db.getAll("sessions");
  return rows.sort((a, b) => b.created_at - a.created_at);
}

/* ---------- Dashboard ---------- */

export type WeeklyBar = { label: string; key: string; count: number };

export async function getWeeklyActivity(languageId?: string): Promise<WeeklyBar[]> {
  const db = await getDB();
  const all = (await db.getAll("words")).map(normWord);
  const words = languageId ? all.filter((w) => w.language_id === languageId) : all;
  const labels = ["L", "M", "M", "J", "V", "S", "D"];
  // Monday-first index
  const out: WeeklyBar[] = [];
  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - dow);
  for (let i = 0; i < 7; i++) {
    const start = monday.getTime() + i * DAY;
    const end = start + DAY;
    const count = words.filter((w) => w.created_at >= start && w.created_at < end).length;
    out.push({ label: labels[i], key: dayKey(start), count });
  }
  return out;
}

export type DashboardData = {
  profile: Profile;
  language: Language | null;
  dueCount: number;
  words: number;
  verbs: number;
  notes: number;
  weekly: WeeklyBar[];
  weeklyTotal: number;
  recent: Word[];
};

export async function getDashboard(languageId?: string): Promise<DashboardData> {
  const db = await getDB();
  const [profile, language] = await Promise.all([
    getProfile(),
    languageId ? getLanguage(languageId) : Promise.resolve(null),
  ]);
  const [allWords, allVerbs, allNotes] = await Promise.all([
    db.getAll("words"),
    db.getAll("verbs"),
    db.getAll("notes"),
  ]);
  const byLang = <T extends { language_id: string }>(rows: T[]) =>
    languageId ? rows.filter((r) => r.language_id === languageId) : rows;
  const words = byLang(allWords).map(normWord);
  const verbs = byLang(allVerbs);
  const notes = byLang(allNotes);
  const weekly = await getWeeklyActivity(languageId);
  const dueCount = languageId ? (await getDueCards(languageId)).total : 0;
  const recent = [...words].sort((a, b) => b.created_at - a.created_at).slice(0, 5);
  return {
    profile,
    language,
    dueCount,
    words: words.length,
    verbs: verbs.length,
    notes: notes.length,
    weekly,
    weeklyTotal: weekly.reduce((s, d) => s + d.count, 0),
    recent,
  };
}

/* ---------- Statistics ---------- */

export type CategoryStat = { key: string; label: string; count: number };

export type Stats = {
  languages: number;
  words: number;
  verbs: number;
  notes: number;
  thisWeek: number;
  thisMonth: number;
  reviews: number;
  successRate: number;
  byCategory: CategoryStat[];
  streak: number;
  /** Activity counts for the last 28 days, oldest first. */
  activity: number[];
  recent: { id: string; original: string; translation: string }[];
};

function categoryKey(raw: string | null): string {
  const c = (raw ?? "").toLowerCase();
  if (!c) return "autres";
  if (c.startsWith("nom")) return "noms";
  if (c.startsWith("verb")) return "verbes";
  if (c.startsWith("adj")) return "adjectifs";
  if (c.startsWith("expr") || c.startsWith("loc")) return "expressions";
  return "autres";
}

const CATEGORY_LABELS: Record<string, string> = {
  noms: "Noms",
  verbes: "Verbes",
  adjectifs: "Adjectifs",
  expressions: "Expressions",
  autres: "Autres",
};

export async function getStats(languageId?: string): Promise<Stats> {
  const db = await getDB();
  const [langs, allWords, allVerbs, allNotes, profile] = await Promise.all([
    db.getAll("languages"),
    db.getAll("words"),
    db.getAll("verbs"),
    db.getAll("notes"),
    getProfile(),
  ]);
  const byLang = <T extends { language_id: string }>(rows: T[]) =>
    languageId ? rows.filter((r) => r.language_id === languageId) : rows;

  const words = byLang(allWords).map(normWord);
  const verbs = byLang(allVerbs).map(normVerb);
  const notes = byLang(allNotes);

  const weekAgo = Date.now() - 7 * DAY;
  const monthAgo = Date.now() - 30 * DAY;
  const thisWeek = words.filter((w) => w.created_at >= weekAgo).length;
  const thisMonth = words.filter((w) => w.created_at >= monthAgo).length;

  let reviews = 0;
  let success = 0;
  for (const w of words) {
    reviews += w.srs.reviews;
    success += w.srs.success;
  }
  for (const v of verbs) {
    reviews += v.srs.reviews;
    success += v.srs.success;
  }
  const successRateValue = reviews ? Math.round((success / reviews) * 100) : 0;

  // Category breakdown — verbs counted under "verbes".
  const counts: Record<string, number> = { noms: 0, verbes: 0, adjectifs: 0, expressions: 0, autres: 0 };
  for (const w of words) counts[categoryKey(w.category)]++;
  counts.verbes += verbs.length;
  const order = ["noms", "verbes", "adjectifs", "expressions", "autres"];
  const byCategory: CategoryStat[] = order
    .filter((k) => counts[k] > 0 || k !== "autres")
    .map((k) => ({ key: k, label: CATEGORY_LABELS[k], count: counts[k] }))
    .filter((c) => c.count > 0 || ["noms", "verbes", "adjectifs", "expressions"].includes(c.key));

  // 28-day activity from profile heatmap
  const activity: number[] = [];
  for (let i = 27; i >= 0; i--) {
    activity.push(profile.activity[dayKey(Date.now() - i * DAY)] ?? 0);
  }

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
    thisMonth,
    reviews,
    successRate: successRateValue,
    byCategory,
    streak: profile.streak,
    activity,
    recent,
  };
}

/* ============================================================
 * EXPORT / IMPORT / RESET
 * ========================================================== */

export async function exportAll(): Promise<string> {
  const db = await getDB();
  const [languages, words, verbs, notes, sessions, settings, profile] = await Promise.all([
    db.getAll("languages"),
    db.getAll("words"),
    db.getAll("verbs"),
    db.getAll("notes"),
    db.getAll("sessions"),
    getSettings(),
    getProfile(),
  ]);
  return JSON.stringify(
    { version: DB_VERSION, exported_at: new Date().toISOString(), languages, words, verbs, notes, sessions, settings, profile },
    null,
    2,
  );
}

export async function importAll(json: string, mode: "merge" | "replace" = "merge"): Promise<void> {
  const data = JSON.parse(json);
  const db = await getDB();
  const tx = db.transaction(["languages", "words", "verbs", "notes", "sessions", "meta"], "readwrite");
  if (mode === "replace") {
    await Promise.all([
      tx.objectStore("languages").clear(),
      tx.objectStore("words").clear(),
      tx.objectStore("verbs").clear(),
      tx.objectStore("notes").clear(),
      tx.objectStore("sessions").clear(),
    ]);
  }
  for (const l of data.languages ?? []) await tx.objectStore("languages").put(l);
  for (const w of data.words ?? []) await tx.objectStore("words").put(w);
  for (const v of data.verbs ?? []) await tx.objectStore("verbs").put(v);
  for (const n of data.notes ?? []) await tx.objectStore("notes").put(n);
  for (const s of data.sessions ?? []) await tx.objectStore("sessions").put(s);
  if (data.settings) await tx.objectStore("meta").put(data.settings, META_SETTINGS);
  if (data.profile) await tx.objectStore("meta").put(data.profile, META_PROFILE);
  await tx.done;
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["languages", "words", "verbs", "notes", "sessions", "meta"], "readwrite");
  await Promise.all([
    tx.objectStore("languages").clear(),
    tx.objectStore("words").clear(),
    tx.objectStore("verbs").clear(),
    tx.objectStore("notes").clear(),
    tx.objectStore("sessions").clear(),
    tx.objectStore("meta").clear(),
  ]);
  await tx.done;
}
