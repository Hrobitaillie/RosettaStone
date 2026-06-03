import { useEffect, useState } from "react";
import { BigButton } from "@/components/mobile/primitives";
import { cn } from "@/lib/utils";

/**
 * Big tappable pastel card (Flashcard.png): shows the front (large), tap to
 * reveal the back, then grade with "À revoir" / "Je sais".
 */
export function FlashcardView({
  front,
  back,
  /** Pastel surface classes, e.g. "bg-noms text-noms-foreground". */
  surface,
  label,
  onGrade,
}: {
  front: string;
  back: string;
  surface: string;
  label?: string;
  onGrade: (correct: boolean) => void;
}) {
  const [revealed, setRevealed] = useState(false);

  // Reset the flip whenever the card changes.
  useEffect(() => {
    setRevealed(false);
  }, [front, back]);

  return (
    <div className="flex h-full flex-col">
      {label && (
        <div className="pb-4 pt-3 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      )}

      <button
        type="button"
        onClick={() => setRevealed(true)}
        className={cn(
          "flex flex-1 flex-col items-center justify-center rounded-3xl p-6 text-center transition active:scale-[0.99]",
          surface,
        )}
      >
        <span className="text-5xl font-extrabold leading-tight">{revealed ? back : front}</span>
        {!revealed && (
          <>
            <span className="mt-8 h-12 w-12 rounded-full bg-black/10" />
            <span className="mt-auto pt-10 text-sm font-medium opacity-70">
              Touchez pour révéler
            </span>
          </>
        )}
        {revealed && <span className="mt-3 text-lg font-semibold opacity-70">{front}</span>}
      </button>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <BigButton variant="secondary" onClick={() => onGrade(false)} disabled={!revealed}>
          À revoir
        </BigButton>
        <BigButton variant="primary" onClick={() => onGrade(true)} disabled={!revealed}>
          Je sais
        </BigButton>
      </div>
    </div>
  );
}
