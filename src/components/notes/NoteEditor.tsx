import { useState } from "react";
import { cn } from "@/lib/utils";

export const NOTE_CATEGORIES = [
  "Grammaire",
  "Conjugaison",
  "Politesse",
  "Expressions",
  "Exception",
  "Culture",
] as const;

const CONTENT_PLACEHOLDER = `## Règle
- ...
> Exemple`;

export type NoteDraft = { title: string; category: string; content: string };

/**
 * Full-screen markdown editor body (matches _diteur Markdown.png):
 * category pills + borderless big title input + growing markdown textarea.
 * The top bar (back / title / OK) is rendered by the host route.
 */
export function NoteEditor({
  value,
  onChange,
}: {
  value: NoteDraft;
  onChange: (next: NoteDraft) => void;
}) {
  return (
    <div className="mt-4">
      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        {NOTE_CATEGORIES.map((c) => {
          const active = value.category === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ ...value, category: c })}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Title — borderless, big bold */}
      <input
        value={value.title}
        onChange={(e) => onChange({ ...value, title: e.target.value })}
        placeholder="Titre de la note"
        className="mt-5 w-full border-none bg-transparent text-3xl font-extrabold text-foreground caret-primary placeholder:text-muted-foreground/60 focus:outline-none"
      />

      <div className="mt-4 h-px w-full bg-border" />

      {/* Markdown body */}
      <AutoTextarea
        value={value.content}
        onChange={(content) => onChange({ ...value, content })}
        placeholder={CONTENT_PLACEHOLDER}
      />
    </div>
  );
}

/** Textarea that grows with its content. */
function AutoTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [el, setEl] = useState<HTMLTextAreaElement | null>(null);

  function resize(node: HTMLTextAreaElement | null) {
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }

  return (
    <textarea
      ref={(node) => {
        setEl(node);
        resize(node);
      }}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        resize(e.target);
      }}
      placeholder={placeholder}
      rows={6}
      className="mt-4 w-full resize-none border-none bg-transparent font-mono text-[15px] leading-relaxed text-foreground caret-primary placeholder:text-muted-foreground/50 focus:outline-none"
      // keep height in sync if value is reset externally
      onFocus={() => resize(el)}
    />
  );
}
