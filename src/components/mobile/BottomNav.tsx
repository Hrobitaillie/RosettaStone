import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Languages, BookOpen, Sparkles, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Accueil", icon: Home, match: (p: string) => p === "/" },
  { to: "/languages", label: "Langues", icon: Languages, match: (p: string) => p.startsWith("/languages") },
  { to: "/dictionary", label: "Dico", icon: BookOpen, match: (p: string) => p.startsWith("/dictionary") },
  { to: "/verbs", label: "Verbes", icon: Sparkles, match: (p: string) => p.startsWith("/verbs") },
  { to: "/notes", label: "Notes", icon: NotebookPen, match: (p: string) => p.startsWith("/notes") },
] as const;

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 h-bottom-nav border-t border-border bg-card/95 backdrop-blur safe-bottom"
      aria-label="Navigation principale"
    >
      <ul className="mx-auto grid h-full max-w-md grid-cols-5">
        {tabs.map((t) => {
          const active = t.match(path);
          return (
            <li key={t.to} className="flex">
              <Link
                to={t.to}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium tracking-wide transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary/10",
                  )}
                >
                  <t.icon className={cn("h-5 w-5", active && "stroke-[2.4]")} />
                </span>
                <span className="leading-none">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
