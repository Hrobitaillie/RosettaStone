import { Check, X } from "lucide-react";
import { BigButton } from "@/components/mobile/primitives";
import { cn } from "@/lib/utils";

export type Feedback = {
  correct: boolean;
  /** Display label of the graded item (original / foreign word). */
  word: string;
  /** Correct answer, shown when wrong. */
  answer: string;
  oldRate: number;
  newRate: number;
};

/**
 * Bottom feedback sheet after a typed/QCM answer.
 * Correct → mint surface (Validation _ correct.png).
 * Wrong → rose surface + "Bonne réponse" (Validation _ _ revoir.png).
 */
export function FeedbackSheet({
  feedback,
  onContinue,
}: {
  feedback: Feedback;
  onContinue: () => void;
}) {
  const { correct, word, answer, oldRate, newRate } = feedback;

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 safe-x">
      <div
        className={cn(
          "rounded-t-3xl px-5 pb-6 pt-5",
          correct ? "bg-verbes text-verbes-foreground" : "bg-noms text-noms-foreground",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
              correct
                ? "bg-primary text-primary-foreground"
                : "bg-destructive text-destructive-foreground",
            )}
          >
            {correct ? <Check className="h-6 w-6" /> : <X className="h-6 w-6" />}
          </span>
          <div className="min-w-0">
            <div className="text-xl font-extrabold leading-tight">
              {correct ? "Correct !" : "À revoir"}
            </div>
            {!correct && (
              <div className="truncate text-sm font-medium opacity-90">
                Bonne réponse : <span className="font-bold">{answer}</span>
              </div>
            )}
          </div>
        </div>

        {/* Success-rate chip */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-black/10 px-4 py-3">
          <span className="truncate text-lg font-bold">{word}</span>
          <span className="text-sm opacity-80">taux de réussite</span>
          <span className="ml-auto text-sm opacity-70">{oldRate}%</span>
          <span className="text-lg font-extrabold">{newRate}%</span>
        </div>

        <BigButton
          variant={correct ? "primary" : "secondary"}
          onClick={onContinue}
          className={cn("mt-4", !correct && "bg-card text-foreground")}
          autoFocus
        >
          Continuer
        </BigButton>
      </div>
    </div>
  );
}
