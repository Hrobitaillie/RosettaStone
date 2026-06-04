/**
 * Hangul utilities for the tracé exercise.
 *
 * Stroke data now comes from `syllableStrokeData.json` (pre-stored SVG paths
 * per syllable, in a 0..100 grid). This module wires that lookup into the
 * shape-matching pipeline used by the canvas: sample expected strokes into
 * polylines, score user input position-invariantly, return SNAP_THRESHOLD.
 */

import { getSyllablePaths, isSyllableSupported, samplePath } from "./syllableStrokes";

export type Point = readonly [number, number];
export type Stroke = readonly Point[];

/* ============================================================
 * Unicode helpers (Hangul Syllables block U+AC00..U+D7A3)
 * ========================================================== */

export function isHangulSyllable(c: string): boolean {
  const code = c.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3;
}

/** Split a string into a sequence of *hangul* syllables (other chars are dropped). */
export function splitSyllables(s: string): string[] {
  return Array.from(s).filter(isHangulSyllable);
}

/* ============================================================
 * Stroke lookup
 * ========================================================== */

/** Returns the canonical strokes (polylines, syllable [0,1] coords) for a
 * syllable, or null if not in the catalogue / catalogue not loaded yet. */
export function syllableStrokes(syl: string): Stroke[] | null {
  const paths = getSyllablePaths(syl);
  if (!paths) return null;
  return paths.map((d) => samplePath(d));
}

/** Returns the raw SVG path strings (one per stroke) for a syllable. */
export function syllablePaths(syl: string): string[] | null {
  return getSyllablePaths(syl);
}

/** True iff every syllable in `s` is in the loaded catalogue. */
export function isFullySupported(s: string): boolean {
  for (const c of splitSyllables(s)) {
    if (!isSyllableSupported(c)) return false;
  }
  return true;
}

/* ============================================================
 * Stroke matching — position & size invariant shape comparison
 * ========================================================== */

function dist(a: Point, b: Point): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function polylineLength(pts: Stroke): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  return total;
}

/** Resample a polyline into `n` equally-spaced points. */
function resample(pts: Stroke, n: number): Point[] {
  if (pts.length === 0) return [];
  if (pts.length === 1) return Array(n).fill(pts[0]);
  const total = polylineLength(pts);
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

function strokeBounds(pts: Stroke): { minX: number; minY: number; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return {
    minX,
    minY,
    w: Math.max(maxX - minX, 1e-6),
    h: Math.max(maxY - minY, 1e-6),
  };
}

/** Normalise a stroke so its bounding box centers in [0,1]² (preserving aspect). */
function normalizeShape(pts: Stroke): Point[] {
  const b = strokeBounds(pts);
  const scale = Math.max(b.w, b.h);
  const offX = (scale - b.w) / 2;
  const offY = (scale - b.h) / 2;
  return pts.map(
    ([x, y]) => [(x - b.minX + offX) / scale, (y - b.minY + offY) / scale] as const,
  );
}

function centroid(pts: Stroke): Point {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
  }
  return [sx / pts.length, sy / pts.length];
}

/**
 * Higher is better. ~1.0 = same shape at the right place, ~0 = wrong shape or
 * way off position. Shape match is size-invariant (so the user can be loose
 * with size) but **not** position-invariant — drawing the right shape in the
 * wrong area of the syllable scores low and won't snap.
 */
export function strokeScore(user: Stroke, expected: Stroke): number {
  if (user.length < 2 || expected.length < 2) return 0;

  const N = 24;
  const ru = resample(user, N);
  const re = resample(expected, N);

  // Shape similarity after centring + size normalisation.
  const nu = normalizeShape(ru);
  const ne = normalizeShape(re);
  let sum = 0;
  for (let i = 0; i < N; i++) sum += dist(nu[i], ne[i]);
  const shape = Math.max(0, 1 - sum / N / 0.3);

  // Aspect-ratio match (so ㅣ doesn't accept ㅡ, etc.)
  const bu = strokeBounds(ru);
  const be = strokeBounds(re);
  const aspectU = bu.w / (bu.w + bu.h);
  const aspectE = be.w / (be.w + be.h);
  const aspectMatch = 1 - Math.min(1, Math.abs(aspectU - aspectE) * 2.5);

  // Position match: centroid distance in syllable [0,1]² coords. ~0.3 of the
  // syllable away ≈ no positional support left.
  const positionDist = dist(centroid(ru), centroid(re));
  const positionMatch = Math.max(0, 1 - positionDist / 0.3);

  return shape * (0.4 + 0.6 * aspectMatch) * (0.2 + 0.8 * positionMatch);
}

/** Above this score, snap the user's stroke to the canonical.
 * Kept low so any non-noise stroke magnetises; strict stroke order naturally
 * prevents accidental matches (we only ever check against the *next* expected). */
export const SNAP_THRESHOLD = 0.25;
