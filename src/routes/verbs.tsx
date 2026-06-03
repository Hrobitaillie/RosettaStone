import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listVerbs,
  upsertVerb,
  deleteVerb,
  toggleVerbFavorite,
  type Verb,
  type Conjugation,
} from "@/lib/db";
import { useState } from "react";
import { Pencil, Plus, Star, Trash2, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/verbs")({
  component: VerbsPage,
});

const DEFAULT_FORMS = ["Présent poli", "Présent formel", "Passé", "Futur", "Impératif"];
const empty = {
  infinitive: "",
  romanization: "",
  translation: "",
  notes: "",
  conjugations: [] as Conjugation[],
};

function VerbsPage() {
  const qc = useQueryClient();
  const { languages, current, setLangId } = useSelectedLanguage();
  const langId = current?.id ?? "";

  const { data: verbs = [] } = useQuery({
    queryKey: ["verbs", langId],
    queryFn: () => listVerbs(langId),
    enabled: !!langId,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Verb | null>(null);
  const [form, setForm] = useState({ ...empty });

  function openNew() {
    setEditing(null);
    setForm({
      ...empty,
      conjugations: DEFAULT_FORMS.map((f) => ({ form_name: f, form_value: "" })),
    });
    setOpen(true);
  }
  function openEdit(v: Verb) {
    setEditing(v);
    setForm({
      infinitive: v.infinitive,
      romanization: v.romanization ?? "",
      translation: v.translation,
      notes: v.notes ?? "",
      conjugations: v.conjugations?.length
        ? v.conjugations
        : DEFAULT_FORMS.map((f) => ({ form_name: f, form_value: "" })),
    });
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!langId) return;
    const conjugations = form.conjugations.filter(
      (c) => c.form_name.trim() && c.form_value.trim(),
    );
    await upsertVerb({
      id: editing?.id,
      language_id: langId,
      infinitive: form.infinitive.trim(),
      romanization: form.romanization.trim() || null,
      translation: form.translation.trim(),
      notes: form.notes.trim() || null,
      conjugations,
    });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["verbs"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    toast.success(editing ? "Verbe modifié" : "Verbe ajouté");
  }
  async function remove(v: Verb) {
    if (!confirm(`Supprimer ${v.infinitive} ?`)) return;
    await deleteVerb(v.id);
    qc.invalidateQueries({ queryKey: ["verbs"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
  }
  async function fav(v: Verb) {
    await toggleVerbFavorite(v.id, !v.is_favorite);
    qc.invalidateQueries({ queryKey: ["verbs"] });
  }

  if (!languages.length) {
    return (
      <>
        <MobileHeader title="Verbes" />
        <AppShell>
          <EmptyNoLang />
        </AppShell>
      </>
    );
  }

  return (
    <>
      <MobileHeader
        title="Verbes"
        subtitle={`${verbs.length} verbe${verbs.length > 1 ? "s" : ""}`}
        right={<LanguagePicker languages={languages} current={current} onSelect={setLangId} />}
      />
      <AppShell>
        <div className="px-5 pt-4 pb-10">
          {!verbs.length ? (
            <div className="mt-16 text-center text-sm text-muted-foreground">
              Pas encore de verbe. Touchez le + pour en ajouter.
            </div>
          ) : (
            <ul className="space-y-3">
              {verbs.map((v) => (
                <li
                  key={v.id}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => fav(v)}
                      aria-label="Favori"
                      className="-m-1 p-1"
                    >
                      <Star
                        className={cn(
                          "h-5 w-5",
                          v.is_favorite
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground",
                        )}
                      />
                    </button>
                    <div className="min-w-0 flex-1" onClick={() => openEdit(v)}>
                      <div className="font-display text-2xl leading-tight">{v.infinitive}</div>
                      <div className="text-sm italic text-muted-foreground">
                        {v.romanization && <>{v.romanization} · </>}
                        {v.translation}
                      </div>
                    </div>
                    <button
                      onClick={() => openEdit(v)}
                      className="-m-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                      aria-label="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(v)}
                      className="-m-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {v.conjugations?.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm">
                      {v.conjugations.map((c, i) => (
                        <div key={i}>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {c.form_name}
                          </div>
                          <div className="leading-snug">{c.form_value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </AppShell>

      <FAB onClick={openNew} label="Nouveau verbe" />

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[92vh]">
          <form
            onSubmit={save}
            className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden px-5 pb-4 pt-2"
          >
            <div className="mt-2 flex items-center justify-between">
              <h2 className="font-display text-2xl">
                {editing ? "Modifier" : "Nouveau"} verbe
              </h2>
              <DrawerClose asChild>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </DrawerClose>
            </div>

            <div className="-mx-1 mt-4 flex-1 space-y-4 overflow-y-auto px-1 pb-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="inf">Infinitif</Label>
                  <Input
                    id="inf"
                    value={form.infinitive}
                    onChange={(e) => setForm({ ...form, infinitive: e.target.value })}
                    required
                    autoFocus
                    className="h-11 text-lg"
                    placeholder="먹다"
                  />
                </div>
                <div>
                  <Label htmlFor="rom">Romanisation</Label>
                  <Input
                    id="rom"
                    value={form.romanization}
                    onChange={(e) => setForm({ ...form, romanization: e.target.value })}
                    className="h-11"
                    placeholder="meokda"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="vtrans">Traduction</Label>
                <Input
                  id="vtrans"
                  value={form.translation}
                  onChange={(e) => setForm({ ...form, translation: e.target.value })}
                  required
                  className="h-11"
                  placeholder="manger"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>Conjugaisons</Label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        conjugations: [
                          ...form.conjugations,
                          { form_name: "", form_value: "" },
                        ],
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
                  >
                    <Plus className="h-3 w-3" /> Forme
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  {form.conjugations.map((c, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                      <Input
                        className="h-10 text-xs"
                        placeholder="Forme"
                        value={c.form_name}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            conjugations: form.conjugations.map((cc, idx) =>
                              idx === i ? { ...cc, form_name: e.target.value } : cc,
                            ),
                          })
                        }
                      />
                      <Input
                        className="h-10"
                        placeholder="Valeur"
                        value={c.form_value}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            conjugations: form.conjugations.map((cc, idx) =>
                              idx === i ? { ...cc, form_value: e.target.value } : cc,
                            ),
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            conjugations: form.conjugations.filter((_, idx) => idx !== i),
                          })
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                        aria-label="Retirer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="vnotes">Notes</Label>
                <Textarea
                  id="vnotes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>

            <Button type="submit" className="mt-3 h-12 w-full rounded-full text-base">
              {editing ? "Enregistrer" : "Ajouter le verbe"}
            </Button>
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
        to="/languages"
        className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        Aller aux langues
      </Link>
    </div>
  );
}
