import { ArrowDownRight, ArrowUpRight, GraduationCap, Minus } from "lucide-react";
import { BigButton, PastelCard, SectionLabel } from "@/components/mobile/primitives";
import { cn } from "@/lib/utils";

export type LearnWordOutcome = {
  id: string;
  original: string;
  translation: string;
  /** Stage before this session (0..5). */
  fromStage: number;
  /** Stage after this session (0..5). */
  toStage: number;
  correct: number;
  total: number;
};

const STAGE_LABEL = [
  "Découverte",
  "Complétion",
  "Production assistée",
  "Production libre",
  "Reconnaissance",
  "Diplômé",
];

/**
 * Variant of the regular ResultScreen for the apprentissage progressif.
 * Shows what happened to each word (stage advanced / held / demoted / graduated).
 */
export function LearnResultScreen({
  outcomes,
  onContinue,
  onFinish,
}: {
  outcomes: LearnWordOutcome[];
  onContinue: () => void;
  onFinish: () => void;
}) {
  const advanced = outcomes.filter((o) => o.toStage > o.fromStage);
  const held = outcomes.filter((o) => o.toStage === o.fromStage);
  const demoted = outcomes.filter((o) => o.toStage < o.fromStage);
  const graduated = outcomes.filter((o) => o.toStage === 5 && o.fromStage < 5);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-col items-center pt-10 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <GraduationCap className="h-12 w-12" />
        </span>
        <h1 className="mt-6 text-3xl font-extrabold">Session terminée !</h1>
        <p className="mt-2 text-muted-foreground">
          {advanced.length > 0
            ? `${advanced.length} mot${advanced.length > 1 ? "s" : ""} ${advanced.length > 1 ? "ont" : "a"} progressé.`
            : "Continue, ça finit par rentrer."}
        </p>
      </div>

      <div className="mt-7 grid grid-cols-3 gap-3">
        <PastelCard tone="bg-verbes text-verbes-foreground" className="p-4 text-center">
          <div className="text-2xl font-extrabold leading-none">{advanced.length}</div>
          <div className="mt-1.5 text-sm font-medium">avancé{advanced.length > 1 ? "s" : ""}</div>
        </PastelCard>
        <PastelCard tone="bg-noms text-noms-foreground" className="p-4 text-center">
          <div className="text-2xl font-extrabold leading-none">{held.length}</div>
          <div className="mt-1.5 text-sm font-medium">à revoir</div>
        </PastelCard>
        <PastelCard tone="bg-adjectifs text-adjectifs-foreground" className="p-4 text-center">
          <div className="text-2xl font-extrabold leading-none">{graduated.length}</div>
          <div className="mt-1.5 text-sm font-medium">diplômé{graduated.length > 1 ? "s" : ""}</div>
        </PastelCard>
      </div>

      {outcomes.length > 0 && (
        <section className="mt-7">
          <SectionLabel>Détail</SectionLabel>
          <ul className="mt-3 space-y-2">
            {outcomes.map((o) => (
              <OutcomeRow key={o.id} outcome={o} />
            ))}
          </ul>
        </section>
      )}

      <div className="mt-auto space-y-2 pt-10">
        <BigButton variant="primary" onClick={onContinue}>
          Nouvelle session
        </BigButton>
        <BigButton variant="ghost" onClick={onFinish}>
          Terminer
        </BigButton>
      </div>

      {demoted.length > 0 && (
        <p className="mt-3 pb-2 text-center text-xs text-muted-foreground">
          {demoted.length} mot{demoted.length > 1 ? "s sont revenus" : " est revenu"} à un stade
          précédent.
        </p>
      )}
    </div>
  );
}

function OutcomeRow({ outcome }: { outcome: LearnWordOutcome }) {
  const { fromStage, toStage } = outcome;
  const direction = toStage > fromStage ? "up" : toStage < fromStage ? "down" : "hold";
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const tone =
    direction === "up"
      ? "text-srs-mastered bg-srs-mastered/15"
      : direction === "down"
        ? "text-destructive bg-destructive/15"
        : "text-muted-foreground bg-muted";

  return (
    <li className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-bold">{outcome.original}</div>
        <div className="truncate text-sm text-muted-foreground">{outcome.translation}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs font-semibold text-muted-foreground">
          {STAGE_LABEL[fromStage]} → <span className="text-foreground">{STAGE_LABEL[toStage]}</span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground/70 tabular-nums">
          {outcome.correct}/{outcome.total}
        </div>
      </div>
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", tone)}>
        <Icon className="h-4 w-4" />
      </span>
    </li>
  );
}
