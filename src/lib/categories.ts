/**
 * Maps a free-text category string to one of the design's pastel palettes.
 * Used for badges, cards, flashcards, note left-borders and stat bars.
 */
export type CategoryKey = "noms" | "verbes" | "adjectifs" | "expressions" | "autres";

export function categoryKeyOf(raw: string | null | undefined): CategoryKey {
  const c = (raw ?? "").toLowerCase().trim();
  if (!c) return "autres";
  if (c.startsWith("nom")) return "noms";
  if (c.startsWith("verb")) return "verbes";
  if (c.startsWith("adj")) return "adjectifs";
  if (c.startsWith("expr") || c.startsWith("loc") || c.startsWith("express")) return "expressions";
  if (c.startsWith("gramm")) return "adjectifs";
  if (c.startsWith("polit")) return "verbes";
  if (c.startsWith("conjug")) return "expressions";
  if (c.startsWith("except")) return "expressions";
  if (c.startsWith("cult")) return "noms";
  return "autres";
}

type Swatch = {
  /** Pastel surface bg + dark fg, for cards/flashcards. */
  surface: string;
  /** Pastel badge (smaller). */
  badge: string;
  /** Saturated bar/dot color (CSS var token). */
  bar: string;
  /** Left-border accent (notes list). */
  border: string;
  dot: string;
};

const SWATCHES: Record<CategoryKey, Swatch> = {
  noms: {
    surface: "bg-noms text-noms-foreground",
    badge: "bg-noms text-noms-foreground",
    bar: "bg-noms-bar",
    border: "border-l-noms-bar",
    dot: "bg-noms-bar",
  },
  verbes: {
    surface: "bg-verbes text-verbes-foreground",
    badge: "bg-verbes text-verbes-foreground",
    bar: "bg-verbes-bar",
    border: "border-l-verbes-bar",
    dot: "bg-verbes-bar",
  },
  adjectifs: {
    surface: "bg-adjectifs text-adjectifs-foreground",
    badge: "bg-adjectifs text-adjectifs-foreground",
    bar: "bg-adjectifs-bar",
    border: "border-l-adjectifs-bar",
    dot: "bg-adjectifs-bar",
  },
  expressions: {
    surface: "bg-expressions text-expressions-foreground",
    badge: "bg-expressions text-expressions-foreground",
    bar: "bg-expressions-bar",
    border: "border-l-expressions-bar",
    dot: "bg-expressions-bar",
  },
  autres: {
    surface: "bg-muted text-foreground",
    badge: "bg-muted text-muted-foreground",
    bar: "bg-muted-foreground",
    border: "border-l-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

export function categorySwatch(raw: string | null | undefined): Swatch {
  return SWATCHES[categoryKeyOf(raw)];
}

/** Pastel surface classes by index (for stat cards that cycle pink/mint/lavender/peach). */
export const PASTEL_CYCLE = [
  "bg-noms text-noms-foreground",
  "bg-verbes text-verbes-foreground",
  "bg-adjectifs text-adjectifs-foreground",
  "bg-expressions text-expressions-foreground",
] as const;
