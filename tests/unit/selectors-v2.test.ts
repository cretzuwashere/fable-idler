// selectors-v2.test.ts — the extended multiplier chain (11 §7), hand-computed:
// gossip at per-generator step 3½, Bookshelf/Ink-That-Remembers at 6½a/6½b,
// the GOLDEN RULE at step 7 (lifetime, not wallet), frenzy on the click base
// only, crit ×10 on the whole click, offline cap/efficiency combos.
import { describe, expect, it } from 'vitest';
import {
  clickPower,
  clickValue,
  computeOfflineReport,
  critChance,
  isCritRoll,
  NIGHT_OWL_EXTRA_CAP_MS,
  offlineCapMs,
  offlineEfficiency,
  perSecond,
  perSecondNoBuff,
  quillMultiplier,
  STROKE_OF_GENIUS,
} from '../../src/engine';
import type { Fable } from '../../src/engine';
import { makeState } from './helpers';

const HOUR = 3_600_000;

function uniqueFables(count: number): Fable[] {
  return Array.from({ length: count }, (_, i) => ({
    n: i + 1,
    title: `Unique Title #${i + 1}`,
    publishedAt: 0,
    runStats: null,
    gilded: false,
  }));
}

describe('GOLDEN RULE — quillMultiplier reads lifetimeQuillsEarned, never the wallet', () => {
  it('a drained wallet with lifetime 3 still gives ×1.9', () => {
    const s = makeState((x) => {
      x.meta.goldenQuills = 0; // everything spent in the Atelier
      x.meta.stats.lifetimeQuillsEarned = 3;
    });
    expect(quillMultiplier(s)).toBeCloseTo(1.9, 12);
  });

  it('a full wallet contributes NOTHING beyond its lifetime anchor', () => {
    const spent = makeState((x) => {
      x.run.generators.inkSprite = 10;
      x.meta.goldenQuills = 0;
      x.meta.stats.lifetimeQuillsEarned = 4;
    });
    const hoarder = makeState((x) => {
      x.run.generators.inkSprite = 10;
      x.meta.goldenQuills = 4;
      x.meta.stats.lifetimeQuillsEarned = 4;
    });
    expect(perSecondNoBuff(spent)).toBe(perSecondNoBuff(hoarder)); // wallet is not an input
    expect(perSecondNoBuff(spent)).toBeCloseTo(22, 12); // 10 × 2.2
  });
});

describe('bookshelf (6½a) and Ink That Remembers (6½b)', () => {
  it('Ink That Remembers is inert below 15 tomes, then 1 + 0.01 × tomes', () => {
    const at = (tomes: number) =>
      perSecondNoBuff(
        makeState((x) => {
          x.run.generators.inkSprite = 10;
          x.meta.tomesPublished = tomes;
        }),
      );
    expect(at(14)).toBeCloseTo(10, 12); // relic locked
    expect(at(15)).toBeCloseTo(10 * 1.15, 12);
    expect(at(20)).toBeCloseTo(10 * 1.2, 12); // grows forever
  });

  it('bookshelf bonus is +2%/unique fable, capped at 25', () => {
    const at = (n: number) =>
      perSecondNoBuff(
        makeState((x) => {
          x.run.generators.inkSprite = 10;
          x.meta.fables = uniqueFables(n);
        }),
      );
    expect(at(3)).toBeCloseTo(10.6, 12);
    expect(at(25)).toBeCloseTo(15, 12);
    expect(at(40)).toBeCloseTo(15, 12); // capped
  });

  it('full v2 global stack, hand-computed', () => {
    const s = makeState((x) => {
      x.run.generators.inkSprite = 10;
      x.run.generators.talkingRaven = 4;
      x.run.upgrades.ravensGossip = true;
      x.run.upgrades.goldenInkwell = true;
      x.meta.achievements = ['firstWords', 'storytellerAwakens'];
      x.meta.fables = uniqueFables(3);
      x.meta.tomesPublished = 20;
      x.meta.goldenQuills = 0; // wallet drained — irrelevant by design
      x.meta.stats.lifetimeQuillsEarned = 1;
      x.run.buff.activeUntil = 10_000;
    });
    // raw = 10·1.2 + 32 = 44 → ×1.5 ×1.02 ×1.06(shelf) ×1.2(ink) ×1.3(quill) ×2(buff)
    const expected = 44 * 1.5 * 1.02 * 1.06 * 1.2 * 1.3 * 2;
    expect(perSecond(s, 0)).toBeCloseTo(expected, 9);
    expect(perSecondNoBuff(s)).toBeCloseTo(expected / 2, 9);
  });
});

describe('gossipBonanza at step 3½ — per generator, tiers 1–3 only', () => {
  it('multiplies muse/sprite/raven ×5 but not higher tiers, and composes with synergies', () => {
    const s = makeState((x) => {
      x.run.generators.wanderingMuse = 10; // 1/s
      x.run.generators.inkSprite = 10; // 10/s, gossip-upgrade boosted below
      x.run.generators.talkingRaven = 4; // 32/s
      x.run.generators.storyLoom = 1; // 260/s — tier 5, NOT multiplied
      x.run.upgrades.ravensGossip = true; // sprite ×1.2
      x.run.sparkBuff = { kind: 'gossipBonanza', activeUntil: 60_000 };
    });
    // tiers 1–3: (1 + 12 + 32) × 5 = 225; loom stays 260
    expect(perSecond(s, 0)).toBeCloseTo(225 + 260, 9);
    expect(perSecond(s, 60_000)).toBeCloseTo(45 + 260, 9); // expired at activeUntil
    expect(perSecondNoBuff(s)).toBeCloseTo(45 + 260, 9); // never in the offline basis
  });

  it('quillFrenzy does NOT touch production', () => {
    const s = makeState((x) => {
      x.run.generators.inkSprite = 10;
      x.run.sparkBuff = { kind: 'quillFrenzy', activeUntil: 30_000 };
    });
    expect(perSecond(s, 0)).toBeCloseTo(10, 12);
  });
});

describe('click: frenzy ×7 base-only; crit ×10 whole click', () => {
  it('three distinct click rules stack exactly (buff ×5 · frenzy ×7 base; echo untouched)', () => {
    const s = makeState((x) => {
      x.run.generators.inkSprite = 10;
      x.run.upgrades.sharpenedNib = true;
      x.run.upgrades.inkEcho = true;
      x.run.buff.activeUntil = 1_000;
      x.run.sparkBuff = { kind: 'quillFrenzy', activeUntil: 1_000 };
    });
    // base = 1·2·5·7 = 70; echo = 0.01 · (10 × 2 buff) = 0.2 → 70.2
    expect(clickPower(s, 0)).toBeCloseTo(70.2, 9);
  });

  it('critChance is 0 / 0.05 / 0.10 by Stroke of Genius level', () => {
    expect(critChance(makeState())).toBe(0);
    const l1 = makeState((x) => void (x.meta.atelier = { strokeOfGenius: 1 }));
    const l2 = makeState((x) => void (x.meta.atelier = { strokeOfGenius: 2 }));
    expect(critChance(l1)).toBe(0.05);
    expect(critChance(l2)).toBe(0.1);
  });

  it('critRoll 0 → always crit (×10 on the WHOLE click, echo included)', () => {
    const s = makeState((x) => {
      x.run.generators.inkSprite = 10;
      x.run.upgrades.inkEcho = true;
      x.meta.atelier = { strokeOfGenius: 1 };
    });
    expect(clickValue(s, 0, 0)).toBeCloseTo(1.1 * STROKE_OF_GENIUS.critMult, 9); // 11, not 10.1
    expect(clickValue(s, 0, 0.999)).toBeCloseTo(1.1, 9); // roll above the chance
    expect(clickValue(s, 0)).toBeCloseTo(1.1, 9); // no roll = no crit
  });

  it('without Stroke of Genius even critRoll 0 never crits; hostile rolls are ignored', () => {
    const s = makeState();
    expect(clickValue(s, 0, 0)).toBe(1);
    expect(isCritRoll(s, 0)).toBe(false);
    const genius = makeState((x) => void (x.meta.atelier = { strokeOfGenius: 2 }));
    expect(isCritRoll(genius, -1)).toBe(false); // negative roll rejected
    expect(isCritRoll(genius, Number.NaN)).toBe(false);
    expect(isCritRoll(genius, 0.0999)).toBe(true);
    expect(isCritRoll(genius, 0.1)).toBe(false); // boundary exact
  });
});

describe('offline cap & efficiency — all v2 combinations', () => {
  const build = (lucid: boolean, nightOwl: boolean, tomes: number) =>
    makeState((x) => {
      x.run.generators.inkSprite = 10;
      if (lucid) x.run.upgrades.lucidDreaming = true;
      if (nightOwl) x.meta.atelier = { nightOwlPact: 1 };
      x.meta.tomesPublished = tomes;
    });

  it('caps: 8h / 12h / 20h / 24h', () => {
    expect(offlineCapMs(build(false, false, 0))).toBe(8 * HOUR);
    expect(offlineCapMs(build(true, false, 0))).toBe(12 * HOUR);
    expect(offlineCapMs(build(false, true, 0))).toBe(20 * HOUR);
    expect(offlineCapMs(build(true, true, 0))).toBe(24 * HOUR);
    expect(NIGHT_OWL_EXTRA_CAP_MS).toBe(12 * HOUR);
  });

  it('efficiencies: 0.5 / 0.6 / 0.75 / 0.85 (Reader’s Letter at 30 tomes)', () => {
    expect(offlineEfficiency(build(false, false, 0))).toBeCloseTo(0.5, 12);
    expect(offlineEfficiency(build(false, false, 30))).toBeCloseTo(0.6, 12);
    expect(offlineEfficiency(build(true, false, 29))).toBeCloseTo(0.75, 12);
    expect(offlineEfficiency(build(true, false, 30))).toBeCloseTo(0.85, 12);
  });

  it('computeOfflineReport uses the v2 cap and efficiency (24h × 0.85 endgame)', () => {
    const s = build(true, true, 30);
    // Bookshelf/relic multipliers off (no fables; ink remembers needs ≥15 — 30 here!)
    // production = 10 × 1.3 (ink remembers at 30 tomes) = 13/s
    const r = computeOfflineReport(s, 0, 48 * HOUR);
    expect(r.cappedMs).toBe(24 * HOUR);
    expect(r.efficiency).toBeCloseTo(0.85, 12);
    expect(r.gained).toBeCloseTo(13 * 24 * 3_600 * 0.85, 6);
  });

  it('v1 defaults unchanged: 1h at 10/s → 18,000 (regression guard)', () => {
    const r = computeOfflineReport(build(false, false, 0), 0, HOUR);
    expect(r.gained).toBeCloseTo(18_000, 9);
  });
});
