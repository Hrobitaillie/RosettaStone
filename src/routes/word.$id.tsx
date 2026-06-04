import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getWord,
  listWords,
  deleteWord,
  toggleWordFavorite,
  knowledgeScore,
  WORD_FORMS,
  type Word,
  type WordForm,
  type WordMeaning,
} from "@/lib/db";
import { splitSyllables } from "@/lib/hangul";
import { PASTEL_CYCLE } from "@/lib/categories";
import { Screen } from "@/components/mobile/Screen";
import { Card, IconButton, PastelCard, Pill, SectionLabel } from "@/components/mobile/primitives";
import { useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { WordDrawer } from "@/components/dictionary/WordDrawer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/word/$id")({
  component: WordDetailPage,
});

function WordDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { current } = useSelectedLanguage();
  const langId = current?.id ?? "";

  const { data: word, isPending } = useQuery({
    queryKey: ["word", id],
    queryFn: () => getWord(id),
  });

  // Resolve related words to ids for linking.
  const { data: allWords = [] } = useQuery({
    queryKey: ["words", langId],
    queryFn: () => listWords(langId),
    enabled: !!langId,
  });

  const [editOpen, setEditOpen] = useState(false);

  async function onFav() {
    if (!word) return;
    await toggleWordFavorite(word.id, !word.is_favorite);
    qc.invalidateQueries({ queryKey: ["word", id] });
    qc.invalidateQueries({ queryKey: ["words"] });
  }

  async function onDelete() {
    if (!word) return;
    if (!confirm(`Supprimer « ${word.original} » ?`)) return;
    await deleteWord(word.id);
    qc.invalidateQueries({ queryKey: ["words"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    toast.success("Mot supprimé");
    navigate({ to: "/dictionary" });
  }

  if (isPending) {
    return (
      <Screen withNav={false}>
        <div className="mt-24 text-center text-sm text-muted-foreground">Chargement…</div>
      </Screen>
    );
  }

  if (!word) {
    return (
      <Screen withNav={false}>
        <div className="flex items-center justify-between pt-1">
          <IconButton onClick={() => navigate({ to: "/dictionary" })} aria-label="Retour">
            <span className="text-xl leading-none">‹</span>
          </IconButton>
        </div>
        <div className="mt-24 text-center text-sm text-muted-foreground">Mot introuvable.</div>
      </Screen>
    );
  }

  const hasMeanings = word.meanings.length > 0;
  const senseCount = word.meanings.length + 1;

  return (
    <>
      <Screen withNav={false}>
        {/* Top bar: back + favorite */}
        <div className="flex items-center justify-between pt-1">
          <Link
            to="/dictionary"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground"
            aria-label="Retour"
          >
            <span className="-mt-0.5 text-2xl leading-none">‹</span>
          </Link>
          <div className="flex items-center gap-2">
            <IconButton onClick={() => setEditOpen(true)} aria-label="Modifier">
              <Pencil className="h-4 w-4" />
            </IconButton>
            <IconButton onClick={onDelete} aria-label="Supprimer">
              <Trash2 className="h-4 w-4" />
            </IconButton>
            <button
              type="button"
              onClick={onFav}
              aria-label="Favori"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
            >
              <Star
                className={cn(
                  "h-5 w-5 transition",
                  word.is_favorite ? "fill-primary text-primary" : "text-foreground",
                )}
              />
            </button>
          </div>
        </div>

        {hasMeanings ? (
          <HomonymView word={word} senseCount={senseCount} />
        ) : (
          <SingleView word={word} allWords={allWords} />
        )}
      </Screen>

      <WordDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        langId={word.language_id}
        editing={word}
        advanced
        alphabet={current?.alphabet}
      />
    </>
  );
}

/* ---------- Single-meaning fiche (Fiche mot.png) ---------- */

function SingleView({ word, allWords }: { word: Word; allWords: Word[] }) {
  return (
    <>
      {/* Title */}
      <div className="mt-3 flex items-center gap-3">
        <h1 className="text-4xl font-extrabold leading-tight">{word.original}</h1>
        <span className="h-7 w-7 shrink-0 rounded-full bg-primary" />
      </div>
      {word.transcription && (
        <div className="mt-1 text-base text-muted-foreground">{word.transcription}</div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {word.category && <Pill active={false}>{word.category}</Pill>}
        {word.level && <Pill active={false}>{word.level}</Pill>}
      </div>

      {/* Big translation */}
      <div className="mt-5 text-3xl font-bold">{word.translation}</div>

      <KnowledgeCard word={word} />

      {/* Examples */}
      {word.examples.length > 0 && (
        <>
          <SectionLabel className="mt-7">Exemples</SectionLabel>
          <div className="mt-3 space-y-3">
            {word.examples.map((ex, i) => (
              <Card key={i}>
                <div className="text-lg font-bold">{ex.original}</div>
                {ex.translation && (
                  <div className="mt-1 text-sm text-muted-foreground">{ex.translation}</div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Note */}
      {word.notes && (
        <>
          <SectionLabel className="mt-7">Note</SectionLabel>
          <PastelCard tone="bg-adjectifs text-adjectifs-foreground" className="mt-3">
            {word.notes}
          </PastelCard>
        </>
      )}

      {/* Related */}
      {word.related.length > 0 && (
        <div className="mt-7 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Liés
          </span>
          {word.related.map((r) => {
            const match = allWords.find(
              (w) => w.original.trim().toLowerCase() === r.trim().toLowerCase(),
            );
            return match ? (
              <Link
                key={r}
                to="/word/$id"
                params={{ id: match.id }}
                className="rounded-full bg-muted px-4 py-1.5 text-sm font-semibold text-foreground active:opacity-70"
              >
                {r}
              </Link>
            ) : (
              <span
                key={r}
                className="rounded-full bg-muted px-4 py-1.5 text-sm font-semibold text-muted-foreground"
              >
                {r}
              </span>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ---------- Homonym / multi-meaning view (Homonyme _.png) ---------- */

function HomonymView({ word, senseCount }: { word: Word; senseCount: number }) {
  // Sense #1 is the primary (translation/category/first example), then extra meanings.
  const primary: WordMeaning = {
    translation: word.translation,
    category: word.category,
    example_original: word.examples[0]?.original ?? null,
    example_translation: word.examples[0]?.translation ?? null,
    note: null,
  };
  const senses = [primary, ...word.meanings];

  return (
    <>
      {/* Title row: original + lime "N significations" badge */}
      <div className="mt-3 flex items-center gap-3">
        <h1 className="text-4xl font-extrabold leading-tight">{word.original}</h1>
        <span className="rounded-full bg-primary px-4 py-2 text-base font-bold text-primary-foreground">
          {senseCount} significations
        </span>
      </div>
      {word.transcription && (
        <div className="mt-2 text-base text-muted-foreground">{word.transcription}</div>
      )}

      <KnowledgeCard word={word} />

      {/* Sense cards, cycling pastel colors */}
      <div className="mt-5 space-y-4">
        {senses.map((s, i) => (
          <SenseCard key={i} sense={s} index={i} />
        ))}
      </div>
    </>
  );
}

function SenseCard({ sense, index }: { sense: WordMeaning; index: number }) {
  const tone = PASTEL_CYCLE[index % PASTEL_CYCLE.length];
  const footer = [sense.category, sense.note].filter(Boolean).join(" · ");
  return (
    <PastelCard tone={tone}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/15 text-sm font-bold">
            {index + 1}
          </span>
          <span className="text-2xl font-extrabold">{sense.translation}</span>
        </div>
        {sense.category && (
          <span className="shrink-0 pt-1 text-sm font-medium opacity-70">{sense.category}</span>
        )}
      </div>

      {sense.example_original && (
        <div className="mt-4">
          <div className="text-xl font-bold">{sense.example_original}</div>
          {sense.example_translation && (
            <div className="mt-1 text-base opacity-80">{sense.example_translation}</div>
          )}
        </div>
      )}

      {footer && (
        <>
          <div className="mt-4 border-t border-black/10" />
          <div className="mt-3 text-sm opacity-70">{footer}</div>
        </>
      )}
    </PastelCard>
  );
}

/* ---------- Knowledge card: overall ring + per-form bars ---------- */

const FORM_LABELS: Record<WordForm, string> = {
  comp: "Compréhension",
  write: "Écriture",
  draw: "Tracé",
};

function KnowledgeCard({ word }: { word: Word }) {
  const score = knowledgeScore(word);
  const totalReviews = WORD_FORMS.reduce((s, f) => s + word.srs[f].reviews, 0);
  const totalSuccess = WORD_FORMS.reduce((s, f) => s + word.srs[f].success, 0);
  // Tracé only applies when the word actually contains hangul.
  const hasHangul = splitSyllables(word.original).length > 0;
  const forms: WordForm[] = hasHangul ? ["comp", "write", "draw"] : ["comp", "write"];

  return (
    <Card className="mt-5">
      <div className="flex items-center gap-4">
        <SuccessRing value={score} />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold">Connaissance</div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            {totalReviews === 0
              ? "Pas encore travaillé en mode apprentissage"
              : `${totalReviews} révision${totalReviews > 1 ? "s" : ""} · ${totalSuccess}/${totalReviews} réussies`}
          </div>
        </div>
      </div>
      <div className="mt-5 space-y-2.5">
        {forms.map((key) => {
          const srs = word.srs[key];
          const reviewed = srs.reviews > 0;
          const rate = reviewed ? Math.round((srs.success / srs.reviews) * 100) : 0;
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm font-semibold">{FORM_LABELS[key]}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: reviewed ? `${rate}%` : "0%" }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-sm font-semibold text-muted-foreground">
                {reviewed ? `${rate}%` : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------- Circular success ring (SVG) ---------- */

function SuccessRing({ value }: { value: number }) {
  const size = 56;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="stroke-primary transition-all"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-base font-bold">
        {value}
      </span>
    </div>
  );
}
