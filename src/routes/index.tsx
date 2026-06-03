import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Languages, NotebookPen, Sparkles, TrendingUp, ArrowRight, Settings } from "lucide-react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { AppShell } from "@/components/mobile/AppShell";
import { getStats } from "@/lib/db";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { data } = useQuery({ queryKey: ["stats"], queryFn: () => getStats() });

  return (
    <>
      <MobileHeader
        title={
          <span className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="font-display">RosettaStone</span>
          </span>
        }
        subtitle="Votre dictionnaire personnel"
        right={
          <Link
            to="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
            aria-label="Réglages"
          >
            <Settings className="h-5 w-5" />
          </Link>
        }
      />
      <AppShell>
        <div className="px-5 pt-5 pb-10">
          <h1 className="font-display text-4xl leading-tight">
            Bonjour <span className="text-primary">👋</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Capturez les mots que vous croisez aujourd'hui.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <StatCard label="Langues" value={data?.languages ?? 0} icon={Languages} />
            <StatCard label="Mots" value={data?.words ?? 0} icon={BookOpen} />
            <StatCard label="Verbes" value={data?.verbs ?? 0} icon={Sparkles} />
            <StatCard label="Notes" value={data?.notes ?? 0} icon={NotebookPen} />
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4 text-primary" /> Cette semaine
            </div>
            <div className="mt-2 font-display text-4xl">{data?.thisWeek ?? 0}</div>
            <p className="text-xs text-muted-foreground">nouveaux mots ajoutés</p>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between px-5 pt-5">
              <span className="text-sm font-medium">Derniers mots</span>
              <Link
                to="/dictionary"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary"
              >
                Tout voir <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <ul className="mt-2 divide-y divide-border px-5 pb-4">
              {(data?.recent ?? []).map((w) => (
                <li key={w.id} className="flex items-baseline justify-between py-3">
                  <span className="truncate font-medium">{w.original}</span>
                  <span className="ml-3 truncate text-sm text-muted-foreground">{w.translation}</span>
                </li>
              ))}
              {!data?.recent?.length && (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  Pas encore de mot.{" "}
                  <Link to="/dictionary" className="font-medium text-primary">
                    Ajouter
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      </AppShell>
    </>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-1 font-display text-3xl">{value}</div>
    </div>
  );
}
