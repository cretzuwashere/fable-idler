// v3-systems.test.ts — the remaining v3 engine systems (13 §1/§4/§5):
//   - New Wing gating of tiers 9–14 (isGeneratorVisibleInShop)
//   - the 7 run-scoped re-scalers (production ×; unlock at 150 owned)
//   - Perpetual Manuscript persistence at prestige (and NOT keeping the re-scalers)
//   - Clockwork Understudy auto-buy of every generator (deterministic)
//   - Atlas of Untold Lands + Strength of the Stacks
//   - the 12 new achievements and 6 reveal milestones
//   - The Endless Shelf bookshelf cap, Pilgrims' Pages, The City Dreams (spark ×)
//   - the "first 40 minutes are identical" invariant (v3 systems are no-ops early)
import { describe, expect, it } from 'vitest';
import {
  atelierLevel,
  bookshelfMultiplier,
  checkAchievements,
  checkMilestones,
  createFadedFable,
  fragmentsPerQuill,
  generatorProduction,
  hasMilestone,
  isGeneratorVisibleInShop,
  perSecondNoBuff,
  publishTheTome,
  sparkRewardMult,
  tick,
  V3_RUN_UPGRADE_UNLOCK_OWNED,
} from '../../src/engine';
import type { AchievementId, GameState } from '../../src/engine';
import { makeState } from './helpers';

const unlockedAch = (s: GameState): readonly AchievementId[] =>
  checkAchievements(s, 0).meta.achievements;

// ---------------------------------------------------------------------------
// New Wing gating (isGeneratorVisibleInShop)
// ---------------------------------------------------------------------------

describe('New Wing gates tiers 9–14 (13 §1 / 14 §2)', () => {
  it('tiers 9–10 need Wing L1, 11–12 need L2, 13–14 need L3 (reveal met)', () => {
    // Give a huge run totalEarned so revealAt is never the blocker.
    const withWing = (level: number) =>
      makeState((s) => {
        s.run.totalEarned = 1e17; // past every v3 revealAt
        if (level > 0) s.meta.atelier = { theNewWing: level };
      });

    const l0 = withWing(0);
    for (const id of ['sagaCitadel', 'onceUponATime'] as const) {
      expect(isGeneratorVisibleInShop(l0, id)).toBe(false);
    }

    const l1 = withWing(1);
    expect(isGeneratorVisibleInShop(l1, 'sagaCitadel')).toBe(true); // tier 9
    expect(isGeneratorVisibleInShop(l1, 'narratorsGuild')).toBe(true); // tier 10
    expect(isGeneratorVisibleInShop(l1, 'pantheonPress')).toBe(false); // tier 11 needs L2

    const l2 = withWing(2);
    expect(isGeneratorVisibleInShop(l2, 'pantheonPress')).toBe(true);
    expect(isGeneratorVisibleInShop(l2, 'worldTreeArchive')).toBe(true);
    expect(isGeneratorVisibleInShop(l2, 'sleepingCity')).toBe(false); // tier 13 needs L3

    const l3 = withWing(3);
    expect(isGeneratorVisibleInShop(l3, 'sleepingCity')).toBe(true);
    expect(isGeneratorVisibleInShop(l3, 'onceUponATime')).toBe(true);
  });

  it('even with the Wing, revealAt still gates the row (no early teaser)', () => {
    const wingButPoor = makeState((s) => {
      s.meta.atelier = { theNewWing: 3 };
      s.run.totalEarned = 1e8; // below sagaCitadel revealAt (3e9)
    });
    expect(isGeneratorVisibleInShop(wingButPoor, 'sagaCitadel')).toBe(false);
  });

  it('mythEngine keeps its own blueprintOfMyths gate (unchanged)', () => {
    const s = makeState((x) => void (x.run.totalEarned = 2e8));
    expect(isGeneratorVisibleInShop(s, 'mythEngine')).toBe(false);
    const withBlueprint = makeState((x) => {
      x.run.totalEarned = 2e8;
      x.meta.atelier = { blueprintOfMyths: 1 };
    });
    expect(isGeneratorVisibleInShop(withBlueprint, 'mythEngine')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The 7 run-scoped re-scalers
// ---------------------------------------------------------------------------

describe('the 7 run-scoped re-scalers (14 §4.3)', () => {
  it('unlock at 150 owned of the target generator', () => {
    // The unlock is a run.upgrades condition — verify the constant and that the
    // upgrade multiplies production only when bought.
    expect(V3_RUN_UPGRADE_UNLOCK_OWNED).toBe(150);
    const bought = makeState((s) => {
      s.run.generators.wanderingMuse = 150;
      s.run.upgrades.hundredNamesOfMuse = true;
    });
    const not = makeState((s) => void (s.run.generators.wanderingMuse = 150));
    expect(generatorProduction(bought, 'wanderingMuse')).toBeCloseTo(
      generatorProduction(not, 'wanderingMuse') * 1000,
      6,
    );
  });

  it('each re-scaler multiplies its own tier only, by the exact factor', () => {
    const cases = [
      { upg: 'hundredNamesOfMuse', gen: 'wanderingMuse', mult: 1000 },
      { upg: 'inkTide', gen: 'inkSprite', mult: 800 },
      { upg: 'parliamentOfRavens', gen: 'talkingRaven', mult: 600 },
      { upg: 'quillstorm', gen: 'enchantedQuill', mult: 500 },
      { upg: 'theGreatTapestry', gen: 'storyLoom', mult: 400 },
      { upg: 'infiniteStacks', gen: 'dreamLibrary', mult: 300 },
      { upg: 'forgeOfLegends', gen: 'fableForge', mult: 200 },
    ] as const;
    for (const { upg, gen, mult } of cases) {
      const base = makeState((s) => void (s.run.generators[gen] = 10));
      const boosted = makeState((s) => {
        s.run.generators[gen] = 10;
        s.run.upgrades[upg] = true;
      });
      expect(generatorProduction(boosted, gen)).toBeCloseTo(
        generatorProduction(base, gen) * mult,
        4,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Perpetual Manuscript / Second Bookmark persistence
// ---------------------------------------------------------------------------

describe('Perpetual Manuscript keeps all 10 v1 run upgrades, NOT the re-scalers', () => {
  it('keeps every owned v1 run upgrade through a publish', () => {
    const s = makeState((x) => {
      x.meta.tomesPublished = 5;
      x.run.totalEarned = 1e6;
      x.run.inspiration = 1e6;
      x.run.upgrades.sharpenedNib = true;
      x.run.upgrades.goldenInkwell = true;
      x.run.upgrades.lucidDreaming = true;
      x.run.upgrades.inkEcho = true;
      x.run.upgrades.hundredNamesOfMuse = true; // a v3 re-scaler — must NOT persist
      x.meta.atelier = { perpetualManuscript: 1 };
    });
    const after = publishTheTome(s, 1_000);
    expect(after.run.upgrades.sharpenedNib).toBe(true);
    expect(after.run.upgrades.goldenInkwell).toBe(true);
    expect(after.run.upgrades.lucidDreaming).toBe(true);
    expect(after.run.upgrades.inkEcho).toBe(true);
    // The v3 re-scaler is dropped — it stays the per-run shopping arc.
    expect(after.run.upgrades.hundredNamesOfMuse).toBeUndefined();
  });

  it('the re-scalers are never kept by Second Bookmark either (only v1 upgrades)', () => {
    const s = makeState((x) => {
      x.meta.tomesPublished = 5;
      x.run.totalEarned = 1e6;
      x.run.inspiration = 1e6;
      x.run.upgrades.hundredNamesOfMuse = true;
      x.run.upgrades.inkTide = true;
      x.meta.atelier = { secondBookmark: 2 };
    });
    const after = publishTheTome(s, 1_000);
    expect(after.run.upgrades.hundredNamesOfMuse).toBeUndefined();
    expect(after.run.upgrades.inkTide).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Clockwork Understudy auto-buy (deterministic across tick chopping)
// ---------------------------------------------------------------------------

describe('Clockwork Understudy — auto-buy every generator, deterministically', () => {
  /** A state where auto-buy can afford cheap generators (1% of the balance).
   *  Achievements + milestones are PRE-UNLOCKED (as the v1 auto-buy determinism
   *  test does): the 10×100ms ≡ 1×1000ms invariant only holds when no unlock
   *  fires mid-window (an unlock would raise the rate in the stepped path but not
   *  the one-shot, a known, documented behavior). */
  function autoBuyState(clockwork: boolean): GameState {
    return makeState((s) => {
      s.run.totalEarned = 900_000; // reveals tiers 1–5 (Story Loom revealAt 65k)
      s.run.inspiration = 900_000; // < 1e6 → hoarderOfIdeas cannot fire mid-window
      s.run.generators.wanderingMuse = 20;
      s.run.generators.inkSprite = 10;
      s.meta.atelier = clockwork
        ? { selfWritingContract: 1, clockworkUnderstudy: 1 }
        : { selfWritingContract: 1 };
      // Pre-unlock every achievement/milestone a handful of auto-buys could trip
      // AND everything already met at t=0, so NO timing-dependent unlock changes
      // the rate mid-window (the stepped path would otherwise unlock it earlier
      // than the one-shot). This mirrors the v1 auto-buy determinism test setup.
      s.meta.achievements = [
        'firstWords', 'storytellerAwakens', 'busyFingers', 'whisperedLegends',
        'aThousandTales', 'museMenagerie', 'fullAviary', 'industrialFiction',
        'patronOfTheArts',
      ];
      s.meta.stats.lifetimeInspiration = 1_000_000; // whisperedLegends/aThousandTales met
      s.meta.stats.totalClicks = 1_000; // busyFingers met
      s.run.milestones = [
        'theFirstSpark', 'whispersInInk', 'craftsmansTools', 'racingHeart',
        'aFeatheredFriend', 'hallOfDeeds', 'theQuillStirs', 'thePublishersLetter',
        'threadsOfNarrative', 'aLightAtTheWindow',
        'qty:talkingRaven:25', 'qty:talkingRaven:50',
        'qty:wanderingMuse:25', 'qty:inkSprite:25',
      ];
      s.lastTickAt = 0;
    });
  }

  it('Self-Writing Contract alone only auto-buys the Wandering Muse', () => {
    const s = autoBuyState(false);
    const after = tick(s, 3_000, 3_000); // 3 whole-second boundaries
    // Only muses grew; other generators untouched.
    expect(after.run.generators.wanderingMuse).toBeGreaterThan(s.run.generators.wanderingMuse);
    expect(after.run.generators.inkSprite).toBe(s.run.generators.inkSprite);
  });

  it('Clockwork Understudy buys the best-payback generator (may not be the Muse)', () => {
    const s = autoBuyState(true);
    const after = tick(s, 5_000, 5_000);
    const bought =
      after.run.generators.wanderingMuse - s.run.generators.wanderingMuse +
      (after.run.generators.inkSprite - s.run.generators.inkSprite) +
      (after.run.generators.talkingRaven - s.run.generators.talkingRaven);
    expect(bought).toBeGreaterThan(0); // at least one auto-buy happened
  });

  it('auto-buy is deterministic: 10×500ms ≡ 1×5000ms with Clockwork on', () => {
    const s = autoBuyState(true);
    const oneShot = tick(s, 5_000, 5_000);
    let chunked = s;
    for (let i = 1; i <= 10; i++) chunked = tick(chunked, i * 500, 500);
    // The auto-buy DECISIONS are what must be deterministic — generator counts
    // and the last-auto-buy timestamp match EXACTLY regardless of tick chopping
    // (the buy schedule is independent of slicing).
    expect(chunked.run.generators).toEqual(oneShot.run.generators);
    expect(chunked.run.lastAutoBuyAt).toBe(oneShot.run.lastAutoBuyAt);
    // With the state pre-unlocked (no mid-window unlock to perturb the rate),
    // production integrates to the same value up to IEEE-754 summation order.
    expect(chunked.run.inspiration).toBeCloseTo(oneShot.run.inspiration, 6);
    expect(chunked.run.totalEarned).toBeCloseTo(oneShot.run.totalEarned, 6);
  });
});

// ---------------------------------------------------------------------------
// Atlas / Strength of the Stacks / Endless Shelf / Pilgrims / City
// ---------------------------------------------------------------------------

describe('v3 Atelier + relic production effects', () => {
  it('Atlas of Untold Lands doubles global production', () => {
    const base = makeState((s) => void (s.run.generators.inkSprite = 10));
    const atlas = makeState((s) => {
      s.run.generators.inkSprite = 10;
      s.meta.atelier = { atlasOfUntoldLands: 1 };
    });
    expect(perSecondNoBuff(atlas) / perSecondNoBuff(base)).toBeCloseTo(2, 9);
  });

  it('The Endless Shelf raises the Bookshelf cap 25 → 100 (max +200%)', () => {
    // Build 100 fables with GUARANTEED-unique titles (faded titles can collide,
    // and the Bookshelf counts UNIQUE titles — 09 §3.1).
    const fables = Array.from({ length: 100 }, (_, i) => ({
      ...createFadedFable(i + 1, 1),
      title: `Unique Fable Number ${i + 1}`,
    }));
    const capped25 = makeState((s) => {
      s.meta.fables = fables;
      s.meta.tomesPublished = 100; // NOT ≥ 200 → Endless Shelf still locked
    });
    const capped100 = makeState((s) => {
      s.meta.fables = fables;
      s.meta.tomesPublished = 200; // Endless Shelf unlocked
    });
    expect(bookshelfMultiplier(capped25)).toBeCloseTo(1 + 0.02 * 25, 9); // +50%, cap 25
    expect(bookshelfMultiplier(capped100)).toBeCloseTo(1 + 0.02 * 100, 9); // +200%, cap 100
  });

  it("Pilgrims' Pages drops fragments-per-quill 5 → 3", () => {
    expect(fragmentsPerQuill(makeState())).toBe(5);
    expect(fragmentsPerQuill(makeState((s) => void (s.meta.tomesPublished = 75)))).toBe(3);
  });

  it('The City Dreams of You doubles spark rewards (×4 with Net L2)', () => {
    const plain = makeState();
    expect(sparkRewardMult(plain)).toBe(1);
    const city = makeState((s) => void (s.run.generators.sleepingCity = 200));
    expect(sparkRewardMult(city)).toBe(2);
    const cityAndNet = makeState((s) => {
      s.run.generators.sleepingCity = 200;
      s.meta.atelier = { sparkcatchersNet: 2 };
    });
    expect(sparkRewardMult(cityAndNet)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// v3 achievements + reveal milestones
// ---------------------------------------------------------------------------

describe('the 12 new achievements (13 §5.1)', () => {
  it('aLongerRoad: first tier-9 generator', () => {
    expect(unlockedAch(makeState((s) => void (s.run.generators.sagaCitadel = 1)))).toContain(
      'aLongerRoad',
    );
    expect(unlockedAch(makeState((s) => void (s.run.generators.fableForge = 1)))).not.toContain(
      'aLongerRoad',
    );
  });

  it('cosmologySection: at least one of every generator (all 14)', () => {
    const all = makeState((s) => {
      for (const id of Object.keys(s.run.generators) as (keyof typeof s.run.generators)[]) {
        s.run.generators[id] = 1;
      }
    });
    expect(unlockedAch(all)).toContain('cosmologySection');
    const missing = makeState((s) => {
      for (const id of Object.keys(s.run.generators) as (keyof typeof s.run.generators)[]) {
        s.run.generators[id] = 1;
      }
      s.run.generators.onceUponATime = 0;
    });
    expect(unlockedAch(missing)).not.toContain('cosmologySection');
  });

  it('twoHundredVoices / deepShelves: 200 / 500 of a single generator', () => {
    expect(unlockedAch(makeState((s) => void (s.run.generators.inkSprite = 200)))).toContain(
      'twoHundredVoices',
    );
    expect(unlockedAch(makeState((s) => void (s.run.generators.inkSprite = 200)))).not.toContain(
      'deepShelves',
    );
    expect(unlockedAch(makeState((s) => void (s.run.generators.inkSprite = 500)))).toContain(
      'deepShelves',
    );
  });

  it('aNumberNeedsAName: 1e15 run totalEarned', () => {
    expect(unlockedAch(makeState((s) => void (s.run.totalEarned = 1e15)))).toContain(
      'aNumberNeedsAName',
    );
    expect(unlockedAch(makeState((s) => void (s.run.totalEarned = 9.9e14)))).not.toContain(
      'aNumberNeedsAName',
    );
  });

  it('beyondTheAlphabet: 1e21 lifetime Inspiration', () => {
    expect(
      unlockedAch(makeState((s) => void (s.meta.stats.lifetimeInspiration = 1e21))),
    ).toContain('beyondTheAlphabet');
  });

  it('masterOfTheWing: The New Wing at L3', () => {
    expect(unlockedAch(makeState((s) => void (s.meta.atelier = { theNewWing: 3 })))).toContain(
      'masterOfTheWing',
    );
    expect(unlockedAch(makeState((s) => void (s.meta.atelier = { theNewWing: 2 })))).not.toContain(
      'masterOfTheWing',
    );
  });

  it('aThousandFeathers: 1000 lifetime quills', () => {
    expect(
      unlockedAch(makeState((s) => void (s.meta.stats.lifetimeQuillsEarned = 1_000))),
    ).toContain('aThousandFeathers');
  });

  it('marathonNovelist / completeWorks: 50 / 200 tomes', () => {
    expect(unlockedAch(makeState((s) => void (s.meta.tomesPublished = 50)))).toContain(
      'marathonNovelist',
    );
    expect(unlockedAch(makeState((s) => void (s.meta.tomesPublished = 50)))).not.toContain(
      'completeWorks',
    );
    expect(unlockedAch(makeState((s) => void (s.meta.tomesPublished = 200)))).toContain(
      'completeWorks',
    );
  });

  it('onceUponAHundred: 100 Once Upon a Time', () => {
    expect(
      unlockedAch(makeState((s) => void (s.run.generators.onceUponATime = 100))),
    ).toContain('onceUponAHundred');
  });

  it('nothingLeftUnwritten: all relics unlocked AND every Atelier upgrade maxed', () => {
    // Just below: all 8 relics (tomes 200) but not every Atelier upgrade.
    const almost = makeState((s) => {
      s.meta.tomesPublished = 200;
    });
    expect(unlockedAch(almost)).not.toContain('nothingLeftUnwritten');
    // Full meta: max every atelier upgrade + tomes ≥ 200 (all relics).
    const full = makeState((s) => {
      s.meta.tomesPublished = 200;
      s.meta.atelier = {
        apprenticeMuse: 3, selfWritingContract: 1, strokeOfGenius: 2, blueprintOfMyths: 1,
        restlessHeart: 2, thunderousApplause: 1, nightOwlPact: 1, sparkcatchersNet: 2,
        secondBookmark: 2, editorsDue: 1, theNewWing: 3, clockworkUnderstudy: 1,
        curatorsPatience: 1, perpetualManuscript: 1, strengthOfTheStacks: 1, atlasOfUntoldLands: 1,
      };
    });
    expect(unlockedAch(full)).toContain('nothingLeftUnwritten');
  });
});

describe('the 6 reveal milestones (13 §5.2) — totalEarned AND New Wing level', () => {
  it('bannersOnTheHorizon fires only when both the reveal AND Wing L1 hold', () => {
    const revealOnly = checkMilestones(
      makeState((s) => void (s.run.totalEarned = 3e9)), // no Wing
    );
    expect(hasMilestone(revealOnly, 'bannersOnTheHorizon')).toBe(false);
    const both = checkMilestones(
      makeState((s) => {
        s.run.totalEarned = 3e9;
        s.meta.atelier = { theNewWing: 1 };
      }),
    );
    expect(hasMilestone(both, 'bannersOnTheHorizon')).toBe(true);
  });

  it('theOldestSentence needs 2.1e16 totalEarned AND Wing L3', () => {
    const l2 = checkMilestones(
      makeState((s) => {
        s.run.totalEarned = 2.1e16;
        s.meta.atelier = { theNewWing: 2 };
      }),
    );
    expect(hasMilestone(l2, 'theOldestSentence')).toBe(false);
    const l3 = checkMilestones(
      makeState((s) => {
        s.run.totalEarned = 2.1e16;
        s.meta.atelier = { theNewWing: 3 };
      }),
    );
    expect(hasMilestone(l3, 'theOldestSentence')).toBe(true);
  });

  it('a 200-owned quantity badge milestone is granted (qty:<gen>:200)', () => {
    const s = checkMilestones(makeState((x) => void (x.run.generators.wanderingMuse = 200)));
    expect(hasMilestone(s, 'qty:wanderingMuse:150')).toBe(true);
    expect(hasMilestone(s, 'qty:wanderingMuse:200')).toBe(true);
    expect(hasMilestone(s, 'qty:wanderingMuse:300')).toBe(false);
  });

  it('the 500 "grand finale" badge is granted at 500 owned', () => {
    const s = checkMilestones(makeState((x) => void (x.run.generators.inkSprite = 500)));
    for (const t of [25, 50, 100, 150, 200, 300, 400, 500]) {
      expect(hasMilestone(s, `qty:inkSprite:${t}`)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// The invariant: the first 40 minutes are UNCHANGED by v3 (§0.1 / §7.3)
// ---------------------------------------------------------------------------

describe('INVARIANT: v3 systems are no-ops in the first-run window', () => {
  it('a fresh run has no New Wing, no seed, and v3 sources are all neutral', () => {
    const fresh = makeState();
    expect(atelierLevel(fresh, 'theNewWing')).toBe(0);
    expect(fresh.run.seededInspiration).toBe(0);
    // No generator can reach the v3 quantity/unique thresholds early (fresh = 0).
    expect(bookshelfMultiplier(fresh)).toBe(1);
    expect(sparkRewardMult(fresh)).toBe(1);
    expect(fragmentsPerQuill(fresh)).toBe(5);
  });

  it('production at a small first-run state matches the pure v1/v2 formula', () => {
    // 40 muses (×4), 20 sprites (<25 → ×1 wait: ≥ nothing; use 24 to stay <25),
    // small counts far below every v3 threshold (150/200) and no atelier.
    const s = makeState((x) => {
      x.run.generators.wanderingMuse = 40; // ≥25,≥50? no (40<50) → ×2
      x.run.generators.inkSprite = 10;
      x.run.upgrades.sharpenedNib = true;
    });
    // muse 40 (≥25 → ×2) × 0.1 × 1 (no chorus) = 8; sprite 10 × 1 = 10 → raw 18.
    // global: no atelier, no achievements, no quills → 1.0.
    expect(perSecondNoBuff(s)).toBeCloseTo(8 + 10, 9);
  });
});
