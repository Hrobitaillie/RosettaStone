import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Repeat } from "lucide-react";
import { Screen } from "@/components/mobile/Screen";
import {
  ScreenHeader,
  LangAvatar,
  Card,
  PastelCard,
  BigButton,
} from "@/components/mobile/primitives";
import { useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { ExerciseEmpty } from "@/components/exercise/ExerciseEmpty";
import { getDueCards, getMasteryCounts, getSettings } from "@/lib/db";

export const Route = createFileRoute("/review")({
  component: ReviewPage,
});

function ReviewPage() {
  const { current, langId } = useSelectedLanguage();
  const navigate = useNavigate();

  const { data: due } = useQuery({
    queryKey: ["dueCards", langId],
    queryFn: () => getDueCards(langId),
    enabled: langId !== "",
  });
  const { data: mastery } = useQuery({
    queryKey: ["mastery", langId],
    queryFn: () => getMasteryCounts(langId),
    enabled: langId !== "",
  });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });

  const header = (
    <ScreenHeader
      title="Révision"
      avatar={<LangAvatar icon={<Repeat className="h-6 w-6" />} size="lg" variant="muted" />}
      back="/exercises"
    />
  );

  if (langId === "" || !current) {
    return (
      <Screen>
        {header}
        <ExerciseEmpty
          emoji="🌐"
          message="Aucune langue pour l'instant. Créez une langue pour commencer à réviser."
          to="/language/new"
          cta="Créer une langue"
        />
      </Screen>
    );
  }

  const total = due?.total ?? 0;
  const perDay = settings?.cards_per_day ?? 20;

  function start() {
    const count = total > 0 ? Math.min(total, perDay) : 0;
    navigate({
      to: "/exercise/$type",
      params: { type: "review" },
      search: { count: count || perDay, dir: "original->translation" },
    });
  }

  return (
    <Screen className="flex flex-col">
      {header}

      {/* Big lime card */}
      <PastelCard tone="bg-primary text-primary-foreground" className="mt-4">
        <div className="text-6xl font-extrabold leading-none">{total}</div>
        <div className="mt-2 text-base font-semibold">cartes à réviser aujourd'hui</div>
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <SubStat value={due?.new.length ?? 0} label="nouveau" />
          <SubStat value={due?.learning.length ?? 0} label="en cours" />
          <SubStat value={due?.due.length ?? 0} label="à revoir" />
        </div>
      </PastelCard>

      {/* Niveaux de maîtrise */}
      <Card className="mt-4">
        <h2 className="text-lg font-bold">Niveaux de maîtrise</h2>
        <div className="mt-4 space-y-3.5">
          <MasteryRow dot="bg-srs-new" label="Nouveau" count={mastery?.new ?? 0} />
          <MasteryRow dot="bg-srs-learning" label="En cours" count={mastery?.learning ?? 0} />
          <MasteryRow dot="bg-srs-mature" label="Mûr" count={mastery?.mature ?? 0} />
          <MasteryRow dot="bg-srs-mastered" label="Maîtrisé" count={mastery?.mastered ?? 0} />
        </div>
      </Card>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Algorithme de répétition espacée · prochaines révisions calculées selon vos réponses
      </p>

      <div className="mt-auto pt-10">
        <BigButton variant="primary" onClick={start} disabled={total === 0}>
          Commencer la révision
        </BigButton>
      </div>
    </Screen>
  );
}

function SubStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-black/10 px-3 py-3 text-center">
      <div className="text-xl font-extrabold leading-none">{value}</div>
      <div className="mt-1 text-xs font-medium">{label}</div>
    </div>
  );
}

function MasteryRow({ dot, label, count }: { dot: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`h-3 w-3 rounded-full ${dot}`} />
      <span className="flex-1 font-semibold">{label}</span>
      <span className="text-muted-foreground">{count}</span>
    </div>
  );
}
