import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listWords,
  upsertWord,
  deleteWord,
  toggleWordFavorite,
  findDuplicates,
  type Word,
} from "@/lib/db";
import { useEffect, useMemo, useState } from "react";
import { Star, Trash2, Search, AlertCircle, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { AppShell } from "@/components/mobile/AppShell";
import { FAB } from "@/components/mobile/FAB";
import { LanguagePicker, useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { Drawer, DrawerContent, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dictionary")({
  component: DictionaryPage,
});

const empty = {
  original: "",
  transcription: "",
  translation: "",
  category: "",
  level: "",
  notes: "",
};

const LEVELS = ["débutant", "intermédiaire", "avancé"] as const;

type MaskKey = "original" | "transcription" | "translation";
const MASK_STORAGE = "rs.maskedFields";
const MASK_LABEL: Record<MaskKey, string> = {
  original: "Mot",
  transcription: "Transcription",
  translation: "Traduction",
};

function useMaskedFields() {
  const [masked, setMasked] = useState<Set<MaskKey>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(MASK_STORAGE);
      if (!raw) return new Set();
      const arr = JSON.parse(raw) as MaskKey[];
      return new Set(arr.filter((k): k is MaskKey => k === "original" || k === "transcription" || k === "translation"));
    } catch {
      return new Set();
    }
  });

  function toggle(k: MaskKey) {
    setMasked((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      try {
        localStorage.setItem(MASK_STORAGE, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  return { masked, toggle };
}

function DictionaryPage() {
  const qc = useQueryClient();
  const { languages, current, setLangId } = useSelectedLanguage();
  const langId = current?.id ?? "";

  const { data: words = [] } = useQuery({
    queryKey: ["words", langId],
    queryFn: () => listWords(langId),
    enabled: !!langId,
  });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const { masked, toggle: toggleMask } = useMaskedFields();

  const homonyms = useMemo(() => {
    const m = new Map<string, number>();
    words.forEach((w) =>
      m.set(w.original.toLowerCase(), (m.get(w.original.toLowerCase()) || 0) + 1),
    );
    return m;
  }, [words]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return words.filter((w) => {
      if (filter === "favorites" && !w.is_favorite) return false;
      if (!q) return true;
      return [w.original, w.transcription, w.translation, w.category, w.notes].some((v) =>
        v?.toLowerCase().includes(q),
      );
    });
  }, [words, search, filter]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Word | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [dups, setDups] = useState<Word[]>([]);

  function openNew() {
    setEditing(null);
    setForm({ ...empty });
    setDups([]);
    setOpen(true);
  }
  function openEdit(w: Word) {
    setEditing(w);
    setForm({
      original: w.original,
      transcription: w.transcription ?? "",
      translation: w.translation,
      category: w.category ?? "",
      level: w.level ?? "",
      notes: w.notes ?? "",
    });
    setDups([]);
    setOpen(true);
  }

  async function onOriginalBlur() {
    if (!form.original.trim() || editing || !langId) return;
    const res = await findDuplicates(langId, form.original);
    setDups(res);
  }

  async function save(e: React.FormEvent, force = false) {
    e.preventDefault();
    if (!langId) return;
    if (!editing && dups.length && !force) return;
    await upsertWord({
      id: editing?.id,
      language_id: langId,
      original: form.original.trim(),
      transcription: form.transcription.trim() || null,
      translation: form.translation.trim(),
      category: form.category.trim() || null,
      level: form.level || null,
      notes: form.notes.trim() || null,
    });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["words"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    toast.success(editing ? "Mot modifié" : "Mot ajouté");
  }
  async function remove(w: Word) {
    if (!confirm(`Supprimer "${w.original}" ?`)) return;
    await deleteWord(w.id);
    qc.invalidateQueries({ queryKey: ["words"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
  }
  async function fav(w: Word) {
    await toggleWordFavorite(w.id, !w.is_favorite);
    qc.invalidateQueries({ queryKey: ["words"] });
  }

  if (!languages.length) {
    return (
      <>
        <MobileHeader title="Dictionnaire" />
        <AppShell>
          <EmptyNoLang />
        </AppShell>
      </>
    );
  }

  return (
    <>
      <MobileHeader
        title="Dictionnaire"
        subtitle={`${filtered.length} mot${filtered.length > 1 ? "s" : ""}`}
        right={<LanguagePicker languages={languages} current={current} onSelect={setLangId} />}
      />
      <AppShell>
        <div className="px-5 pt-3 pb-10">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un mot, une traduction…"
              className="h-11 rounded-full bg-muted/70 pl-10 pr-10 placeholder:text-muted-foreground"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full hover:bg-muted"
                aria-label="Effacer"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
              Tous
            </FilterPill>
            <FilterPill active={filter === "favorites"} onClick={() => setFilter("favorites")}>
              <Star className="h-3.5 w-3.5" /> Favoris
            </FilterPill>
          </div>

          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-0.5">
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
              Masquer
            </span>
            {(["original", "transcription", "translation"] as MaskKey[]).map((k) => {
              const on = masked.has(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleMask(k)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition",
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {on ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {MASK_LABEL[k]}
                </button>
              );
            })}
          </div>

          <ul className="mt-4 space-y-2">
            {filtered.map((w) => (
              <li
                key={w.id}
                className="rounded-2xl border border-border bg-card p-4 active:bg-muted/50"
                onClick={() => openEdit(w)}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fav(w);
                    }}
                    aria-label="Favori"
                    className="-m-1 p-1"
                  >
                    <Star
                      className={cn(
                        "h-5 w-5 transition",
                        w.is_favorite
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground",
                      )}
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <MaskedText
                        value={w.original}
                        masked={masked.has("original")}
                        className="truncate font-display text-2xl leading-tight"
                      />
                      {homonyms.get(w.original.toLowerCase())! > 1 && (
                        <Badge variant="secondary" className="text-[9px]">
                          homonyme
                        </Badge>
                      )}
                    </div>
                    {w.transcription && (
                      <MaskedText
                        value={w.transcription}
                        masked={masked.has("transcription")}
                        className="text-sm italic text-muted-foreground"
                      />
                    )}
                    <MaskedText
                      value={w.translation}
                      masked={masked.has("translation")}
                      className="mt-1 truncate text-sm"
                    />
                    {(w.category || w.level) && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {w.category && (
                          <Badge variant="outline" className="text-[10px]">
                            {w.category}
                          </Badge>
                        )}
                        {w.level && (
                          <Badge variant="outline" className="text-[10px]">
                            {w.level}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(w);
                    }}
                    aria-label="Supprimer"
                    className="-m-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
            {!filtered.length && (
              <li className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
                {search ? "Aucun résultat." : "Pas encore de mot. Touchez le + pour en ajouter."}
              </li>
            )}
          </ul>
        </div>
      </AppShell>

      <FAB onClick={openNew} label="Nouveau mot" />

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[92vh]">
          <form
            onSubmit={(e) => save(e)}
            className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden px-5 pb-4 pt-2"
          >
            <div className="mt-2 flex items-center justify-between">
              <h2 className="font-display text-2xl">
                {editing ? "Modifier" : "Nouveau"} mot
              </h2>
              <DrawerClose asChild>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </DrawerClose>
            </div>

            <div className="-mx-1 mt-4 flex-1 space-y-4 overflow-y-auto px-1 pb-2">
              <div>
                <Label htmlFor="original">Mot original</Label>
                <Input
                  id="original"
                  value={form.original}
                  onChange={(e) => setForm({ ...form, original: e.target.value })}
                  onBlur={onOriginalBlur}
                  required
                  autoFocus
                  className="h-12 text-lg"
                  placeholder={current?.alphabet ? `Dans ${current.alphabet}` : ""}
                />
              </div>

              {dups.length > 0 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-50/60 p-3 text-sm dark:bg-amber-950/30">
                  <div className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
                    <AlertCircle className="h-4 w-4" />
                    Ce mot existe déjà ({dups.length})
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-amber-900/80 dark:text-amber-200/80">
                    {dups.map((d) => (
                      <li key={d.id}>
                        · {d.translation}
                        {d.category ? ` (${d.category})` : ""}
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 h-8 rounded-full"
                    onClick={(e) => save(e as React.FormEvent, true)}
                  >
                    Ajouter quand même
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="trans">Transcription</Label>
                  <Input
                    id="trans"
                    value={form.transcription}
                    onChange={(e) => setForm({ ...form, transcription: e.target.value })}
                    className="h-11"
                    placeholder="annyeong"
                  />
                </div>
                <div>
                  <Label htmlFor="translation">Traduction</Label>
                  <Input
                    id="translation"
                    value={form.translation}
                    onChange={(e) => setForm({ ...form, translation: e.target.value })}
                    required
                    className="h-11"
                    placeholder="bonjour"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="cat">Catégorie</Label>
                <Input
                  id="cat"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="h-11"
                  placeholder="nom, verbe, expression…"
                />
              </div>

              <div>
                <Label>Niveau</Label>
                <div className="mt-1.5 flex gap-2">
                  {LEVELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() =>
                        setForm({ ...form, level: form.level === l ? "" : l })
                      }
                      className={cn(
                        "flex-1 rounded-full border px-3 py-2 text-xs font-medium capitalize transition",
                        form.level === l
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="min-h-[80px]"
                  placeholder="Contexte, expression utile…"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={!editing && dups.length > 0}
              className="mt-3 h-12 w-full rounded-full text-base"
            >
              {editing ? "Enregistrer" : "Ajouter le mot"}
            </Button>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function MaskedText({
  value,
  masked,
  className,
}: {
  value: string;
  masked: boolean;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (masked) setRevealed(false);
  }, [masked]);

  if (!masked) return <div className={className}>{value}</div>;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setRevealed((r) => !r);
      }}
      className={cn(
        "block max-w-full text-left transition",
        className,
        !revealed && "select-none blur-sm opacity-80",
      )}
      aria-label={revealed ? "Masquer" : "Révéler"}
    >
      {value}
    </button>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EmptyNoLang() {
  return (
    <div className="mt-20 flex flex-col items-center px-6 text-center">
      <div className="text-6xl">📚</div>
      <p className="mt-4 text-sm text-muted-foreground">
        Créez d'abord une langue dans l'onglet <strong>Langues</strong> pour ajouter des mots.
      </p>
      <Link
        to="/languages"
        className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        Aller aux langues
      </Link>
    </div>
  );
}
