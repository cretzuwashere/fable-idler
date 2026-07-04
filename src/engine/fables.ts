// fables.ts — The Bookshelf: deterministic procedural fable titles (09 §3.1).
// Same seed → same title, forever. The word tables in config.ts are APPEND-ONLY;
// fables.test.ts hardcodes exact titles so any reordering fails loudly.

import {
  FABLE_ADJECTIVES,
  FABLE_CREATURES,
  FABLE_OBJECTS,
  FABLE_VERB_PHRASES,
  GILDED_QUILLS_THRESHOLD,
} from './config';
import type { Fable } from './types';

/** Classic mulberry32 PRNG — tiny, deterministic, good enough for titles. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One 32-bit avalanche step (murmur-style). */
function mix(h: number, v: number): number {
  let x = (h ^ v) >>> 0;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  return x;
}

/** Low/high 32-bit folds of a (possibly huge) non-negative double — deterministic. */
function lo32(v: number): number {
  return v >>> 0; // ToUint32 = mod 2^32, well-defined for any finite double
}
function hi32(v: number): number {
  return (v / 4294967296) >>> 0;
}

/**
 * Seed of a published fable: hash of (n, floor(totalEarned), floor(durationMs/1000)).
 * Sub-unit noise in totalEarned / sub-second noise in duration never changes the title.
 */
export function fableSeed(n: number, totalEarned: number, durationMs: number): number {
  const te = Math.floor(Math.max(0, totalEarned));
  const ds = Math.floor(Math.max(0, durationMs) / 1000);
  let h = 0x9e3779b9;
  h = mix(h, lo32(n));
  h = mix(h, lo32(te));
  h = mix(h, hi32(te));
  h = mix(h, lo32(ds));
  h = mix(h, hi32(ds));
  return h >>> 0;
}

/** Seed of a "faded" fable from the v1→v2 migration: the tome index ALONE (10 §3.3). */
export function fadedFableSeed(n: number): number {
  // Different domain constant than fableSeed → faded titles are their own family.
  return mix(0x51ed270b, lo32(n));
}

/**
 * Deterministic title from a seed. Template + word draws use a fixed order —
 * do not reorder the rng() calls (it would change every historical title).
 */
export function generateFableTitle(seed: number): string {
  const rng = mulberry32(seed);
  const pick = (words: readonly string[]): string => words[Math.floor(rng() * words.length)];
  const template = Math.floor(rng() * 3);
  if (template === 0) {
    return `The ${pick(FABLE_ADJECTIVES)} ${pick(FABLE_CREATURES)} and the ${pick(FABLE_OBJECTS)}`;
  }
  if (template === 1) {
    return `The ${pick(FABLE_CREATURES)} Who ${pick(FABLE_VERB_PHRASES)}`;
  }
  return `${pick(FABLE_ADJECTIVES)} ${pick(FABLE_CREATURES)}, or: How the ${pick(FABLE_OBJECTS)} Was Won`;
}

/** Title of a migrated (faded) fable — stable and regenerable from n alone. */
export function generateFadedTitle(n: number): string {
  return generateFableTitle(fadedFableSeed(n));
}

/** The fable minted by a real (post-v2) Publish the Tome. */
export function createFable(
  n: number,
  totalEarned: number,
  durationMs: number | null,
  quillsEarned: number,
  publishedAt: number,
): Fable {
  return {
    n,
    title: generateFableTitle(fableSeed(n, totalEarned, durationMs ?? 0)),
    publishedAt,
    runStats: { totalEarned, durationMs, quillsEarned },
    gilded: quillsEarned >= GILDED_QUILLS_THRESHOLD,
  };
}

/** A retroactive "faded" fable for a v1 veteran (runStats lost to time). */
export function createFadedFable(n: number, publishedAt: number): Fable {
  return {
    n,
    title: generateFadedTitle(n),
    publishedAt,
    runStats: null,
    gilded: false,
  };
}

/** Number of UNIQUE titles on the shelf (duplicates count once — "a reprint!"). */
export function uniqueFableCount(fables: readonly Fable[]): number {
  const titles = new Set<string>();
  for (const f of fables) titles.add(f.title);
  return titles.size;
}
