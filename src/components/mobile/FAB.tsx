import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  label?: string;
};

export function FAB({ className, icon, label = "Ajouter", ...rest }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-primary/30 transition active:scale-95",
        // Sits above bottom nav with safe-area
        className,
      )}
      style={{ bottom: `calc(var(--bottom-nav-h) + var(--safe-bottom) + 16px)` }}
      {...rest}
    >
      {icon ?? <Plus className="h-6 w-6" />}
    </button>
  );
}
