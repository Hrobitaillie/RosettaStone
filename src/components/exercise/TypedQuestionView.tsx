import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Lightbulb } from "lucide-react";
import { BigButton } from "@/components/mobile/primitives";
import { splitSyllables } from "@/lib/hangul";
import { cn } from "@/lib/utils";

/**
 * Typed-answer question (Traduction / Romanisation / Conjugaison).
 * Shows a top label, the prompt (plain large text, or inside a pink pastel
 * card), a "Ta réponse" input with a lime focus ring, and a Vérifier button.
 * When `locked` (after verifying) the input reflects correctness colors.
 *
 * Special modes for the apprentissage progressif:
 *   - `copyAnswer` : pre-shows the answer above the input (stage 0 "découverte"),
 *     and pre-fills the input with the answer so the user just confirms/retypes.
 *   - `progressiveHint` (with `answer`) : the "Indice" button reveals the
 *     answer ONE SYLLABLE AT A TIME instead of the romanisation in full.
 */
export function TypedQuestionView({
  label,
  prompt,
  promptCard = false,
  hint,
  copyAnswer,
  progressiveHint,
  answer,
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
  /** Copy mode: show the answer above the input as a model to retype. */
  copyAnswer?: string;
  /** Show the "reveal a syllable" hint button instead of romanisation. */
  progressiveHint?: boolean;
  /** Full target answer (required when progressiveHint=true). */
  answer?: string;
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
  const [revealed, setRevealed] = useState(0);

  // Refocus when a new question loads.
  useEffect(() => {
    if (prompt !== key) setKey(prompt);
    if (!locked) inputRef.current?.focus();
  }, [prompt, locked, key]);

  // Reset the hint state whenever the question changes.
  useEffect(() => {
    setShowHint(false);
    setRevealed(0);
  }, [prompt]);

  // Pre-fill the input with the model in copy mode (just once per question).
  useEffect(() => {
    if (copyAnswer && !value) onChange(copyAnswer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copyAnswer, prompt]);

  const syllables = useMemo(() => (answer ? splitSyllables(answer) : []), [answer]);
  const revealedText = useMemo(() => {
    if (!answer) return "";
    if (syllables.length === 0) return answer.slice(0, revealed);
    return syllables.slice(0, revealed).join("");
  }, [answer, syllables, revealed]);
  const maxReveals = syllables.length || (answer?.length ?? 0);

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

      {hint && !progressiveHint && (
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

      {progressiveHint && answer && maxReveals > 0 && (
        <div className="mt-4 flex min-h-[1.75rem] items-center gap-3">
          <button
            type="button"
            disabled={revealed >= maxReveals}
            onClick={() => setRevealed((r) => Math.min(maxReveals, r + 1))}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-semibold text-muted-foreground active:scale-95 disabled:opacity-40"
          >
            <Lightbulb className="h-4 w-4" /> Révéler une syllabe
          </button>
          {revealed > 0 && (
            <span className="text-base font-bold text-muted-foreground">
              {revealedText}
              {revealed < maxReveals && <span className="text-muted-foreground/40">…</span>}
            </span>
          )}
        </div>
      )}

      {copyAnswer && (
        <div className="mt-5 flex min-h-[6rem] items-center justify-center rounded-3xl bg-noms px-6 py-5 text-center">
          <span className="inline-flex items-center gap-2 text-noms-foreground">
            <Eye className="h-5 w-5 opacity-70" />
            <span className="text-4xl font-extrabold">{copyAnswer}</span>
          </span>
        </div>
      )}

      <label className="mt-8 block text-sm font-medium text-muted-foreground">
        {copyAnswer ? "Recopie pour mémoriser" : "Ta réponse"}
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
