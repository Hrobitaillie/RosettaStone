import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  findDuplicates,
  upsertWord,
  type Word,
  type WordExample,
  type WordMeaning,
} from "@/lib/db";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pill } from "@/components/mobile/primitives";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "nom", label: "nom" },
  { value: "verbe", label: "verbe" },
  { value: "adjectif", label: "adjectif" },
  { value: "expression", label: "expression" },
] as const;

const LEVELS = ["débutant", "intermédiaire", "avancé"] as const;

type FormState = {
  original: string;
  transcription: string;
  translation: string;
  category: string;
  level: string;
  notes: string;
  meanings: WordMeaning[];
  examples: WordExample[];
};

function emptyForm(): FormState {
  return {
    original: "",
    transcription: "",
    translation: "",
    category: "",
    level: "",
    notes: "",
    meanings: [],
    examples: [],
  };
}

function formFromWord(w: Word): FormState {
  return {
    original: w.original,
    transcription: w.transcription ?? "",
    translation: w.translation,
    category: w.category ?? "",
    level: w.level ?? "",
    notes: w.notes ?? "",
    meanings: w.meanings.map((m) => ({ ...m })),
    examples: w.examples.map((e) => ({ ...e })),
  };
}

export function WordDrawer({
  open,
  onOpenChange,
  langId,
  editing,
  /** Show meaning/example editors (used on the detail page). Off = quick add. */
  advanced = false,
  alphabet,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  langId: string;
  editing?: Word | null;
  advanced?: boolean;
  alphabet?: string | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [dups, setDups] = useState<Word[]>([]);

  useEffect(() => {
    if (open) {
      setForm(editing ? formFromWord(editing) : emptyForm());
      setDups([]);
    }
  }, [open, editing]);

  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  async function onOriginalBlur() {
    if (editing || !form.original.trim() || !langId) return;
    const res = await findDuplicates(langId, form.original);
    setDups(res);
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["words"] });
    qc.invalidateQueries({ queryKey: ["word"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
  }

  async function doSave() {
    if (!langId) return;
    if (!form.original.trim() || !form.translation.trim()) {
      toast.error("Mot original et traduction requis");
      return;
    }
    await upsertWord({
      id: editing?.id,
      language_id: langId,
      original: form.original.trim(),
      transcription: form.transcription.trim() || null,
      translation: form.translation.trim(),
      category: form.category.trim() || null,
      level: form.level || null,
      notes: form.notes.trim() || null,
      meanings: form.meanings
        .filter((m) => m.translation.trim())
        .map((m) => ({
          translation: m.translation.trim(),
          category: m.category?.trim() || null,
          example_original: m.example_original?.trim() || null,
          example_translation: m.example_translation?.trim() || null,
          note: m.note?.trim() || null,
        })),
      examples: form.examples.filter((e) => e.original.trim() || e.translation.trim()),
    });
    invalidate();
    toast.success(editing ? "Mot modifié" : "Mot ajouté");
    onOpenChange(false);
  }

  /** Fusionner: add the new translation as an extra meaning on the existing word. */
  async function doMerge(target: Word) {
    const newMeaning: WordMeaning = {
      translation: form.translation.trim(),
      category: form.category.trim() || null,
      example_original: null,
      example_translation: null,
      note: form.notes.trim() || null,
    };
    await upsertWord({
      id: target.id,
      language_id: target.language_id,
      original: target.original,
      transcription: target.transcription,
      translation: target.translation,
      category: target.category,
      level: target.level,
      notes: target.notes,
      meanings: [...target.meanings, newMeaning],
      examples: target.examples,
      related: target.related,
    });
    invalidate();
    toast.success("Sens fusionné");
    onOpenChange(false);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <div className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden px-5 pb-6 pt-2">
          <div className="mt-2 flex items-center justify-between">
            <h2 className="text-2xl font-bold">{editing ? "Modifier le mot" : "Nouveau mot"}</h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="-mx-1 mt-4 flex-1 space-y-5 overflow-y-auto px-1 pb-2">
            {/* Duplicate panel */}
            {dups.length > 0 && (
              <div className="rounded-3xl border-2 border-primary p-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-primary" />
                  <span className="font-bold">Doublon détecté</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  « {form.original.trim()} » est déjà dans la base
                </p>
                <ul className="mt-3 space-y-2">
                  {dups.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2 rounded-2xl bg-muted px-4 py-3"
                    >
                      <span className="truncate font-medium">{d.translation}</span>
                      <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {d.category || "—"}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDups([])}
                    className="flex-1 rounded-full bg-muted px-4 py-2.5 text-sm font-semibold text-foreground"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => doMerge(dups[0])}
                    disabled={!form.translation.trim()}
                    className="flex-1 rounded-full bg-muted px-4 py-2.5 text-sm font-semibold text-foreground disabled:opacity-50"
                  >
                    Fusionner
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDups([]);
                      void doSave();
                    }}
                    className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            )}

            <div>
              <Label className="text-muted-foreground">Mot original</Label>
              <Input
                value={form.original}
                onChange={(e) => patch({ original: e.target.value })}
                onBlur={onOriginalBlur}
                autoFocus
                className="mt-1.5 h-12 rounded-2xl border-0 bg-muted px-4 text-lg"
                placeholder={alphabet ? `Dans ${alphabet}` : "학교"}
              />
            </div>

            <div>
              <Label className="text-muted-foreground">Transcription phonétique</Label>
              <Input
                value={form.transcription}
                onChange={(e) => patch({ transcription: e.target.value })}
                className="mt-1.5 h-12 rounded-2xl border-0 bg-muted px-4"
                placeholder="hakgyo"
              />
            </div>

            <div>
              <Label className="text-muted-foreground">Traduction française</Label>
              <Input
                value={form.translation}
                onChange={(e) => patch({ translation: e.target.value })}
                className="mt-1.5 h-12 rounded-2xl border-0 bg-muted px-4"
                placeholder="école"
              />
            </div>

            <div>
              <Label className="text-muted-foreground">Catégorie</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <Pill
                    key={c.value}
                    active={form.category === c.value}
                    onClick={() => patch({ category: form.category === c.value ? "" : c.value })}
                  >
                    {c.label}
                  </Pill>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Niveau</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {LEVELS.map((l) => (
                  <Pill
                    key={l}
                    active={form.level === l}
                    onClick={() => patch({ level: form.level === l ? "" : l })}
                  >
                    {l}
                  </Pill>
                ))}
              </div>
            </div>

            {advanced && (
              <>
                {/* Examples editor */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground">Exemples</Label>
                    <button
                      type="button"
                      onClick={() =>
                        patch({ examples: [...form.examples, { original: "", translation: "" }] })
                      }
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold"
                    >
                      <Plus className="h-3 w-3" /> Exemple
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {form.examples.map((ex, i) => (
                      <div key={i} className="rounded-2xl bg-muted p-3">
                        <div className="flex gap-2">
                          <Input
                            value={ex.original}
                            onChange={(e) =>
                              patch({
                                examples: form.examples.map((x, idx) =>
                                  idx === i ? { ...x, original: e.target.value } : x,
                                ),
                              })
                            }
                            className="h-10 rounded-xl border-0 bg-background"
                            placeholder="Phrase originale"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              patch({ examples: form.examples.filter((_, idx) => idx !== i) })
                            }
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground"
                            aria-label="Retirer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <Input
                          value={ex.translation}
                          onChange={(e) =>
                            patch({
                              examples: form.examples.map((x, idx) =>
                                idx === i ? { ...x, translation: e.target.value } : x,
                              ),
                            })
                          }
                          className="mt-2 h-10 rounded-xl border-0 bg-background"
                          placeholder="Traduction"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Meanings editor */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground">Autres sens</Label>
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          meanings: [
                            ...form.meanings,
                            {
                              translation: "",
                              category: null,
                              example_original: null,
                              example_translation: null,
                              note: null,
                            },
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold"
                    >
                      <Plus className="h-3 w-3" /> Sens
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {form.meanings.map((m, i) => (
                      <div key={i} className="rounded-2xl bg-muted p-3">
                        <div className="flex gap-2">
                          <Input
                            value={m.translation}
                            onChange={(e) =>
                              patch({
                                meanings: form.meanings.map((x, idx) =>
                                  idx === i ? { ...x, translation: e.target.value } : x,
                                ),
                              })
                            }
                            className="h-10 rounded-xl border-0 bg-background"
                            placeholder="Traduction"
                          />
                          <Input
                            value={m.category ?? ""}
                            onChange={(e) =>
                              patch({
                                meanings: form.meanings.map((x, idx) =>
                                  idx === i ? { ...x, category: e.target.value || null } : x,
                                ),
                              })
                            }
                            className="h-10 w-28 shrink-0 rounded-xl border-0 bg-background"
                            placeholder="catégorie"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              patch({ meanings: form.meanings.filter((_, idx) => idx !== i) })
                            }
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground"
                            aria-label="Retirer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <Input
                          value={m.example_original ?? ""}
                          onChange={(e) =>
                            patch({
                              meanings: form.meanings.map((x, idx) =>
                                idx === i ? { ...x, example_original: e.target.value || null } : x,
                              ),
                            })
                          }
                          className="mt-2 h-10 rounded-xl border-0 bg-background"
                          placeholder="Exemple (original)"
                        />
                        <Input
                          value={m.example_translation ?? ""}
                          onChange={(e) =>
                            patch({
                              meanings: form.meanings.map((x, idx) =>
                                idx === i
                                  ? { ...x, example_translation: e.target.value || null }
                                  : x,
                              ),
                            })
                          }
                          className="mt-2 h-10 rounded-xl border-0 bg-background"
                          placeholder="Exemple (traduction)"
                        />
                        <Input
                          value={m.note ?? ""}
                          onChange={(e) =>
                            patch({
                              meanings: form.meanings.map((x, idx) =>
                                idx === i ? { ...x, note: e.target.value || null } : x,
                              ),
                            })
                          }
                          className="mt-2 h-10 rounded-xl border-0 bg-background"
                          placeholder="Note"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <Label className="text-muted-foreground">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                rows={3}
                className={cn("mt-1.5 min-h-[80px] rounded-2xl border-0 bg-muted px-4 py-3")}
                placeholder="Contexte, expression utile…"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void doSave()}
            className="mt-3 flex h-14 w-full items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground active:scale-[0.98]"
          >
            Enregistrer
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
