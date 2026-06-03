import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string | (() => void);
  right?: ReactNode;
  className?: string;
};

export function MobileHeader({ title, subtitle, back, right, className }: Props) {
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 h-header bg-background/85 backdrop-blur border-b border-border safe-x",
        className,
      )}
    >
      <div
        className="flex h-full items-center gap-2 px-3"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        {back &&
          (typeof back === "string" ? (
            <Link
              to={back}
              className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
              aria-label="Retour"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={back}
              className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
              aria-label="Retour"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ))}
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg leading-tight">{title}</div>
          {subtitle && (
            <div className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
        {right && <div className="flex items-center gap-1">{right}</div>}
      </div>
    </header>
  );
}
