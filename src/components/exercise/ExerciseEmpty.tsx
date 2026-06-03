import { Link } from "@tanstack/react-router";

/**
 * Friendly empty / no-data state shared by every exercise screen.
 * Either prompts to create a language or to add words.
 */
export function ExerciseEmpty({
  emoji = "🌱",
  message,
  to,
  cta,
}: {
  emoji?: string;
  message: string;
  to: "/dictionary" | "/language/new";
  cta: string;
}) {
  return (
    <div className="mt-24 flex flex-col items-center text-center">
      <div className="text-6xl">{emoji}</div>
      <p className="mt-5 text-sm text-muted-foreground">{message}</p>
      <Link
        to={to}
        className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 font-bold text-primary-foreground transition active:scale-95"
      >
        {cta}
      </Link>
    </div>
  );
}
