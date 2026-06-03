import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { Screen } from "@/components/mobile/Screen";
import {
  LangAvatar,
  Card,
  PastelCard,
} from "@/components/mobile/primitives";
import { useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { getDashboard, getSettings } from "@/lib/db";
import { categoryKeyOf } from "@/lib/categories";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Home,
});

const CATEGORY_LABELS: Record<string, string> = {
  noms: "NOM",
  verbes: "VERBE",
  adjectifs: "ADJECTIF",
  expressions: "EXPRESSION",
  autres: "AUTRE",
};

function Home() {
  const { current, langId } = useSelectedLanguage();
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(langId || undefined),
    enabled: langId !== "",
  });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });

  if (langId === "" || !current) {
    return (
      <Screen>
        <EmptyState />
      </Screen>
    );
  }

  const profileName = settings?.profile_name ?? "Apprenant";
  const weekly = data?.weekly ?? [];
  const maxWeekly = Math.max(1, ...weekly.map((w) => w.count));
  // The lime bar = the most recent day with activity (rightmost non-zero).
  let limeIndex = -1;
  for (let i = weekly.length - 1; i >= 0; i--) {
    if (weekly[i].count > 0) {
      limeIndex = i;
      break;
    }
  }

  return (
    <Screen>
      {/* Header */}
      <header className="flex items-center gap-3 pb-2 pt-1">
        <LangAvatar icon={current.icon || "🌐"} size="lg" variant="lime" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold leading-tight">{profileName}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {current.name}
            {current.alphabet ? ` · ${current.alphabet}` : ""}
          </p>
        </div>
        <Link
          to="/settings"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition active:scale-95"
          aria-label="Réglages"
        >
          <Settings className="h-5 w-5 text-muted-foreground" />
        </Link>
      </header>

      {/* Streak + Due */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Card className="flex flex-col justify-center">
          <div className="text-4xl font-extrabold leading-none">{data?.profile.streak ?? 0}</div>
          <div className="mt-2 text-sm text-muted-foreground">jours de série</div>
        </Card>
        <Link to="/review" className="block transition active:scale-[0.98]">
          <PastelCard tone="bg-primary text-primary-foreground" className="flex h-full flex-col justify-center">
            <div className="text-4xl font-extrabold leading-none">{data?.dueCount ?? 0}</div>
            <div className="mt-2 text-sm font-semibold">à réviser</div>
          </PastelCard>
        </Link>
      </div>

      {/* Pastel stat cards */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <StatCard to="/dictionary" tone="bg-noms text-noms-foreground" value={data?.words ?? 0} label="Mots" />
        <StatCard to="/verbs" tone="bg-verbes text-verbes-foreground" value={data?.verbs ?? 0} label="Verbes" />
        <StatCard to="/notes" tone="bg-adjectifs text-adjectifs-foreground" value={data?.notes ?? 0} label="Notes" />
      </div>

      {/* Weekly chart */}
      <Card className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold">Cette semaine</span>
          <span className="text-sm font-semibold text-primary">+{data?.weeklyTotal ?? 0} mots</span>
        </div>
        <div className="mt-5 flex h-28 items-end justify-between gap-2">
          {weekly.map((bar, i) => {
            const ratio = bar.count / maxWeekly;
            const heightPct = bar.count > 0 ? 25 + ratio * 75 : 12;
            const isLime = i === limeIndex;
            return (
              <div key={`${bar.key}-${i}`} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-full w-full items-end justify-center">
                  <div
                    className={cn(
                      "w-full max-w-[18px] rounded-full",
                      isLime ? "bg-primary" : "bg-muted",
                    )}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{bar.label}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recent additions */}
      <section className="mt-6">
        <h2 className="text-xl font-bold">Derniers ajouts</h2>
        {data && data.recent.length > 0 ? (
          <ul className="mt-3 divide-y divide-border">
            {data.recent.map((w) => (
              <li key={w.id}>
                <Link
                  to="/word/$id"
                  params={{ id: w.id }}
                  className="flex items-baseline gap-3 py-3.5"
                >
                  <span className="text-xl font-bold">{w.original}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{w.translation}</span>
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {CATEGORY_LABELS[categoryKeyOf(w.category)]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 py-6 text-center text-sm text-muted-foreground">
            Aucun mot pour l'instant.{" "}
            <Link to="/dictionary" className="font-semibold text-primary">
              Ajouter un mot
            </Link>
          </p>
        )}
      </section>
    </Screen>
  );
}

function StatCard({
  to,
  tone,
  value,
  label,
}: {
  to: "/dictionary" | "/verbs" | "/notes";
  tone: string;
  value: number;
  label: string;
}) {
  return (
    <Link to={to} className="block transition active:scale-[0.97]">
      <PastelCard tone={tone} className="p-4">
        <div className="text-3xl font-extrabold leading-none">{value}</div>
        <div className="mt-1.5 text-sm font-medium">{label}</div>
      </PastelCard>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="mt-24 flex flex-col items-center text-center">
      <div className="text-6xl">🌐</div>
      <p className="mt-5 text-sm text-muted-foreground">
        Aucune langue pour l'instant. Créez votre première langue pour commencer.
      </p>
      <Link
        to="/language/new"
        className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 font-bold text-primary-foreground transition active:scale-95"
      >
        Créer une langue
      </Link>
    </div>
  );
}
