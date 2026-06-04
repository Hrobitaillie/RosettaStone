import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Screen } from "@/components/mobile/Screen";
import { useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { ExerciseEmpty } from "@/components/exercise/ExerciseEmpty";
import { RunnerChrome } from "@/components/exercise/RunnerChrome";
import { TypedQuestionView } from "@/components/exercise/TypedQuestionView";
import { QcmView } from "@/components/exercise/QcmView";
import { TracageView } from "@/components/exercise/TracageView";
import { FeedbackSheet, type Feedback } from "@/components/exercise/FeedbackSheet";
import { ResultScreen } from "@/components/exercise/ResultScreen";
import { useExerciseRunner, type RunnerItem } from "@/components/exercise/useExerciseRunner";
import {
  addSession,
  buildConjugation,
  buildQcm,
  buildReviewQueue,
  buildTracage,
  buildTranslation,
  getProfile,
  gradeVerb,
  gradeWord,
  listWords,
  successRate,
  answersMatch,
  type ExerciseDirection,
  type ExerciseType,
  type TracagePromptMode,
  type Verb,
  type Word,
  type WordForm,
} from "@/lib/db";
import { isFullySupported, splitSyllables } from "@/lib/hangul";
import { loadSyllableStrokes } from "@/lib/syllableStrokes";

const TYPES = ["traduction", "qcm", "conjugaison", "tracage", "mix", "review"] as const;
type RunnerType = (typeof TYPES)[number];

function isDirection(v: unknown): v is ExerciseDirection {
  return v === "original->translation" || v === "translation->original";
}

function isTracageMode(v: unknown): v is TracagePromptMode {
  return v === "fr" || v === "rom" || v === "mix";
}

/** Question types available inside the apprentissage mode (per-word). */
export type ReviewType = "traduction" | "qcm" | "tracage";
const REVIEW_TYPES: ReviewType[] = ["traduction", "qcm", "tracage"];
function isReviewType(v: unknown): v is ReviewType {
  return v === "traduction" || v === "qcm" || v === "tracage";
}

type ExerciseSearch = {
  count: number;
  dir: ExerciseDirection;
  dirs?: ExerciseDirection[];
  mode?: TracagePromptMode;
  types?: ReviewType[];
};

export const Route = createFileRoute("/exercise/$type")({
  validateSearch: (s: Record<string, unknown>): ExerciseSearch => {
    const dirs = Array.isArray(s.dirs)
      ? (s.dirs.filter(isDirection) as ExerciseDirection[])
      : undefined;
    const types = Array.isArray(s.types)
      ? (s.types.filter(isReviewType) as ReviewType[])
      : undefined;
    return {
      count: Number(s.count) || 20,
      dir: isDirection(s.dir) ? s.dir : "original->translation",
      ...(dirs && dirs.length ? { dirs } : {}),
      ...(isTracageMode(s.mode) ? { mode: s.mode } : {}),
      ...(types && types.length ? { types } : {}),
    };
  },
  component: ExerciseRunner,
});

/* ============================================================
 * Normalised question shapes the runner can play
 * ========================================================== */

type TypedQ = {
  kind: "typed";
  item: RunnerItem;
  label: string;
  prompt: string;
  promptCard: boolean;
  answer: string;
  word: string; // display label on feedback chip
  hint?: string; // romanisation revealed as a hint
};
type QcmQ = {
  kind: "qcm";
  item: RunnerItem;
  prompt: string;
  choices: string[];
  answerIndex: number;
  answer: string;
  word: string;
  hint?: string; // romanisation revealed as a hint
};
type TracageQ = {
  kind: "tracage";
  item: RunnerItem;
  label: string;
  prompt: string;
  answer: string; // hangul target
  word: string;
};
type Question = TypedQ | QcmQ | TracageQ;

const TYPE_TITLES: Record<RunnerType, ExerciseType> = {
  traduction: "traduction",
  qcm: "qcm",
  conjugaison: "conjugaison",
  tracage: "tracage",
  mix: "mix",
  review: "review",
};

function ExerciseRunner() {
  const { type } = Route.useParams();
  const { count, dir, dirs, mode, types } = Route.useSearch();
  const { current, langId } = useSelectedLanguage();
  const navigate = useNavigate();

  const runnerType = (TYPES as readonly string[]).includes(type)
    ? (type as RunnerType)
    : "traduction";
  const target = current?.name ?? "";

  // A bump key lets "Revoir les erreurs" restart with a fresh question set.
  const [restartKey, setRestartKey] = useState(0);
  // When set, the runner replays only this subset of words (mistakes).
  const [retryIds, setRetryIds] = useState<string[] | null>(null);

  const { data: questions, isPending } = useQuery({
    queryKey: ["exerciseQuestions", runnerType, langId, count, dir, dirs, mode, types, restartKey],
    queryFn: () => buildQuestions(runnerType, langId, count, dir, dirs, target, mode, types),
    enabled: langId !== "",
    gcTime: 0,
    staleTime: 0,
  });

  const playable = useMemo(() => {
    if (!questions) return [] as Question[];
    if (!retryIds) return questions;
    const set = new Set(retryIds);
    return questions.filter((q) => set.has(q.item.id));
  }, [questions, retryIds]);

  if (langId === "" || !current) {
    return (
      <Screen withNav={false}>
        <ExerciseEmpty
          emoji="🌐"
          message="Aucune langue sélectionnée."
          to="/language/new"
          cta="Créer une langue"
        />
      </Screen>
    );
  }

  if (isPending) {
    return (
      <Screen withNav={false}>
        <div className="mt-24 text-center text-sm text-muted-foreground">Préparation…</div>
      </Screen>
    );
  }

  if (!playable.length) {
    const isConj = runnerType === "conjugaison";
    const isTracage = runnerType === "tracage";
    return (
      <Screen withNav={false}>
        <RunnerChrome current={0} total={0} onClose={() => navigate({ to: "/exercises" })} />
        <ExerciseEmpty
          message={
            isConj
              ? "Aucun verbe conjugué disponible. Ajoutez des verbes avec leurs conjugaisons."
              : isTracage
                ? "Aucun mot en hangeul disponible. Ajoutez des mots coréens à votre dictionnaire."
                : "Aucun mot disponible pour cet exercice. Ajoutez des mots à votre dictionnaire."
          }
          to="/dictionary"
          cta="Ajouter un mot"
        />
      </Screen>
    );
  }

  return (
    <RunnerSession
      key={`${restartKey}-${retryIds ? "retry" : "full"}`}
      type={runnerType}
      questions={playable}
      onClose={() => navigate({ to: "/exercises" })}
      onRetryMistakes={(ids) => setRetryIds(ids)}
    />
  );
}

/* ============================================================
 * Active session (own runner state)
 * ========================================================== */

function RunnerSession({
  type,
  questions,
  onClose,
  onRetryMistakes,
}: {
  type: RunnerType;
  questions: Question[];
  onClose: () => void;
  onRetryMistakes: (ids: string[]) => void;
}) {
  const qc = useQueryClient();
  const { langId } = useSelectedLanguage();
  const runner = useExerciseRunner(questions.map((q) => q.item));
  const current = questions[runner.index];

  // Typed/QCM transient state.
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Session persistence (runs once when the queue is exhausted).
  const [streak, setStreak] = useState(0);
  const [saved, setSaved] = useState(false);

  // Reset transient state when the question changes.
  useEffect(() => {
    setInput("");
    setSelected(null);
    setFeedback(null);
  }, [runner.index]);

  useEffect(() => {
    if (!runner.done || saved) return;
    setSaved(true);
    void persistSession(type, langId, runner.correctCount, runner.total, runner.mistakes, qc).then(
      (s) => setStreak(s),
    );
  }, [runner.done, saved, type, langId, runner.correctCount, runner.total, runner.mistakes, qc]);

  // ---- Result screen ----
  if (runner.done) {
    const xp = computeXp(runner.correctCount);
    return (
      <Screen withNav={false}>
        <ResultScreen
          total={runner.total}
          correct={runner.correctCount}
          xp={xp}
          streak={streak}
          mistakes={runner.mistakes}
          onRetryMistakes={() => onRetryMistakes(runner.mistakes.map((m) => m.id))}
          onFinish={onClose}
        />
      </Screen>
    );
  }

  if (!current) return null;

  /** Grade the item and return its new success rate for the form just tested. */
  async function grade(item: RunnerItem, correct: boolean): Promise<number> {
    if (item.kind === "verb") {
      const updated = await gradeVerb(item.id, correct);
      return successRate(updated);
    }
    const form: WordForm = item.form ?? "comp";
    const updated = await gradeWord(item.id, form, correct);
    return successRate({ srs: updated.srs[form] });
  }

  // ---- Typed / QCM / Tracage: verify → feedback sheet → continue ----
  async function verifyTyped(q: TypedQ) {
    const correct = answersMatch(input, q.answer);
    await showFeedback(q.item, q.word, q.answer, correct);
  }
  async function verifyQcm(q: QcmQ) {
    const correct = selected === q.answerIndex;
    await showFeedback(q.item, q.word, q.answer, correct);
  }
  async function verifyTracage(q: TracageQ, isCorrect: boolean) {
    await showFeedback(q.item, q.word, q.answer, isCorrect);
  }

  async function showFeedback(item: RunnerItem, word: string, answer: string, correct: boolean) {
    const before = item.oldRate;
    const after = await grade(item, correct);
    setFeedback({ correct, word, answer, oldRate: before, newRate: after });
  }

  function continueNext() {
    const correct = feedback?.correct ?? false;
    setFeedback(null);
    runner.submit(correct);
  }

  const locked = feedback != null;

  return (
    <Screen withNav={false} padded={false} className="flex flex-col">
      <div className="px-5">
        <RunnerChrome
          current={runner.index}
          total={runner.total}
          onClose={onClose}
          variant="percent"
          percent={runner.successPercent}
        />
      </div>

      <div className="flex-1 px-5">
        {current.kind === "typed" && (
          <TypedQuestionView
            label={current.label}
            prompt={current.prompt}
            promptCard={current.promptCard}
            hint={current.hint}
            value={input}
            onChange={setInput}
            onVerify={() => void verifyTyped(current)}
            locked={locked}
            correct={feedback?.correct ?? false}
          />
        )}
        {current.kind === "qcm" && (
          <QcmView
            prompt={current.prompt}
            choices={current.choices}
            selected={selected}
            onSelect={setSelected}
            onVerify={() => void verifyQcm(current)}
            locked={locked}
            answerIndex={current.answerIndex}
            hint={current.hint}
          />
        )}
        {current.kind === "tracage" && (
          <TracageView
            label={current.label}
            prompt={current.prompt}
            answer={current.answer}
            onSubmit={(ok) => void verifyTracage(current, ok)}
            locked={locked}
          />
        )}
      </div>

      {feedback && <FeedbackSheet feedback={feedback} onContinue={continueNext} />}
    </Screen>
  );
}

/* ============================================================
 * Helpers
 * ========================================================== */

function computeXp(correct: number): number {
  // 10 XP per correct answer + small bonus for finishing.
  return correct * 10 + (correct > 0 ? 5 : 0);
}

async function persistSession(
  type: RunnerType,
  langId: string,
  correct: number,
  total: number,
  mistakes: { id: string; original: string; translation: string }[],
  qc: ReturnType<typeof useQueryClient>,
): Promise<number> {
  const xp = computeXp(correct);
  await addSession({
    language_id: langId,
    type: TYPE_TITLES[type],
    total,
    correct,
    xp,
    mistakes,
  });
  const keys = [
    ["dueCards"],
    ["mastery"],
    ["sessions"],
    ["dashboard"],
    ["stats"],
    ["profile"],
    ["words"],
    ["verbs"],
  ];
  for (const key of keys) qc.invalidateQueries({ queryKey: key });
  const profile = await getProfile();
  return profile.streak;
}

/* ---- Question builders → normalised Question[] ---- */

async function buildQuestions(
  type: RunnerType,
  langId: string,
  count: number,
  dir: ExerciseDirection,
  dirs: ExerciseDirection[] | undefined,
  target: string,
  mode: TracagePromptMode | undefined,
  types: ReviewType[] | undefined,
): Promise<Question[]> {
  switch (type) {
    case "review": {
      // Apprentissage: a mix of question types over the fragile-first queue.
      // For each word, we pick a type the word actually supports (e.g. tracage
      // needs the hangul to be in the catalogue).
      const enabled = types && types.length ? types : (REVIEW_TYPES as ReviewType[]);
      const wantTracage = enabled.includes("tracage");
      const [words, allWords] = await Promise.all([
        buildReviewQueue(langId, count),
        enabled.includes("qcm") ? listWords(langId) : Promise.resolve([] as Word[]),
        wantTracage ? loadSyllableStrokes() : Promise.resolve(null),
      ]);
      const directions = dirs && dirs.length ? dirs : [dir];
      const out: Question[] = [];
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const d = directions[i % directions.length];
        const candidates = enabled.filter((t) => isTypeApplicable(t, w));
        if (!candidates.length) continue;
        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        if (picked === "traduction") {
          out.push(reviewQ(w, d, target));
        } else if (picked === "qcm") {
          out.push(qcmFromWord(w, allWords));
        } else if (picked === "tracage") {
          out.push(tracageFromWord(w));
        }
      }
      return out;
    }
    case "traduction": {
      const qs = await buildTranslation(langId, count, dir);
      return qs.map((q) => traductionQ(q.word, q.prompt, q.answer, dir, target));
    }
    case "qcm": {
      const qs = await buildQcm(langId, count);
      return qs.map((q) => qcmQ(q.word, q.prompt, q.choices, q.answerIndex));
    }
    case "conjugaison": {
      const qs = await buildConjugation(langId, count);
      return qs.map((q) => conjugaisonQ(q.verb, q.prompt, q.answer, q.romanization));
    }
    case "tracage": {
      const qs = await buildTracage(langId, count, mode ?? "mix");
      return qs.map((q) => tracageQ(q.word, q.prompt, q.answer, q.picked));
    }
    case "mix": {
      // Blend every exercise type into one shuffled session.
      const per = Math.max(2, Math.ceil(count / 4));
      const [trad, qcm, conj, trace] = await Promise.all([
        buildTranslation(langId, per, dir),
        buildQcm(langId, per),
        buildConjugation(langId, per),
        buildTracage(langId, per, mode ?? "mix"),
      ]);
      const pool: Question[] = [
        ...trad.map((q) => traductionQ(q.word, q.prompt, q.answer, dir, target)),
        ...qcm.map((q) => qcmQ(q.word, q.prompt, q.choices, q.answerIndex)),
        ...conj.map((q) => conjugaisonQ(q.verb, q.prompt, q.answer, q.romanization)),
        ...trace.map((q) => tracageQ(q.word, q.prompt, q.answer, q.picked)),
      ];
      return shuffleArray(pool).slice(0, count);
    }
  }
}

/** Can a given review type be used for this word? */
function isTypeApplicable(type: ReviewType, w: Word): boolean {
  if (type === "tracage") {
    return splitSyllables(w.original).length > 0 && isFullySupported(w.original);
  }
  return true;
}

/** Build a QCM question for a specific word, drawing 3 distractors from the
 * language's word list (same-category preferred, else any). */
function qcmFromWord(word: Word, allWords: Word[]): QcmQ {
  const sameCat = allWords.filter(
    (w) => w.id !== word.id && w.category === word.category && w.translation,
  );
  const others = allWords.filter((w) => w.id !== word.id && w.translation !== word.translation);
  const distractPool = sameCat.length >= 3 ? sameCat : others;
  const distractors = shuffleArray(distractPool.map((w) => w.translation))
    .filter((t, i, a) => a.indexOf(t) === i && t !== word.translation)
    .slice(0, 3);
  const choices = shuffleArray([word.translation, ...distractors]);
  return qcmQ(word, word.original, choices, choices.indexOf(word.translation));
}

/** Build a tracage question for a specific word (FR prompt by default). */
function tracageFromWord(word: Word): TracageQ {
  return tracageQ(word, word.translation, word.original, "fr");
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function traductionQ(
  word: Word,
  prompt: string,
  answer: string,
  dir: ExerciseDirection,
  target: string,
): TypedQ {
  const toTarget = dir === "translation->original";
  // FR → KO = production écrite (write). KO → FR = compréhension (comp).
  const form: WordForm = toTarget ? "write" : "comp";
  return typedQ(word, form, {
    label: toTarget ? `TRADUIS EN ${target.toUpperCase()}` : "ÉCRIS LA TRADUCTION EN FRANÇAIS",
    prompt,
    promptCard: false,
    answer,
    word: word.original,
    hint: word.transcription || undefined,
  });
}

function tracageQ(word: Word, prompt: string, answer: string, picked: "fr" | "rom"): TracageQ {
  return {
    kind: "tracage",
    item: wordItem(word, "draw"),
    label: picked === "rom" ? "TRACE EN HANGEUL" : "TRACE EN HANGEUL",
    prompt,
    answer,
    word: word.original,
  };
}

function qcmQ(word: Word, prompt: string, choices: string[], answerIndex: number): QcmQ {
  // QCM always tests recognition KO → FR → comp.
  return {
    kind: "qcm",
    item: wordItem(word, "comp"),
    prompt,
    choices,
    answerIndex,
    answer: choices[answerIndex],
    word: word.original,
    hint: word.transcription || undefined,
  };
}

function conjugaisonQ(
  verb: { id: string; infinitive: string; translation: string; srs: Verb["srs"] },
  prompt: string,
  answer: string,
  romanization: string | null,
): TypedQ {
  return {
    kind: "typed",
    item: {
      id: verb.id,
      kind: "verb",
      original: verb.infinitive,
      translation: verb.translation,
      oldRate: successRate(verb),
    },
    label: "CONJUGUE LE VERBE",
    prompt,
    promptCard: false,
    answer,
    word: verb.infinitive,
    hint: romanization || undefined,
  };
}

function wordItem(w: Word, form: WordForm): RunnerItem {
  return {
    id: w.id,
    kind: "word",
    form,
    original: w.original,
    translation: w.translation,
    oldRate: successRate({ srs: w.srs[form] }),
  };
}

function reviewQ(w: Word, d: ExerciseDirection, target: string): TypedQ {
  return traductionQ(
    w,
    d === "translation->original" ? w.translation : w.original,
    d === "translation->original" ? w.original : w.translation,
    d,
    target,
  );
}

function typedQ(
  w: Word,
  form: WordForm,
  opts: {
    label: string;
    prompt: string;
    promptCard: boolean;
    answer: string;
    word: string;
    hint?: string;
  },
): TypedQ {
  return { kind: "typed", item: wordItem(w, form), ...opts };
}
