import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { Screen } from "@/components/mobile/Screen";
import { ScreenHeader, LangAvatar, BigButton, Pill } from "@/components/mobile/primitives";
import { Switch } from "@/components/ui/switch";
import { useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { ExerciseEmpty } from "@/components/exercise/ExerciseEmpty";
import { listWords, successRate, type ExerciseDirection, type Word } from "@/lib/db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/exercises/learn")({
  component: LearnConfig,
});

type CountOption = 10 | 20 | 30 | "all";

const DIRECTIONS: { key: ExerciseDirection; label: string }[] = [
  { key: "original->translation", label: "Hangeul → Français" },
  { key: "romanization->translation", label: "Romanisation → Français" },
  { key: "translation->original", label: "Français → Hangeul" },
];

function LearnConfig() {
  const { current, langId } = useSelectedLanguage();
  const navigate = useNavigate();

  const [count, setCount] = useState<CountOption>(20);
  const [dirs, setDirs] = useState<Record<ExerciseDirection, boolean>>({
    "original->translation": true,
    "romanization->translation": true,
    "translation->original": true,
  });

  const { data: words = [] } = useQuery({
    queryKey: ["words", langId],
    queryFn: () => listWords(langId),
    enabled: langId !== "",
  });

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

  const selectedDirs = DIRECTIONS.filter((d) => dirs[d.key]).map((d) => d.key);
  const total = count === "all" ? words.length : Math.min(count, words.length);

  // A few most-fragile words (lowest success rate, reviewed first).
  const fragile = [...words]
    .filter((w) => w.srs.reviews > 0)
    .sort((a, b) => successRate(a) - successRate(b))
    .slice(0, 3);

  const canStart = selectedDirs.length > 0 && total > 0;

  function toggleDir(key: ExerciseDirection) {
    setDirs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Guarantee at least one direction stays on.
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  }

  function commencer() {
    navigate({
      to: "/exercise/$type",
      params: { type: "review" },
      search: { count: total, dir: selectedDirs[0], dirs: selectedDirs },
    });
  }

  return (
    <Screen className="flex flex-col">
      {header}

      {/* Combien de mots ? */}
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

      {/* Que veux-tu tester ? */}
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

      {/* Priorité aux mots fragiles */}
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
