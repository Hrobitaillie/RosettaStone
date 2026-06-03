import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listVerbs, upsertVerb, type Conjugation } from "@/lib/db";
import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Screen } from "@/components/mobile/Screen";
import { ScreenHeader, Pill, PillRow } from "@/components/mobile/primitives";
import { FAB } from "@/components/mobile/FAB";
import { LanguagePicker, useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { Drawer, DrawerContent, DrawerClose } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/verbs")({
  component: VerbsPage,
});

const DEFAULT_FORMS = ["Présent poli", "Présent formel", "Passé", "Futur", "Impératif"];

type Filter = "all" | "regular" | "irregular" | "favorites";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "regular", label: "Réguliers" },
  { key: "irregular", label: "Irréguliers" },
  { key: "favorites", label: "Favoris" },
];

const emptyForm = () => ({
  infinitive: "",
  romanization: "",
  translation: "",
  is_irregular: false,
  conjugations: DEFAULT_FORMS.map((f) => ({
    form_name: f,
    form_value: "",
    romanization: "",
  })) as Conjugation[],
});

/** Pull a trailing single-glyph hint out of notes, e.g. "ㄷ" / "ㄹ" irregularity. */
function consonantHint(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.trim().match(/([ᄀ-ᇿ㄰-㆏])\s*$/);
  return m ? m[1] : null;
}

function VerbsPage() {
  const qc = useQueryClient();
  const { languages, current, setLangId } = useSelectedLanguage();
  const langId = current?.id ?? "";

  const { data: verbs = [] } = useQuery({
    queryKey: ["verbs", langId],
    queryFn: () => listVerbs(langId),
    enabled: !!langId,
  });

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return verbs.filter((v) => {
      if (filter === "regular" && v.is_irregular) return false;
      if (filter === "irregular" && !v.is_irregular) return false;
      if (filter === "favorites" && !v.is_favorite) return false;
      if (!term) return true;
      return [v.infinitive, v.romanization, v.translation]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(term));
    });
  }, [verbs, query, filter]);

  function openNew() {
    setForm(emptyForm());
    setOpen(true);
  }

  function patchConj(i: number, patch: Partial<Conjugation>) {
    setForm((f) => ({
      ...f,
      conjugations: f.conjugations.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!langId) return;
    const infinitive = form.infinitive.trim();
    const translation = form.translation.trim();
    if (!infinitive || !translation) {
      toast.error("Infinitif et traduction requis");
      return;
    }
    const conjugations: Conjugation[] = form.conjugations
      .filter((c) => c.form_name.trim() && c.form_value.trim())
      .map((c) => ({
        form_name: c.form_name.trim(),
        form_value: c.form_value.trim(),
        romanization: c.romanization?.trim() || null,
      }));
    await upsertVerb({
      language_id: langId,
      infinitive,
      romanization: form.romanization.trim() || null,
      translation,
      is_irregular: form.is_irregular,
      conjugations,
    });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["verbs"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    toast.success("Verbe ajouté");
  }

  if (!languages.length) {
    return (
      <Screen>
        <ScreenHeader title="Verbes" />
        <EmptyNoLang />
      </Screen>
    );
  }

  return (
    <>
      <Screen>
        <ScreenHeader
          title={
            <span className="flex items-baseline gap-2">
              <span>Verbes</span>
              <span className="text-base font-semibold text-muted-foreground">{verbs.length}</span>
            </span>
          }
          right={<LanguagePicker languages={languages} current={current} onSelect={setLangId} />}
        />

        {/* Search */}
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher un verbe…"
            className="h-12 rounded-full border-0 bg-muted pl-12 pr-4 text-base placeholder:text-muted-foreground focus-visible:ring-0"
          />
        </div>

        {/* Filters */}
        <PillRow className="mt-4">
          {FILTERS.map((f) => (
            <Pill key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </Pill>
          ))}
        </PillRow>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="mt-16 text-center text-sm text-muted-foreground">
            {verbs.length === 0
              ? "Pas encore de verbe. Touchez le + pour en ajouter."
              : "Aucun verbe ne correspond."}
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {filtered.map((v) => {
              const hint = v.is_irregular ? consonantHint(v.notes) : null;
              return (
                <li key={v.id}>
                  <Link
                    to="/verb/$id"
                    params={{ id: v.id }}
                    className="flex items-start gap-4 py-4 active:opacity-70"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-2xl font-bold leading-tight">{v.infinitive}</div>
                      {v.romanization && (
                        <div className="mt-0.5 text-sm text-muted-foreground">{v.romanization}</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="font-bold leading-tight">{v.translation}</div>
                      <div
                        className={cn(
                          "mt-1 flex items-center gap-1.5 text-sm",
                          v.is_irregular ? "font-semibold text-noms-bar" : "text-muted-foreground",
                        )}
                      >
                        {v.is_irregular ? "irrégulier" : "régulier"}
                        {hint && (
                          <span className="rounded border border-current px-1 text-xs leading-tight">
                            {hint}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Screen>

      <FAB onClick={openNew} label="Nouveau verbe" />

      {/* Create drawer */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[92vh]">
          <form
            onSubmit={save}
            className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden px-5 pb-6 pt-2"
          >
            <div className="mt-2 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Nouveau verbe</h2>
              <DrawerClose asChild>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </DrawerClose>
            </div>

            <div className="-mx-1 mt-4 flex-1 space-y-4 overflow-y-auto px-1 pb-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="inf">Infinitif</Label>
                  <Input
                    id="inf"
                    value={form.infinitive}
                    onChange={(e) => setForm({ ...form, infinitive: e.target.value })}
                    autoFocus
                    className="h-12 rounded-2xl bg-muted text-lg font-bold"
                    placeholder="먹다"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rom">Romanisation</Label>
                  <Input
                    id="rom"
                    value={form.romanization}
                    onChange={(e) => setForm({ ...form, romanization: e.target.value })}
                    className="h-12 rounded-2xl bg-muted"
                    placeholder="meokda"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vtrans">Traduction</Label>
                <Input
                  id="vtrans"
                  value={form.translation}
                  onChange={(e) => setForm({ ...form, translation: e.target.value })}
                  className="h-12 rounded-2xl bg-muted"
                  placeholder="manger"
                />
              </div>

              <label className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
                <span className="font-semibold">Verbe irrégulier</span>
                <Switch
                  checked={form.is_irregular}
                  onCheckedChange={(v) => setForm({ ...form, is_irregular: v })}
                />
              </label>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Conjugaisons</Label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        conjugations: [
                          ...f.conjugations,
                          { form_name: "", form_value: "", romanization: "" },
                        ],
                      }))
                    }
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> Ajouter une forme
                  </button>
                </div>
                {form.conjugations.map((c, i) => (
                  <div key={i} className="space-y-2 rounded-2xl bg-card p-3">
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-10 flex-1 rounded-xl bg-muted text-sm"
                        placeholder="Nom de la forme"
                        value={c.form_name}
                        onChange={(e) => patchConj(i, { form_name: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            conjugations: f.conjugations.filter((_, idx) => idx !== i),
                          }))
                        }
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
                        aria-label="Retirer la forme"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <Input
                      className="h-11 rounded-xl bg-muted text-lg font-bold"
                      placeholder="Conjugaison"
                      value={c.form_value}
                      onChange={(e) => patchConj(i, { form_value: e.target.value })}
                    />
                    <Input
                      className="h-10 rounded-xl bg-muted text-sm"
                      placeholder="Romanisation"
                      value={c.romanization ?? ""}
                      onChange={(e) => patchConj(i, { romanization: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="mt-3 flex h-14 w-full items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground active:scale-[0.98]"
            >
              Ajouter le verbe
            </button>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function EmptyNoLang() {
  return (
    <div className="mt-20 flex flex-col items-center px-6 text-center">
      <div className="text-6xl">✨</div>
      <p className="mt-4 text-sm text-muted-foreground">
        Créez d'abord une langue pour conjuguer des verbes.
      </p>
      <Link
        to="/language/new"
        className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
      >
        Créer une langue
      </Link>
    </div>
  );
}
