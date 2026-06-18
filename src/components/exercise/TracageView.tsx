import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Eye, EyeOff, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SNAP_THRESHOLD, splitSyllables, strokeScore, type Point, type Stroke } from "@/lib/hangul";
import {
  drawSyllableStroke,
  getSyllablePaths,
  loadSyllableStrokes,
  samplePath,
} from "@/lib/syllableStrokes";

/* ------------------------------------------------------------------ */

/** One expected stroke: its SVG path (for rendering) and its sampled
 * polyline (for shape matching against user input). */
type Expected = { d: string; polyline: Stroke };

type DrawnStroke = {
  /** Points captured by the pointer, in syllable [0,1] coordinates. */
  raw: Point[];
  /** Index into `expected` if recognised, else null. */
  snappedIdx: number | null;
  /** performance.now() timestamp when the snap happened — used to animate the
   * morph from the raw user path to the canonical shape. */
  morphStart?: number;
};

const MORPH_DURATION_MS = 220;
const MORPH_SAMPLES = 32;

type SyllableResult = {
  syllable: string;
  expected: Expected[] | null;
  drawn: DrawnStroke[];
};

function makeResult(syllable: string): SyllableResult {
  const paths = getSyllablePaths(syllable);
  if (!paths) return { syllable, expected: null, drawn: [] };
  const expected = paths.map<Expected>((d) => ({ d, polyline: samplePath(d) }));
  return { syllable, expected, drawn: [] };
}

export function TracageView({
  label,
  prompt,
  answer,
  onSubmit,
  locked,
  ghostDefault = false,
  hideGhostToggle = false,
}: {
  label: string;
  /** Question prompt — FR word or romanisation. */
  prompt: string;
  /** Target hangul string (e.g. "오이"). */
  answer: string;
  /** Auto-fired once every expected stroke has been traced. */
  onSubmit: (isCorrect: boolean) => void;
  locked: boolean;
  /** Apprentissage stage 0 (copie) → start with the model visible. */
  ghostDefault?: boolean;
  /** Apprentissage stage 3 (production libre) → hide the toggle entirely. */
  hideGhostToggle?: boolean;
}) {
  // Make sure the catalogue is loaded; rebuild results once it lands.
  const [dataReady, setDataReady] = useState(() => getSyllablePaths("오") != null);
  useEffect(() => {
    if (dataReady) return;
    let alive = true;
    void loadSyllableStrokes().then(() => {
      if (alive) setDataReady(true);
    });
    return () => {
      alive = false;
    };
  }, [dataReady]);

  const syllables = useMemo(() => splitSyllables(answer), [answer]);
  const [results, setResults] = useState<SyllableResult[]>(() =>
    syllables.map((s) => makeResult(s)),
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [ghost, setGhost] = useState(ghostDefault);

  // Reset state when the question or data changes.
  useEffect(() => {
    setResults(syllables.map((s) => makeResult(s)));
    setCurrentIdx(0);
    setGhost(ghostDefault);
  }, [answer, syllables, dataReady, ghostDefault]);

  const currentSyl = syllables[currentIdx];
  const currentRes = results[currentIdx];
  const isLast = currentIdx >= syllables.length - 1;

  const matchedCount = currentRes?.drawn.length ?? 0;
  const expectedCount = currentRes?.expected?.length ?? 0;
  const syllableComplete = expectedCount > 0 && matchedCount >= expectedCount;

  const updateDrawn = useCallback(
    (mut: (drawn: DrawnStroke[]) => DrawnStroke[]) => {
      setResults((prev) =>
        prev.map((r, i) => (i === currentIdx ? { ...r, drawn: mut(r.drawn) } : r)),
      );
    },
    [currentIdx],
  );

  // Auto-submit guard. Reset whenever the question changes so a fresh
  // word starts from a clean slate.
  const submittedRef = useRef(false);
  useEffect(() => {
    submittedRef.current = false;
  }, [answer]);

  const handleStrokeEnd = useCallback(
    (raw: Point[]) => {
      if (locked) return;
      const expected = currentRes?.expected;
      const nextIndex = currentRes?.drawn.length ?? 0;
      const next = expected?.[nextIndex] ?? null;
      if (!next || !expected) return;
      const s = strokeScore(raw, next.polyline);
      if (s < SNAP_THRESHOLD) return; // discard silently — user retries
      const morphStart = performance.now();
      flushSync(() => {
        updateDrawn((d) => [...d, { raw, snappedIdx: nextIndex, morphStart }]);
      });

      // Detect end-of-word here (not via a state-driven effect, to avoid the
      // stale-results race on question transitions): if this was the final
      // stroke of the final syllable, schedule the submit directly.
      const isLastStrokeOfSyllable = nextIndex + 1 >= expected.length;
      const isLastSyllable = currentIdx >= syllables.length - 1;
      if (isLastStrokeOfSyllable && isLastSyllable && !submittedRef.current) {
        submittedRef.current = true;
        setTimeout(() => onSubmit(true), 600);
      }
    },
    [locked, currentRes, updateDrawn, currentIdx, syllables.length, onSubmit],
  );

  const undo = () => {
    if (locked) return;
    updateDrawn((d) => d.slice(0, -1));
  };

  const advance = useCallback(() => {
    if (locked) return;
    if (currentIdx < syllables.length - 1) {
      setCurrentIdx((i) => i + 1);
      // In copy mode (stage 0 découverte) the ghost must stay on for every
      // syllable — the user is supposed to copy, not recall.
      setGhost(ghostDefault);
    }
  }, [locked, currentIdx, syllables.length, ghostDefault]);

  // Auto-advance briefly after the last expected stroke matches.
  useEffect(() => {
    if (locked || !syllableComplete || isLast) return;
    const t = setTimeout(() => advance(), 450);
    return () => clearTimeout(t);
  }, [locked, syllableComplete, isLast, advance]);

  return (
    <div className="flex h-full flex-col">
      <div className="pt-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>

      {/* Progress: the word forming. In normal mode (production), syllables
          not yet completed show only as a thin underline so the user has to
          recall them. In copy mode (ghostDefault, stage 0 découverte) we show
          the actual hangul faded out — the user is supposed to see what
          they're copying, not guess it. In copy mode the hangul is the focal
          point (the thing being learned) and the FR prompt is a subtitle;
          otherwise the FR prompt is the directive and stays prominent. */}
      {ghostDefault ? (
        <>
          <div className="mt-3 flex items-end justify-center text-6xl font-extrabold leading-none tracking-tight">
            {syllables.map((s, i) => {
              // `results` is reset via a post-commit effect; during the
              // render where `answer` just changed, `results[i]` can be
              // undefined for new indices. Treat as "not done" until then.
              const r = results[i];
              const matched = r?.drawn.length ?? 0;
              const total = r?.expected?.length ?? 0;
              const done = total > 0 && matched >= total;
              const cur = i === currentIdx && !locked;
              return (
                <span
                  key={`syl-${i}`}
                  className={cn(
                    done
                      ? "text-foreground"
                      : cur
                        ? "text-primary"
                        : "text-muted-foreground/40",
                  )}
                >
                  {s}
                </span>
              );
            })}
          </div>
          <div className="mt-2 text-center text-base font-medium text-muted-foreground">
            {prompt}
          </div>
        </>
      ) : (
        <>
          <div className="mt-3 flex min-h-[6rem] items-center justify-center rounded-3xl bg-noms px-6 py-5 text-center">
            <span className="text-4xl font-extrabold text-noms-foreground">{prompt}</span>
          </div>
          <div className="mt-4 flex items-end justify-center text-5xl font-extrabold leading-none tracking-tight">
            {syllables.map((s, i) => {
              const r = results[i];
              const matched = r?.drawn.length ?? 0;
              const total = r?.expected?.length ?? 0;
              const done = total > 0 && matched >= total;
              const cur = i === currentIdx && !locked;
              if (done) {
                return (
                  <span key={`syl-${i}`} className="text-foreground">
                    {s}
                  </span>
                );
              }
              return (
                <span
                  key={`syl-${i}`}
                  className={cn(
                    "inline-flex h-[1em] items-end justify-center px-[0.06em]",
                    cur ? "text-primary" : "text-muted-foreground/40",
                  )}
                >
                  <span className="mb-[0.16em] h-[3px] w-[0.55em] rounded-full bg-current" />
                </span>
              );
            })}
          </div>
        </>
      )}

      {/* Drawing canvas centred in the remaining vertical space */}
      {currentRes && (
        <div className="flex flex-1 items-center justify-center py-3">
          <SyllableCanvas
            syllable={currentSyl}
            drawn={currentRes.drawn}
            expected={currentRes.expected}
            ghost={ghost}
            locked={locked}
            onStrokeEnd={handleStrokeEnd}
          />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={undo}
          disabled={locked || (currentRes?.drawn.length ?? 0) === 0}
          className="inline-flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground active:scale-95 disabled:opacity-40"
        >
          <Undo2 className="h-4 w-4" /> Effacer
        </button>

        {!hideGhostToggle && (
          <button
            type="button"
            onClick={() => setGhost((g) => !g)}
            disabled={locked}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground active:scale-95 disabled:opacity-40"
          >
            {ghost ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {ghost ? "Cacher" : "Modèle"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
 * Canvas — pointer-driven drawing pad for a single syllable
 * ========================================================== */

function SyllableCanvas({
  syllable,
  drawn,
  expected,
  ghost,
  locked,
  onStrokeEnd,
}: {
  syllable: string;
  drawn: DrawnStroke[];
  expected: Expected[] | null;
  ghost: boolean;
  locked: boolean;
  onStrokeEnd: (raw: Point[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(280);
  const liveStroke = useRef<Point[]>([]);
  const drawing = useRef(false);

  // Responsive: square sized to the smaller of container width / height.
  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const s = Math.min(400, Math.max(220, Math.min(w, h)));
      setSize(s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Redraw whenever inputs change; keep ticking while any stroke is mid-morph.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    const tick = () => {
      const stillMorphing = redraw(canvas, size, syllable, drawn, expected, ghost, null);
      if (stillMorphing) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [size, syllable, drawn, expected, ghost]);

  const toLocal = (clientX: number, clientY: number): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (locked) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    const p = toLocal(e.clientX, e.clientY);
    if (!p) return;
    liveStroke.current = [p];
    drawing.current = true;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || locked) return;
    e.preventDefault();
    const p = toLocal(e.clientX, e.clientY);
    if (!p) return;
    const last = liveStroke.current[liveStroke.current.length - 1];
    if (!last || dist(last, p) > 0.005) {
      liveStroke.current.push(p);
      const canvas = canvasRef.current;
      if (canvas) redraw(canvas, size, syllable, drawn, expected, ghost, liveStroke.current);
    }
  };

  const finishStroke = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    const stroke = liveStroke.current;
    liveStroke.current = [];
    // Clear the live preview immediately so the user sees a clean canvas
    // while React processes the snap result.
    const canvas = canvasRef.current;
    if (canvas) redraw(canvas, size, syllable, drawn, expected, ghost, null);
    if (stroke.length >= 2) onStrokeEnd(stroke);
  }, [drawn, expected, ghost, onStrokeEnd, size, syllable]);

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    canvasRef.current?.releasePointerCapture(e.pointerId);
    finishStroke();
  };

  // Window-level safety net: some Android WebView builds drop the pointerup
  // event on the captured element. Catch it at the document level too.
  useEffect(() => {
    const handler = () => finishStroke();
    window.addEventListener("pointerup", handler);
    window.addEventListener("pointercancel", handler);
    return () => {
      window.removeEventListener("pointerup", handler);
      window.removeEventListener("pointercancel", handler);
    };
  }, [finishStroke]);

  return (
    <div ref={containerRef} className="flex justify-center">
      <canvas
        ref={canvasRef}
        width={size * devicePixelRatio}
        height={size * devicePixelRatio}
        style={{ width: size, height: size, touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="rounded-3xl bg-card shadow-inner"
      />
    </div>
  );
}

/* ============================================================
 * Low-level rendering
 * ========================================================== */

function dist(a: Point, b: Point): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/** Resample a polyline into N equally-spaced points. */
function resample(pts: Point[], n: number): Point[] {
  if (pts.length === 0) return [];
  if (pts.length === 1) return Array(n).fill(pts[0]);
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  if (total === 0) return Array(n).fill(pts[0]);
  const step = total / (n - 1);
  const out: Point[] = [pts[0]];
  let acc = 0;
  let i = 1;
  let prev = pts[0];
  while (out.length < n - 1 && i < pts.length) {
    const seg = dist(prev, pts[i]);
    if (acc + seg >= step) {
      const t = (step - acc) / seg;
      const np: Point = [prev[0] + t * (pts[i][0] - prev[0]), prev[1] + t * (pts[i][1] - prev[1])];
      out.push(np);
      prev = np;
      acc = 0;
    } else {
      acc += seg;
      prev = pts[i];
      i++;
    }
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Returns true if any stroke is still mid-morph (caller should request another frame). */
function redraw(
  canvas: HTMLCanvasElement,
  size: number,
  _syllable: string,
  drawn: DrawnStroke[],
  expected: Expected[] | null,
  ghost: boolean,
  live: Point[] | null,
): boolean {
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);

  // Theme colours from CSS variables (re-read each frame so theme switches work).
  const cs = getComputedStyle(document.documentElement);
  const primary = cs.getPropertyValue("--primary").trim() || "#c1e64a";
  const fg = cs.getPropertyValue("--foreground").trim() || "#fff";
  const muted = cs.getPropertyValue("--muted-foreground").trim() || "#777";

  // Soft grid (helps positioning).
  ctx.strokeStyle = fg;
  ctx.globalAlpha = 0.08;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Ghost: each expected stroke in solid muted-foreground (no alpha so
  // overlaps don't darken at the intersection).
  if (ghost && expected) {
    for (const e of expected) {
      drawSyllableStroke(ctx, e.d, size, size * 0.085, muted, 1);
    }
  }

  // Matched strokes: animate a morph from the raw user path to the canonical
  // SVG path. After MORPH_DURATION_MS the canonical SVG is drawn directly
  // (gives the proper bezier smoothness).
  const now = performance.now();
  let stillMorphing = false;
  if (expected) {
    for (const d of drawn) {
      if (d.snappedIdx == null) continue;
      const e = expected[d.snappedIdx];
      if (!e) continue;
      const elapsed = d.morphStart != null ? now - d.morphStart : MORPH_DURATION_MS;
      if (elapsed >= MORPH_DURATION_MS) {
        drawSyllableStroke(ctx, e.d, size, size * 0.09, primary, 1);
        continue;
      }
      stillMorphing = true;
      const t = easeInOut(elapsed / MORPH_DURATION_MS);
      const rawN = resample(d.raw, MORPH_SAMPLES);
      const expN = resample(e.polyline as Point[], MORPH_SAMPLES);
      ctx.strokeStyle = primary;
      ctx.lineWidth = size * 0.09;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < MORPH_SAMPLES; i++) {
        const x = rawN[i][0] + t * (expN[i][0] - rawN[i][0]);
        const y = rawN[i][1] + t * (expN[i][1] - rawN[i][1]);
        if (i === 0) ctx.moveTo(x * size, y * size);
        else ctx.lineTo(x * size, y * size);
      }
      ctx.stroke();
    }
  }

  // Live (in-progress) stroke — light foreground tint, slimmer.
  if (live && live.length > 1) {
    ctx.save();
    ctx.strokeStyle = fg;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = size * 0.07;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    drawPath(ctx, live, size);
    ctx.restore();
  }

  return stillMorphing;
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  pts: readonly (readonly [number, number])[],
  size: number,
) {
  if (pts.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * size, pts[0][1] * size);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * size, pts[i][1] * size);
  ctx.stroke();
}
