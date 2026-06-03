import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Screen } from "@/components/mobile/Screen";
import { LangAvatar, ProgressBar, ScreenHeader } from "@/components/mobile/primitives";
import { useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { listLanguages, getLanguageProgress, type Language } from "@/lib/db";

export const Route = createFileRoute("/languages")({
  component: LanguagesPage,
});

function LanguagesPage() {
  const { data: langs = [] } = useQuery({ queryKey: ["languages"], queryFn: listLanguages });
  const { langId, setLangId } = useSelectedLanguage();

  return (
    <Screen>
      <ScreenHeader
        title="Mes langues"
        avatar={
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted" />
        }
        right={
          <Link
            to="/language/new"
            aria-label="Ajouter une langue"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition active:scale-95"
          >
            <Plus className="h-5 w-5" />
          </Link>
        }
      />

      {langs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-4 space-y-4">
          {langs.map((l) => (
            <LanguageCard
              key={l.id}
              language={l}
              active={l.id === langId}
              onActivate={() => setLangId(l.id)}
            />
          ))}

          <Link
            to="/language/new"
            className="flex h-[72px] w-full items-center justify-center rounded-3xl border border-dashed border-border text-base font-semibold text-muted-foreground transition active:scale-[0.99]"
          >
            Ajouter une langue
          </Link>
        </div>
      )}
    </Screen>
  );
}

function LanguageCard({
  language,
  active,
  onActivate,
}: {
  language: Language;
  active: boolean;
  onActivate: () => void;
}) {
  const navigate = useNavigate();
  const { data: progress } = useQuery({
    queryKey: ["langProgress", language.id],
    queryFn: () => getLanguageProgress(language.id),
  });

  const percent = progress?.percent ?? 0;
  const words = progress?.words ?? 0;

  // Tapping a non-active card makes it active and opens its detail.
  // Tapping the already-active card opens its detail directly.
  function handleTap() {
    if (!active) onActivate();
    navigate({ to: "/language/$id", params: { id: language.id } });
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      className="block w-full rounded-3xl bg-card p-5 text-left transition active:scale-[0.99]"
    >
      <div className="flex items-start gap-4">
        <LangAvatar icon={language.icon || "🌐"} size="lg" variant="lime" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-bold leading-tight">{language.name}</div>
          <div className="mt-0.5 truncate text-sm text-muted-foreground">
            {words} mot{words > 1 ? "s" : ""} enregistré{words > 1 ? "s" : ""}
          </div>
        </div>
        {active && (
          <span className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
            active
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <ProgressBar value={percent} className="flex-1" />
        <span className="shrink-0 text-sm font-bold text-primary">{percent}%</span>
      </div>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="mt-24 flex flex-col items-center text-center">
      <div className="text-6xl">🌐</div>
      <p className="mt-5 text-sm text-muted-foreground">
        Aucune langue pour l'instant. Créez votre première langue pour commencer à enregistrer des
        mots.
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
