import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Screen } from "@/components/mobile/Screen";
import {
  LangAvatar,
  ScreenHeader,
  Pill,
  BigButton,
  SectionLabel,
} from "@/components/mobile/primitives";
import { useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { Input } from "@/components/ui/input";
import { upsertLanguage, type Level } from "@/lib/db";

export const Route = createFileRoute("/language/new")({
  component: NewLanguagePage,
});

const ICON_OPTIONS = ["한", "あ", "中", "ひ", "A", "Es"];
const LEVELS: Level[] = ["débutant", "intermédiaire", "avancé"];

function NewLanguagePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setLangId } = useSelectedLanguage();

  const [icon, setIcon] = useState<string>(ICON_OPTIONS[0]);
  const [customIcon, setCustomIcon] = useState("");
  const [name, setName] = useState("");
  const [alphabet, setAlphabet] = useState("");
  const [translation, setTranslation] = useState("Français");
  const [level, setLevel] = useState<Level>("débutant");
  const [saving, setSaving] = useState(false);

  const chosenIcon = customIcon.trim() || icon;

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Donnez un nom à la langue");
      return;
    }
    setSaving(true);
    try {
      const lang = await upsertLanguage({
        name: name.trim(),
        icon: chosenIcon || name.trim().slice(0, 1).toUpperCase(),
        alphabet: alphabet.trim() || null,
        translation_language: translation.trim() || "Français",
        level,
      });
      setLangId(lang.id);
      qc.invalidateQueries({ queryKey: ["languages"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Langue créée");
      navigate({ to: "/languages" });
    } catch (e) {
      console.error(e);
      toast.error("Impossible de créer la langue");
      setSaving(false);
    }
  }

  return (
    <Screen withNav={false}>
      <ScreenHeader title="Nouvelle langue" back="/languages" />

      <div className="mt-4 space-y-7">
        {/* Icône */}
        <div>
          <SectionLabel className="normal-case tracking-normal text-sm">Icône</SectionLabel>
          <div className="mt-3 flex flex-wrap gap-3">
            {ICON_OPTIONS.map((glyph) => {
              const selected = !customIcon.trim() && glyph === icon;
              return (
                <button
                  key={glyph}
                  type="button"
                  onClick={() => {
                    setIcon(glyph);
                    setCustomIcon("");
                  }}
                  aria-pressed={selected}
                >
                  <LangAvatar icon={glyph} size="md" variant={selected ? "lime" : "muted"} />
                </button>
              );
            })}
          </div>
          <Input
            value={customIcon}
            onChange={(e) => setCustomIcon(e.target.value.slice(0, 2))}
            placeholder="Glyphe personnalisé"
            maxLength={2}
            className="mt-3 h-11 w-40 rounded-2xl bg-card text-center"
          />
        </div>

        <Field label="Nom de la langue">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Coréen"
            className="h-14 rounded-2xl bg-card px-4 text-base"
            autoFocus
          />
        </Field>

        <Field label="Alphabet principal">
          <Input
            value={alphabet}
            onChange={(e) => setAlphabet(e.target.value)}
            placeholder="Hangul (한글)"
            className="h-14 rounded-2xl bg-card px-4 text-base"
          />
        </Field>

        <Field label="Langue de traduction">
          <Input
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
            placeholder="Français"
            className="h-14 rounded-2xl bg-card px-4 text-base"
          />
        </Field>

        {/* Niveau de départ */}
        <div>
          <SectionLabel className="normal-case tracking-normal text-sm">
            Niveau de départ
          </SectionLabel>
          <div className="mt-3 flex flex-wrap gap-2">
            {LEVELS.map((lvl) => (
              <Pill key={lvl} active={level === lvl} onClick={() => setLevel(lvl)}>
                {lvl}
              </Pill>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10">
        <BigButton onClick={handleCreate} disabled={saving}>
          Créer la langue
        </BigButton>
      </div>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionLabel className="normal-case tracking-normal text-sm">{label}</SectionLabel>
      <div className="mt-2">{children}</div>
    </div>
  );
}
