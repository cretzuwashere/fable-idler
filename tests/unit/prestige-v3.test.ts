// prestige-v3.test.ts — the segmented prestige formula (14 §5) + the net-seed
// anti-exploit rule (14 §5.4). The regression contract: q(te) is bit-identical
// to floor(sqrt(te/1e5)) for ALL te ≤ 1e9, continuous and monotonic at both
// knees, and matches the §5.3 breakpoint table.
import { describe, expect, it } from 'vitest';
import {
  DOG_EARED_PAGE_START_INSPIRATION,
  prestigeNetTotalEarned,
  prestigePreview,
  publishTheTome,
  quillsForTotalEarned,
  seedInspirationForNextRun,
  totalEarnedForQuills,
} from '../../src/engine';
import { makeState } from './helpers';

/** The exact v1/v2 formula — the oracle below the first knee. */
function sqrtFormula(te: number): number {
  if (!(te > 0)) return 0;
  return Math.floor(Math.sqrt(te / 1e5));
}

describe('segment 1 (te ≤ 1e9) is BIT-IDENTICAL to v1 floor(sqrt(te/1e5))', () => {
  it('property test: 200k uniform samples in [0, 1e9] all match the sqrt oracle', () => {
    // A deterministic LCG keeps the test reproducible (no vitest RNG dependence).
    let seed = 0x1234_5678;
    const rand = () => {
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 200_000; i++) {
      const te = rand() * 1e9;
      expect(quillsForTotalEarned(te)).toBe(sqrtFormula(te));
    }
  });

  it('exact-boundary samples match the oracle (including 1e9 itself)', () => {
    for (const te of [0, 1, 99_999, 1e5, 4e5 - 1, 4e5, 9e5, 1e7, 1e9 - 1, 1e9]) {
      expect(quillsForTotalEarned(te)).toBe(sqrtFormula(te));
    }
  });

  it('negatives and zero are defensive (0 quills)', () => {
    expect(quillsForTotalEarned(-5)).toBe(0);
    expect(quillsForTotalEarned(0)).toBe(0);
  });
});

describe('breakpoints (14 §5.3) — the numbers the UI/economy contract on', () => {
  it('matches the published table', () => {
    expect(quillsForTotalEarned(1e5)).toBe(1);
    expect(quillsForTotalEarned(4e5)).toBe(2);
    expect(quillsForTotalEarned(1e7)).toBe(10);
    expect(quillsForTotalEarned(1e9)).toBe(100); // knee 1 — identical to v1
    expect(quillsForTotalEarned(1.6e10)).toBe(158);
    expect(quillsForTotalEarned(1e11)).toBe(215);
    expect(quillsForTotalEarned(1e13)).toBe(464);
    expect(quillsForTotalEarned(1e15)).toBe(1000); // knee 2
    expect(quillsForTotalEarned(1e18)).toBe(1778);
    expect(quillsForTotalEarned(1e21)).toBe(3162);
    expect(quillsForTotalEarned(1e24)).toBe(5623);
  });
});

describe('continuity at the knees (diff 0, thanks to the +1e-9 guard)', () => {
  it('q(1e9) == q(1e9 ± tiny) — no visible wall', () => {
    expect(quillsForTotalEarned(1e9)).toBe(100);
    expect(quillsForTotalEarned(1e9 - 1)).toBe(99); // sqrt side rounds down here
    expect(quillsForTotalEarned(1e9 + 1)).toBe(100); // segment 2 continues from 100
  });

  it('q(1e15) == 1000 == q(1e15 + 1e6) — the guard defeats pow(1e6,1/6)=9.9999…', () => {
    expect(quillsForTotalEarned(1e15)).toBe(1000);
    expect(quillsForTotalEarned(1e15 + 1e6)).toBe(1000);
    expect(quillsForTotalEarned(1e15 - 1)).toBe(1000);
  });
});

describe('monotonicity — non-decreasing across the whole domain', () => {
  it('holds on a dense log grid 1e5 → 1e24 (step 0.01 decade)', () => {
    let prev = -1;
    for (let e = 5; e <= 24; e += 0.01) {
      const q = quillsForTotalEarned(Math.pow(10, e));
      expect(q).toBeGreaterThanOrEqual(prev);
      prev = q;
    }
  });

  it('holds across each knee at fine linear resolution', () => {
    for (const knee of [1e9, 1e15]) {
      let prev = quillsForTotalEarned(knee * 0.999);
      for (let f = 0.999; f <= 1.001; f += 0.0001) {
        const q = quillsForTotalEarned(knee * f);
        expect(q).toBeGreaterThanOrEqual(prev);
        prev = q;
      }
    }
  });
});

describe('totalEarnedForQuills — the inverse the PrestigePanel bar/caption use', () => {
  // The floor for q quills is where the q-th quill unlocks; feeding it back
  // through quillsForTotalEarned must return exactly q across ALL three segments.
  it('round-trips: quillsForTotalEarned(totalEarnedForQuills(q)) === q', () => {
    for (const q of [1, 2, 3, 10, 50, 99, 100, 101, 158, 215, 464, 999, 1000, 1001, 1778, 3162, 5623]) {
      const floor = totalEarnedForQuills(q);
      // The floor is the exact unlock point of the q-th quill.
      expect(quillsForTotalEarned(floor)).toBe(q);
      // Strictly below the floor (by more than one whole quill's worth of span,
      // to clear the +1e-9 continuity epsilon baked into the forward formula)
      // yields fewer quills — so the bar is genuinely mid-fill, never pinned.
      const belowFloor = totalEarnedForQuills(q - 1);
      const justBelow = floor - (floor - belowFloor) * 1e-6;
      expect(quillsForTotalEarned(justBelow)).toBeLessThan(q);
      expect(quillsForTotalEarned(justBelow)).toBeGreaterThanOrEqual(q - 1);
    }
  });

  it('is monotonic and matches the v1 closed form in segment 1', () => {
    // Segment 1: floor = q² · 1e5.
    expect(totalEarnedForQuills(1)).toBe(1e5);
    expect(totalEarnedForQuills(2)).toBe(4e5);
    expect(totalEarnedForQuills(100)).toBe(1e9); // knee 1
    let prev = -1;
    for (let q = 0; q <= 6000; q += 7) {
      const te = totalEarnedForQuills(q);
      expect(te).toBeGreaterThanOrEqual(prev);
      prev = te;
    }
  });

  it('q ≤ 0 needs no earnings', () => {
    expect(totalEarnedForQuills(0)).toBe(0);
    expect(totalEarnedForQuills(-4)).toBe(0);
  });

  it('the PrestigePanel bar stays in [0,1) across the whole range (was pinned/negative before the fix)', () => {
    // Reproduce the panel math on the NET total for a spread of quill counts,
    // one unit above each floor: barValue must be a small positive fraction,
    // never < 0 (old bug in seg 1 with Editor's Due) nor ≥ 1 (old bug in segs 2-3).
    for (const q of [3, 100, 158, 464, 1000, 1778]) {
      const floor = totalEarnedForQuills(q);
      const next = totalEarnedForQuills(q + 1);
      const netTotalEarned = floor + (next - floor) * 0.01; // 1% into the bar
      const barQuills = quillsForTotalEarned(netTotalEarned);
      const currentFloor = totalEarnedForQuills(barQuills);
      const nextTarget = totalEarnedForQuills(barQuills + 1);
      const span = nextTarget - currentFloor;
      const barValue = span > 0 ? (netTotalEarned - currentFloor) / span : 1;
      expect(barValue).toBeGreaterThanOrEqual(0);
      expect(barValue).toBeLessThan(1);
    }
  });
});

describe('net-seed anti-exploit (14 §5.4) — prestige runs on te − seededInspiration', () => {
  it('prestigeNetTotalEarned subtracts the seed, clamped to ≥ 0', () => {
    const s = makeState((x) => {
      x.run.totalEarned = 1e12;
      x.run.seededInspiration = 3e11;
    });
    expect(prestigeNetTotalEarned(s)).toBe(1e12 - 3e11);
    const over = makeState((x) => {
      x.run.totalEarned = 1e6;
      x.run.seededInspiration = 5e6; // sanitizer would clamp, but be defensive
    });
    expect(prestigeNetTotalEarned(over)).toBe(0);
  });

  it('prestigePreview uses the NET total, not the gross', () => {
    const gross = makeState((x) => {
      x.run.totalEarned = 1e12;
      x.run.seededInspiration = 0;
    });
    const seeded = makeState((x) => {
      x.run.totalEarned = 1e12;
      x.run.seededInspiration = 1e12 - 1e9; // net = 1e9 → 100 quills
    });
    expect(prestigePreview(seeded)).toBe(100);
    expect(prestigePreview(gross)).toBeGreaterThan(prestigePreview(seeded));
  });

  it('an INSTANT re-publish right after a Foreword start yields 0 quills', () => {
    // Simulate a run that only ever holds its seed capital (te == seededInspiration):
    // this is exactly the exploit scenario — the Foreword head-start must NOT mint.
    const s = makeState((x) => {
      x.meta.tomesPublished = 60; // Foreword (tomes 50) unlocked
      x.run.totalEarned = 5e11; // suppose the seed was huge
      x.run.inspiration = 5e11;
      x.run.seededInspiration = 5e11; // the whole balance is seed capital
    });
    // Net = 0 → base quills 0. Only Editor's Due / Divine Royalties flat bonuses
    // (not owned here) could add — with none owned, preview is exactly 0.
    expect(prestigePreview(s)).toBe(0);
  });

  it('Dog-Eared Page (seed 300) is numerically identical to v1: q(300) = 0', () => {
    // For any run whose only seed is the 300 flat start, the net subtraction of
    // 300 changes nothing because q under 1e5 is 0 anyway.
    expect(quillsForTotalEarned(DOG_EARED_PAGE_START_INSPIRATION)).toBe(0);
  });
});

describe('seedInspirationForNextRun (14 §6.2) — Dog-Eared + Foreword capital', () => {
  it('no seed before tome 3', () => {
    const s = makeState((x) => void (x.run.totalEarned = 1e12));
    expect(seedInspirationForNextRun(s, 2)).toBe(0); // opening tome #2
  });

  it('Dog-Eared alone (tomes 3..49) = flat 300', () => {
    const s = makeState((x) => void (x.run.totalEarned = 1e12));
    expect(seedInspirationForNextRun(s, 3)).toBe(300);
    expect(seedInspirationForNextRun(s, 49)).toBe(300);
  });

  it('Foreword adds 0.1% of the previous run totalEarned from tome 50', () => {
    const s = makeState((x) => void (x.run.totalEarned = 1e12));
    // 300 (Dog-Eared) + 0.1% × 1e12 = 300 + 1e9.
    expect(seedInspirationForNextRun(s, 50)).toBe(300 + 1e9);
  });

  it('Foreword is capped at 1e18', () => {
    const s = makeState((x) => void (x.run.totalEarned = 1e24)); // 0.1% = 1e21 > cap
    expect(seedInspirationForNextRun(s, 50)).toBe(300 + 1e18);
  });
});

describe('publishTheTome sets run.seededInspiration on the new run', () => {
  it('a publish opening tome 50 seeds the new run and records seededInspiration', () => {
    const s = makeState((x) => {
      x.meta.tomesPublished = 49; // publishing makes it 50
      x.run.totalEarned = 1e12;
      x.run.inspiration = 1e12;
      x.run.startedAt = 0;
    });
    const after = publishTheTome(s, 1_000);
    const expectedSeed = 300 + 1e9; // Dog-Eared + Foreword (0.1% of 1e12)
    expect(after.run.seededInspiration).toBe(expectedSeed);
    expect(after.run.inspiration).toBe(expectedSeed);
    expect(after.run.totalEarned).toBe(expectedSeed);
    // The NEXT publish, if instant, would net 0 (seed == totalEarned).
    expect(prestigeNetTotalEarned(after.run.seededInspiration === after.run.totalEarned ? after : after)).toBe(0);
  });

  it('a v2-era publish (tomes 3, no Foreword) seeds only 300 with seededInspiration 300', () => {
    const s = makeState((x) => {
      x.meta.tomesPublished = 2;
      x.run.totalEarned = 5e5;
      x.run.inspiration = 5e5;
    });
    const after = publishTheTome(s, 2_000);
    expect(after.run.seededInspiration).toBe(300);
    expect(after.run.inspiration).toBe(300);
  });
});
