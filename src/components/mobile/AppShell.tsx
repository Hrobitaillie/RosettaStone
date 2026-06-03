import { type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/**
 * Wraps a page's main content so it sits between the fixed mobile header and
 * the bottom nav, while preserving safe-area insets.
 */
export function AppShell({ children }: Props) {
  return (
    <div className="pt-header pb-bottom-nav h-full overflow-y-auto overscroll-contain safe-x">
      {children}
    </div>
  );
}
