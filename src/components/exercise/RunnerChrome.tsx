import { X } from "lucide-react";
import { ProgressBar } from "@/components/mobile/primitives";
import { cn } from "@/lib/utils";

/**
 * Top chrome shared by every runner: a close button, the lime progress bar,
 * and either a "n/total" counter chip or a running success-% pill (dot turns
 * green / amber / red), matching the Validation mockups.
 */
export function RunnerChrome({
  current,
  total,
  onClose,
  variant = "counter",
  percent,
}: {
  /** Number answered / position (0-based start, shown as current+1 typically). */
  current: number;
  total: number;
  onClose: () => void;
  variant?: "counter" | "percent";
  /** Running success percentage for the percent pill. */
  percent?: number;
}) {
  const value = total > 0 ? (current / total) * 100 : 0;
  const dot =
    percent == null
      ? ""
      : percent >= 80
        ? "bg-srs-mastered"
        : percent >= 50
          ? "bg-expressions-bar"
          : "bg-destructive";

  return (
    <div className="flex items-center gap-3 pt-1">
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition active:scale-95"
      >
        <X className="h-5 w-5" />
      </button>
      <ProgressBar value={value} className="flex-1" />
      {variant === "counter" ? (
        <span className="shrink-0 rounded-full bg-muted px-3 py-1.5 text-sm font-bold text-foreground">
          {Math.min(current + 1, total)}/{total}
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-bold text-foreground">
          <span className={cn("h-2.5 w-2.5 rounded-full", dot)} />
          {percent ?? 100}%
        </span>
      )}
    </div>
  );
}
