import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listNotes } from "@/lib/db";
import { categorySwatch } from "@/lib/categories";
import { Screen } from "@/components/mobile/Screen";
import { ScreenHeader, Pill, PillRow, BigButton } from "@/components/mobile/primitives";
import { FAB } from "@/components/mobile/FAB";
import { LanguagePicker, useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { markdownPreview } from "@/components/notes/Markdown";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notes")({
  component: NotesPage,
});

const ALL = "__all__";

function NotesPage() {
  const navigate = useNavigate();
  const { languages, current, setLangId } = useSelectedLanguage();
  const langId = current?.id ?? "";

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", langId],
    queryFn: () => listNotes(langId),
    enabled: !!langId,
  });

  const [filter, setFilter] = useState<string>(ALL);

  // Distinct categories present, in first-seen order.
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const n of notes) {
      const c = n.category?.trim();
      if (c && !seen.includes(c)) seen.push(c);
    }
    return seen;
  }, [notes]);

  const filtered = useMemo(
    () => (filter === ALL ? notes : notes.filter((n) => n.category === filter)),
    [notes, filter],
  );

  if (!languages.length) {
    return (
      <Screen>
        <ScreenHeader title="Notes" />
        <EmptyNoLang />
      </Screen>
    );
  }

  return (
    <>
      <Screen>
        <ScreenHeader
          title="Notes"
          right={<LanguagePicker languages={languages} current={current} onSelect={setLangId} />}
        />

        <PillRow className="mt-3">
          <Pill active={filter === ALL} onClick={() => setFilter(ALL)}>
            Toutes
          </Pill>
          {categories.map((c) => (
            <Pill key={c} active={filter === c} onClick={() => setFilter(c)}>
              {c}
            </Pill>
          ))}
        </PillRow>

        <div className="mt-4 space-y-3">
          {filtered.map((n) => {
            const swatch = categorySwatch(n.category);
            const preview = markdownPreview(n.content);
            return (
              <Link
                key={n.id}
                to="/note/$id"
                params={{ id: n.id }}
                className={cn(
                  "block rounded-3xl border-l-4 bg-card p-5 transition active:scale-[0.99]",
                  swatch.border,
                )}
              >
                <h3 className="text-lg font-bold leading-tight text-foreground">{n.title}</h3>
                {preview && (
                  <p className="mt-1 truncate text-sm text-muted-foreground">{preview}</p>
                )}
                {n.category && (
                  <span
                    className={cn(
                      "mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                      swatch.badge,
                    )}
                  >
                    {n.category}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {!filtered.length && (
          <div className="mt-16 text-center text-sm text-muted-foreground">
            {notes.length
              ? "Aucune note dans cette catégorie."
              : "Aucune note. Touchez le + pour ajouter une règle ou une expression."}
          </div>
        )}
      </Screen>

      <FAB onClick={() => navigate({ to: "/note/new" })} label="Nouvelle note" />
    </>
  );
}

function EmptyNoLang() {
  return (
    <div className="mt-24 flex flex-col items-center px-6 text-center">
      <div className="text-6xl">📝</div>
      <p className="mt-4 text-sm text-muted-foreground">
        Créez d'abord une langue pour prendre des notes.
      </p>
      <Link to="/language/new" className="mt-6 w-full max-w-xs">
        <BigButton>Ajouter une langue</BigButton>
      </Link>
    </div>
  );
}
