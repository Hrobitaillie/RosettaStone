import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { searchWords } from "@/lib/db";
import { Screen } from "@/components/mobile/Screen";
import { SectionLabel } from "@/components/mobile/primitives";
import { useSelectedLanguage } from "@/components/mobile/LanguagePicker";
import { WordRow } from "@/components/dictionary/WordRow";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/search")({
  component: SearchPage,
});

const RECENT_KEY = "rs.recentSearches";
const MAX_RECENT = 6;

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // ignore storage failures (private mode / quota)
  }
}

function SearchPage() {
  const { current } = useSelectedLanguage();
  const langId = current?.id ?? "";
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(loadRecent);

  const term = query.trim();

  const { data: results = [] } = useQuery({
    queryKey: ["search", langId, term],
    queryFn: () => searchWords(langId, term),
    enabled: !!langId && term.length > 0,
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Persist the term as a recent search once the user pauses typing.
  useEffect(() => {
    if (!term) return;
    const t = setTimeout(() => {
      setRecent((prev) => {
        const next = [term, ...prev.filter((r) => r !== term)].slice(0, MAX_RECENT);
        saveRecent(next);
        return next;
      });
    }, 900);
    return () => clearTimeout(t);
  }, [term]);

  return (
    <Screen withNav={false}>
      {/* Search bar + Annuler */}
      <div className="flex items-center gap-3 pt-1">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher…"
          className={cn(
            "h-12 flex-1 rounded-full bg-muted px-5 text-base font-semibold text-foreground outline-none",
            "ring-2 ring-transparent transition focus:ring-primary placeholder:font-normal placeholder:text-muted-foreground",
          )}
        />
        <Link to="/dictionary" className="shrink-0 px-1 text-base font-semibold text-primary">
          Annuler
        </Link>
      </div>

      {term ? (
        <>
          <SectionLabel className="mt-6">
            {results.length} résultat{results.length > 1 ? "s" : ""}
          </SectionLabel>
          <div className="mt-1 divide-y divide-border">
            {results.map((w) => (
              <WordRow key={w.id} word={w} />
            ))}
          </div>
          {!results.length && (
            <div className="mt-16 text-center text-sm text-muted-foreground">Aucun résultat.</div>
          )}
        </>
      ) : (
        recent.length > 0 && (
          <>
            <SectionLabel className="mt-6">Recherches récentes</SectionLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {recent.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setQuery(r);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full bg-muted px-5 py-2.5 text-base font-bold text-foreground active:opacity-70"
                >
                  {r}
                </button>
              ))}
            </div>
          </>
        )
      )}
    </Screen>
  );
}
