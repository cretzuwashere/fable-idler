// save-migration-v3.test.ts — the real v2→v3 migration (MIGRATIONS[2], 14 §8)
// and the FULL v1→v2→v3 chain. Additive: generators 9–14 = 0, the 7 v3 re-scalers
// uncbought, the 6 v3 Atelier upgrades absent, achievements 25–36 locked, and the
// single new run field run.seededInspiration = 0 (numerically a no-op — q(300)=0).
// Production after migration is identical term-by-term (all v3 sources null at 0).
import { describe, expect, it } from 'vitest';
import {
  CURRENT_SAVE_VERSION,
  parseSave,
  perSecondNoBuff,
  sanitizeSaveData,
  serializeState,
} from '../../src/engine';
import type { GameState } from '../../src/engine';
import { makeState } from './helpers';

/** A REAL v2 payload — exactly what the v2 engine serialized (no v3 fields). */
const V2_FIXTURE = {
  version: 2,
  savedAt: 1_752_000_000_000,
  run: {
    inspiration: 5_000_000.5,
    totalEarned: 40_000_000.25,
    generators: {
      wanderingMuse: 60,
      inkSprite: 30,
      talkingRaven: 12,
      enchantedQuill: 6,
      storyLoom: 2,
      dreamLibrary: 1,
      fableForge: 0,
      mythEngine: 0,
    },
    upgrades: { sharpenedNib: true, musesChorus: true, goldenInkwell: true, inkEcho: true },
    milestones: ['theFirstSpark', 'whispersInInk', 'craftsmansTools', 'racingHeart'],
    buff: { activeUntil: 0, cooldownUntil: 0 },
    startedAt: 1_751_999_000_000,
    sparkBuff: null,
    buffActivationsThisRun: 3,
    lastAutoBuyAt: 0,
  },
  meta: {
    goldenQuills: 10,
    tomesPublished: 10,
    achievements: ['firstWords', 'storytellerAwakens', 'publishedAuthor', 'patronOfTheArts'],
    quillResonance: true,
    stats: {
      totalClicks: 20_000,
      lifetimeInspiration: 500_000_000,
      buffActivations: 40,
      offlineSessionsOver30Min: 5,
      bestSingleOfflineGain: 1_000_000,
      lifetimeQuillsEarned: 30,
      sparksCaught: 12,
      quillsFromFragments: 2,
      fastestPublishMs: 480_000,
    },
    settings: { buyQty: 'max', reduceMotion: true },
    atelier: { apprenticeMuse: 3, selfWritingContract: 1, blueprintOfMyths: 1 },
    storyFragments: 3,
    fables: [
      { n: 1, title: 'The Curious Muse and the Inkwell', publishedAt: 1, runStats: null, gilded: false },
    ],
  },
};

function migrateV2() {
  const data = parseSave(JSON.stringify(V2_FIXTURE));
  expect(data).not.toBeNull();
  return data!;
}
function migratedV2State(): GameState {
  const data = migrateV2();
  return { run: data.run, meta: data.meta, lastTickAt: data.savedAt };
}

describe('MIGRATIONS[2] — v2 → v3, additive (14 §8 defaults table)', () => {
  it('produces a current-version payload with savedAt intact', () => {
    const data = migrateV2();
    expect(data.version).toBe(CURRENT_SAVE_VERSION);
    expect(data.savedAt).toBe(V2_FIXTURE.savedAt);
  });

  it('sets the ONE new run field: seededInspiration = 0', () => {
    expect(migrateV2().run.seededInspiration).toBe(0);
  });

  it('generators 9–14 start at 0 (same row structure)', () => {
    const { run } = migrateV2();
    expect(run.generators.sagaCitadel).toBe(0);
    expect(run.generators.narratorsGuild).toBe(0);
    expect(run.generators.pantheonPress).toBe(0);
    expect(run.generators.worldTreeArchive).toBe(0);
    expect(run.generators.sleepingCity).toBe(0);
    expect(run.generators.onceUponATime).toBe(0);
  });

  it('the 7 v3 re-scalers stay uncbought (run.upgrades untouched)', () => {
    const { run } = migrateV2();
    expect(run.upgrades.hundredNamesOfMuse).toBeUndefined();
    expect(run.upgrades.forgeOfLegends).toBeUndefined();
    // The v2 run upgrades survive exactly.
    expect(run.upgrades).toEqual(V2_FIXTURE.run.upgrades);
  });

  it('the 6 v3 Atelier upgrades are absent (meta.atelier untouched)', () => {
    const { meta } = migrateV2();
    expect(meta.atelier.theNewWing).toBeUndefined();
    expect(meta.atelier.atlasOfUntoldLands).toBeUndefined();
    expect(meta.atelier).toEqual(V2_FIXTURE.meta.atelier);
  });

  it('every v2 field survives untouched (spot check across run + meta)', () => {
    const { run, meta } = migrateV2();
    expect(run.inspiration).toBe(V2_FIXTURE.run.inspiration);
    expect(run.totalEarned).toBe(V2_FIXTURE.run.totalEarned);
    expect(run.generators.wanderingMuse).toBe(60);
    expect(run.buffActivationsThisRun).toBe(3);
    expect(run.startedAt).toBe(V2_FIXTURE.run.startedAt);
    expect(meta.goldenQuills).toBe(10);
    expect(meta.tomesPublished).toBe(10);
    expect(meta.stats.lifetimeQuillsEarned).toBe(30);
    expect(meta.stats.fastestPublishMs).toBe(480_000);
    expect(meta.storyFragments).toBe(3);
    expect(meta.fables).toHaveLength(1);
    expect(meta.settings.buyQty).toBe('max');
  });

  it('achievements 25–36 stay locked (only the 4 v2 achievements remain)', () => {
    const { meta } = migrateV2();
    expect(meta.achievements).toEqual(V2_FIXTURE.meta.achievements);
    expect(meta.achievements).not.toContain('aLongerRoad');
    expect(meta.achievements).not.toContain('nothingLeftUnwritten');
  });

  it('production after migration is IDENTICAL to the pre-v3 value (all v3 sources null at 0)', () => {
    const s = migratedV2State();
    // Hand-computed v2 production at this state:
    //   muses 60 (≥25,≥50 → ×4) × 0.1 × 2 (chorus) = 48
    //   sprites 30 (≥25 → ×2) × 1 = 60
    //   ravens 12 (<25 → ×1) × 8 = 96
    //   quills 6 × 47 = 282
    //   loom 2 × 260 = 520
    //   library 1 × 1400 = 1400
    //   raw = 48 + 60 + 96 + 282 + 520 + 1400 = 2406
    //   global: ×1.5 (inkwell) × (1 + 0.01×4) (4 ach) × bookshelf (1 unique → 1.02)
    //           × (1 + 0.3×30) (30 lifetime quills)
    const raw = 48 + 60 + 96 + 282 + 520 + 1400;
    const expected = raw * 1.5 * 1.04 * 1.02 * (1 + 0.3 * 30);
    expect(perSecondNoBuff(s)).toBeCloseTo(expected, 4);
  });

  it('the migrated v2 payload round-trips as v3 (serialize → parse → deep equal)', () => {
    const s = migratedV2State();
    const reparsed = parseSave(serializeState(s, s.lastTickAt + 60_000));
    expect(reparsed).not.toBeNull();
    expect(reparsed!.run).toEqual(s.run);
    expect(reparsed!.meta).toEqual(s.meta);
  });
});

describe('the FULL chain v1 → v2 → v3', () => {
  const V1_FIXTURE = {
    version: 1,
    savedAt: 1_751_000_000_000,
    run: {
      inspiration: 12_345,
      totalEarned: 250_000,
      generators: {
        wanderingMuse: 42, inkSprite: 20, talkingRaven: 8, enchantedQuill: 2,
        storyLoom: 0, dreamLibrary: 0, fableForge: 0,
      },
      upgrades: { sharpenedNib: true },
      milestones: ['theFirstSpark'],
      buff: { activeUntil: 0, cooldownUntil: 0 },
    },
    meta: {
      goldenQuills: 3,
      tomesPublished: 3,
      achievements: ['firstWords', 'publishedAuthor'],
      quillResonance: false,
      stats: {
        totalClicks: 100, lifetimeInspiration: 1_000_000,
        buffActivations: 5, offlineSessionsOver30Min: 1, bestSingleOfflineGain: 5_000,
      },
      settings: {},
    },
  };

  it('a v1 save migrates ALL THE WAY to v3 in one parseSave', () => {
    const data = parseSave(JSON.stringify(V1_FIXTURE));
    expect(data).not.toBeNull();
    expect(data!.version).toBe(CURRENT_SAVE_VERSION);
    // v2 defaults present…
    expect(data!.meta.stats.lifetimeQuillsEarned).toBe(3);
    expect(data!.meta.fables).toHaveLength(3); // faded fables
    expect(data!.run.startedAt).toBe(0); // v1→v2 sentinel
    expect(data!.run.sparkBuff).toBeNull();
    // …and v3 defaults present.
    expect(data!.run.seededInspiration).toBe(0);
    expect(data!.run.generators.onceUponATime).toBe(0);
    expect(data!.meta.atelier.theNewWing).toBeUndefined();
  });
});

describe('v3 sanitization of the new fields', () => {
  function tampered(mutate: (json: ReturnType<typeof JSON.parse>) => void) {
    const base = makeState((s) => {
      s.meta.goldenQuills = 2;
      s.meta.stats.lifetimeQuillsEarned = 5;
      s.meta.tomesPublished = 1;
      s.run.totalEarned = 1_000_000;
      s.run.inspiration = 1_000_000;
    });
    const json = JSON.parse(serializeState(base, 555));
    mutate(json);
    return parseSave(JSON.stringify(json));
  }

  it('seededInspiration is clamped to [0, totalEarned]', () => {
    const over = tampered((j) => {
      j.run.seededInspiration = 5_000_000; // > totalEarned 1e6
    });
    expect(over!.run.seededInspiration).toBe(1_000_000); // clamped to totalEarned

    const neg = tampered((j) => {
      j.run.seededInspiration = -100;
    });
    expect(neg!.run.seededInspiration).toBe(0);

    const nan = tampered((j) => {
      j.run.seededInspiration = 'lots';
    });
    expect(nan!.run.seededInspiration).toBe(0);
  });

  it('generators 9–14 clamp to finite non-negative integers', () => {
    const data = tampered((j) => {
      j.run.generators.sagaCitadel = 12.9;
      j.run.generators.onceUponATime = 5;
    });
    expect(data!.run.generators.sagaCitadel).toBe(12);
    expect(data!.run.generators.onceUponATime).toBe(5);
    const bad = tampered((j) => {
      j.run.generators.sleepingCity = -3;
    });
    expect(bad).toBeNull(); // a negative generator count invalidates the run
  });

  it('v3 Atelier levels clamp to each upgrade max; junk dropped', () => {
    const data = tampered((j) => {
      j.meta.atelier = { theNewWing: 99, atlasOfUntoldLands: 1, strengthOfTheStacks: 0 };
    });
    expect(data!.meta.atelier).toEqual({ theNewWing: 3, atlasOfUntoldLands: 1 });
  });

  it('a save with seededInspiration but no matching totalEarned still validates safely', () => {
    // seededInspiration present, totalEarned absent → run rejected (core field),
    // never a crash.
    const raw = { version: CURRENT_SAVE_VERSION, savedAt: 1, run: { seededInspiration: 5 }, meta: {} };
    expect(sanitizeSaveData(raw)).toBeNull();
  });
});
