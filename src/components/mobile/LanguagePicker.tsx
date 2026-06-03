import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listLanguages, type Language } from "@/lib/db";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { ChevronDown, Check } from "lucide-react";

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

export function LanguagePicker({ current, onSelect, languages }: Props) {
  const [open, setOpen] = useState(false);

  if (!languages.length) return null;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-foreground"
        >
          <span className="text-base leading-none">{current?.flag || "🌐"}</span>
          <span className="truncate max-w-[10ch]">{current?.name ?? "Choisir"}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md px-4 pb-6 pt-2">
          <div className="mb-3 text-center text-xs uppercase tracking-wider text-muted-foreground">
            Choisir une langue
          </div>
          <ul className="space-y-1">
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
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-muted"
                  >
                    <span className="text-2xl">{l.flag || "🌐"}</span>
                    <span className="flex-1">
                      <span className="block font-medium">{l.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {l.alphabet || "—"} · vers {l.translation_language}
                      </span>
                    </span>
                    {active && <Check className="h-4 w-4 text-primary" />}
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
