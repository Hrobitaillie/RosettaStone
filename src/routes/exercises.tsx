import {
  createFileRoute,
  Link,
  Outlet,
  useChildMatches,
  useNavigate,
} from "@tanstack/react-router";
import {
  GraduationCap,
  Layers,
  Languages,
  ListChecks,
  Repeat,
  Shuffle,
  SpellCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { Screen } from "@/components/mobile/Screen";
import { PastelCard } from "@/components/mobile/primitives";
import { useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { ExerciseEmpty } from "@/components/exercise/ExerciseEmpty";
import type { ExerciseDirection } from "@/lib/db";

export const Route = createFileRoute("/exercises")({
  component: ExercisesLayout,
});

/**
 * `/exercises` is a layout route (it parents `/exercises/learn`). When a child
 * route is active we render only its <Outlet>; otherwise we show the hub.
 */
function ExercisesLayout() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
  return <ExercisesHub />;
}

type ExoType = "flashcards" | "traduction" | "qcm" | "conjugaison" | "romanisation" | "mix";

function ExercisesHub() {
  const { current, langId } = useSelectedLanguage();
  const navigate = useNavigate();

  if (langId === "" || !current) {
    return (
      <Screen>
        <h1 className="pb-2 pt-1 text-3xl font-extrabold">Exercices</h1>
        <ExerciseEmpty
          emoji="🌐"
          message="Aucune langue pour l'instant. Créez une langue pour vous entraîner."
          to="/language/new"
          cta="Créer une langue"
        />
      </Screen>
    );
  }

  const target = current.name;

  const start = (
    type: ExoType,
    count: number,
    dir: ExerciseDirection = "original->translation",
  ) =>
    navigate({
      to: "/exercise/$type",
      params: { type },
      search: { count, dir },
    });

  return (
    <Screen>
      <h1 className="pb-4 pt-1 text-3xl font-extrabold">Exercices</h1>

      {/* Mode apprentissage (lime hero) */}
      <Link to="/exercises/learn" className="block transition active:scale-[0.99]">
        <PastelCard tone="bg-primary text-primary-foreground" className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-2xl font-extrabold leading-tight">Mode apprentissage</div>
            <div className="mt-1 text-sm font-medium opacity-80">
              Teste tes mots · ajuste ton taux de réussite
            </div>
          </div>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-foreground/90 text-primary">
            <GraduationCap className="h-7 w-7" />
          </span>
        </PastelCard>
      </Link>

      <div className="mt-3 space-y-3">
        <ExoCard
          tone="bg-card text-foreground"
          icon={<Shuffle className="h-6 w-6" />}
          title="Mélange"
          subtitle="Tous les types d'exercices mélangés"
          onClick={() => start("mix", 20)}
        />
        <ExoCard
          tone="bg-noms text-noms-foreground"
          icon={<Layers className="h-6 w-6" />}
          title="Flashcards"
          subtitle="Recto / verso · révision rapide"
          onClick={() => start("flashcards", 20)}
        />
        <ExoCard
          tone="bg-verbes text-verbes-foreground"
          icon={<Languages className="h-6 w-6" />}
          title="Compréhension"
          subtitle={`${target} → Français`}
          onClick={() => start("traduction", 12, "original->translation")}
        />
        <ExoCard
          tone="bg-verbes text-verbes-foreground"
          icon={<Languages className="h-6 w-6" />}
          title="Traduction"
          subtitle={`Français → ${target}`}
          onClick={() => start("traduction", 12, "translation->original")}
        />
        <ExoCard
          tone="bg-adjectifs text-adjectifs-foreground"
          icon={<ListChecks className="h-6 w-6" />}
          title="QCM"
          subtitle="4 réponses possibles"
          onClick={() => start("qcm", 10)}
        />
        <ExoCard
          tone="bg-expressions text-expressions-foreground"
          icon={<Repeat className="h-6 w-6" />}
          title="Conjugaison"
          subtitle="Conjugue le verbe demandé"
          onClick={() => start("conjugaison", 10)}
        />
        <ExoCard
          tone="bg-primary text-primary-foreground"
          icon={<SpellCheck className="h-6 w-6" />}
          title="Romanisation"
          subtitle="hakgyo → 학교"
          onClick={() => start("romanisation", 10)}
        />
      </div>
    </Screen>
  );
}

function ExoCard({
  tone,
  icon,
  title,
  subtitle,
  onClick,
}: {
  tone: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left transition active:scale-[0.99]"
    >
      <PastelCard tone={tone} className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black/10">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-xl font-extrabold leading-tight">{title}</div>
          <div className="mt-0.5 text-sm font-medium opacity-80">{subtitle}</div>
        </div>
      </PastelCard>
    </button>
  );
}
