// save-migration-v2.test.ts — the real v1→v2 migration (MIGRATIONS[1]),
// verified FIELD BY FIELD against the defaults table in 10 §3.3, on a fixture
// built from the EXACT v1 schema (SaveDataV1 as written by the v1 engine:
// version/savedAt/run{inspiration,totalEarned,generators×7,upgrades,milestones,
// buff}/meta{goldenQuills,tomesPublished,achievements,quillResonance,stats×5,
// settings}). Plus hostile-payload sanitization of every NEW v2 field.
import { describe, expect, it } from 'vitest';
import {
  CURRENT_SAVE_VERSION,
  generateFadedTitle,
  parseSave,
  perSecondNoBuff,
  sanitizeSaveData,
  serializeState,
  SPARK,
  uniqueFableCount,
} from '../../src/engine';
import type { GameState } from '../../src/engine';
import { makeState } from './helpers';

/** A REAL v1 payload — every field the v1 engine serialized, nothing more. */
const V1_FIXTURE = {
  version: 1,
  savedAt: 1_751_000_000_000,
  run: {
    inspiration: 12_345.678,
    totalEarned: 250_000.5,
    generators: {
      wanderingMuse: 42,
      inkSprite: 20,
      talkingRaven: 8,
      enchantedQuill: 2,
      storyLoom: 0,
      dreamLibrary: 0,
      fableForge: 0,
    },
    upgrades: { sharpenedNib: true, musesChorus: true, goldenInkwell: true },
    milestones: [
      'theFirstSpark',
      'whispersInInk',
      'craftsmansTools',
      'racingHeart',
      'aFeatheredFriend',
      'hallOfDeeds',
      'theQuillStirs',
      'qty:wanderingMuse:25',
    ],
    buff: { activeUntil: 0, cooldownUntil: 1_751_000_030_000 },
  },
  meta: {
    goldenQuills: 3,
    tomesPublished: 3,
    achievements: [
      'firstWords',
      'storytellerAwakens',
      'whisperedLegends',
      'aThousandTales',
      'publishedAuthor',
      'serialNovelist',
    ],
    quillResonance: true,
    stats: {
      totalClicks: 4_812,
      lifetimeInspiration: 1_450_000,
      buffActivations: 12,
      offlineSessionsOver30Min: 1,
      bestSingleOfflineGain: 22_000,
    },
    settings: { buyQty: 10, reduceMotion: false },
  },
};

function migrateFixture() {
  const data = parseSave(JSON.stringify(V1_FIXTURE));
  expect(data).not.toBeNull();
  return data!;
}

function migratedState(): GameState {
  const data = migrateFixture();
  return { run: data.run, meta: data.meta, lastTickAt: data.savedAt };
}

describe('MIGRATIONS[1] — the 10 §3.3 defaults table, field by field', () => {
  it('produces a valid current-version payload with savedAt intact (v1→v2→v3)', () => {
    const data = migrateFixture();
    // The chain now runs all the way to v3; every v2 field still carries through
    // the additive v2→v3 migration (verified field-by-field below).
    expect(data.version).toBe(CURRENT_SAVE_VERSION);
    expect(data.savedAt).toBe(V1_FIXTURE.savedAt);
    expect(data.run.seededInspiration).toBe(0); // v3 field: no impact (q(300)=0)
  });

  it('GOLDEN RULE: lifetimeQuillsEarned = floor(v1 goldenQuills); wallet untouched', () => {
    const { meta } = migrateFixture();
    expect(meta.stats.lifetimeQuillsEarned).toBe(3);
    expect(meta.goldenQuills).toBe(3); // fully spendable in the Atelier from second one
  });

  it('new meta counters start at their table defaults', () => {
    const { meta } = migrateFixture();
    expect(meta.stats.sparksCaught).toBe(0);
    expect(meta.stats.quillsFromFragments).toBe(0);
    expect(meta.stats.fastestPublishMs).toBeNull();
    expect(meta.storyFragments).toBe(0);
    expect(meta.atelier).toEqual({});
    expect(meta.settings.leaderboard).toBeUndefined();
  });

  it('creates tomesPublished FADED fables with deterministic index-only titles', () => {
    const { meta } = migrateFixture();
    expect(meta.fables).toHaveLength(3);
    meta.fables.forEach((fable, i) => {
      expect(fable.n).toBe(i + 1);
      expect(fable.title).toBe(generateFadedTitle(i + 1));
      expect(fable.runStats).toBeNull();
      expect(fable.gilded).toBe(false);
      expect(fable.publishedAt).toBe(V1_FIXTURE.savedAt);
    });
    expect(uniqueFableCount(meta.fables)).toBe(3); // titles 1–3 are distinct
  });

  it('new run fields: startedAt = 0 SENTINEL (A5), sparkBuff null, counters 0, mythEngine 0', () => {
    const { run } = migrateFixture();
    expect(run.startedAt).toBe(0); // NOT savedAt — Fastest Publish must skip this run
    expect(run.sparkBuff).toBeNull();
    expect(run.buffActivationsThisRun).toBe(0);
    expect(run.lastAutoBuyAt).toBe(0);
    expect(run.generators.mythEngine).toBe(0);
  });

  it('every v1 field survives untouched', () => {
    const { run, meta } = migrateFixture();
    expect(run.inspiration).toBe(V1_FIXTURE.run.inspiration);
    expect(run.totalEarned).toBe(V1_FIXTURE.run.totalEarned);
    expect(run.generators.wanderingMuse).toBe(42);
    expect(run.upgrades).toEqual(V1_FIXTURE.run.upgrades);
    expect(run.milestones).toEqual(V1_FIXTURE.run.milestones);
    expect(run.buff).toEqual(V1_FIXTURE.run.buff);
    expect(meta.tomesPublished).toBe(3);
    expect(meta.achievements).toEqual(V1_FIXTURE.meta.achievements);
    expect(meta.quillResonance).toBe(true);
    expect(meta.stats.totalClicks).toBe(4_812);
    expect(meta.stats.lifetimeInspiration).toBe(1_450_000);
    expect(meta.settings.buyQty).toBe(10);
  });

  it('production after migration ≥ v1 production at the identical state (criterion 6.2.3)', () => {
    const s = migratedState();
    // Hand-computed v1 value at this state:
    // muses 42 (≥25 → ×2) × 0.1 × 2 (chorus) = 16.8; sprites 20; ravens 64;
    // quills 2 × 47 = 94 → raw 194.8; global: ×1.5 (inkwell) ×1.06 (6 ach)
    // ×(1 + 0.3×3) (quills) = 194.8 × 1.5 × 1.06 × 1.9 = 588.4836
    const v1Prod = 194.8 * 1.5 * 1.06 * 1.9;
    // v2 adds ONLY gifts on top: ×1.06 Bookshelf (3 unique faded fables).
    expect(perSecondNoBuff(s)).toBeCloseTo(v1Prod * 1.06, 6);
    expect(perSecondNoBuff(s)).toBeGreaterThanOrEqual(v1Prod);
  });

  it('the migrated payload round-trips as v2 (serialize → parse → deep equal)', () => {
    const s = migratedState();
    // savedAt must not predate the state's own timestamps, or the legitimate
    // buff-clamp sanitization kicks in (the engine always saves at "now").
    const reparsed = parseSave(serializeState(s, s.lastTickAt + 60_000));
    expect(reparsed).not.toBeNull();
    expect(reparsed!.run).toEqual(s.run);
    expect(reparsed!.meta).toEqual(s.meta);
  });

  it('a zero-progress v1 save migrates to exact fresh-state defaults', () => {
    const empty = {
      version: 1,
      savedAt: 5_000,
      run: { inspiration: 0, totalEarned: 0, generators: {} },
      meta: { goldenQuills: 0, tomesPublished: 0 },
    };
    const data = parseSave(JSON.stringify(empty));
    expect(data).not.toBeNull();
    expect(data!.meta.fables).toEqual([]);
    expect(data!.meta.stats.lifetimeQuillsEarned).toBe(0);
    expect(data!.run.startedAt).toBe(0);
  });

  it('a broken v1 shape still migrates defensively and is then rejected by validation', () => {
    const bad = {
      version: 1,
      savedAt: 1,
      run: { inspiration: 'lots', totalEarned: 5, generators: {} },
      meta: { goldenQuills: 0, tomesPublished: 0 },
    };
    expect(parseSave(JSON.stringify(bad))).toBeNull(); // no crash, clean null
  });
});

describe('hostile v2 payloads — sanitization of the NEW fields', () => {
  /** Serialize a valid v2 state, apply a hostile mutation, re-parse. */
  function tampered(mutate: (json: ReturnType<typeof JSON.parse>) => void) {
    const base = makeState((s) => {
      s.meta.goldenQuills = 2;
      s.meta.stats.lifetimeQuillsEarned = 5;
      s.meta.tomesPublished = 1;
    });
    const json = JSON.parse(serializeState(base, 555));
    mutate(json);
    return parseSave(JSON.stringify(json));
  }

  it('GOLDEN-RULE INVARIANT: wallet > lifetime is repaired by LIFTING lifetime', () => {
    const data = tampered((j) => {
      j.meta.goldenQuills = 50;
      j.meta.stats.lifetimeQuillsEarned = 3;
    });
    expect(data!.meta.goldenQuills).toBe(50);
    expect(data!.meta.stats.lifetimeQuillsEarned).toBe(50); // lifted, wallet kept
  });

  it('NaN / negative / oversized new counters fall back to safe values', () => {
    const data = tampered((j) => {
      j.meta.storyFragments = 99; // engine can never hold ≥ 5
      j.meta.stats.sparksCaught = -3;
      j.meta.stats.quillsFromFragments = Number.NaN;
      j.meta.stats.fastestPublishMs = -100; // impossible duration
    });
    expect(data!.meta.storyFragments).toBe(SPARK.fragmentsPerQuill - 1); // clamped to 4
    expect(data!.meta.stats.sparksCaught).toBe(0);
    expect(data!.meta.stats.quillsFromFragments).toBe(0);
    expect(data!.meta.stats.fastestPublishMs).toBeNull();
  });

  it('atelier levels are clamped to each upgrade max; junk keys dropped', () => {
    const data = tampered((j) => {
      j.meta.atelier = { apprenticeMuse: 99, strokeOfGenius: 1.7, notAnUpgrade: 5, editorsDue: -1 };
    });
    expect(data!.meta.atelier).toEqual({ apprenticeMuse: 3, strokeOfGenius: 1 });
  });

  it('fables: invalid entries skipped, duplicates (same n) deduped, sorted by n', () => {
    const data = tampered((j) => {
      j.meta.fables = [
        { n: 2, title: 'B', publishedAt: 1, runStats: null, gilded: false },
        { n: 2, title: 'B-dup', publishedAt: 1, runStats: null, gilded: false },
        { n: 1, title: 'A', publishedAt: 1, runStats: null, gilded: true },
        { n: 0, title: 'bad-n', publishedAt: 1, runStats: null, gilded: false },
        { n: 3, title: '', publishedAt: 1, runStats: null, gilded: false },
        { n: 4, title: 'X'.repeat(500), publishedAt: 1, runStats: null, gilded: false },
        'not-a-fable',
        { n: 5, title: 'E', publishedAt: -9, runStats: { totalEarned: -1 }, gilded: 'yes' },
      ];
    });
    expect(data!.meta.fables.map((f) => f.n)).toEqual([1, 2, 5]);
    expect(data!.meta.fables[0].gilded).toBe(true);
    expect(data!.meta.fables[2]).toEqual({
      n: 5,
      title: 'E',
      publishedAt: 0,
      runStats: null, // invalid runStats → faded, not rejected
      gilded: false,
    });
  });

  it('sparkBuff: bogus kinds dropped; absurd expiry clamped to the max legit window', () => {
    const dropped = tampered((j) => {
      j.run.sparkBuff = { kind: 'permanentGodMode', activeUntil: 9e15 };
    });
    expect(dropped!.run.sparkBuff).toBeNull();

    const clamped = tampered((j) => {
      j.run.sparkBuff = { kind: 'gossipBonanza', activeUntil: 9e15 };
    });
    expect(clamped!.run.sparkBuff).toEqual({
      kind: 'gossipBonanza',
      activeUntil: 555 + SPARK.gossip.durationMs * SPARK.netRewardMult,
    });
  });

  it('startedAt / lastAutoBuyAt in the future are clamped to savedAt (no fake fastest publish)', () => {
    const data = tampered((j) => {
      j.run.startedAt = 9e15;
      j.run.lastAutoBuyAt = 9e15;
    });
    expect(data!.run.startedAt).toBe(555);
    expect(data!.run.lastAutoBuyAt).toBe(555);
  });

  it('leaderboard identity: kept only when complete and well-typed', () => {
    const kept = tampered((j) => {
      j.meta.settings.leaderboard = {
        playerId: 'p-1',
        token: 'ab12',
        nickname: 'Ink Wizard',
        lastSubmittedAt: 42,
      };
    });
    expect(kept!.meta.settings.leaderboard).toEqual({
      playerId: 'p-1',
      token: 'ab12',
      nickname: 'Ink Wizard',
      lastSubmittedAt: 42,
    });

    const dropped = tampered((j) => {
      j.meta.settings.leaderboard = { playerId: 'p-1', token: 42, nickname: '', lastSubmittedAt: -1 };
    });
    expect(dropped!.meta.settings.leaderboard).toBeUndefined();
  });

  it('a hostile v1 payload with an absurd tome count cannot stall the migration', () => {
    const huge = {
      version: 1,
      savedAt: 1,
      run: { inspiration: 0, totalEarned: 0, generators: {} },
      meta: { goldenQuills: 0, tomesPublished: 1e15 },
    };
    const data = parseSave(JSON.stringify(huge));
    expect(data).not.toBeNull();
    expect(data!.meta.fables.length).toBeLessThanOrEqual(1_000); // capped
  });

  it('sanitizeSaveData still rejects wrong versions outright', () => {
    // v3 is now CURRENT — a non-current version is rejected before shape checks.
    expect(sanitizeSaveData({ version: 4, savedAt: 1, run: {}, meta: {} })).toBeNull();
    expect(sanitizeSaveData({ version: 2, savedAt: 1, run: {}, meta: {} })).toBeNull();
    expect(sanitizeSaveData({ version: 1, savedAt: 1, run: {}, meta: {} })).toBeNull();
    // The current version with an invalid (empty) run shape is still rejected.
    expect(sanitizeSaveData({ version: CURRENT_SAVE_VERSION, savedAt: 1, run: {}, meta: {} })).toBeNull();
  });
});
