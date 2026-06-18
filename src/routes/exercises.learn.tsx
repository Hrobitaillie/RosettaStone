import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { GraduationCap, RotateCcw, Sparkles } from "lucide-react";
import { Screen } from "@/components/mobile/Screen";
import { ScreenHeader, LangAvatar, BigButton, Pill } from "@/components/mobile/primitives";
import { Switch } from "@/components/ui/switch";
import { useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { ExerciseEmpty } from "@/components/exercise/ExerciseEmpty";
import {
  listWords,
  successRate,
  LEARN_GRADUATED,
  WORD_FORMS,
  type ExerciseDirection,
  type Word,
} from "@/lib/db";
import type { ReviewType } from "@/routes/exercise.$type";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/exercises/learn")({
  component: LearnConfig,
});

type CountOption = 10 | 20 | 30 | "all";
type WordsOption = 3 | 5 | 10;
type StageOption = 0 | 1 | 2 | 3 | 4;

const DIRECTIONS: { key: ExerciseDirection; label: string }[] = [
  { key: "original->translation", label: "Hangeul → Français" },
  { key: "translation->original", label: "Français → Hangeul" },
];

const EXERCISE_TYPES: { key: ReviewType; label: string; subtitle: string }[] = [
  { key: "traduction", label: "Traduction écrite", subtitle: "Tape la réponse" },
  { key: "qcm", label: "QCM", subtitle: "4 réponses possibles" },
  { key: "tracage", label: "Tracé hangeul", subtitle: "Dessine la syllabe (coréen)" },
];

function LearnConfig() {
  const { current, langId } = useSelectedLanguage();
  const navigate = useNavigate();

  const { data: words = [] } = useQuery({
    queryKey: ["words", langId],
    queryFn: () => listWords(langId),
    enabled: langId !== "",
  });

  const inLearning = useMemo(() => words.filter((w) => w.learnStage < LEARN_GRADUATED), [words]);
  const showProgressive = inLearning.length > 0;

  const header = (
    <ScreenHeader
      title="Mode apprentissage"
      avatar={<LangAvatar icon={<GraduationCap className="h-6 w-6" />} size="lg" variant="muted" />}
      back="/exercises"
    />
  );

  if (langId === "" || !current) {
    return (
      <Screen>
        {header}
        <ExerciseEmpty
          emoji="🌐"
          message="Aucune langue pour l'instant. Créez une langue pour vous entraîner."
          to="/language/new"
          cta="Créer une langue"
        />
      </Screen>
    );
  }

  if (!words.length) {
    return (
      <Screen>
        {header}
        <ExerciseEmpty
          message="Aucun mot à tester. Ajoutez quelques mots à votre dictionnaire."
          to="/dictionary"
          cta="Ajouter un mot"
        />
      </Screen>
    );
  }

  if (showProgressive) {
    return (
      <ProgressiveLearnConfig
        header={header}
        words={words}
        inLearning={inLearning}
        navigate={navigate}
      />
    );
  }

  return <SrsReviewConfig header={header} words={words} navigate={navigate} />;
}

/* ============================================================
 * Progressive mode — for words with learnStage < 5
 * ========================================================== */

function ProgressiveLearnConfig({
  header,
  words,
  inLearning,
  navigate,
}: {
  header: React.ReactNode;
  words: Word[];
  inLearning: Word[];
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [wordsPerSession, setWordsPerSession] = useState<WordsOption>(5);
  const [stage, setStage] = useState<StageOption>(0);

  // Bucket the in-learning words by stage so the user sees what's coming.
  const stageBuckets = useMemo(() => {
    const b = [0, 0, 0, 0, 0];
    for (const w of inLearning) {
      if (w.learnStage >= 0 && w.learnStage <= 4) b[w.learnStage]++;
    }
    return b;
  }, [inLearning]);

  const stageCount = stageBuckets[stage] ?? 0;
  const total = Math.min(wordsPerSession, stageCount);

  function commencer() {
    navigate({
      to: "/exercise/$type",
      params: { type: "learn" },
      search: {
        count: total,
        dir: "translation->original" as ExerciseDirection,
        wordsPerSession,
        stage,
      },
    });
  }

  return (
    <Screen className="flex flex-col">
      {header}

      <div className="mt-4 rounded-2xl bg-primary/10 p-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm font-medium text-foreground">
            <span className="font-bold">{inLearning.length}</span>{" "}
            {inLearning.length > 1 ? "mots en apprentissage" : "mot en apprentissage"} · choisis la
            phase à pratiquer.
          </p>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5 text-center text-[10px] font-semibold uppercase tracking-wider">
          {STAGE_SHORT.map((label, i) => {
            const n = stageBuckets[i];
            const active = stage === i;
            const empty = n === 0;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStage(i as StageOption)}
                disabled={empty}
                className={cn(
                  "rounded-lg px-1 py-2 transition active:scale-95",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground",
                  empty && !active && "opacity-40",
                )}
              >
                <div
                  className={cn(
                    "text-xl font-extrabold tabular-nums",
                    active ? "text-primary-foreground" : "text-foreground",
                  )}
                >
                  {n}
                </div>
                <div className="mt-0.5 leading-tight">{label}</div>
              </button>
            );
          })}
        </div>
      </div>

      <h2 className="mt-7 text-lg font-bold">Mots par session</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        ~4 répétitions par mot, mélangées pour éviter la monotonie.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {([3, 5, 10] as WordsOption[]).map((opt) => (
          <Pill
            key={opt}
            active={wordsPerSession === opt}
            onClick={() => setWordsPerSession(opt)}
            className="justify-center py-3"
          >
            {opt}
          </Pill>
        ))}
      </div>

      {words.length > inLearning.length && (
        <p className="mt-7 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" />
          {words.length - inLearning.length} mot{words.length - inLearning.length > 1 ? "s" : ""}{" "}
          déjà en révision SRS — réinitialise depuis le dictionnaire pour les remettre ici.
        </p>
      )}

      <div className="mt-auto pt-10">
        <BigButton variant="primary" onClick={commencer} disabled={total === 0}>
          Commencer · {total} {total > 1 ? "mots" : "mot"}
        </BigButton>
      </div>
    </Screen>
  );
}

const STAGE_SHORT = ["Découv.", "Complét.", "Prod. ass.", "Prod. libre", "Reconn."];

/* ============================================================
 * SRS review mode — used once everything has graduated
 * ========================================================== */

function SrsReviewConfig({
  header,
  words,
  navigate,
}: {
  header: React.ReactNode;
  words: Word[];
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [count, setCount] = useState<CountOption>(20);
  const [dirs, setDirs] = useState<Record<ExerciseDirection, boolean>>({
    "original->translation": true,
    "translation->original": true,
  });
  const [types, setTypes] = useState<Record<ReviewType, boolean>>({
    traduction: true,
    qcm: true,
    tracage: true,
  });

  const selectedDirs = DIRECTIONS.filter((d) => dirs[d.key]).map((d) => d.key);
  const selectedTypes = EXERCISE_TYPES.filter((t) => types[t.key]).map((t) => t.key);
  const total = count === "all" ? words.length : Math.min(count, words.length);

  // A few most-fragile words (lowest success rate, reviewed first).
  const fragile = [...words]
    .filter((w) => WORD_FORMS.some((f) => w.srs[f].reviews > 0))
    .sort((a, b) => successRate(a) - successRate(b))
    .slice(0, 3);

  const canStart = selectedDirs.length > 0 && selectedTypes.length > 0 && total > 0;

  function toggleDir(key: ExerciseDirection) {
    setDirs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  }

  function toggleType(key: ReviewType) {
    setTypes((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  }

  function commencer() {
    navigate({
      to: "/exercise/$type",
      params: { type: "review" },
      search: {
        count: total,
        dir: selectedDirs[0],
        dirs: selectedDirs,
        types: selectedTypes,
      },
    });
  }

  return (
    <Screen className="flex flex-col">
      {header}

      <p className="mt-2 text-sm text-muted-foreground">
        Tous tes mots sont diplômés du mode progressif — bienvenue en révision SRS.
      </p>

      <h2 className="mt-5 text-lg font-bold">Combien de mots ?</h2>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {([10, 20, 30, "all"] as CountOption[]).map((opt) => (
          <Pill
            key={String(opt)}
            active={count === opt}
            onClick={() => setCount(opt)}
            className="justify-center py-3"
          >
            {opt === "all" ? "Tout" : opt}
          </Pill>
        ))}
      </div>

      <h2 className="mt-7 text-lg font-bold">Que veux-tu tester ?</h2>
      <div className="mt-3 space-y-2.5">
        {DIRECTIONS.map((d) => (
          <label
            key={d.key}
            className="flex cursor-pointer items-center justify-between rounded-2xl bg-card px-5 py-4"
          >
            <span className="font-semibold">{d.label}</span>
            <Switch checked={dirs[d.key]} onCheckedChange={() => toggleDir(d.key)} />
          </label>
        ))}
      </div>

      <h2 className="mt-7 text-lg font-bold">Types d'exercices</h2>
      <div className="mt-3 space-y-2.5">
        {EXERCISE_TYPES.map((t) => (
          <label
            key={t.key}
            className="flex cursor-pointer items-center justify-between rounded-2xl bg-card px-5 py-4"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t.label}</span>
              <span className="block text-sm text-muted-foreground">{t.subtitle}</span>
            </span>
            <Switch checked={types[t.key]} onCheckedChange={() => toggleType(t.key)} />
          </label>
        ))}
      </div>

      {fragile.length > 0 && (
        <>
          <div className="mt-7 flex items-baseline justify-between">
            <h2 className="text-lg font-bold">Priorité aux mots fragiles</h2>
            <span className="text-sm text-muted-foreground">taux de réussite</span>
          </div>
          <div className="mt-3 space-y-3">
            {fragile.map((w) => (
              <FragileRow key={w.id} word={w} />
            ))}
          </div>
        </>
      )}

      <div className="mt-auto pt-10">
        <BigButton variant="primary" onClick={commencer} disabled={!canStart}>
          Commencer · {total} {total > 1 ? "mots" : "mot"}
        </BigButton>
      </div>
    </Screen>
  );
}

function FragileRow({ word }: { word: Word }) {
  const rate = successRate(word);
  const color = rate < 50 ? "bg-destructive" : rate < 70 ? "bg-expressions-bar" : "bg-srs-mastered";
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-xl font-bold">{word.original}</span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{word.translation}</span>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${rate}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-sm font-bold">{rate}%</span>
    </div>
  );
}
