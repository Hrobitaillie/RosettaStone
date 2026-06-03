import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Screen } from "@/components/mobile/Screen";
import { useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { ExerciseEmpty } from "@/components/exercise/ExerciseEmpty";
import { RunnerChrome } from "@/components/exercise/RunnerChrome";
import { FlashcardView } from "@/components/exercise/FlashcardView";
import { TypedQuestionView } from "@/components/exercise/TypedQuestionView";
import { QcmView } from "@/components/exercise/QcmView";
import { FeedbackSheet, type Feedback } from "@/components/exercise/FeedbackSheet";
import { ResultScreen } from "@/components/exercise/ResultScreen";
import { useExerciseRunner, type RunnerItem } from "@/components/exercise/useExerciseRunner";
import { categorySwatch } from "@/lib/categories";
import {
  addSession,
  buildConjugation,
  buildFlashcards,
  buildQcm,
  buildReviewQueue,
  buildRomanisation,
  buildTranslation,
  getProfile,
  gradeVerb,
  gradeWord,
  successRate,
  answersMatch,
  type ExerciseDirection,
  type ExerciseType,
  type Word,
} from "@/lib/db";

const TYPES = [
  "flashcards",
  "traduction",
  "qcm",
  "conjugaison",
  "romanisation",
  "mix",
  "review",
] as const;
type RunnerType = (typeof TYPES)[number];

function isDirection(v: unknown): v is ExerciseDirection {
  return (
    v === "original->translation" ||
    v === "translation->original" ||
    v === "romanization->translation"
  );
}

type ExerciseSearch = {
  count: number;
  dir: ExerciseDirection;
  dirs?: ExerciseDirection[];
};

export const Route = createFileRoute("/exercise/$type")({
  validateSearch: (s: Record<string, unknown>): ExerciseSearch => {
    const dirs = Array.isArray(s.dirs)
      ? (s.dirs.filter(isDirection) as ExerciseDirection[])
      : undefined;
    return {
      count: Number(s.count) || 20,
      dir: isDirection(s.dir) ? s.dir : "original->translation",
      ...(dirs && dirs.length ? { dirs } : {}),
    };
  },
  component: ExerciseRunner,
});

/* ============================================================
 * Normalised question shapes the runner can play
 * ========================================================== */

type FlashQ = { kind: "flash"; item: RunnerItem; front: string; back: string; surface: string };
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
type Question = FlashQ | TypedQ | QcmQ;

const TYPE_TITLES: Record<RunnerType, ExerciseType> = {
  flashcards: "flashcards",
  traduction: "traduction",
  qcm: "qcm",
  conjugaison: "conjugaison",
  romanisation: "romanisation",
  mix: "mix",
  review: "review",
};

function ExerciseRunner() {
  const { type } = Route.useParams();
  const { count, dir, dirs } = Route.useSearch();
  const { current, langId } = useSelectedLanguage();
  const navigate = useNavigate();

  const runnerType = (TYPES as readonly string[]).includes(type)
    ? (type as RunnerType)
    : "flashcards";
  const target = current?.name ?? "";

  // A bump key lets "Revoir les erreurs" restart with a fresh question set.
  const [restartKey, setRestartKey] = useState(0);
  // When set, the runner replays only this subset of words (mistakes).
  const [retryIds, setRetryIds] = useState<string[] | null>(null);

  const { data: questions, isPending } = useQuery({
    queryKey: ["exerciseQuestions", runnerType, langId, count, dir, dirs, restartKey],
    queryFn: () => buildQuestions(runnerType, langId, count, dir, dirs, target),
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
    return (
      <Screen withNav={false}>
        <RunnerChrome current={0} total={0} onClose={() => navigate({ to: "/exercises" })} />
        <ExerciseEmpty
          message={
            isConj
              ? "Aucun verbe conjugué disponible. Ajoutez des verbes avec leurs conjugaisons."
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

  /** Grade the item and return its new success rate (for the feedback chip). */
  async function grade(item: RunnerItem, correct: boolean): Promise<number> {
    const updated =
      item.kind === "verb" ? await gradeVerb(item.id, correct) : await gradeWord(item.id, correct);
    return successRate(updated);
  }

  // ---- Flashcard / review self-grade ----
  if (current.kind === "flash") {
    return (
      <Screen withNav={false} className="flex flex-col">
        <RunnerChrome current={runner.index} total={runner.total} onClose={onClose} />
        <div className="mt-3 flex flex-1 flex-col pb-2">
          <FlashcardView
            front={current.front}
            back={current.back}
            surface={current.surface}
            onGrade={(correct) => {
              void grade(current.item, correct);
              runner.submit(correct);
            }}
          />
        </div>
      </Screen>
    );
  }

  // ---- Typed / QCM: verify → feedback sheet → continue ----
  async function verifyTyped(q: TypedQ) {
    const correct = answersMatch(input, q.answer);
    await showFeedback(q.item, q.word, q.answer, correct);
  }
  async function verifyQcm(q: QcmQ) {
    const correct = selected === q.answerIndex;
    await showFeedback(q.item, q.word, q.answer, correct);
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
): Promise<Question[]> {
  switch (type) {
    case "flashcards": {
      const cards = await buildFlashcards(langId, count, dir);
      return cards.map((c) => flashQ(c.word, c.front, c.back));
    }
    case "review": {
      // Learn/review session: flashcard self-grade over the fragile-first queue.
      const words = await buildReviewQueue(langId, count);
      const directions = dirs && dirs.length ? dirs : [dir];
      return words.map((w, i) => {
        const d = directions[i % directions.length];
        const { front, back } = faces(w, d);
        return flashQ(w, front, back);
      });
    }
    case "traduction": {
      const qs = await buildTranslation(langId, count, dir);
      return qs.map((q) => traductionQ(q.word, q.prompt, q.answer, dir, target));
    }
    case "romanisation": {
      const qs = await buildRomanisation(langId, count);
      return qs.map((q) =>
        typedQ(q.word, {
          label: "ÉCRIS LA TRADUCTION EN FRANÇAIS",
          prompt: q.prompt,
          promptCard: true,
          answer: q.answer,
          word: q.word.original,
        }),
      );
    }
    case "qcm": {
      const qs = await buildQcm(langId, count);
      return qs.map((q) => qcmQ(q.word, q.prompt, q.choices, q.answerIndex));
    }
    case "conjugaison": {
      const qs = await buildConjugation(langId, count);
      return qs.map((q) => conjugaisonQ(q.verb, q.prompt, q.answer, q.romanization));
    }
    case "mix": {
      // Blend every exercise type into one shuffled session.
      const per = Math.max(2, Math.ceil(count / 4));
      const [flash, trad, qcm, roman, conj] = await Promise.all([
        buildFlashcards(langId, per, dir),
        buildTranslation(langId, per, dir),
        buildQcm(langId, per),
        buildRomanisation(langId, per),
        buildConjugation(langId, per),
      ]);
      const pool: Question[] = [
        ...flash.map((c) => flashQ(c.word, c.front, c.back)),
        ...trad.map((q) => traductionQ(q.word, q.prompt, q.answer, dir, target)),
        ...qcm.map((q) => qcmQ(q.word, q.prompt, q.choices, q.answerIndex)),
        ...roman.map((q) =>
          typedQ(q.word, {
            label: "ÉCRIS LA TRADUCTION EN FRANÇAIS",
            prompt: q.prompt,
            promptCard: true,
            answer: q.answer,
            word: q.word.original,
          }),
        ),
        ...conj.map((q) => conjugaisonQ(q.verb, q.prompt, q.answer, q.romanization)),
      ];
      return shuffleArray(pool).slice(0, count);
    }
  }
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
  return typedQ(word, {
    label: toTarget ? `TRADUIS EN ${target.toUpperCase()}` : "ÉCRIS LA TRADUCTION EN FRANÇAIS",
    prompt,
    promptCard: false,
    answer,
    word: word.original,
    // Hint helps both directions: the romanisation of the foreign word.
    hint: word.transcription || undefined,
  });
}

function qcmQ(word: Word, prompt: string, choices: string[], answerIndex: number): QcmQ {
  return {
    kind: "qcm",
    item: wordItem(word),
    prompt,
    choices,
    answerIndex,
    answer: choices[answerIndex],
    word: word.original,
    hint: word.transcription || undefined,
  };
}

function conjugaisonQ(
  verb: { id: string; infinitive: string; translation: string; srs: Word["srs"] },
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

function faces(w: Word, d: ExerciseDirection): { front: string; back: string } {
  if (d === "translation->original") return { front: w.translation, back: w.original };
  if (d === "romanization->translation")
    return { front: w.transcription || w.original, back: w.translation };
  return { front: w.original, back: w.translation };
}

function wordItem(w: Word): RunnerItem {
  return {
    id: w.id,
    kind: "word",
    original: w.original,
    translation: w.translation,
    oldRate: successRate(w),
  };
}

function flashQ(w: Word, front: string, back: string): FlashQ {
  return {
    kind: "flash",
    item: wordItem(w),
    front,
    back,
    surface: categorySwatch(w.category).surface,
  };
}

function typedQ(
  w: Word,
  opts: {
    label: string;
    prompt: string;
    promptCard: boolean;
    answer: string;
    word: string;
    hint?: string;
  },
): TypedQ {
  return { kind: "typed", item: wordItem(w), ...opts };
}
