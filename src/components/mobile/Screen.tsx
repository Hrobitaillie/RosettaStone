import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  /** Add padding so content clears the floating bottom nav. Default true. */
  withNav?: boolean;
  className?: string;
  /** Inner horizontal padding wrapper. Default true (px-5). */
  padded?: boolean;
};

/**
 * Full-height scrolling page container. Replaces the old fixed-header AppShell:
 * mockups scroll from the status bar with an in-flow header, so pages render
 * their own header inside <Screen>.
 */
export function Screen({ children, withNav = true, className, padded = true }: Props) {
  return (
    <div
      className={cn(
        "h-full overflow-y-auto overscroll-contain safe-x pt-status",
        withNav ? "pb-bottom-nav" : "pb-safe",
        className,
      )}
    >
      <div className={cn(padded && "px-5", "pb-6")}>{children}</div>
    </div>
  );
}
