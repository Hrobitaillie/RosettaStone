import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listLanguages, type Language } from "@/lib/db";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { ChevronDown, Check } from "lucide-react";
import { LangAvatar } from "@/components/mobile/primitives";

const STORAGE_KEY = "rs.selectedLanguageId";

export function useSelectedLanguage() {
  const { data: languages = [], isPending } = useQuery({
    queryKey: ["languages"],
    queryFn: listLanguages,
  });

  const [langId, setLangIdState] = useState<string>(
    () => (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) || "",
  );

  useEffect(() => {
    if (!languages.length) return;
    if (!langId || !languages.find((l) => l.id === langId)) {
      const next = languages[0].id;
      setLangIdState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {}
    }
  }, [languages, langId]);

  function setLangId(id: string) {
    setLangIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  }

  const current = languages.find((l) => l.id === langId) ?? null;
  return { languages, current, langId, setLangId, isPending };
}

type Props = {
  current: Language | null;
  onSelect: (id: string) => void;
  languages: Language[];
};

/** Compact chip (used in page headers): small lime avatar + name. */
export function LanguagePicker({ current, onSelect, languages }: Props) {
  const [open, setOpen] = useState(false);
  if (!languages.length) return null;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full bg-muted py-1.5 pl-1.5 pr-3 text-sm font-semibold text-foreground"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
            {current?.icon || "🌐"}
          </span>
          <span className="max-w-[10ch] truncate">{current?.name ?? "Choisir"}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md px-4 pb-8 pt-2">
          <div className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Choisir une langue
          </div>
          <ul className="space-y-1.5">
            {languages.map((l) => {
              const active = l.id === current?.id;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(l.id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl bg-muted/60 px-3 py-3 text-left transition active:bg-muted"
                  >
                    <LangAvatar icon={l.icon || "🌐"} size="sm" variant={active ? "lime" : "muted"} />
                    <span className="flex-1">
                      <span className="block font-semibold">{l.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {l.alphabet || "—"} · {l.translation_language}
                      </span>
                    </span>
                    {active && <Check className="h-5 w-5 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
