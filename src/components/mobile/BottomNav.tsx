import { Link, useRouterState } from "@tanstack/react-router";
import { Home, BookOpen, Sparkles, StickyNote, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Accueil", icon: Home, match: (p: string) => p === "/" },
  { to: "/dictionary", label: "Dico", icon: BookOpen, match: (p: string) => p.startsWith("/dictionary") || p.startsWith("/word") },
  { to: "/verbs", label: "Verbes", icon: Sparkles, match: (p: string) => p.startsWith("/verbs") || p.startsWith("/verb/") },
  { to: "/notes", label: "Notes", icon: StickyNote, match: (p: string) => p.startsWith("/notes") || p.startsWith("/note/") },
  { to: "/exercises", label: "Exos", icon: Dumbbell, match: (p: string) => p.startsWith("/exercises") || p.startsWith("/exercise") || p.startsWith("/review") },
] as const;

/** Routes that should hide the bottom nav (immersive exercise / editor flows). */
const HIDDEN_PREFIXES = ["/exercise/", "/review/session", "/note/", "/language/new", "/language/"];

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (HIDDEN_PREFIXES.some((p) => path.startsWith(p)) && !tabs.some((t) => t.to === path)) {
    return null;
  }

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center safe-bottom"
      aria-label="Navigation principale"
    >
      <ul
        className="pointer-events-auto mx-4 mb-3 flex h-[68px] w-full max-w-md items-center justify-between rounded-full border border-border bg-card/90 px-2 backdrop-blur-xl"
        style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.45)" }}
      >
        {tabs.map((t) => {
          const active = t.match(path);
          return (
            <li key={t.to} className="flex flex-1">
              <Link
                to={t.to}
                className="flex flex-1 flex-col items-center justify-center gap-1 py-1"
                aria-label={t.label}
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  <t.icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                </span>
                <span
                  className={cn(
                    "text-[10px] leading-none transition-colors",
                    active ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
                  )}
                >
                  {t.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
