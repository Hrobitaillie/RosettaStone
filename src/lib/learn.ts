/**
 * Progressive learning mode — builds the per-session queue and shapes the
 * questions for each stage. Stages 0..4 are defined as:
 *
 *   0 · Découverte / copie     — FR + romanisation + answer visible, retype/redraw.
 *   1 · Complétion             — FR + hangul partiel (1 piece masked), fill the gap.
 *   2 · Production assistée    — FR only, reveal a hint syllable on demand.
 *   3 · Production libre       — FR only, no hint.
 *   4 · Reconnaissance inverse — hangul → français.
 *
 * Within a session every rep of a stage uses the SAME stage (the user only
 * progresses by one stage per session), but reps from different words are
 * interleaved round-robin so the user never repeats the same word back-to-back.
 */

import { LEARN_GRADUATED, LEARN_REPS_PER_STAGE, type LearnStage, type Word, listWords } from "./db";
import { isHangulSyllable, isFullySupported, splitSyllables } from "./hangul";

/* ------------------------------------------------------------------
 * Public types
 * ------------------------------------------------------------------ */

/** What the runner needs to render one progressive question. */
export type LearnRep = {
  word: Word;
  stage: LearnStage;
  /** 1-based rep index within the word's bloc (e.g. 2 of 4). */
  repIndex: number;
  totalReps: number;
  /** True if this is a "rappel" rep injected from the previous stage. */
  isWarmup: boolean;
  /** What the user actually has to do. */
  variant: LearnVariant;
};

export type LearnVariant =
  /** Stage 0 — copy: prompt = FR + romanisation, target = original; answer pre-shown. */
  | {
      kind: "copy";
      prompt: string;
      romanization: string | null;
      answer: string;
      useHangulCanvas: boolean;
    }
  /** Stage 1 — completion: hangul with one slice masked, user types the missing slice. */
  | {
      kind: "completion";
      prompt: string;
      full: string;
      /** The visible string with `_` placeholders for the masked part. */
      masked: string;
      /** What the user must type. */
      missing: string;
      hint: string;
    }
  /** Stages 2 & 3 — production: FR → original. `revealHint=true` means the user
   *  can tap to reveal a syllable as scaffolding (stage 2). Stage 3 = no hint. */
  | {
      kind: "production";
      prompt: string;
      answer: string;
      romanization: string | null;
      useHangulCanvas: boolean;
      revealHint: boolean;
    }
  /** Stage 4 — recognition: original → français. */
  | { kind: "recognition"; prompt: string; answer: string; romanization: string | null };

export type LearnQueue = {
  reps: LearnRep[];
  /** Distinct words involved in this session (in queue order of first appearance). */
  words: Word[];
};

/* ------------------------------------------------------------------
 * Queue builder
 * ------------------------------------------------------------------ */

const WARMUP_THRESHOLD_MS = 3 * 86_400_000; // 3 days

export type BuildLearnQueueOpts = {
  /** Max number of distinct words this session. */
  wordsPerSession: number;
  /** Does this language have stroke data (Korean) — if false, all draws become typing. */
  isKorean?: boolean;
  /** Restrict the candidate pool to words currently at this stage. */
  stage?: LearnStage;
};

/** Pick fresh words (lowest stage first, oldest lastLearnAt first) and build
 *  an interleaved rep queue. Returns an empty queue if no word is < stage 5. */
export async function buildLearnQueue(
  languageId: string,
  opts: BuildLearnQueueOpts,
): Promise<LearnQueue> {
  const all = await listWords(languageId);
  const candidates =
    opts.stage != null
      ? all.filter((w) => w.learnStage === opts.stage)
      : all.filter((w) => w.learnStage < LEARN_GRADUATED);
  if (!candidates.length) return { reps: [], words: [] };

  // Prioritise: lowest stage first, then never-touched (lastLearnAt null) first,
  // then oldest lastLearnAt. This makes the queue feel fair — the user finishes
  // what they've started before encountering brand-new vocabulary.
  candidates.sort((a, b) => {
    if (a.learnStage !== b.learnStage) return a.learnStage - b.learnStage;
    const aLast = a.lastLearnAt ?? 0;
    const bLast = b.lastLearnAt ?? 0;
    return aLast - bLast;
  });

  const picked = candidates.slice(0, Math.max(1, opts.wordsPerSession));
  const isKorean = opts.isKorean ?? false;

  // Generate reps per word, then interleave.
  const perWord = picked.map((w) => buildRepsForWord(w, isKorean));
  const reps = interleave(perWord);

  return { reps, words: picked };
}

/** Build the bloc of reps for ONE word at its current stage, plus optional warmup. */
function buildRepsForWord(word: Word, isKorean: boolean): LearnRep[] {
  const stage = word.learnStage as LearnStage;
  const total = LEARN_REPS_PER_STAGE[stage];
  const out: LearnRep[] = [];

  // Warmup: if the word is at stage ≥1 and hasn't been touched in 3+ days,
  // prepend ONE rep of the previous stage as a refresher. Marked isWarmup so
  // the UI can show a "Rappel" badge and the runner doesn't count it toward
  // stage progression.
  const needsWarmup =
    stage >= 1 && word.lastLearnAt != null && Date.now() - word.lastLearnAt > WARMUP_THRESHOLD_MS;
  if (needsWarmup) {
    const prev = (stage - 1) as LearnStage;
    out.push({
      word,
      stage: prev,
      repIndex: 1,
      totalReps: 1,
      isWarmup: true,
      variant: makeVariantForStage(word, prev, 0, isKorean),
    });
  }

  for (let i = 0; i < total; i++) {
    out.push({
      word,
      stage,
      repIndex: i + 1,
      totalReps: total,
      isWarmup: false,
      variant: makeVariantForStage(word, stage, i, isKorean),
    });
  }
  return out;
}

/** Round-robin merge: take[0] from each bloc, then take[1] from each, etc.
 *  Guarantees no two adjacent reps share a word (as long as ≥2 words). */
function interleave(blocs: LearnRep[][]): LearnRep[] {
  const out: LearnRep[] = [];
  let added = true;
  for (let row = 0; added; row++) {
    added = false;
    for (const bloc of blocs) {
      if (row < bloc.length) {
        out.push(bloc[row]);
        added = true;
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------
 * Per-stage question shaping
 * ------------------------------------------------------------------ */

function makeVariantForStage(
  word: Word,
  stage: LearnStage,
  repIndex: number,
  isKorean: boolean,
): LearnVariant {
  const useHangulCanvas = isKorean && wordCanBeDrawn(word);
  switch (stage) {
    case 0:
      return {
        kind: "copy",
        prompt: word.translation,
        romanization: word.transcription || null,
        answer: word.original,
        useHangulCanvas,
      };
    case 1: {
      const { masked, missing, hint } = maskHangulPart(word.original, repIndex);
      return {
        kind: "completion",
        prompt: word.translation,
        full: word.original,
        masked,
        missing,
        hint,
      };
    }
    case 2:
      return {
        kind: "production",
        prompt: word.translation,
        answer: word.original,
        romanization: word.transcription || null,
        useHangulCanvas,
        revealHint: true,
      };
    case 3:
      return {
        kind: "production",
        prompt: word.translation,
        answer: word.original,
        romanization: word.transcription || null,
        useHangulCanvas,
        revealHint: false,
      };
    case 4:
      return {
        kind: "recognition",
        prompt: word.original,
        answer: word.translation,
        romanization: word.transcription || null,
      };
    case 5:
      // Should not happen — graduated words are filtered out before reps are built.
      // Fall back to recognition just in case.
      return {
        kind: "recognition",
        prompt: word.original,
        answer: word.translation,
        romanization: word.transcription || null,
      };
  }
}

/** Does this word have any drawable hangul syllables? */
function wordCanBeDrawn(word: Word): boolean {
  const sylls = splitSyllables(word.original);
  return sylls.length > 0 && isFullySupported(word.original);
}

/* ------------------------------------------------------------------
 * Masking — for stage 1 (completion)
 * ------------------------------------------------------------------ */

/**
 * Hide a different syllable on each rep so the learner reconstructs different
 * positions rather than memorising one masking shape.
 *
 * Strategy (cycled by `repIndex % 4`):
 *   0 — last syllable
 *   1 — first syllable
 *   2 — middle syllable (fallback: last)
 *   3 — random syllable
 *
 * Non-hangul characters (spaces, punctuation, mixed scripts) stay visible
 * — the gap is hangul-only. Single-syllable words fall back to masking that
 * one syllable (the typed-completion is then identical to a stage-2 prompt,
 * which is intentional — there isn't much to scaffold for a 1-syllable word).
 */
export function maskHangulPart(
  original: string,
  repIndex: number,
): { masked: string; missing: string; hint: string } {
  const syllables = splitSyllables(original);
  if (syllables.length === 0) {
    // No hangul to mask — show the whole thing as a blank and ask for it.
    return {
      masked: "_".repeat(Math.max(1, original.length)),
      missing: original,
      hint: "Tape le mot complet",
    };
  }

  const n = syllables.length;
  let nth: number;
  switch (repIndex % 4) {
    case 0:
      nth = n - 1;
      break;
    case 1:
      nth = 0;
      break;
    case 2:
      nth = n >= 3 ? Math.floor(n / 2) : n - 1;
      break;
    default:
      nth = Math.floor(Math.random() * n);
  }
  return maskSyllableAt(original, syllables, nth);
}

/** Replace the N-th hangul syllable with `___` (3 underscores) inside the
 *  original string, preserving non-hangul characters. */
function maskSyllableAt(
  original: string,
  syllables: string[],
  nthHangul: number,
): { masked: string; missing: string; hint: string } {
  let seenHangul = 0;
  let masked = "";
  for (const ch of original) {
    if (isHangulSyllable(ch)) {
      masked += seenHangul === nthHangul ? "___" : ch;
      seenHangul++;
    } else {
      masked += ch;
    }
  }
  const missing = syllables[nthHangul];
  const hint =
    syllables.length === 1
      ? "Tape la syllabe manquante"
      : nthHangul === 0
        ? "Tape la première syllabe"
        : nthHangul === syllables.length - 1
          ? "Tape la dernière syllabe"
          : `Tape la ${nthHangul + 1}ᵉ syllabe`;
  return { masked, missing, hint };
}
