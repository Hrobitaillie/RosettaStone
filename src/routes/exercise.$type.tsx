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
import { LearnResultScreen, type LearnWordOutcome } from "@/components/exercise/LearnResultScreen";
import { CompletionView } from "@/components/exercise/CompletionView";
import { useExerciseRunner, type RunnerItem } from "@/components/exercise/useExerciseRunner";
import { SessionErrorBoundary, logSessionError } from "@/components/exercise/SessionErrorBoundary";
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
  setLearnStage,
  successRate,
  touchLearn,
  answersMatch,
  LEARN_GRADUATED,
  type ExerciseDirection,
  type ExerciseType,
  type LearnStage,
  type TracagePromptMode,
  type Verb,
  type Word,
  type WordForm,
} from "@/lib/db";
import { buildLearnQueue, type LearnRep } from "@/lib/learn";
import { isFullySupported, splitSyllables } from "@/lib/hangul";
import { loadSyllableStrokes } from "@/lib/syllableStrokes";

const TYPES = ["traduction", "qcm", "conjugaison", "tracage", "mix", "review", "learn"] as const;
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
  /** Apprentissage progressif: number of distinct words per session. */
  wordsPerSession?: number;
  /** Apprentissage progressif: restrict the pool to one stage (0..4). */
  stage?: 0 | 1 | 2 | 3 | 4;
};

export const Route = createFileRoute("/exercise/$type")({
  validateSearch: (s: Record<string, unknown>): ExerciseSearch => {
    const dirs = Array.isArray(s.dirs)
      ? (s.dirs.filter(isDirection) as ExerciseDirection[])
      : undefined;
    const types = Array.isArray(s.types)
      ? (s.types.filter(isReviewType) as ReviewType[])
      : undefined;
    const wps = Number(s.wordsPerSession);
    const stageNum = Number(s.stage);
    const stage =
      Number.isInteger(stageNum) && stageNum >= 0 && stageNum <= 4
        ? (stageNum as 0 | 1 | 2 | 3 | 4)
        : undefined;
    return {
      count: Number(s.count) || 20,
      dir: isDirection(s.dir) ? s.dir : "original->translation",
      ...(dirs && dirs.length ? { dirs } : {}),
      ...(isTracageMode(s.mode) ? { mode: s.mode } : {}),
      ...(types && types.length ? { types } : {}),
      ...(Number.isFinite(wps) && wps > 0 ? { wordsPerSession: wps } : {}),
      ...(stage != null ? { stage } : {}),
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
  /** Apprentissage stage 0: pre-shown answer to retype. */
  copyAnswer?: string;
  /** Apprentissage stage 2: enable the syllable-by-syllable hint button. */
  progressiveHint?: boolean;
  /** Learn metadata for stage badge / progression tracking. */
  learnRep?: LearnRep;
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
  /** Stage 0 → start with the model visible. */
  ghostDefault?: boolean;
  /** Stage 3 → no model toggle at all. */
  hideGhostToggle?: boolean;
  learnRep?: LearnRep;
};
type CompletionQ = {
  kind: "completion";
  item: RunnerItem;
  label: string;
  prompt: string;
  masked: string;
  full: string;
  missing: string;
  hint: string;
  word: string;
  learnRep: LearnRep;
};
type Question = TypedQ | QcmQ | TracageQ | CompletionQ;

const TYPE_TITLES: Record<RunnerType, ExerciseType> = {
  traduction: "traduction",
  qcm: "qcm",
  conjugaison: "conjugaison",
  tracage: "tracage",
  mix: "mix",
  review: "review",
  learn: "apprentissage",
};

function ExerciseRunner() {
  const { type } = Route.useParams();
  const { count, dir, dirs, mode, types, wordsPerSession, stage } = Route.useSearch();
  const { current, langId } = useSelectedLanguage();
  const navigate = useNavigate();

  const runnerType = (TYPES as readonly string[]).includes(type)
    ? (type as RunnerType)
    : "traduction";
  const target = current?.name ?? "";
  const isKorean = !!current && /cor|kor|한/i.test(current.name);

  // A bump key lets "Revoir les erreurs" restart with a fresh question set.
  const [restartKey, setRestartKey] = useState(0);
  // When set, the runner replays only this subset of words (mistakes).
  const [retryIds, setRetryIds] = useState<string[] | null>(null);

  const { data: questions, isPending } = useQuery({
    queryKey: [
      "exerciseQuestions",
      runnerType,
      langId,
      count,
      dir,
      dirs,
      mode,
      types,
      wordsPerSession,
      stage,
      isKorean,
      restartKey,
    ],
    queryFn: () =>
      buildQuestions(runnerType, langId, count, dir, dirs, target, mode, types, {
        wordsPerSession: wordsPerSession ?? 5,
        isKorean,
        stage,
      }),
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
    const isLearn = runnerType === "learn";
    return (
      <Screen withNav={false}>
        <RunnerChrome current={0} total={0} onClose={() => navigate({ to: "/exercises" })} />
        <ExerciseEmpty
          message={
            isConj
              ? "Aucun verbe conjugué disponible. Ajoutez des verbes avec leurs conjugaisons."
              : isTracage
                ? "Aucun mot en hangeul disponible. Ajoutez des mots coréens à votre dictionnaire."
                : isLearn
                  ? "Tout est diplômé ! Réinitialise des mots dans le dictionnaire pour les réapprendre."
                  : "Aucun mot disponible pour cet exercice. Ajoutez des mots à votre dictionnaire."
          }
          to={isLearn ? "/dictionary" : "/dictionary"}
          cta={isLearn ? "Ouvrir le dictionnaire" : "Ajouter un mot"}
        />
      </Screen>
    );
  }

  return (
    <SessionErrorBoundary
      key={`boundary-${restartKey}-${retryIds ? "retry" : "full"}`}
      onReset={() => setRestartKey((k) => k + 1)}
      onExit={() => navigate({ to: "/exercises" })}
    >
      <RunnerSession
        key={`${restartKey}-${retryIds ? "retry" : "full"}`}
        type={runnerType}
        questions={playable}
        onClose={() => navigate({ to: "/exercises" })}
        onRetryMistakes={(ids) => setRetryIds(ids)}
      />
    </SessionErrorBoundary>
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

  // Per-question correct flag — needed for the apprentissage progressif to
  // compute per-word ratios at the end of the session.
  const [answerLog, setAnswerLog] = useState<boolean[]>([]);
  const [learnOutcomes, setLearnOutcomes] = useState<LearnWordOutcome[] | null>(null);

  const isLearn = type === "learn";

  // Reset transient state when the question changes.
  useEffect(() => {
    setInput("");
    setSelected(null);
    setFeedback(null);
  }, [runner.index]);

  useEffect(() => {
    if (!runner.done || saved) return;
    setSaved(true);
    persistSession(type, langId, runner.correctCount, runner.total, runner.mistakes, qc)
      .then((s) => setStreak(s))
      .catch((err) => {
        // Persist failures must NOT kill the result screen — log and keep streak unchanged.
        logSessionError(err, { stage: "persistSession", type, langId });
      });
    if (isLearn) {
      applyLearnProgress(questions, answerLog)
        .then((outcomes) => {
          setLearnOutcomes(outcomes);
          qc.invalidateQueries({ queryKey: ["words"] });
        })
        .catch((err) => {
          logSessionError(err, { stage: "applyLearnProgress", langId });
          setLearnOutcomes([]);
        });
    }
  }, [
    runner.done,
    saved,
    type,
    langId,
    runner.correctCount,
    runner.total,
    runner.mistakes,
    qc,
    isLearn,
    questions,
    answerLog,
  ]);

  // ---- Result screen ----
  if (runner.done) {
    if (isLearn) {
      if (!learnOutcomes) {
        return (
          <Screen withNav={false}>
            <div className="mt-24 text-center text-sm text-muted-foreground">
              Mise à jour des stades…
            </div>
          </Screen>
        );
      }
      return (
        <Screen withNav={false}>
          <LearnResultScreen outcomes={learnOutcomes} onContinue={onClose} onFinish={onClose} />
        </Screen>
      );
    }
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

  /** Grade the item and return its new success rate for the form just tested.
   * Returns `oldRate` if the DB write fails so the session never hard-crashes.
   * In learn mode the SRS is NOT touched — stage progression is handled
   * separately at session end via applyLearnProgress. */
  async function grade(item: RunnerItem, correct: boolean): Promise<number> {
    if (isLearn) {
      // Just bump lastLearnAt so warmup thresholds reset.
      touchLearn(item.id).catch((err) =>
        logSessionError(err, { stage: "touchLearn", itemId: item.id }),
      );
      return item.oldRate;
    }
    try {
      if (item.kind === "verb") {
        const updated = await gradeVerb(item.id, correct);
        return successRate(updated);
      }
      const form: WordForm = item.form ?? "comp";
      const updated = await gradeWord(item.id, form, correct);
      return successRate({ srs: updated.srs[form] });
    } catch (err) {
      logSessionError(err, { stage: "grade", itemId: item.id, kind: item.kind, form: item.form });
      return item.oldRate;
    }
  }

  // ---- Typed / QCM / Tracage / Completion: verify → feedback sheet → continue ----
  // Every verify wraps showFeedback in a guard so a thrown DB/render error
  // surfaces as the feedback sheet (correct=false, no rate change) instead of
  // tearing down the route.
  async function verifyTyped(q: TypedQ) {
    try {
      // Stage 0 (copyAnswer) is always counted correct as long as the input
      // matches the model — the user is supposed to retype it.
      const correct = answersMatch(input, q.answer);
      await showFeedback(q.item, q.word, q.answer, correct);
    } catch (err) {
      logSessionError(err, { stage: "verifyTyped", itemId: q.item.id });
      setFeedback({
        correct: false,
        word: q.word,
        answer: q.answer,
        oldRate: q.item.oldRate,
        newRate: q.item.oldRate,
      });
    }
  }
  async function verifyQcm(q: QcmQ) {
    try {
      const correct = selected === q.answerIndex;
      await showFeedback(q.item, q.word, q.answer, correct);
    } catch (err) {
      logSessionError(err, { stage: "verifyQcm", itemId: q.item.id });
      setFeedback({
        correct: false,
        word: q.word,
        answer: q.answer,
        oldRate: q.item.oldRate,
        newRate: q.item.oldRate,
      });
    }
  }
  async function verifyTracage(q: TracageQ, isCorrect: boolean) {
    try {
      await showFeedback(q.item, q.word, q.answer, isCorrect);
    } catch (err) {
      logSessionError(err, { stage: "verifyTracage", itemId: q.item.id });
      setFeedback({
        correct: isCorrect,
        word: q.word,
        answer: q.answer,
        oldRate: q.item.oldRate,
        newRate: q.item.oldRate,
      });
    }
  }
  async function verifyCompletion(q: CompletionQ) {
    try {
      const correct = answersMatch(input, q.missing);
      await showFeedback(q.item, q.word, q.full, correct);
    } catch (err) {
      logSessionError(err, { stage: "verifyCompletion", itemId: q.item.id });
      setFeedback({
        correct: false,
        word: q.word,
        answer: q.full,
        oldRate: q.item.oldRate,
        newRate: q.item.oldRate,
      });
    }
  }

  async function showFeedback(item: RunnerItem, word: string, answer: string, correct: boolean) {
    const before = item.oldRate;
    const after = await grade(item, correct);
    setFeedback({ correct, word, answer, oldRate: before, newRate: after });
  }

  function continueNext() {
    const correct = feedback?.correct ?? false;
    setFeedback(null);
    // Record per-question correctness — used by applyLearnProgress on done.
    setAnswerLog((log) => {
      const next = log.slice();
      next[runner.index] = correct;
      return next;
    });
    runner.submit(correct);
  }

  const locked = feedback != null;
  const learnRep =
    current.kind === "typed" || current.kind === "tracage" || current.kind === "completion"
      ? current.learnRep
      : undefined;

  return (
    <Screen withNav={false} padded={false} className="flex flex-col">
      <div className="px-5">
        <RunnerChrome
          current={runner.index}
          total={runner.total}
          onClose={onClose}
          variant={isLearn ? "counter" : "percent"}
          percent={runner.successPercent}
        />
        {learnRep && <LearnStageBadge rep={learnRep} />}
      </div>

      <div className="flex-1 px-5">
        {current.kind === "typed" && (
          <TypedQuestionView
            label={current.label}
            prompt={current.prompt}
            promptCard={current.promptCard}
            hint={current.hint}
            copyAnswer={current.copyAnswer}
            progressiveHint={current.progressiveHint}
            answer={current.answer}
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
            ghostDefault={current.ghostDefault}
            hideGhostToggle={current.hideGhostToggle}
          />
        )}
        {current.kind === "completion" && (
          <CompletionView
            label={current.label}
            prompt={current.prompt}
            masked={current.masked}
            full={current.full}
            hint={current.hint}
            value={input}
            onChange={setInput}
            onVerify={() => void verifyCompletion(current)}
            locked={locked}
            correct={feedback?.correct ?? false}
          />
        )}
      </div>

      {feedback && <FeedbackSheet feedback={feedback} onContinue={continueNext} />}
    </Screen>
  );
}

const STAGE_LABEL = [
  "Découverte",
  "Complétion",
  "Production assistée",
  "Production libre",
  "Reconnaissance",
];

function LearnStageBadge({ rep }: { rep: LearnRep }) {
  // No word hint here on purpose — it would leak the answer in completion /
  // production / recognition stages.
  return (
    <div className="mt-2 flex items-center gap-2 text-xs">
      {rep.isWarmup && (
        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-primary-foreground">
          Rappel
        </span>
      )}
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-bold uppercase tracking-wider text-muted-foreground">
        {STAGE_LABEL[rep.stage] ?? "Apprentissage"} · {rep.repIndex}/{rep.totalReps}
      </span>
    </div>
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
  learnOpts: { wordsPerSession: number; isKorean: boolean; stage?: 0 | 1 | 2 | 3 | 4 },
): Promise<Question[]> {
  switch (type) {
    case "learn": {
      // Make sure the catalogue is loaded so canvas-friendly drawing reps work.
      if (learnOpts.isKorean) await loadSyllableStrokes();
      const { reps } = await buildLearnQueue(langId, {
        wordsPerSession: learnOpts.wordsPerSession,
        isKorean: learnOpts.isKorean,
        stage: learnOpts.stage,
      });
      return reps.map((rep) => learnRepToQuestion(rep, target));
    }
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

/* ============================================================
 * Learn-mode helpers
 * ========================================================== */

/** Map a LearnRep to a Question the runner can play. */
function learnRepToQuestion(rep: LearnRep, target: string): Question {
  const stageBadge =
    rep.stage === 0
      ? "DÉCOUVERTE"
      : rep.stage === 1
        ? "COMPLÉTION"
        : rep.stage === 2
          ? "PRODUCTION ASSISTÉE"
          : rep.stage === 3
            ? "PRODUCTION LIBRE"
            : "RECONNAISSANCE";
  const label = `${stageBadge} · ${rep.repIndex}/${rep.totalReps}`;
  const { word, variant } = rep;

  switch (variant.kind) {
    case "copy":
      if (variant.useHangulCanvas) {
        return {
          kind: "tracage",
          item: wordItem(word, "draw"),
          label,
          prompt: variant.prompt,
          answer: variant.answer,
          word: word.original,
          ghostDefault: true,
          learnRep: rep,
        };
      }
      return {
        kind: "typed",
        item: wordItem(word, "write"),
        label,
        prompt: variant.prompt,
        promptCard: false,
        answer: variant.answer,
        word: word.original,
        hint: variant.romanization ?? undefined,
        copyAnswer: variant.answer,
        learnRep: rep,
      };
    case "completion":
      return {
        kind: "completion",
        item: wordItem(word, "write"),
        label,
        prompt: variant.prompt,
        masked: variant.masked,
        full: variant.full,
        missing: variant.missing,
        hint: variant.hint,
        word: word.original,
        learnRep: rep,
      };
    case "production":
      if (variant.useHangulCanvas) {
        return {
          kind: "tracage",
          item: wordItem(word, "draw"),
          label,
          prompt: variant.prompt,
          answer: variant.answer,
          word: word.original,
          ghostDefault: false,
          hideGhostToggle: !variant.revealHint,
          learnRep: rep,
        };
      }
      return {
        kind: "typed",
        item: wordItem(word, "write"),
        label: `TRADUIS EN ${target.toUpperCase() || "LANGUE CIBLE"}`,
        prompt: variant.prompt,
        promptCard: false,
        answer: variant.answer,
        word: word.original,
        hint: variant.revealHint ? undefined : (variant.romanization ?? undefined),
        progressiveHint: variant.revealHint,
        learnRep: rep,
      };
    case "recognition":
      return {
        kind: "typed",
        item: wordItem(word, "comp"),
        label: "TRADUIS EN FRANÇAIS",
        prompt: variant.prompt,
        promptCard: false,
        answer: variant.answer,
        word: word.original,
        hint: variant.romanization ?? undefined,
        learnRep: rep,
      };
  }
}

/**
 * Apply stage progression based on per-word success ratio.
 *  - success ≥ 75% → +1 stage (graduate to 5 if was at 4)
 *  - success ≥ 50% → hold (no change)
 *  - success  < 50% → -1 stage (floor 0)
 * Warmup reps are excluded from the count — they're a refresher, not a test.
 */
async function applyLearnProgress(
  questions: Question[],
  answerLog: boolean[],
): Promise<LearnWordOutcome[]> {
  type Acc = { word: Word; from: LearnStage; correct: number; total: number };
  const byId = new Map<string, Acc>();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const rep =
      q.kind === "typed" || q.kind === "tracage" || q.kind === "completion"
        ? q.learnRep
        : undefined;
    if (!rep) continue;
    if (rep.isWarmup) continue;

    const id = rep.word.id;
    let acc = byId.get(id);
    if (!acc) {
      acc = { word: rep.word, from: rep.stage, correct: 0, total: 0 };
      byId.set(id, acc);
    }
    acc.total += 1;
    if (answerLog[i]) acc.correct += 1;
  }

  const outcomes: LearnWordOutcome[] = [];
  for (const acc of byId.values()) {
    if (acc.total === 0) continue;
    const ratio = acc.correct / acc.total;
    let next: LearnStage = acc.from;
    if (ratio >= 0.75) {
      next = Math.min(LEARN_GRADUATED, acc.from + 1) as LearnStage;
    } else if (ratio < 0.5) {
      next = Math.max(0, acc.from - 1) as LearnStage;
    }
    try {
      await setLearnStage(acc.word.id, next);
    } catch (err) {
      logSessionError(err, { stage: "setLearnStage", id: acc.word.id, next });
    }
    outcomes.push({
      id: acc.word.id,
      original: acc.word.original,
      translation: acc.word.translation,
      fromStage: acc.from,
      toStage: next,
      correct: acc.correct,
      total: acc.total,
    });
  }
  return outcomes;
}
