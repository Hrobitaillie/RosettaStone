import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { upsertNote } from "@/lib/db";
import { Screen } from "@/components/mobile/Screen";
import { useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { NoteEditor, type NoteDraft } from "@/components/notes/NoteEditor";

export const Route = createFileRoute("/note/new")({
  component: NewNotePage,
});

function NewNotePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { current } = useSelectedLanguage();
  const langId = current?.id ?? "";

  const [draft, setDraft] = useState<NoteDraft>({
    title: "",
    category: "Grammaire",
    content: "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!langId) {
      toast.error("Aucune langue sélectionnée");
      return;
    }
    if (!draft.title.trim()) {
      toast.error("Donnez un titre à la note");
      return;
    }
    setSaving(true);
    try {
      const note = await upsertNote({
        language_id: langId,
        title: draft.title.trim(),
        category: draft.category,
        content: draft.content.trim() || null,
      });
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Note créée");
      navigate({ to: "/note/$id", params: { id: note.id } });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen withNav={false}>
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => navigate({ to: "/notes" })}
          aria-label="Retour"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-lg font-bold">Nouvelle note</h1>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-2 text-base font-bold text-primary disabled:opacity-50"
        >
          OK
        </button>
      </div>

      <NoteEditor value={draft} onChange={setDraft} />
    </Screen>
  );
}
