import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { BigButton } from "@/components/mobile/primitives";

/** Persisted error record (keeps the last few crashes so the user can copy/paste them back). */
type LoggedError = {
  ts: number;
  message: string;
  stack?: string;
  componentStack?: string;
  context?: Record<string, unknown>;
};

const STORAGE_KEY = "rs.lastErrors";
const MAX_LOGS = 5;

/** Append an error to the localStorage ring buffer (best-effort, never throws). */
export function logSessionError(
  err: unknown,
  context?: Record<string, unknown>,
  componentStack?: string,
): void {
  try {
    const rec: LoggedError = {
      ts: Date.now(),
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      componentStack,
      context,
    };
    const raw = localStorage.getItem(STORAGE_KEY);
    const prev: LoggedError[] = raw ? JSON.parse(raw) : [];
    const next = [rec, ...prev].slice(0, MAX_LOGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* localStorage full / disabled / parse error — silent */
  }
  // Mirror to console too — useful when chrome:inspect is attached to the WebView.
  console.error("[session]", err, context);
}

type Props = {
  children: ReactNode;
  onReset?: () => void;
  onExit?: () => void;
};

type State = {
  error: Error | null;
  info: ErrorInfo | null;
};

/**
 * Catches React render errors inside the exercise runner so a single bad
 * question doesn't bubble up to the route-level errorComponent (which would
 * force a reload and wipe the session). Shows the error inline with a
 * "Reprendre" button that re-mounts the runner via `onReset`.
 */
export class SessionErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ info });
    logSessionError(error, { boundary: "SessionErrorBoundary" }, info.componentStack ?? undefined);
  }

  private reset = () => {
    this.setState({ error: null, info: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex h-full flex-col px-5 pt-6">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <div className="text-xl font-extrabold leading-tight">Erreur dans la session</div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              La session est interrompue. Tu peux la relancer sans recharger l'app.
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-card p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Message
          </div>
          <pre className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-foreground">
            {error.message || String(error)}
          </pre>
          {error.stack && (
            <>
              <div className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Stack
              </div>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-tight text-muted-foreground">
                {error.stack}
              </pre>
            </>
          )}
          {info?.componentStack && (
            <>
              <div className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Composants
              </div>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-tight text-muted-foreground">
                {info.componentStack}
              </pre>
            </>
          )}
        </div>

        <div className="mt-auto flex gap-3 pb-6 pt-8">
          {this.props.onExit && (
            <BigButton variant="secondary" onClick={this.props.onExit} className="flex-1">
              Quitter
            </BigButton>
          )}
          <BigButton variant="primary" onClick={this.reset} className="flex-1">
            Reprendre
          </BigButton>
        </div>
      </div>
    );
  }
}
