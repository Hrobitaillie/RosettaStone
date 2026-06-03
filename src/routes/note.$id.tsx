import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getNote, upsertNote, deleteNote, type Note } from "@/lib/db";
import { categorySwatch } from "@/lib/categories";
import { Screen } from "@/components/mobile/Screen";
import { IconButton, SectionLabel } from "@/components/mobile/primitives";
import { Markdown } from "@/components/notes/Markdown";
import { NoteEditor, type NoteDraft } from "@/components/notes/NoteEditor";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/note/$id")({
  component: NoteDetailPage,
});

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function NoteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: note, isPending } = useQuery({
    queryKey: ["note", id],
    queryFn: () => getNote(id),
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<NoteDraft>({ title: "", category: "Grammaire", content: "" });
  const [saving, setSaving] = useState(false);

  // Sync the draft whenever we enter edit mode with the latest note.
  useEffect(() => {
    if (editing && note) {
      setDraft({
        title: note.title,
        category: note.category ?? "Grammaire",
        content: note.content ?? "",
      });
    }
  }, [editing, note]);

  async function save() {
    if (!note) return;
    if (!draft.title.trim()) {
      toast.error("Donnez un titre à la note");
      return;
    }
    setSaving(true);
    try {
      await upsertNote({
        id: note.id,
        language_id: note.language_id,
        title: draft.title.trim(),
        category: draft.category,
        content: draft.content.trim() || null,
        examples: note.examples,
      });
      qc.invalidateQueries({ queryKey: ["note", id] });
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Note modifiée");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!note) return;
    if (!confirm(`Supprimer « ${note.title} » ?`)) return;
    await deleteNote(note.id);
    qc.invalidateQueries({ queryKey: ["notes"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    toast.success("Note supprimée");
    navigate({ to: "/notes" });
  }

  if (isPending) {
    return (
      <Screen withNav={false}>
        <div className="mt-24 text-center text-sm text-muted-foreground">Chargement…</div>
      </Screen>
    );
  }

  if (!note) {
    return (
      <Screen withNav={false}>
        <div className="pt-1">
          <IconButton onClick={() => navigate({ to: "/notes" })} aria-label="Retour">
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
        </div>
        <div className="mt-24 text-center text-sm text-muted-foreground">Note introuvable.</div>
      </Screen>
    );
  }

  return (
    <Screen withNav={false}>
      {/* Top bar */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => (editing ? setEditing(false) : navigate({ to: "/notes" }))}
          aria-label="Retour"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {editing ? (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-2 text-base font-bold text-primary disabled:opacity-50"
          >
            OK
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <IconButton onClick={() => setEditing(true)} aria-label="Modifier">
              <Pencil className="h-4 w-4" />
            </IconButton>
            <IconButton onClick={remove} aria-label="Supprimer">
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        )}
      </div>

      {editing ? (
        <NoteEditor value={draft} onChange={setDraft} />
      ) : (
        <NoteView note={note} />
      )}
    </Screen>
  );
}

function NoteView({ note }: { note: Note }) {
  const swatch = categorySwatch(note.category);
  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {note.category && (
          <span
            className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", swatch.badge)}
          >
            {note.category}
          </span>
        )}
        <span className="text-sm text-muted-foreground">
          {formatDate(note.updated_at || note.created_at)}
        </span>
      </div>

      <h1 className="mt-3 text-3xl font-extrabold leading-tight text-foreground">{note.title}</h1>

      {note.content && <Markdown source={note.content} className="mt-5" />}

      {note.examples && (
        <>
          <SectionLabel className="mt-7">Exemple</SectionLabel>
          <div className="mt-3 rounded-3xl border-l-4 border-primary bg-muted/60 p-5">
            <Markdown source={note.examples} />
          </div>
        </>
      )}
    </>
  );
}
