import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Screen } from "@/components/mobile/Screen";
import { LangAvatar, ScreenHeader, SectionLabel } from "@/components/mobile/primitives";
import { useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  getLanguage,
  getLanguageProgress,
  getLangSettings,
  updateLangSettings,
  upsertLanguage,
  deleteLanguage,
  type PerLanguageSettings,
} from "@/lib/db";

export const Route = createFileRoute("/language/$id")({
  component: LanguageSettingsPage,
});

type EditField = "name" | "alphabet" | "translation_language";

function LanguageSettingsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { langId, setLangId } = useSelectedLanguage();

  const { data: language, isPending } = useQuery({
    queryKey: ["languages", id],
    queryFn: () => getLanguage(id),
  });
  const { data: progress } = useQuery({
    queryKey: ["langProgress", id],
    queryFn: () => getLanguageProgress(id),
  });
  const { data: settings } = useQuery({
    queryKey: ["langSettings", id],
    queryFn: () => getLangSettings(id),
  });

  const [editing, setEditing] = useState<EditField | null>(null);
  const [draft, setDraft] = useState("");

  if (!isPending && !language) {
    return (
      <Screen withNav={false}>
        <ScreenHeader title="Langue" back="/languages" />
        <p className="mt-16 text-center text-sm text-muted-foreground">Langue introuvable.</p>
      </Screen>
    );
  }

  if (!language) {
    return (
      <Screen withNav={false}>
        <ScreenHeader back="/languages" />
      </Screen>
    );
  }

  function startEdit(field: EditField, value: string) {
    setEditing(field);
    setDraft(value);
  }

  async function saveEdit() {
    if (!editing || !language) return;
    const value = draft.trim();
    if (editing !== "alphabet" && !value) {
      toast.error("Ce champ ne peut pas être vide");
      return;
    }
    try {
      await upsertLanguage({
        id: language.id,
        name: editing === "name" ? value : language.name,
        icon: language.icon,
        flag: language.flag,
        alphabet: editing === "alphabet" ? value || null : language.alphabet,
        translation_language:
          editing === "translation_language" ? value : language.translation_language,
        level: language.level,
      });
      qc.invalidateQueries({ queryKey: ["languages"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(null);
      toast.success("Modifié");
    } catch (e) {
      console.error(e);
      toast.error("Impossible de modifier");
    }
  }

  async function toggle(key: keyof PerLanguageSettings, value: boolean) {
    try {
      await updateLangSettings(id, { [key]: value });
      qc.invalidateQueries({ queryKey: ["langSettings", id] });
    } catch (e) {
      console.error(e);
      toast.error("Impossible de modifier le réglage");
    }
  }

  async function handleDelete() {
    if (!language) return;
    if (!confirm(`Supprimer ${language.name} et toutes ses données ?`)) return;
    try {
      await deleteLanguage(language.id);
      if (langId === language.id) setLangId("");
      qc.invalidateQueries({ queryKey: ["languages"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Langue supprimée");
      navigate({ to: "/languages" });
    } catch (e) {
      console.error(e);
      toast.error("Impossible de supprimer");
    }
  }

  const words = progress?.words ?? 0;
  const verbs = progress?.verbs ?? 0;
  const notes = progress?.notes ?? 0;

  return (
    <Screen withNav={false}>
      <ScreenHeader title={language.name} back="/languages" />

      {/* Avatar + counts */}
      <div className="mt-2 flex flex-col items-center text-center">
        <LangAvatar icon={language.icon || "🌐"} size="xl" variant="lime" />
        <p className="mt-4 text-sm text-muted-foreground">
          {words} mots · {verbs} verbes · {notes} notes
        </p>
      </div>

      {/* GÉNÉRAL */}
      <SectionLabel className="mt-8">Général</SectionLabel>
      <div className="mt-1 divide-y divide-border">
        <EditableRow
          label="Nom"
          value={language.name}
          editing={editing === "name"}
          draft={draft}
          onDraft={setDraft}
          onStart={() => startEdit("name", language.name)}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
        />
        <EditableRow
          label="Alphabet"
          value={language.alphabet || "—"}
          editing={editing === "alphabet"}
          draft={draft}
          onDraft={setDraft}
          onStart={() => startEdit("alphabet", language.alphabet ?? "")}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
        />
        <EditableRow
          label="Traduction"
          value={language.translation_language}
          editing={editing === "translation_language"}
          draft={draft}
          onDraft={setDraft}
          onStart={() => startEdit("translation_language", language.translation_language)}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
        />
      </div>

      {/* AFFICHAGE */}
      <SectionLabel className="mt-8">Affichage</SectionLabel>
      <div className="mt-1 divide-y divide-border">
        <ToggleRow
          label="Afficher la romanisation"
          checked={settings?.show_romanization ?? true}
          onChange={(v) => toggle("show_romanization", v)}
        />
        <ToggleRow
          label="Masquer la traduction en révision"
          checked={settings?.hide_translation_in_review ?? false}
          onChange={(v) => toggle("hide_translation_in_review", v)}
        />
        <ToggleRow
          label="Lecture audio automatique"
          checked={settings?.auto_audio ?? false}
          onChange={(v) => toggle("auto_audio", v)}
        />
      </div>

      {/* Delete */}
      <div className="mt-6 border-t border-border pt-5">
        <button
          type="button"
          onClick={handleDelete}
          className="text-base font-semibold text-destructive transition active:opacity-70"
        >
          Supprimer la langue
        </button>
      </div>
    </Screen>
  );
}

function EditableRow({
  label,
  value,
  editing,
  draft,
  onDraft,
  onStart,
  onCancel,
  onSave,
}: {
  label: string;
  value: string;
  editing: boolean;
  draft: string;
  onDraft: (v: string) => void;
  onStart: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (editing) {
    return (
      <div className="flex items-center gap-2 py-3">
        <span className="shrink-0 font-bold">{label}</span>
        <Input
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onCancel();
          }}
          className="h-10 flex-1 rounded-xl bg-card text-right"
        />
        <button
          type="button"
          onClick={onSave}
          aria-label="Enregistrer"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Annuler"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onStart}
      className="flex w-full items-center justify-between py-4 text-left transition active:opacity-70"
    >
      <span className="font-bold">{label}</span>
      <span className="ml-3 truncate text-muted-foreground">{value}</span>
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-4">
      <span className="font-bold">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="h-7 w-12 [&>span]:h-6 [&>span]:w-6 [&>span]:data-[state=checked]:translate-x-5"
      />
    </label>
  );
}
