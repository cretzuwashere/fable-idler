// fables.test.ts — deterministic procedural titles (09 §3.1 / 10 §4.1).
// The exact-title expectations were computed with an INDEPENDENT mirror of the
// algorithm (plain Node) — they hardcode the contract: same seed → same title,
// forever. Any reordering of the word tables in config.ts (they are
// APPEND-ONLY) or of the rng() draws fails these tests loudly.
import { describe, expect, it } from 'vitest';
import {
  BOOKSHELF,
  bookshelfMultiplier,
  createFable,
  createFadedFable,
  fableSeed,
  fadedFableSeed,
  generateFableTitle,
  generateFadedTitle,
  GILDED_QUILLS_THRESHOLD,
  mulberry32,
  uniqueFableCount,
} from '../../src/engine';
import type { Fable } from '../../src/engine';
import { makeState } from './helpers';

function fableWithTitle(n: number, title: string): Fable {
  return { n, title, publishedAt: 0, runStats: null, gilded: false };
}

describe('deterministic titles (exact values — the append-only guard)', () => {
  it('fixed publish seeds produce the exact expected titles', () => {
    expect(generateFableTitle(fableSeed(1, 250_000, 1_500_000))).toBe(
      'The Stubborn Raven and the Silver Thread',
    );
    expect(generateFableTitle(fableSeed(2, 1_000_000, 600_000))).toBe(
      'Ink-Stained Bookworm, or: How the Midnight Library Was Won',
    );
    expect(generateFableTitle(fableSeed(7, 12_345_678, 3_600_000))).toBe(
      'The Tortoise Who Counted the Stars Twice',
    );
  });

  it('faded titles (migration, seed = tome index alone) are exact and stable', () => {
    expect(generateFadedTitle(1)).toBe('The Fox Who Sold Silence');
    expect(generateFadedTitle(2)).toBe('The Nightingale Who Taught the Rain to Read');
    expect(generateFadedTitle(3)).toBe('The Fox Who Outwrote the Dawn');
    // stable across repeated calls
    expect(generateFadedTitle(1)).toBe(generateFadedTitle(1));
  });

  it('all three templates are reachable', () => {
    const templates = new Set<number>();
    for (let seed = 0; seed < 100; seed++) {
      const rng = mulberry32(seed);
      templates.add(Math.floor(rng() * 3));
    }
    expect([...templates].sort()).toEqual([0, 1, 2]);
  });
});

describe('fableSeed — floor semantics', () => {
  it('sub-unit totalEarned noise and sub-second duration noise never change the seed', () => {
    expect(fableSeed(1, 250_000.9, 1_500_999)).toBe(fableSeed(1, 250_000, 1_500_000));
    expect(fableSeed(1, 250_000.9, 1_500_999)).toBe(4_048_721_069);
  });

  it('different inputs produce different seeds', () => {
    expect(fableSeed(1, 250_000, 1_500_000)).not.toBe(fableSeed(2, 250_000, 1_500_000));
    expect(fableSeed(1, 250_000, 1_500_000)).not.toBe(fableSeed(1, 250_001, 1_500_000));
    expect(fadedFableSeed(1)).not.toBe(fadedFableSeed(2));
  });

  it('is defensive about negatives (no NaN, deterministic)', () => {
    expect(fableSeed(1, -5, -5)).toBe(fableSeed(1, 0, 0));
  });
});

describe('createFable / createFadedFable', () => {
  it('gilded exactly at the quill threshold', () => {
    expect(createFable(1, 3e6, 60_000, GILDED_QUILLS_THRESHOLD, 0).gilded).toBe(true);
    expect(createFable(1, 3e6, 60_000, GILDED_QUILLS_THRESHOLD - 1, 0).gilded).toBe(false);
  });

  it('a null duration is seeded as 0 and recorded as null in runStats', () => {
    const f = createFable(4, 500_000, null, 2, 123);
    expect(f.runStats).toEqual({ totalEarned: 500_000, durationMs: null, quillsEarned: 2 });
    expect(f.title).toBe(generateFableTitle(fableSeed(4, 500_000, 0)));
  });

  it('faded fables have no runStats and are never gilded', () => {
    const f = createFadedFable(3, 999);
    expect(f).toEqual({
      n: 3,
      title: generateFadedTitle(3),
      publishedAt: 999,
      runStats: null,
      gilded: false,
    });
  });
});

describe('uniqueFableCount + bookshelf bonus cap', () => {
  it('duplicate titles count once ("a reprint!")', () => {
    const fables = [
      fableWithTitle(1, 'A'),
      fableWithTitle(2, 'B'),
      fableWithTitle(3, 'A'),
      fableWithTitle(4, 'C'),
    ];
    expect(uniqueFableCount(fables)).toBe(3);
    expect(uniqueFableCount([])).toBe(0);
  });

  it('bookshelfMultiplier is +2% per unique fable, capped at 25 counted (max +50%)', () => {
    const three = makeState((s) => {
      s.meta.fables = [fableWithTitle(1, 'A'), fableWithTitle(2, 'B'), fableWithTitle(3, 'C')];
    });
    expect(bookshelfMultiplier(three)).toBeCloseTo(1.06, 12);

    const thirtyUnique = makeState((s) => {
      s.meta.fables = Array.from({ length: 30 }, (_, i) => fableWithTitle(i + 1, `T${i}`));
    });
    expect(bookshelfMultiplier(thirtyUnique)).toBeCloseTo(
      1 + BOOKSHELF.bonusPerUniqueFable * BOOKSHELF.countedCap, // 1.5
      12,
    );
  });
});
