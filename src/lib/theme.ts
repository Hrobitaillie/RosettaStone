import type { AccentColor, ThemeMode, Settings } from "@/lib/db";

/** Applies the accent hue by toggling `data-accent` on <html>. */
export function applyAccent(accent: AccentColor) {
  const root = document.documentElement;
  if (accent === "lime") root.removeAttribute("data-accent");
  else root.setAttribute("data-accent", accent);
}

/** Applies the light/dark mode. Dark is the default (no class). */
export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("light", mode === "light");
  root.classList.toggle("dark", mode === "dark");
}

export function applySettings(settings: Pick<Settings, "accent" | "theme">) {
  applyAccent(settings.accent);
  applyTheme(settings.theme);
}
