import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listLanguages,
  upsertLanguage,
  deleteLanguage,
  type Language,
} from "@/lib/db";
import { useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { AppShell } from "@/components/mobile/AppShell";
import { FAB } from "@/components/mobile/FAB";
import { Drawer, DrawerContent, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/languages")({
  component: LanguagesPage,
});

const empty = { name: "", flag: "", alphabet: "", translation_language: "Français" };

function LanguagesPage() {
  const qc = useQueryClient();
  const { data: langs = [] } = useQuery({ queryKey: ["languages"], queryFn: listLanguages });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Language | null>(null);
  const [form, setForm] = useState({ ...empty });

  function openNew() {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  }
  function openEdit(l: Language) {
    setEditing(l);
    setForm({
      name: l.name,
      flag: l.flag ?? "",
      alphabet: l.alphabet ?? "",
      translation_language: l.translation_language,
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await upsertLanguage({
      id: editing?.id,
      name: form.name.trim(),
      flag: form.flag.trim() || null,
      alphabet: form.alphabet.trim() || null,
      translation_language: form.translation_language.trim() || "Français",
    });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["languages"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    toast.success(editing ? "Langue modifiée" : "Langue créée");
  }

  async function remove(l: Language) {
    if (!confirm(`Supprimer ${l.name} et toutes ses données ?`)) return;
    await deleteLanguage(l.id);
    qc.invalidateQueries();
    toast.success("Langue supprimée");
  }

  return (
    <>
      <MobileHeader title="Langues" subtitle={`${langs.length} langue${langs.length > 1 ? "s" : ""}`} />
      <AppShell>
        <div className="px-5 pt-4 pb-10">
          {!langs.length ? (
            <div className="mt-16 flex flex-col items-center text-center">
              <div className="text-6xl">🌐</div>
              <p className="mt-4 text-sm text-muted-foreground">
                Créez votre première langue pour commencer à enregistrer des mots.
              </p>
              <Button className="mt-6 rounded-full px-6" onClick={openNew}>
                Créer une langue
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {langs.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-3xl">
                    {l.flag || "🌐"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-xl leading-tight">{l.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {l.alphabet || "—"} · vers {l.translation_language}
                    </div>
                  </div>
                  <button
                    onClick={() => openEdit(l)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(l)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </AppShell>

      {langs.length > 0 && <FAB onClick={openNew} label="Nouvelle langue" />}

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <form onSubmit={save} className="mx-auto w-full max-w-md px-5 pb-6 pt-2">
            <div className="mt-2 flex items-center justify-between">
              <h2 className="font-display text-2xl">{editing ? "Modifier" : "Nouvelle"} langue</h2>
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

            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-[1fr_96px] gap-3">
                <div>
                  <Label htmlFor="name">Nom</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    autoFocus
                    placeholder="Coréen"
                    className="h-11"
                  />
                </div>
                <div>
                  <Label htmlFor="flag">Drapeau</Label>
                  <Input
                    id="flag"
                    value={form.flag}
                    onChange={(e) => setForm({ ...form, flag: e.target.value })}
                    placeholder="🇰🇷"
                    maxLength={4}
                    className="h-11 text-center text-xl"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="alphabet">Alphabet</Label>
                <Input
                  id="alphabet"
                  value={form.alphabet}
                  onChange={(e) => setForm({ ...form, alphabet: e.target.value })}
                  placeholder="Hangul"
                  className="h-11"
                />
              </div>
              <div>
                <Label htmlFor="trans">Traduire vers</Label>
                <Input
                  id="trans"
                  value={form.translation_language}
                  onChange={(e) => setForm({ ...form, translation_language: e.target.value })}
                  className="h-11"
                />
              </div>
            </div>

            <Button type="submit" className="mt-6 h-12 w-full rounded-full text-base">
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}
