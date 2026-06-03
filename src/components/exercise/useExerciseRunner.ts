import { useCallback, useMemo, useState } from "react";
import type { SessionMistake } from "@/lib/db";

/**
 * Generic per-question item the runner can play. Each exercise type maps its
 * build* output onto this shape via an adapter (see exercise.$type.tsx).
 */
export type RunnerItem = {
  /** Stable id of the underlying word/verb (for grading). */
  id: string;
  /** "word" → gradeWord, "verb" → gradeVerb. */
  kind: "word" | "verb";
  /** Used for the session mistake list + "À revoir". */
  original: string;
  translation: string;
  /** Success rate before this session, for the feedback chip ("72% → 78%"). */
  oldRate: number;
};

export type RunnerState = {
  index: number;
  total: number;
  correctCount: number;
  /** Items the learner got wrong, in order. */
  mistakes: SessionMistake[];
  /** True once the queue is exhausted. */
  done: boolean;
};

export type RunnerApi = RunnerState & {
  current: RunnerItem | undefined;
  /** Running success percentage (0..100), based on answered questions. */
  successPercent: number;
  answered: number;
  /** Record a result for the current item and advance to the next one. */
  submit: (correct: boolean) => void;
};

/**
 * Drives index / score / mistakes for a queue of items. Presentational views
 * call `submit(correct)` once per question; the parent reads `done` to render
 * the result screen and persist the session.
 */
export function useExerciseRunner(items: RunnerItem[]): RunnerApi {
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [mistakes, setMistakes] = useState<SessionMistake[]>([]);

  const total = items.length;
  const current = items[index];
  const answered = index; // questions resolved so far
  const done = total > 0 && index >= total;

  const submit = useCallback(
    (correct: boolean) => {
      const item = items[index];
      if (!item) return;
      if (correct) {
        setCorrectCount((c) => c + 1);
      } else {
        setMistakes((m) =>
          m.some((x) => x.id === item.id)
            ? m
            : [...m, { id: item.id, original: item.original, translation: item.translation }],
        );
      }
      setIndex((i) => i + 1);
    },
    [items, index],
  );

  const successPercent = useMemo(
    () => (answered > 0 ? Math.round((correctCount / answered) * 100) : 100),
    [answered, correctCount],
  );

  return {
    index,
    total,
    correctCount,
    mistakes,
    done,
    current,
    answered,
    successPercent,
    submit,
  };
}
