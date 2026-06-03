import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- Round language / profile avatar ---------- */

export function LangAvatar({
  icon,
  size = "md",
  variant = "lime",
  className,
}: {
  icon: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "lime" | "muted";
  className?: string;
}) {
  const sizes = {
    sm: "h-10 w-10 text-lg",
    md: "h-12 w-12 text-xl",
    lg: "h-14 w-14 text-2xl",
    xl: "h-20 w-20 text-4xl",
  };
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        sizes[size],
        variant === "lime" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        className,
      )}
    >
      {icon}
    </span>
  );
}

/* ---------- In-flow page header (avatar + title + right action) ---------- */

export function ScreenHeader({
  title,
  avatar,
  right,
  back,
  className,
}: {
  title?: ReactNode;
  avatar?: ReactNode;
  right?: ReactNode;
  back?: string | (() => void);
  className?: string;
}) {
  return (
    <header className={cn("flex items-center gap-3 pb-2 pt-1", className)}>
      {back &&
        (typeof back === "string" ? (
          <Link
            to={back}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground"
            aria-label="Retour"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={back}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground"
            aria-label="Retour"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ))}
      {avatar}
      {title != null && <h1 className="min-w-0 flex-1 truncate text-2xl font-bold">{title}</h1>}
      {title == null && <span className="flex-1" />}
      {right}
    </header>
  );
}

/* ---------- Pastel card ---------- */

export function PastelCard({
  tone,
  className,
  children,
}: {
  /** Pastel surface utility classes, e.g. "bg-noms text-noms-foreground". */
  tone: string;
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("rounded-3xl p-5", tone, className)}>{children}</div>;
}

/* ---------- Dark surface card ---------- */

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-3xl bg-card p-5", className)} {...rest}>
      {children}
    </div>
  );
}

/* ---------- Filter / segmented pills ---------- */

export function Pill({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition",
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function PillRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]", className)}>
      {children}
    </div>
  );
}

/* ---------- Progress bar ---------- */

export function ProgressBar({
  value,
  className,
  barClassName,
}: {
  value: number; // 0..100
  className?: string;
  barClassName?: string;
}) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full bg-primary transition-all", barClassName)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* ---------- Full-width pill button ---------- */

type BigButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function BigButton({ variant = "primary", className, children, ...rest }: BigButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-14 w-full items-center justify-center rounded-full text-base font-bold transition active:scale-[0.98] disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-foreground",
        variant === "secondary" && "bg-muted text-foreground",
        variant === "ghost" && "text-muted-foreground",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Small round icon button ---------- */

export function IconButton({
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition active:scale-95",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Section label ---------- */

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("text-xs font-semibold uppercase tracking-wider text-muted-foreground", className)}>
      {children}
    </div>
  );
}
