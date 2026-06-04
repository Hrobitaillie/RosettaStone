/**
 * Loads the per-syllable stroke catalogue once on first use, exposes lookup,
 * sampling (path → polyline, for shape matching) and drawing helpers.
 *
 * Each syllable maps to an array of SVG path strings (one per stroke), with
 * coordinates expressed in a 0..100 grid inside the syllable's block.
 */

import type { Point } from "./hangul";

type StrokeData = Record<string, string[]>;

let cache: StrokeData | null = null;
let loading: Promise<StrokeData> | null = null;

/** Preload the catalogue (call early to avoid first-use latency). */
export function loadSyllableStrokes(): Promise<StrokeData> {
  if (cache) return Promise.resolve(cache);
  if (loading) return loading;
  loading = fetch("/syllableStrokes.json")
    .then((r) => r.json())
    .then((data: StrokeData) => {
      cache = data;
      loading = null;
      return data;
    });
  return loading;
}

/** Synchronous lookup once preloaded. Returns null if data isn't loaded yet
 * or the syllable isn't in the catalogue. */
export function getSyllablePaths(syllable: string): string[] | null {
  if (!cache) return null;
  return cache[syllable] ?? null;
}

/** True iff the catalogue is loaded AND every syllable in `s` is covered. */
export function isSyllableSupported(syllable: string): boolean {
  return cache != null && syllable in cache;
}

/* ------------------------------------------------------------------ */
/* Path sampling — turn an SVG path d-string into a polyline           */
/* ------------------------------------------------------------------ */

const SVG_NS = "http://www.w3.org/2000/svg";
const sampleCache = new Map<string, Point[]>();

/** Sample an SVG path into `n` equally-spaced points in [0,1]² syllable coords. */
export function samplePath(d: string, n = 24): Point[] {
  const key = `${n}|${d}`;
  const hit = sampleCache.get(key);
  if (hit) return hit;
  if (typeof document === "undefined") return [];

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.style.cssText = "position:absolute;left:-9999px;top:-9999px;visibility:hidden";
  svg.setAttribute("viewBox", "0 0 100 100");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  document.body.appendChild(svg);

  const total = path.getTotalLength();
  const points: Point[] = [];
  if (total === 0 || !isFinite(total)) {
    // Degenerate path; fall back to start point.
    const p = path.getPointAtLength(0);
    for (let i = 0; i < n; i++) points.push([p.x / 100, p.y / 100]);
  } else {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      const p = path.getPointAtLength(t * total);
      points.push([p.x / 100, p.y / 100]);
    }
  }
  document.body.removeChild(svg);

  sampleCache.set(key, points);
  return points;
}

/* ------------------------------------------------------------------ */
/* Canvas rendering                                                    */
/* ------------------------------------------------------------------ */

const path2dCache = new Map<string, Path2D>();
function pathFor(d: string): Path2D {
  const hit = path2dCache.get(d);
  if (hit) return hit;
  const p = new Path2D(d);
  path2dCache.set(d, p);
  return p;
}

/** Draw a single stroke (its SVG path) onto the canvas. The path uses a
 * 0..100 grid; `size` is the canvas square in CSS pixels. */
export function drawSyllableStroke(
  ctx: CanvasRenderingContext2D,
  d: string,
  size: number,
  lineWidthPx: number,
  color: string,
  alpha = 1,
) {
  ctx.save();
  const s = size / 100;
  ctx.scale(s, s);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  // Counter-scale lineWidth so it stays at the requested pixel value.
  ctx.lineWidth = lineWidthPx / s;
  ctx.globalAlpha = alpha;
  ctx.stroke(pathFor(d));
  ctx.restore();
}
