import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import { BigButton } from "@/components/mobile/primitives";
import { cn } from "@/lib/utils";

/**
 * 4-choice QCM (QCM dialogue.png). The foreign word is the prompt; the four
 * translations are a 2-col grid of big rounded buttons. After verifying
 * (`locked`), the correct choice turns lime and a wrong pick turns red.
 */
export function QcmView({
  prompt,
  choices,
  selected,
  onSelect,
  onVerify,
  locked,
  answerIndex,
  hint,
}: {
  prompt: string;
  choices: string[];
  selected: number | null;
  onSelect: (i: number) => void;
  onVerify: () => void;
  locked: boolean;
  answerIndex: number;
  /** Optional romanisation revealed as a hint. */
  hint?: string;
}) {
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    setShowHint(false);
  }, [prompt]);

  return (
    <div className="flex flex-col">
      <h2 className="pt-6 text-3xl font-extrabold leading-tight">{prompt}</h2>

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

      <div className="mt-8 grid grid-cols-2 gap-3">
        {choices.map((choice, i) => {
          const isSelected = selected === i;
          const isAnswer = i === answerIndex;
          let tone = "bg-card text-foreground";
          if (locked) {
            if (isAnswer) tone = "bg-primary text-primary-foreground";
            else if (isSelected) tone = "bg-destructive text-destructive-foreground";
            else tone = "bg-card text-muted-foreground";
          } else if (isSelected) {
            tone = "bg-primary text-primary-foreground";
          }
          return (
            <button
              key={`${choice}-${i}`}
              type="button"
              disabled={locked}
              onClick={() => onSelect(i)}
              className={cn(
                "flex min-h-[4.5rem] items-center justify-center rounded-2xl px-4 py-4 text-center text-lg font-bold transition active:scale-[0.98]",
                tone,
              )}
            >
              {choice}
            </button>
          );
        })}
      </div>

      <div className="mt-8">
        <BigButton variant="primary" onClick={onVerify} disabled={locked || selected == null}>
          Vérifier
        </BigButton>
      </div>
    </div>
  );
}
