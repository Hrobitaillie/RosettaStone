import { Link } from "@tanstack/react-router";
import { categoryKeyOf, type CategoryKey } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { knowledgeScore, WORD_FORMS, type Word } from "@/lib/db";

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  noms: "NOM",
  verbes: "VERBE",
  adjectifs: "ADJECTIF",
  expressions: "EXPRESSION",
  autres: "AUTRE",
};

/** Uppercase category label: prefer the word's own free-text category, else the mapped key. */
function categoryLabel(category: string | null | undefined): string {
  if (category?.trim()) return category.trim().toUpperCase();
  return CATEGORY_LABEL[categoryKeyOf(category)];
}

/**
 * Flat dictionary list row (matches Dictionnaire.png / Recherche.png):
 * big bold original + muted transcription | translation (+ "n sens" badge) | uppercase category.
 */
export function WordRow({ word, className }: { word: Word; className?: string }) {
  const senses = word.meanings.length + 1;
  const score = knowledgeScore(word);
  const reviewed = WORD_FORMS.some((f) => word.srs[f].reviews > 0);
  return (
    <Link
      to="/word/$id"
      params={{ id: word.id }}
      className={cn("flex items-start justify-between gap-4 py-4 active:opacity-70", className)}
    >
      <div className="min-w-0">
        <div className="truncate text-2xl font-extrabold leading-tight">{word.original}</div>
        {word.transcription && (
          <div className="mt-0.5 truncate text-sm text-muted-foreground">{word.transcription}</div>
        )}
      </div>
      <div className="flex min-w-0 max-w-[58%] shrink-0 flex-col items-end pt-1 text-right">
        <div className="flex items-center justify-end gap-2">
          <span className="truncate text-base">{word.translation}</span>
          {senses > 1 && (
            <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              {senses} sens
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          <span>{categoryLabel(word.category)}</span>
          <span aria-hidden className="text-muted-foreground/40">·</span>
          <KnowledgeBadge score={score} reviewed={reviewed} />
        </div>
      </div>
    </Link>
  );
}

function KnowledgeBadge({ score, reviewed }: { score: number; reviewed: boolean }) {
  if (!reviewed) {
    return (
      <span
        className="rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground/70"
        title="Pas encore travaillé en mode apprentissage"
      >
        —
      </span>
    );
  }
  const tone =
    score >= 80
      ? "bg-srs-mastered/15 text-srs-mastered"
      : score >= 50
        ? "bg-expressions-bar/15 text-expressions-bar"
        : "bg-destructive/15 text-destructive";
  return (
    <span
      className={cn("rounded-full px-1.5 py-0.5 tabular-nums", tone)}
      title={`Score de connaissance — ${score}%`}
    >
      {score}%
    </span>
  );
}
