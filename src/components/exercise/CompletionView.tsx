import { useEffect, useRef, useState } from "react";
import { BigButton } from "@/components/mobile/primitives";
import { cn } from "@/lib/utils";

/**
 * Stage-1 question — the hangul is shown with one syllable replaced by "___"
 * and the user types the missing part. The display string is rendered with
 * the underscore inline so the gap reads naturally inside the word
 * (e.g. "한 ___ 사람").
 */
export function CompletionView({
  label,
  prompt,
  masked,
  full,
  hint,
  value,
  onChange,
  onVerify,
  locked,
  correct,
}: {
  /** Top label (badge), e.g. "COMPLÉTION · 2/4". */
  label: string;
  /** French prompt (translation). */
  prompt: string;
  /** Hangul with a gap, e.g. "한 ___ 사람". */
  masked: string;
  /** Full original word (revealed in the bottom feedback when wrong). */
  full: string;
  /** Inline helper line under the gap ("Tape la dernière syllabe"). */
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onVerify: () => void;
  locked: boolean;
  correct: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!locked) inputRef.current?.focus();
  }, [masked, locked]);

  // After verify (locked), reveal the missing piece in-place by re-rendering
  // the masked string with the user's `value` or the canonical full string.
  const display = locked ? full : masked.replace(/_+/g, (run) => "•".repeat(run.length));

  return (
    <div className="flex flex-col">
      <div className="pt-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>

      <h2 className="mt-3 text-3xl font-extrabold leading-tight">{prompt}</h2>

      <div className="mt-5 flex min-h-[6rem] items-center justify-center rounded-3xl bg-noms px-6 py-5 text-center">
        <span
          className={cn(
            "text-5xl font-extrabold tracking-tight text-noms-foreground",
            locked && (correct ? "text-noms-foreground" : "text-destructive line-through"),
          )}
        >
          {display}
        </span>
      </div>

      <p className="mt-3 text-sm font-medium text-muted-foreground">{hint}</p>

      <label className="mt-6 block text-sm font-medium text-muted-foreground">
        Partie manquante
      </label>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !locked && value.trim()) onVerify();
        }}
        readOnly={locked}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className={cn(
          "mt-2 h-16 w-full rounded-2xl bg-card px-5 text-2xl font-bold text-foreground outline-none",
          "ring-2 transition placeholder:font-normal placeholder:text-muted-foreground",
          locked
            ? correct
              ? "ring-primary"
              : "text-muted-foreground line-through ring-destructive"
            : "ring-transparent focus:ring-primary",
        )}
      />

      <div className="mt-6">
        <BigButton variant="primary" onClick={onVerify} disabled={locked || !value.trim()}>
          Vérifier
        </BigButton>
      </div>
    </div>
  );
}
