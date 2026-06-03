import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listNotes,
  upsertNote,
  deleteNote,
  type Note,
} from "@/lib/db";
import { useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
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

export const Route = createFileRoute("/notes")({
  component: NotesPage,
});

const CATEGORIES = ["Grammaire", "Conjugaison", "Expressions", "Politesse", "Exceptions", "Culture"];
const empty = { title: "", category: "Grammaire", content: "", examples: "" };

function NotesPage() {
  const qc = useQueryClient();
  const { languages, current, setLangId } = useSelectedLanguage();
  const langId = current?.id ?? "";

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", langId],
    queryFn: () => listNotes(langId),
    enabled: !!langId,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [form, setForm] = useState({ ...empty });

  function openNew() {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  }
  function openEdit(n: Note) {
    setEditing(n);
    setForm({
      title: n.title,
      category: n.category ?? "Grammaire",
      content: n.content ?? "",
      examples: n.examples ?? "",
    });
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!langId) return;
    await upsertNote({
      id: editing?.id,
      language_id: langId,
      title: form.title.trim(),
      category: form.category,
      content: form.content.trim() || null,
      examples: form.examples.trim() || null,
    });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["notes"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    toast.success(editing ? "Note modifiée" : "Note créée");
  }
  async function remove(n: Note) {
    if (!confirm(`Supprimer "${n.title}" ?`)) return;
    await deleteNote(n.id);
    qc.invalidateQueries({ queryKey: ["notes"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
  }

  if (!languages.length) {
    return (
      <>
        <MobileHeader title="Notes" />
        <AppShell>
          <EmptyNoLang />
        </AppShell>
      </>
    );
  }

  return (
    <>
      <MobileHeader
        title="Notes"
        subtitle={`${notes.length} note${notes.length > 1 ? "s" : ""}`}
        right={<LanguagePicker languages={languages} current={current} onSelect={setLangId} />}
      />
      <AppShell>
        <div className="px-5 pt-4 pb-10">
          {!notes.length ? (
            <div className="mt-16 text-center text-sm text-muted-foreground">
              Aucune note. Touchez le + pour ajouter une règle de grammaire ou une expression.
            </div>
          ) : (
            <ul className="space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1" onClick={() => openEdit(n)}>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <h3 className="font-display text-xl leading-tight">{n.title}</h3>
                        {n.category && (
                          <Badge variant="secondary" className="text-[10px]">
                            {n.category}
                          </Badge>
                        )}
                      </div>
                      {n.content && (
                        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                          {n.content}
                        </pre>
                      )}
                      {n.examples && (
                        <div className="mt-3 rounded-lg bg-muted/60 p-3 text-sm">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Exemples
                          </div>
                          <pre className="mt-1 whitespace-pre-wrap font-sans">{n.examples}</pre>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => openEdit(n)}
                      className="-m-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                      aria-label="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(n)}
                      className="-m-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </AppShell>

      <FAB onClick={openNew} label="Nouvelle note" />

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[92vh]">
          <form
            onSubmit={save}
            className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden px-5 pb-4 pt-2"
          >
            <div className="mt-2 flex items-center justify-between">
              <h2 className="font-display text-2xl">
                {editing ? "Modifier" : "Nouvelle"} note
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
              <div>
                <Label htmlFor="ntitle">Titre</Label>
                <Input
                  id="ntitle"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  autoFocus
                  className="h-11"
                  placeholder="Particule 은 / 는"
                />
              </div>
              <div>
                <Label>Catégorie</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, category: c })}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        form.category === c
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="ncontent">Contenu (Markdown)</Label>
                <Textarea
                  id="ncontent"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={8}
                  className="font-mono text-sm"
                  placeholder="# Règle&#10;..."
                />
              </div>
              <div>
                <Label htmlFor="nex">Exemples</Label>
                <Textarea
                  id="nex"
                  value={form.examples}
                  onChange={(e) => setForm({ ...form, examples: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <Button type="submit" className="mt-3 h-12 w-full rounded-full text-base">
              {editing ? "Enregistrer" : "Créer la note"}
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
      <div className="text-6xl">📝</div>
      <p className="mt-4 text-sm text-muted-foreground">
        Créez d'abord une langue pour prendre des notes.
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
