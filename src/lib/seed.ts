import {
  getDB,
  listLanguages,
  upsertLanguage,
  upsertWord,
  upsertVerb,
  upsertNote,
  updateSettings,
  dayKey,
  type Conjugation,
} from "@/lib/db";

/**
 * Seeds a Korean demo dataset on first launch (only when the DB is empty),
 * so the app immediately reflects the design mockups and every feature is
 * testable. Idempotent: does nothing if any language already exists.
 */
export async function ensureSeed(): Promise<void> {
  const existing = await listLanguages();
  if (existing.length) return;

  const lang = await upsertLanguage({
    name: "Coréen",
    icon: "한",
    flag: "🇰🇷",
    alphabet: "Hangul (한글)",
    translation_language: "Français",
    level: "intermédiaire",
  });
  const language_id = lang.id;

  const words: Parameters<typeof upsertWord>[0][] = [
    {
      language_id,
      original: "학교",
      transcription: "hakgyo",
      translation: "école",
      category: "nom",
      level: "débutant",
      notes: "Mot très courant. Se combine souvent avec 에 (lieu) et 에서 (action).",
      examples: [
        { original: "학교에 가요.", translation: "Je vais à l'école." },
        { original: "우리 학교는 커요.", translation: "Notre école est grande." },
      ],
      related: ["학생", "학기", "대학교"],
    },
    {
      language_id,
      original: "학생",
      transcription: "haksaeng",
      translation: "élève, étudiant",
      category: "nom",
      level: "débutant",
    },
    {
      language_id,
      original: "학기",
      transcription: "hakgi",
      translation: "semestre",
      category: "nom",
    },
    {
      language_id,
      original: "학원",
      transcription: "hagwon",
      translation: "académie privée",
      category: "nom",
    },
    {
      language_id,
      original: "눈",
      transcription: "nun",
      translation: "œil",
      category: "nom",
      notes: "partie du corps",
      examples: [{ original: "눈이 아파요.", translation: "J'ai mal aux yeux." }],
      meanings: [
        {
          translation: "neige",
          category: "nom",
          example_original: "눈이 와요.",
          example_translation: "Il neige.",
          note: "météo · prononciation longue",
        },
      ],
    },
    {
      language_id,
      original: "물",
      transcription: "mul",
      translation: "eau",
      category: "nom",
    },
    {
      language_id,
      original: "사랑",
      transcription: "sarang",
      translation: "amour",
      category: "nom",
    },
    {
      language_id,
      original: "예쁘다",
      transcription: "yeppeuda",
      translation: "joli",
      category: "adjectif",
    },
    {
      language_id,
      original: "안녕하세요",
      transcription: "annyeonghaseyo",
      translation: "bonjour",
      category: "expression",
    },
    {
      language_id,
      original: "친구",
      transcription: "chingu",
      translation: "ami",
      category: "nom",
    },
    {
      language_id,
      original: "집",
      transcription: "jip",
      translation: "maison",
      category: "nom",
    },
    {
      language_id,
      original: "맛있다",
      transcription: "masitda",
      translation: "délicieux",
      category: "adjectif",
    },
  ];
  for (const w of words) await upsertWord(w);

  const fullForms = (
    pairs: [string, string, string][],
  ): Conjugation[] => pairs.map(([form_name, form_value, romanization]) => ({ form_name, form_value, romanization }));

  const verbs: Parameters<typeof upsertVerb>[0][] = [
    {
      language_id,
      infinitive: "먹다",
      romanization: "meokda",
      translation: "manger",
      is_irregular: false,
      conjugations: fullForms([
        ["Présent poli", "먹어요", "meogeoyo"],
        ["Présent formel", "먹습니다", "meokseumnida"],
        ["Passé", "먹었어요", "meogeosseoyo"],
        ["Futur", "먹을 거예요", "meogeul geoyeyo"],
        ["Impératif", "먹으세요", "meogeuseyo"],
      ]),
    },
    {
      language_id,
      infinitive: "가다",
      romanization: "gada",
      translation: "aller",
      is_irregular: false,
      conjugations: fullForms([
        ["Présent poli", "가요", "gayo"],
        ["Passé", "갔어요", "gasseoyo"],
      ]),
    },
    {
      language_id,
      infinitive: "하다",
      romanization: "hada",
      translation: "faire",
      is_irregular: true,
      conjugations: fullForms([
        ["Présent poli", "해요", "haeyo"],
        ["Passé", "했어요", "haesseoyo"],
      ]),
    },
    {
      language_id,
      infinitive: "듣다",
      romanization: "deutda",
      translation: "écouter",
      is_irregular: true,
      conjugations: fullForms([
        ["Présent poli", "들어요", "deureoyo"],
        ["Passé", "들었어요", "deureosseoyo"],
      ]),
    },
    {
      language_id,
      infinitive: "보다",
      romanization: "boda",
      translation: "voir, regarder",
      is_irregular: false,
      conjugations: fullForms([["Présent poli", "봐요", "bwayo"]]),
    },
    {
      language_id,
      infinitive: "살다",
      romanization: "salda",
      translation: "vivre",
      is_irregular: true,
      conjugations: fullForms([["Présent poli", "살아요", "sarayo"]]),
    },
  ];
  for (const v of verbs) await upsertVerb(v);

  const notes: Parameters<typeof upsertNote>[0][] = [
    {
      language_id,
      title: "Particule 은 / 는",
      category: "Grammaire",
      content:
        "La particule de thème marque le sujet dont on parle. Elle se place après le mot et change selon la finale.\n\n## Règle\n- 받침 (consonne finale) → 은\n- voyelle finale → 는\n\n> Exemple\n저는 프랑스 사람입니다.\n\nNuance : 은/는 oppose ou met en contraste, là où 이/가 désigne simplement le sujet grammatical.",
      examples: "저는 프랑스 사람입니다. — Moi, je suis français.",
    },
    {
      language_id,
      title: "Politesse : 요 vs 습니다",
      category: "Politesse",
      content:
        "Deux registres polis courants :\n- **요** : poli informel, du quotidien\n- **습니다** : poli formel, écrit ou officiel",
    },
    {
      language_id,
      title: "Conjugaison irrégulière ㄷ",
      category: "Conjugaison",
      content: "Certains verbes en ㄷ changent le ㄷ en ㄹ devant une voyelle.\n\n듣다 → 들어요, le ㄷ devient ㄹ.",
    },
    {
      language_id,
      title: "Compter : chiffres natifs",
      category: "Exception",
      content: "Deux systèmes de nombres :\n- natifs : 하나, 둘, 셋...\n- sino-coréens : 일, 이, 삼...",
    },
    {
      language_id,
      title: "Expressions du quotidien",
      category: "Expressions",
      content: "- 잘 먹겠습니다 (avant de manger)\n- 화이팅 ! (courage / go !)",
    },
  ];
  for (const n of notes) await upsertNote(n);

  await updateSettings({ profile_name: "Léa Martin" });

  // Seed a plausible streak + activity heatmap for the demo.
  const db = await getDB();
  const activity: Record<string, number> = {};
  const DAY = 86400000;
  for (let i = 13; i >= 0; i--) {
    if (i === 3 || i === 10) continue; // a couple of rest days
    activity[dayKey(Date.now() - i * DAY)] = 3 + ((i * 7) % 9);
  }
  await db.put(
    "meta",
    { xp: 540, streak: 12, last_active: dayKey(), activity },
    "profile",
  );
}
