import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { CheckSquare, RotateCcw, Search, Star, X } from "lucide-react";
import { bulkResetLearnStage, listWords } from "@/lib/db";
import { categoryKeyOf, type CategoryKey } from "@/lib/categories";
import { Screen } from "@/components/mobile/Screen";
import { ScreenHeader, Pill, PillRow, BigButton } from "@/components/mobile/primitives";
import { FAB } from "@/components/mobile/FAB";
import { LanguagePicker, useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { WordRow } from "@/components/dictionary/WordRow";
import { WordDrawer } from "@/components/dictionary/WordDrawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const qc = useQueryClient();
  const { languages, current, setLangId } = useSelectedLanguage();
  const langId = current?.id ?? "";

  const { data: words = [] } = useQuery({
    queryKey: ["words", langId],
    queryFn: () => listWords(langId),
    enabled: !!langId,
  });

  const [filter, setFilter] = useState<FilterKey>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Bulk-selection state: enter on long-press, exit when set is empty + button.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const resetMutation = useMutation({
    mutationFn: (ids: string[]) => bulkResetLearnStage(ids),
    onSuccess: (n) => {
      toast.success(n > 1 ? `${n} mots réinitialisés` : "Mot réinitialisé", {
        description: "Ils repartent en stade 0 (découverte).",
      });
      qc.invalidateQueries({ queryKey: ["words"] });
      exitSelection();
    },
    onError: () => toast.error("Impossible de réinitialiser ces mots."),
  });

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

  const enterSelectionWith = useCallback((id: string) => {
    setSelectionMode(true);
    setSelected((s) => {
      const next = new Set(s);
      next.add(id);
      return next;
    });
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelected(new Set());
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelected(new Set(filtered.map((w) => w.id)));
  }, [filtered]);

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
      <Screen padded={!selectionMode} className={cn(selectionMode && "pb-32")}>
        {selectionMode ? (
          <SelectionHeader
            count={selected.size}
            total={filtered.length}
            onCancel={exitSelection}
            onSelectAll={selectAllFiltered}
          />
        ) : (
          <ScreenHeader
            title="Dictionnaire"
            right={<LanguagePicker languages={languages} current={current} onSelect={setLangId} />}
          />
        )}

        <div className={cn(selectionMode ? "px-5" : "")}>
          {/* Search field → navigates to dedicated search screen */}
          {!selectionMode && (
            <button
              type="button"
              onClick={() => navigate({ to: "/search" })}
              className="mt-2 flex w-full items-center gap-3 rounded-full bg-muted px-5 py-3.5 text-left text-muted-foreground"
            >
              <Search className="h-5 w-5" />
              <span>Mot, romanisation, traduction…</span>
            </button>
          )}

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
              <WordRow
                key={w.id}
                word={w}
                selectionMode={selectionMode}
                selected={selected.has(w.id)}
                onToggle={toggleSelected}
                onLongPress={enterSelectionWith}
              />
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
        </div>
      </Screen>

      {!selectionMode && <FAB onClick={() => setDrawerOpen(true)} label="Nouveau mot" />}

      {selectionMode && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-5 pb-6 pt-3 safe-x">
          <BigButton
            variant="primary"
            onClick={() => setConfirmOpen(true)}
            disabled={selected.size === 0 || resetMutation.isPending}
          >
            <RotateCcw className="mr-2 h-5 w-5" />
            Réinitialiser l'apprentissage ({selected.size})
          </BigButton>
        </div>
      )}

      <WordDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        langId={langId}
        alphabet={current?.alphabet}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Réinitialiser {selected.size} mot{selected.size > 1 ? "s" : ""} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ces mots repartent au stade 0 (découverte). Leurs reviews SRS ne sont pas touchées,
              mais ils repassent par les 5 stades du mode apprentissage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetMutation.mutate(Array.from(selected));
                setConfirmOpen(false);
              }}
            >
              Réinitialiser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SelectionHeader({
  count,
  total,
  onCancel,
  onSelectAll,
}: {
  count: number;
  total: number;
  onCancel: () => void;
  onSelectAll: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-3">
      <button
        type="button"
        onClick={onCancel}
        aria-label="Quitter la sélection"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition active:scale-95"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-base font-extrabold">
          {count} sélectionné{count > 1 ? "s" : ""}
        </div>
        <div className="text-xs text-muted-foreground">sur {total} visibles</div>
      </div>
      <button
        type="button"
        onClick={onSelectAll}
        className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-semibold text-muted-foreground active:scale-95"
      >
        <CheckSquare className="h-4 w-4" /> Tout
      </button>
    </div>
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
