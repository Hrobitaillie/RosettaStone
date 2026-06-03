import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getVerb, upsertVerb, deleteVerb, toggleVerbFavorite, type Conjugation } from "@/lib/db";
import { useState } from "react";
import { Plus, Star, Trash2, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Screen } from "@/components/mobile/Screen";
import { ScreenHeader, IconButton } from "@/components/mobile/primitives";
import { Drawer, DrawerContent, DrawerClose } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/verb/$id")({
  component: VerbDetailPage,
});

const FORM_PRESETS = ["Présent", "Passé", "Futur", "Impératif", "Personnalisé"];

function VerbDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: verb, isPending } = useQuery({
    queryKey: ["verb", id],
    queryFn: () => getVerb(id),
  });

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["verb", id] });
    qc.invalidateQueries({ queryKey: ["verbs"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
  }

  if (isPending) {
    return (
      <Screen>
        <ScreenHeader back="/verbs" />
        <div className="mt-20 text-center text-sm text-muted-foreground">Chargement…</div>
      </Screen>
    );
  }

  if (!verb) {
    return (
      <Screen>
        <ScreenHeader back="/verbs" title="Verbe introuvable" />
        <div className="mt-16 text-center text-sm text-muted-foreground">
          Ce verbe n'existe plus.
        </div>
      </Screen>
    );
  }

  async function toggleFav() {
    if (!verb) return;
    await toggleVerbFavorite(verb.id, !verb.is_favorite);
    invalidate();
  }

  async function addForm(c: Conjugation) {
    if (!verb) return;
    await upsertVerb({
      id: verb.id,
      language_id: verb.language_id,
      infinitive: verb.infinitive,
      romanization: verb.romanization,
      translation: verb.translation,
      is_irregular: verb.is_irregular,
      notes: verb.notes,
      conjugations: [...verb.conjugations, c],
    });
    setAddOpen(false);
    invalidate();
    toast.success("Forme ajoutée");
  }

  async function deleteForm(index: number) {
    if (!verb) return;
    await upsertVerb({
      id: verb.id,
      language_id: verb.language_id,
      infinitive: verb.infinitive,
      romanization: verb.romanization,
      translation: verb.translation,
      is_irregular: verb.is_irregular,
      notes: verb.notes,
      conjugations: verb.conjugations.filter((_, i) => i !== index),
    });
    invalidate();
  }

  async function removeVerb() {
    if (!verb) return;
    if (!confirm(`Supprimer ${verb.infinitive} ?`)) return;
    await deleteVerb(verb.id);
    invalidate();
    navigate({ to: "/verbs" });
  }

  return (
    <>
      <Screen>
        <ScreenHeader
          back="/verbs"
          right={
            <div className="flex items-center gap-2">
              <IconButton onClick={toggleFav} aria-label="Favori">
                <Star
                  className={cn(
                    "h-5 w-5",
                    verb.is_favorite ? "fill-primary text-primary" : "text-foreground",
                  )}
                />
              </IconButton>
              <IconButton onClick={() => setEditOpen(true)} aria-label="Modifier le verbe">
                <Pencil className="h-5 w-5" />
              </IconButton>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                aria-label="Ajouter une forme"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground transition active:scale-95"
              >
                <Plus className="h-6 w-6" strokeWidth={2.5} />
              </button>
            </div>
          }
        />

        {/* Title block */}
        <div className="mt-2">
          <h1 className="text-5xl font-extrabold leading-none">{verb.infinitive}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">
              {verb.romanization && <span>{verb.romanization} · </span>}
              <span className="font-bold text-foreground">{verb.translation}</span>
            </span>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-sm font-semibold",
                verb.is_irregular ? "bg-muted text-noms-bar" : "bg-muted text-muted-foreground",
              )}
            >
              {verb.is_irregular ? "irrégulier" : "régulier"}
            </span>
          </div>
        </div>

        {/* Notes */}
        {verb.notes && (
          <div className="mt-5 rounded-3xl bg-card p-5 text-sm leading-relaxed text-foreground/90">
            {verb.notes}
          </div>
        )}

        {/* Conjugations section */}
        <div className="mt-7 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Conjugaisons</h2>
          {verb.conjugations.length > 0 && (
            <button
              type="button"
              onClick={() => setEditMode((m) => !m)}
              className="text-sm font-semibold text-primary"
            >
              {editMode ? "Terminé" : "Modifier"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="ml-4 text-base font-bold text-primary"
          >
            Forme
          </button>
        </div>

        {verb.conjugations.length === 0 ? (
          <div className="mt-6 rounded-3xl bg-card p-6 text-center text-sm text-muted-foreground">
            Aucune forme. Touchez « Forme » pour en ajouter.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {verb.conjugations.map((c, i) => (
              <li key={i} className="flex items-center gap-3 rounded-3xl bg-card p-5">
                <span className="w-24 shrink-0 text-sm text-muted-foreground">{c.form_name}</span>
                <span className="flex-1 text-2xl font-bold leading-tight">{c.form_value}</span>
                {c.romanization && (
                  <span className="shrink-0 text-sm text-muted-foreground">{c.romanization}</span>
                )}
                {editMode && (
                  <button
                    type="button"
                    onClick={() => deleteForm(i)}
                    aria-label="Supprimer la forme"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive active:scale-95"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Delete verb */}
        <button
          type="button"
          onClick={removeVerb}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-muted py-3 text-sm font-semibold text-destructive active:scale-[0.98]"
        >
          <Trash2 className="h-4 w-4" /> Supprimer le verbe
        </button>
      </Screen>

      <AddFormDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        infinitive={verb.infinitive}
        romanization={verb.romanization}
        translation={verb.translation}
        onAdd={addForm}
      />

      <EditVerbDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        verb={verb}
        onSaved={() => {
          setEditOpen(false);
          invalidate();
          toast.success("Verbe modifié");
        }}
      />
    </>
  );
}

/* ---------- Add-form drawer ---------- */

function AddFormDrawer({
  open,
  onOpenChange,
  infinitive,
  romanization,
  translation,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  infinitive: string;
  romanization: string | null;
  translation: string;
  onAdd: (c: Conjugation) => void;
}) {
  const [preset, setPreset] = useState("Personnalisé");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [rom, setRom] = useState("");
  const [note, setNote] = useState("");

  function reset() {
    setPreset("Personnalisé");
    setName("");
    setValue("");
    setRom("");
    setNote("");
  }

  function selectPreset(p: string) {
    setPreset(p);
    if (p !== "Personnalisé") setName(p);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const formName = name.trim();
    const formValue = value.trim();
    if (!formName || !formValue) {
      toast.error("Nom et conjugaison requis");
      return;
    }
    onAdd({
      form_name: formName,
      form_value: formValue,
      romanization: rom.trim() || (note.trim() ? note.trim() : null),
    });
    reset();
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DrawerContent className="max-h-[94vh]">
        <form
          onSubmit={submit}
          className="mx-auto flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden px-5 pb-6 pt-2"
        >
          <div className="mt-2 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Nouvelle forme</h2>
            <DrawerClose asChild>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </DrawerClose>
          </div>

          <div className="-mx-1 mt-4 flex-1 space-y-5 overflow-y-auto px-1 pb-2">
            {/* Verb context */}
            <div className="flex items-baseline gap-3 rounded-3xl bg-card p-5">
              <span className="text-3xl font-extrabold">{infinitive}</span>
              <span className="text-sm text-muted-foreground">
                {romanization && <span>{romanization} · </span>}
                {translation}
              </span>
            </div>

            <div className="space-y-2">
              <Label>Type de forme</Label>
              <div className="flex flex-wrap gap-2">
                {FORM_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => selectPreset(p)}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-semibold transition",
                      preset === p
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fname">Nom de la forme</Label>
              <Input
                id="fname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 rounded-2xl bg-muted"
                placeholder="Présent négatif"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fvalue">Conjugaison</Label>
              <Input
                id="fvalue"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-12 rounded-2xl bg-muted text-xl font-bold"
                placeholder="안 먹어요"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="from">Romanisation</Label>
              <Input
                id="from"
                value={rom}
                onChange={(e) => setRom(e.target.value)}
                className="h-12 rounded-2xl bg-muted"
                placeholder="an meogeoyo"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fnote">Note (optionnel)</Label>
              <Input
                id="fnote"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-12 rounded-2xl bg-muted"
                placeholder="ex. registre, exception…"
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-3 flex h-14 w-full items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground active:scale-[0.98]"
          >
            Ajouter la forme
          </button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

/* ---------- Edit-verb drawer ---------- */

function EditVerbDrawer({
  open,
  onOpenChange,
  verb,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  verb: {
    id: string;
    language_id: string;
    infinitive: string;
    romanization: string | null;
    translation: string;
    is_irregular: boolean;
    notes: string | null;
    conjugations: Conjugation[];
  };
  onSaved: () => void;
}) {
  const [infinitive, setInfinitive] = useState(verb.infinitive);
  const [romanization, setRomanization] = useState(verb.romanization ?? "");
  const [translation, setTranslation] = useState(verb.translation);
  const [isIrregular, setIsIrregular] = useState(verb.is_irregular);
  const [notes, setNotes] = useState(verb.notes ?? "");

  // Re-sync fields whenever the drawer is (re)opened for a verb.
  function handleOpenChange(v: boolean) {
    if (v) {
      setInfinitive(verb.infinitive);
      setRomanization(verb.romanization ?? "");
      setTranslation(verb.translation);
      setIsIrregular(verb.is_irregular);
      setNotes(verb.notes ?? "");
    }
    onOpenChange(v);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!infinitive.trim() || !translation.trim()) {
      toast.error("Infinitif et traduction requis");
      return;
    }
    await upsertVerb({
      id: verb.id,
      language_id: verb.language_id,
      infinitive: infinitive.trim(),
      romanization: romanization.trim() || null,
      translation: translation.trim(),
      is_irregular: isIrregular,
      notes: notes.trim() || null,
      conjugations: verb.conjugations,
    });
    onSaved();
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <form
          onSubmit={submit}
          className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden px-5 pb-6 pt-2"
        >
          <div className="mt-2 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Modifier le verbe</h2>
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
                <Label htmlFor="einf">Infinitif</Label>
                <Input
                  id="einf"
                  value={infinitive}
                  onChange={(e) => setInfinitive(e.target.value)}
                  className="h-12 rounded-2xl bg-muted text-lg font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="erom">Romanisation</Label>
                <Input
                  id="erom"
                  value={romanization}
                  onChange={(e) => setRomanization(e.target.value)}
                  className="h-12 rounded-2xl bg-muted"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etrans">Traduction</Label>
              <Input
                id="etrans"
                value={translation}
                onChange={(e) => setTranslation(e.target.value)}
                className="h-12 rounded-2xl bg-muted"
              />
            </div>
            <label className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
              <span className="font-semibold">Verbe irrégulier</span>
              <Switch checked={isIrregular} onCheckedChange={setIsIrregular} />
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="enotes">Notes</Label>
              <Textarea
                id="enotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="rounded-2xl bg-muted"
                placeholder="ex. irrégularité en ㄷ, exceptions…"
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-3 flex h-14 w-full items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground active:scale-[0.98]"
          >
            Enregistrer
          </button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
