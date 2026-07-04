// production.test.ts — selectors: bases, synergies, qty milestones ×2/×4/×8,
// achievements, quills, buff — and the exact composition order from 03 §2.
import { describe, expect, it } from 'vitest';
import {
  generatorProduction,
  perSecond,
  perSecondNoBuff,
  qtyMilestoneMultiplier,
  rawProduction,
} from '../../src/engine';
import { makeState } from './helpers';

describe('base production', () => {
  it('is zero with no generators', () => {
    expect(perSecondNoBuff(makeState())).toBe(0);
  });

  it('uses the 03 §1 base rates', () => {
    const s = makeState((x) => {
      x.run.generators.wanderingMuse = 1; // 0.1/s
      x.run.generators.inkSprite = 10; //    10/s
      x.run.generators.talkingRaven = 2; //  16/s
    });
    expect(generatorProduction(s, 'wanderingMuse')).toBeCloseTo(0.1, 12);
    expect(generatorProduction(s, 'inkSprite')).toBeCloseTo(10, 12);
    expect(generatorProduction(s, 'talkingRaven')).toBeCloseTo(16, 12);
    expect(rawProduction(s)).toBeCloseTo(26.1, 12);
  });
});

describe('quantity milestones (v1 25/50/100 → ×2/×4/×8; v3 150/300/400/500)', () => {
  it('multiplier steps exactly at the thresholds', () => {
    const at = (n: number) =>
      qtyMilestoneMultiplier(
        makeState((x) => void (x.run.generators.wanderingMuse = n)),
        'wanderingMuse',
      );
    // v1 thresholds
    expect(at(24)).toBe(1);
    expect(at(25)).toBe(2);
    expect(at(49)).toBe(2);
    expect(at(50)).toBe(4);
    expect(at(99)).toBe(4);
    expect(at(100)).toBe(8);
    // v3 thresholds (150 ×2, 300 ×2, 400 ×2, 500 ×4). 200 is the UNIQUE bonus,
    // NOT a production multiplier here — so 200 and 250 stay at the 150 step.
    expect(at(149)).toBe(8);
    expect(at(150)).toBe(16);
    expect(at(200)).toBe(16); // unique bonus, no extra production mult
    expect(at(250)).toBe(16);
    expect(at(299)).toBe(16);
    expect(at(300)).toBe(32);
    expect(at(399)).toBe(32);
    expect(at(400)).toBe(64);
    expect(at(499)).toBe(64);
    expect(at(500)).toBe(256); // ×4 finale: 64 × 4
  });

  it('applies to that generator only', () => {
    const s = makeState((x) => {
      x.run.generators.wanderingMuse = 25; // 25 × 0.1 × 2 = 5
      x.run.generators.inkSprite = 10; //     10 × 1       = 10
    });
    expect(generatorProduction(s, 'wanderingMuse')).toBeCloseTo(5, 12);
    expect(generatorProduction(s, 'inkSprite')).toBeCloseTo(10, 12);
  });
});

describe('per-generator upgrade and synergies', () => {
  it("Muse's Chorus doubles Wandering Muse only", () => {
    const s = makeState((x) => {
      x.run.generators.wanderingMuse = 10;
      x.run.generators.inkSprite = 5;
      x.run.upgrades.musesChorus = true;
    });
    expect(generatorProduction(s, 'wanderingMuse')).toBeCloseTo(2, 12); // 10·0.1·2
    expect(generatorProduction(s, 'inkSprite')).toBeCloseTo(5, 12);
  });

  it("Raven's Gossip: inkSprite ×(1 + 0.05·ravens)", () => {
    const s = makeState((x) => {
      x.run.generators.inkSprite = 10;
      x.run.generators.talkingRaven = 4;
      x.run.upgrades.ravensGossip = true;
    });
    expect(generatorProduction(s, 'inkSprite')).toBeCloseTo(12, 12); // 10 · 1.2
    expect(generatorProduction(s, 'talkingRaven')).toBeCloseTo(32, 12);
    expect(rawProduction(s)).toBeCloseTo(44, 12);
  });

  it("Weaver's Rhythm: enchantedQuill ×(1 + 0.10·looms)", () => {
    const s = makeState((x) => {
      x.run.generators.enchantedQuill = 10; // 470/s base
      x.run.generators.storyLoom = 5; //      1300/s
      x.run.upgrades.weaversRhythm = true;
    });
    expect(generatorProduction(s, 'enchantedQuill')).toBeCloseTo(705, 9); // 470 · 1.5
    expect(rawProduction(s)).toBeCloseTo(2_005, 9);
  });

  it('synergies do nothing before the upgrade is bought', () => {
    const s = makeState((x) => {
      x.run.generators.inkSprite = 10;
      x.run.generators.talkingRaven = 4;
    });
    expect(generatorProduction(s, 'inkSprite')).toBeCloseTo(10, 12);
  });
});

describe('global multipliers', () => {
  it('Golden Inkwell ×1.5', () => {
    const s = makeState((x) => {
      x.run.generators.inkSprite = 10;
      x.run.upgrades.goldenInkwell = true;
    });
    expect(perSecondNoBuff(s)).toBeCloseTo(15, 12);
  });

  it('achievements add +1% each (additive within the category)', () => {
    const s = makeState((x) => {
      x.run.generators.inkSprite = 10;
      x.meta.achievements = ['firstWords', 'storytellerAwakens'];
    });
    expect(perSecondNoBuff(s)).toBeCloseTo(10.2, 12); // 10 · 1.02
  });

  it('Bound Anthology doubles the per-achievement bonus', () => {
    const s = makeState((x) => {
      x.run.generators.inkSprite = 10;
      x.meta.achievements = [
        'firstWords',
        'storytellerAwakens',
        'busyFingers',
        'whisperedLegends',
        'aThousandTales',
        'hoarderOfIdeas',
        'museMenagerie',
        'fullAviary',
        'wellRoundedLibrary',
        'industrialFiction',
      ];
      x.run.upgrades.boundAnthology = true;
    });
    expect(perSecondNoBuff(s)).toBeCloseTo(12, 12); // 10 · (1 + 0.02·10)
  });

  it('Golden Quills add +30% each, additive per quill', () => {
    // v2 GOLDEN RULE: the bonus reads stats.lifetimeQuillsEarned (monotonic),
    // not the spendable wallet — a non-spender has wallet ≡ lifetime.
    const s = makeState((x) => {
      x.run.generators.inkSprite = 10;
      x.meta.goldenQuills = 2;
      x.meta.stats.lifetimeQuillsEarned = 2;
    });
    expect(perSecondNoBuff(s)).toBeCloseTo(16, 12); // 10 · 1.6
  });

  it('v2: the wallet alone contributes NOTHING (spending can never lower production)', () => {
    const s = makeState((x) => {
      x.run.generators.inkSprite = 10;
      x.meta.goldenQuills = 2; // wallet without lifetime — impossible for the
      x.meta.stats.lifetimeQuillsEarned = 0; // engine, but proves the anchor
    });
    expect(perSecondNoBuff(s)).toBeCloseTo(10, 12);
  });

  it('buff doubles production only while active', () => {
    const s = makeState((x) => {
      x.run.generators.inkSprite = 10;
      x.run.buff.activeUntil = 1_000;
    });
    expect(perSecond(s, 500)).toBeCloseTo(20, 12); // active
    expect(perSecond(s, 1_000)).toBeCloseTo(10, 12); // expired exactly at activeUntil
    expect(perSecondNoBuff(s)).toBeCloseTo(10, 12);
  });
});

describe('full 03 §2 stack, hand-computed', () => {
  it('10 sprites + 4 ravens + gossip + inkwell + 2 achievements + 1 quill + buff = 175.032/s', () => {
    const s = makeState((x) => {
      x.run.generators.inkSprite = 10;
      x.run.generators.talkingRaven = 4;
      x.run.upgrades.ravensGossip = true;
      x.run.upgrades.goldenInkwell = true;
      x.meta.achievements = ['firstWords', 'storytellerAwakens'];
      x.meta.goldenQuills = 1;
      x.meta.stats.lifetimeQuillsEarned = 1; // v2 golden rule: bonus reads lifetime
      x.run.buff.activeUntil = 10_000;
    });
    // raw = 10·1.2 + 32 = 44 → ×1.5 = 66 → ×1.02 = 67.32 → ×1.3 = 87.516 → ×2 = 175.032
    expect(perSecond(s, 0)).toBeCloseTo(175.032, 9);
    expect(perSecondNoBuff(s)).toBeCloseTo(87.516, 9);
  });
});
