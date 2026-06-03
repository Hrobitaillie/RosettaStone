import { useEffect, useRef, useState } from "react";
import { Lightbulb } from "lucide-react";
import { BigButton } from "@/components/mobile/primitives";
import { cn } from "@/lib/utils";

/**
 * Typed-answer question (Traduction / Romanisation / Conjugaison).
 * Shows a top label, the prompt (plain large text, or inside a pink pastel
 * card), a "Ta réponse" input with a lime focus ring, and a Vérifier button.
 * When `locked` (after verifying) the input reflects correctness colors.
 */
export function TypedQuestionView({
  label,
  prompt,
  promptCard = false,
  hint,
  value,
  onChange,
  onVerify,
  locked,
  correct,
}: {
  label: string;
  prompt: string;
  /** Render the prompt inside a big pink pastel card (romanisation style). */
  promptCard?: boolean;
  /** Optional romanisation revealed as a hint. */
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  onVerify: () => void;
  /** True once the answer has been verified (input frozen + colored). */
  locked: boolean;
  correct: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState(prompt);
  const [showHint, setShowHint] = useState(false);

  // Refocus when a new question loads.
  useEffect(() => {
    if (prompt !== key) setKey(prompt);
    if (!locked) inputRef.current?.focus();
  }, [prompt, locked, key]);

  // Reset the hint whenever the question changes.
  useEffect(() => {
    setShowHint(false);
  }, [prompt]);

  return (
    <div className="flex flex-col">
      <div className="pt-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>

      {promptCard ? (
        <div className="mt-5 flex min-h-[8rem] items-center justify-center rounded-3xl bg-noms p-6 text-center">
          <span className="text-5xl font-extrabold text-noms-foreground">{prompt}</span>
        </div>
      ) : (
        <h2 className="mt-3 text-5xl font-extrabold leading-tight">{prompt}</h2>
      )}

      {hint && (
        <div className="mt-4 h-7">
          {showHint ? (
            <span className="text-base font-medium text-muted-foreground">
              <span className="text-muted-foreground/60">indice · </span>
              {hint}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setShowHint(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-semibold text-muted-foreground active:scale-95"
            >
              <Lightbulb className="h-4 w-4" /> Indice
            </button>
          )}
        </div>
      )}

      <label className="mt-8 block text-sm font-medium text-muted-foreground">Ta réponse</label>
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
