import type { SessionMistake } from "@/lib/db";
import { BigButton, PastelCard, SectionLabel } from "@/components/mobile/primitives";

/**
 * Session result (R_sultat de session.png): lime circle, score / XP / streak
 * pastel cards, an "À REVOIR" mistake list, then "Revoir les erreurs" + Terminer.
 */
export function ResultScreen({
  total,
  correct,
  xp,
  streak,
  mistakes,
  onRetryMistakes,
  onFinish,
}: {
  total: number;
  correct: number;
  xp: number;
  streak: number;
  mistakes: SessionMistake[];
  onRetryMistakes: () => void;
  onFinish: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col items-center pt-10 text-center">
        <span className="h-24 w-24 rounded-full bg-primary" />
        <h1 className="mt-6 text-3xl font-extrabold">Session terminée !</h1>
        <p className="mt-2 text-muted-foreground">Beau travail, continue ta série.</p>
      </div>

      <div className="mt-7 grid grid-cols-3 gap-3">
        <PastelCard tone="bg-verbes text-verbes-foreground" className="p-4 text-center">
          <div className="text-2xl font-extrabold leading-none">
            {correct}/{total}
          </div>
          <div className="mt-1.5 text-sm font-medium">score</div>
        </PastelCard>
        <PastelCard tone="bg-noms text-noms-foreground" className="p-4 text-center">
          <div className="text-2xl font-extrabold leading-none">+{xp}</div>
          <div className="mt-1.5 text-sm font-medium">XP</div>
        </PastelCard>
        <PastelCard tone="bg-adjectifs text-adjectifs-foreground" className="p-4 text-center">
          <div className="text-2xl font-extrabold leading-none">{streak} j</div>
          <div className="mt-1.5 text-sm font-medium">série</div>
        </PastelCard>
      </div>

      {mistakes.length > 0 && (
        <section className="mt-7">
          <SectionLabel>À revoir</SectionLabel>
          <ul className="mt-3 space-y-2">
            {mistakes.map((m) => (
              <li key={m.id} className="flex items-baseline gap-3 rounded-2xl bg-card px-4 py-3.5">
                <span className="text-lg font-bold">{m.original}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {m.translation}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-auto space-y-2 pt-10">
        {mistakes.length > 0 && (
          <BigButton variant="primary" onClick={onRetryMistakes}>
            Revoir les erreurs
          </BigButton>
        )}
        <BigButton variant="ghost" onClick={onFinish}>
          Terminer
        </BigButton>
      </div>
    </div>
  );
}
