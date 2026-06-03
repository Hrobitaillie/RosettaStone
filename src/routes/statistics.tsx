import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { Screen } from "@/components/mobile/Screen";
import { ScreenHeader, LangAvatar, Card, PastelCard } from "@/components/mobile/primitives";
import { useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { getStats } from "@/lib/db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/statistics")({
  component: StatisticsPage,
});

const CATEGORY_BAR: Record<string, string> = {
  noms: "bg-noms-bar",
  verbes: "bg-verbes-bar",
  adjectifs: "bg-adjectifs-bar",
  expressions: "bg-expressions-bar",
  autres: "bg-muted-foreground",
};

function StatisticsPage() {
  const { current, langId } = useSelectedLanguage();
  const { data } = useQuery({
    queryKey: ["stats"],
    queryFn: () => getStats(langId || undefined),
    enabled: langId !== "",
  });

  const header = (
    <ScreenHeader
      title="Statistiques"
      avatar={<LangAvatar icon={<BarChart3 className="h-6 w-6" />} size="lg" variant="muted" />}
      back="/"
    />
  );

  if (langId === "" || !current) {
    return (
      <Screen>
        {header}
        <div className="mt-24 flex flex-col items-center text-center">
          <div className="text-6xl">📊</div>
          <p className="mt-5 text-sm text-muted-foreground">
            Aucune langue pour l'instant. Créez une langue pour suivre vos progrès.
          </p>
          <Link
            to="/language/new"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 font-bold text-primary-foreground transition active:scale-95"
          >
            Créer une langue
          </Link>
        </div>
      </Screen>
    );
  }

  const byCategory = data?.byCategory ?? [];
  const maxCount = Math.max(1, ...byCategory.map((c) => c.count));
  const activity = data?.activity ?? [];

  return (
    <Screen>
      {header}

      {/* Pastel stat cards */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <PastelCard tone="bg-noms text-noms-foreground" className="p-4">
          <div className="text-2xl font-extrabold leading-none">+{data?.thisMonth ?? 0}</div>
          <div className="mt-1.5 text-sm font-medium">ce mois</div>
        </PastelCard>
        <PastelCard tone="bg-verbes text-verbes-foreground" className="p-4">
          <div className="text-2xl font-extrabold leading-none">{data?.reviews ?? 0}</div>
          <div className="mt-1.5 text-sm font-medium">révisions</div>
        </PastelCard>
        <PastelCard tone="bg-adjectifs text-adjectifs-foreground" className="p-4">
          <div className="text-2xl font-extrabold leading-none">{data?.successRate ?? 0}%</div>
          <div className="mt-1.5 text-sm font-medium">réussite</div>
        </PastelCard>
      </div>

      {/* Category breakdown */}
      <Card className="mt-4">
        <h2 className="text-lg font-bold">Répartition par catégorie</h2>
        <div className="mt-4 space-y-4">
          {byCategory.map((c) => (
            <div key={c.key}>
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{c.label}</span>
                <span className="text-sm text-muted-foreground">{c.count}</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", CATEGORY_BAR[c.key] ?? CATEGORY_BAR.autres)}
                  style={{ width: `${(c.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Activity heatmap */}
      <Card className="mt-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">Série d'activité</h2>
          <span className="text-sm font-semibold text-primary">{data?.streak ?? 0} jours</span>
        </div>
        <div className="mt-4 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1.5">
          {activity.map((count, i) => (
            <div
              key={i}
              className={cn("aspect-square rounded-md", heatColor(count))}
              title={`${count} activité${count > 1 ? "s" : ""}`}
            />
          ))}
        </div>
      </Card>
    </Screen>
  );
}

function heatColor(count: number): string {
  if (count <= 0) return "bg-muted";
  if (count < 3) return "bg-primary/30";
  if (count < 6) return "bg-primary/60";
  return "bg-primary";
}
