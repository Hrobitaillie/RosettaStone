import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { listWords } from "@/lib/db";
import { categoryKeyOf, type CategoryKey } from "@/lib/categories";
import { Screen } from "@/components/mobile/Screen";
import { ScreenHeader, Pill, PillRow, BigButton } from "@/components/mobile/primitives";
import { FAB } from "@/components/mobile/FAB";
import { LanguagePicker, useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { WordRow } from "@/components/dictionary/WordRow";
import { WordDrawer } from "@/components/dictionary/WordDrawer";

export const Route = createFileRoute("/dictionary")({
  component: DictionaryPage,
});

type FilterKey = "all" | "favorites" | CategoryKey;

const CATEGORY_PILLS: { key: CategoryKey; label: string }[] = [
  { key: "noms", label: "Noms" },
  { key: "verbes", label: "Verbes" },
  { key: "adjectifs", label: "Adjectifs" },
  { key: "expressions", label: "Expressions" },
];

function DictionaryPage() {
  const navigate = useNavigate();
  const { languages, current, setLangId } = useSelectedLanguage();
  const langId = current?.id ?? "";

  const { data: words = [] } = useQuery({
    queryKey: ["words", langId],
    queryFn: () => listWords(langId),
    enabled: !!langId,
  });

  const [filter, setFilter] = useState<FilterKey>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Only show category pills that actually have words (besides the staples).
  const presentCategories = useMemo(() => {
    const set = new Set<CategoryKey>();
    words.forEach((w) => set.add(categoryKeyOf(w.category)));
    return set;
  }, [words]);

  const visiblePills = useMemo(
    () =>
      CATEGORY_PILLS.filter(
        (p) =>
          presentCategories.has(p.key) ||
          p.key === "noms" ||
          p.key === "verbes" ||
          p.key === "adjectifs",
      ),
    [presentCategories],
  );

  const filtered = useMemo(() => {
    return words.filter((w) => {
      if (filter === "all") return true;
      if (filter === "favorites") return w.is_favorite;
      return categoryKeyOf(w.category) === filter;
    });
  }, [words, filter]);

  if (!languages.length) {
    return (
      <Screen>
        <ScreenHeader title="Dictionnaire" />
        <EmptyNoLang />
      </Screen>
    );
  }

  return (
    <>
      <Screen>
        <ScreenHeader
          title="Dictionnaire"
          right={<LanguagePicker languages={languages} current={current} onSelect={setLangId} />}
        />

        {/* Search field → navigates to dedicated search screen */}
        <button
          type="button"
          onClick={() => navigate({ to: "/search" })}
          className="mt-2 flex w-full items-center gap-3 rounded-full bg-muted px-5 py-3.5 text-left text-muted-foreground"
        >
          <Search className="h-5 w-5" />
          <span>Mot, romanisation, traduction…</span>
        </button>

        {/* Category filters */}
        <PillRow className="mt-4">
          <Pill active={filter === "all"} onClick={() => setFilter("all")}>
            Tous
          </Pill>
          {visiblePills.map((p) => (
            <Pill key={p.key} active={filter === p.key} onClick={() => setFilter(p.key)}>
              {p.label}
            </Pill>
          ))}
          <Pill active={filter === "favorites"} onClick={() => setFilter("favorites")}>
            <Star className="h-3.5 w-3.5" /> Favoris
          </Pill>
        </PillRow>

        {/* Flat word list */}
        <div className="mt-2 divide-y divide-border">
          {filtered.map((w) => (
            <WordRow key={w.id} word={w} />
          ))}
        </div>

        {!filtered.length && (
          <div className="mt-16 text-center text-sm text-muted-foreground">
            {filter === "favorites"
              ? "Aucun favori pour l'instant."
              : words.length
                ? "Aucun mot dans cette catégorie."
                : "Pas encore de mot. Touchez le + pour en ajouter."}
          </div>
        )}
      </Screen>

      <FAB onClick={() => setDrawerOpen(true)} label="Nouveau mot" />

      <WordDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        langId={langId}
        alphabet={current?.alphabet}
      />
    </>
  );
}

function EmptyNoLang() {
  return (
    <div className="mt-24 flex flex-col items-center px-6 text-center">
      <div className="text-6xl">📚</div>
      <p className="mt-4 text-sm text-muted-foreground">
        Créez d'abord une langue pour ajouter des mots à votre dictionnaire.
      </p>
      <Link to="/language/new" className="mt-6 w-full max-w-xs">
        <BigButton>Ajouter une langue</BigButton>
      </Link>
    </div>
  );
}
