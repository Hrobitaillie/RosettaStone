import {
  listLanguages,
  upsertLanguage,
  upsertWord,
} from "@/lib/db";

export async function ensureSeed(): Promise<void> {
  const existing = await listLanguages();
  if (existing.length) return;

  const lang = await upsertLanguage({
    name: "Coréen",
    icon: "한",
    flag: "🇰🇷",
    alphabet: "Hangul (한글)",
    translation_language: "Français",
    level: "débutant",
  });
  const language_id = lang.id;

  const words: Parameters<typeof upsertWord>[0][] = [
    { language_id, original: "차", transcription: "cha", translation: "thé", category: "nom" },
    { language_id, original: "커피", transcription: "keopi", translation: "café", category: "nom" },
    { language_id, original: "물", transcription: "mul", translation: "eau", category: "nom" },
    { language_id, original: "주스", transcription: "juseu", translation: "jus", category: "nom" },
    { language_id, original: "사과", transcription: "sagwa", translation: "pomme", category: "nom" },
    { language_id, original: "네", transcription: "ne", translation: "oui", category: "expression" },
    { language_id, original: "우유", transcription: "uyu", translation: "lait", category: "nom" },
    { language_id, original: "오이", transcription: "oi", translation: "concombre", category: "nom" },
    { language_id, original: "맥주", transcription: "maekju", translation: "bière", category: "nom" },
    { language_id, original: "고기", transcription: "gogi", translation: "viande", category: "nom" },
  ];
  for (const w of words) await upsertWord(w);
}
