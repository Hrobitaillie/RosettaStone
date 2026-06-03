import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  label?: string;
};

/** Floating action button — lime circle sitting just above the bottom nav. */
export function FAB({ className, icon, label = "Ajouter", ...rest }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "bottom-above-nav fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition active:scale-95",
        className,
      )}
      style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.45)" }}
      {...rest}
    >
      {icon ?? <Plus className="h-7 w-7" strokeWidth={2.5} />}
    </button>
  );
}
