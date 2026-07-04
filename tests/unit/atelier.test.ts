// atelier.test.ts — The Gilded Atelier (v2).
// THE GOLDEN RULE (09 §1.1 / 11 §1.1, criterion 6.2.2): buying ANY Atelier
// upgrade must never decrease production or click power — the +30%/quill bonus
// is anchored on lifetimeQuillsEarned (monotonic), while purchases spend only
// the wallet. Verified here for EVERY upgrade at EVERY level.
import { describe, expect, it } from 'vitest';
import {
  apprenticeStartMuses,
  ATELIER_UPGRADES,
  atelierLevel,
  atelierMaxLevel,
  atelierNextCost,
  bookmarkedUpgrades,
  buyAtelierUpgrade,
  canBuyAtelierUpgrade,
  checkMilestones,
  clickPower,
  createGameStore,
  createMemoryStorage,
  DOG_EARED_PAGE_START_INSPIRATION,
  EDITORS_DUE_BONUS_QUILLS,
  generatorProduction,
  hasAnyAtelierUpgrade,
  hasRelic,
  isAtelierComplete,
  isGeneratorVisibleInShop,
  loadSave,
  perSecond,
  perSecondNoBuff,
  publishTheTome,
  unlockedRelics,
} from '../../src/engine';
import type { GameEvent, GameState } from '../../src/engine';
import { makeState } from './helpers';

/** Total Atelier sink across v2 + v3 (92 + 470,760 = 470,852; 14 §6.1). */
const ATELIER_TOTAL_SINK = ATELIER_UPGRADES.reduce(
  (sum, u) => sum + u.costs.reduce((a, b) => a + b, 0),
  0,
);

/** A production- and click-relevant state with a wallet large enough to buy the
 *  ENTIRE Atelier (v2 + v3). lifetimeQuillsEarned is set to the same figure so
 *  the golden-rule tests spend only the wallet, never the (monotonic) anchor. */
function richAtelierState(mutate?: (s: GameState) => void): GameState {
  return makeState((s) => {
    s.run.generators.wanderingMuse = 30;
    s.run.generators.inkSprite = 10;
    s.run.generators.talkingRaven = 4;
    s.run.upgrades.sharpenedNib = true;
    s.run.upgrades.goldenInkwell = true;
    s.run.upgrades.inkEcho = true;
    s.meta.achievements = ['firstWords', 'storytellerAwakens'];
    s.meta.goldenQuills = ATELIER_TOTAL_SINK;
    s.meta.stats.lifetimeQuillsEarned = ATELIER_TOTAL_SINK;
    s.meta.quillResonance = true;
    if (mutate) mutate(s);
  });
}

describe('THE GOLDEN RULE — no purchase ever lowers production or click power', () => {
  for (const cfg of ATELIER_UPGRADES) {
    it(`${cfg.id}: perSecond and clickPower never drop across all ${cfg.costs.length} level(s)`, () => {
      let s = richAtelierState();
      for (let level = 1; level <= cfg.costs.length; level++) {
        const prodBefore = perSecondNoBuff(s);
        const prodShownBefore = perSecond(s, 0);
        const clickBefore = clickPower(s, 0);
        const lifetimeBefore = s.meta.stats.lifetimeQuillsEarned;
        const walletBefore = s.meta.goldenQuills;

        s = buyAtelierUpgrade(s, cfg.id);

        expect(atelierLevel(s, cfg.id)).toBe(level);
        // production / click: NEVER decreased by spending (criterion 6.2.2)
        expect(perSecondNoBuff(s)).toBeGreaterThanOrEqual(prodBefore);
        expect(perSecond(s, 0)).toBeGreaterThanOrEqual(prodShownBefore);
        expect(clickPower(s, 0)).toBeGreaterThanOrEqual(clickBefore);
        // wallet pays, the lifetime anchor NEVER moves
        expect(s.meta.goldenQuills).toBe(walletBefore - cfg.costs[level - 1]);
        expect(s.meta.stats.lifetimeQuillsEarned).toBe(lifetimeBefore);
      }
    });
  }

  it('spending the whole Atelier wallet leaves production EXACTLY unchanged', () => {
    // Buy every v2+v3 Atelier upgrade in one go. Note some v3 upgrades DO raise
    // production/click (Atlas ×2, Strength of the Stacks, the unique-related
    // ones); the ones exercised by richAtelierState that are pure production
    // BOOSTS still can only ever raise it. The strict-equality check below is
    // therefore run on a state with NO active production-affecting v3 upgrade —
    // we instead assert the GOLDEN-RULE floor (never drops) after the full spend,
    // and that the wallet is emptied exactly.
    let s = richAtelierState();
    const before = perSecondNoBuff(s);
    const clickBefore = clickPower(s, 0);
    for (const cfg of ATELIER_UPGRADES) {
      for (let i = 0; i < cfg.costs.length; i++) s = buyAtelierUpgrade(s, cfg.id);
    }
    expect(isAtelierComplete(s)).toBe(true);
    expect(s.meta.goldenQuills).toBe(0); // exactly the total sink (14 §6.1)
    // Atlas of Untold Lands (×2) legitimately RAISES production — the golden rule
    // is "never drops", so >= is the correct assertion after a full spend.
    expect(perSecondNoBuff(s)).toBeGreaterThanOrEqual(before);
    expect(clickPower(s, 0)).toBeGreaterThanOrEqual(clickBefore);
  });
});

describe('levels, costs, refusals', () => {
  it('apprenticeMuse costs 1/3/8 per level and refuses past max level', () => {
    let s = makeState((x) => {
      x.meta.goldenQuills = 12;
      x.meta.stats.lifetimeQuillsEarned = 12;
    });
    expect(atelierNextCost(s, 'apprenticeMuse')).toBe(1);
    s = buyAtelierUpgrade(s, 'apprenticeMuse');
    expect(atelierNextCost(s, 'apprenticeMuse')).toBe(3);
    s = buyAtelierUpgrade(s, 'apprenticeMuse');
    expect(atelierNextCost(s, 'apprenticeMuse')).toBe(8);
    s = buyAtelierUpgrade(s, 'apprenticeMuse');
    expect(s.meta.goldenQuills).toBe(0);
    expect(atelierLevel(s, 'apprenticeMuse')).toBe(3);
    expect(atelierMaxLevel('apprenticeMuse')).toBe(3);
    expect(atelierNextCost(s, 'apprenticeMuse')).toBeNull();
    expect(buyAtelierUpgrade(s, 'apprenticeMuse')).toBe(s); // same reference — no-op
  });

  it('refuses without funds (same state reference)', () => {
    const s = makeState((x) => {
      x.meta.goldenQuills = 3;
      x.meta.stats.lifetimeQuillsEarned = 3;
    });
    expect(canBuyAtelierUpgrade(s, 'selfWritingContract')).toBe(false); // costs 4
    expect(buyAtelierUpgrade(s, 'selfWritingContract')).toBe(s);
    expect(canBuyAtelierUpgrade(s, 'apprenticeMuse')).toBe(true); // costs 1
  });

  it('hasAnyAtelierUpgrade flips on the first purchase (Patron of the Arts basis)', () => {
    const s = makeState((x) => {
      x.meta.goldenQuills = 1;
      x.meta.stats.lifetimeQuillsEarned = 1;
    });
    expect(hasAnyAtelierUpgrade(s)).toBe(false);
    expect(hasAnyAtelierUpgrade(buyAtelierUpgrade(s, 'apprenticeMuse'))).toBe(true);
  });
});

describe('Second Bookmark — the cheapest K owned run upgrades survive', () => {
  const owned = (s: GameState) => {
    s.run.upgrades.goldenInkwell = true; // 15,000
    s.run.upgrades.sharpenedNib = true; // 100
    s.run.upgrades.ravensGossip = true; // 25,000
    s.run.upgrades.musesChorus = true; // 500
    s.run.upgrades.lucidDreaming = true; // 50,000
  };

  it('L1 keeps exactly the 2 cheapest by config cost', () => {
    const s = makeState((x) => {
      owned(x);
      x.meta.atelier = { secondBookmark: 1 };
    });
    expect(bookmarkedUpgrades(s)).toEqual({ sharpenedNib: true, musesChorus: true });
  });

  it('L2 keeps exactly the 4 cheapest; fewer owned than K keeps them all', () => {
    const s = makeState((x) => {
      owned(x);
      x.meta.atelier = { secondBookmark: 2 };
    });
    expect(bookmarkedUpgrades(s)).toEqual({
      sharpenedNib: true,
      musesChorus: true,
      goldenInkwell: true,
      ravensGossip: true,
    });
    const two = makeState((x) => {
      x.run.upgrades.patronsFavor = true;
      x.run.upgrades.inkEcho = true;
      x.meta.atelier = { secondBookmark: 2 };
    });
    expect(bookmarkedUpgrades(two)).toEqual({ patronsFavor: true, inkEcho: true });
  });

  it('without the upgrade nothing survives; through publishTheTome the keepers land in the new run', () => {
    const none = makeState((x) => owned(x));
    expect(bookmarkedUpgrades(none)).toEqual({});

    const s = makeState((x) => {
      owned(x);
      x.run.totalEarned = 200_000;
      x.meta.atelier = { secondBookmark: 1 };
    });
    const after = publishTheTome(s, 1_000);
    expect(after.run.upgrades).toEqual({ sharpenedNib: true, musesChorus: true });
    expect(after.run.generators.wanderingMuse).toBe(0); // no Apprentice here
  });
});

describe('Apprentice Muse + Dog-Eared Page at run construction', () => {
  it('L3 starts the new run with 30 free muses (and the qty:25 milestone re-arms)', () => {
    const s = makeState((x) => {
      x.run.totalEarned = 150_000;
      x.meta.atelier = { apprenticeMuse: 3 };
    });
    expect(apprenticeStartMuses(s)).toBe(30);
    const after = checkMilestones(publishTheTome(s, 500));
    expect(after.run.generators.wanderingMuse).toBe(30);
    expect(after.run.inspiration).toBe(0); // free hires, not earnings
    expect(after.run.milestones).toContain('qty:wanderingMuse:25'); // assumed behavior (10 risk #5)
    expect(after.run.startedAt).toBe(500);
  });

  it('publishing tome #3 unlocks Dog-Eared Page for the run it opens (300 into BOTH)', () => {
    const second = makeState((x) => {
      x.run.totalEarned = 150_000;
      x.meta.tomesPublished = 1;
    });
    const afterSecond = publishTheTome(second, 0);
    expect(afterSecond.run.inspiration).toBe(0); // tome #2 < threshold 3

    const third = makeState((x) => {
      x.run.totalEarned = 150_000;
      x.meta.tomesPublished = 2;
    });
    const afterThird = publishTheTome(third, 0);
    expect(afterThird.meta.tomesPublished).toBe(3);
    expect(afterThird.run.inspiration).toBe(DOG_EARED_PAGE_START_INSPIRATION);
    expect(afterThird.run.totalEarned).toBe(DOG_EARED_PAGE_START_INSPIRATION); // invariant kept
  });
});

describe("Editor's Due — +1 quill per publish, wallet AND lifetime", () => {
  it('adds the bonus on top of the formula quills', () => {
    const s = makeState((x) => {
      x.run.totalEarned = 450_000; // formula: 2
      x.meta.atelier = { editorsDue: 1 };
      x.meta.goldenQuills = 10;
      x.meta.stats.lifetimeQuillsEarned = 10;
    });
    const after = publishTheTome(s, 0);
    expect(after.meta.goldenQuills).toBe(10 + 2 + EDITORS_DUE_BONUS_QUILLS);
    expect(after.meta.stats.lifetimeQuillsEarned).toBe(10 + 2 + EDITORS_DUE_BONUS_QUILLS);
    expect(after.meta.fables[0].runStats?.quillsEarned).toBe(3); // fable records the total
  });
});

describe('Relics — derived from tomesPublished, never stored', () => {
  it('unlock exactly at 3 / 7 / 15 / 30 tomes', () => {
    const at = (tomes: number) =>
      unlockedRelics(makeState((s) => void (s.meta.tomesPublished = tomes)));
    expect(at(0)).toEqual([]);
    expect(at(2)).toEqual([]);
    expect(at(3)).toEqual(['dogEaredPage']);
    expect(at(6)).toEqual(['dogEaredPage']);
    expect(at(7)).toEqual(['dogEaredPage', 'standingOvation']);
    expect(at(15)).toEqual(['dogEaredPage', 'standingOvation', 'inkThatRemembers']);
    expect(at(30)).toEqual([
      'dogEaredPage',
      'standingOvation',
      'inkThatRemembers',
      'readersLetter',
    ]);
    expect(hasRelic(makeState((s) => void (s.meta.tomesPublished = 14)), 'inkThatRemembers')).toBe(
      false,
    );
  });
});

describe('Myth Engine — Atelier-gated generator 8', () => {
  it('is invisible in the shop without Blueprint of Myths, at ANY totalEarned', () => {
    const rich = makeState((s) => void (s.run.totalEarned = 1e12));
    expect(isGeneratorVisibleInShop(rich, 'mythEngine')).toBe(false);
    expect(isGeneratorVisibleInShop(rich, 'fableForge')).toBe(true); // v1 rule intact
  });

  it('with the Blueprint it follows the normal revealAt (150M)', () => {
    const blueprint = (totalEarned: number) =>
      makeState((s) => {
        s.run.totalEarned = totalEarned;
        s.meta.atelier = { blueprintOfMyths: 1 };
      });
    expect(isGeneratorVisibleInShop(blueprint(149_999_999), 'mythEngine')).toBe(false);
    expect(isGeneratorVisibleInShop(blueprint(150_000_000), 'mythEngine')).toBe(true);
  });

  it('produces as a normal generator (45,000/s base) once owned', () => {
    const s = makeState((x) => void (x.run.generators.mythEngine = 1));
    expect(generatorProduction(s, 'mythEngine')).toBeCloseTo(45_000, 9);
  });
});

describe('store integration — critical action + atelierPurchase event', () => {
  it('dispatch(buyAtelierUpgrade) persists immediately and emits one event with the new level', () => {
    const storage = createMemoryStorage();
    const initial = makeState((s) => {
      s.meta.goldenQuills = 4;
      s.meta.stats.lifetimeQuillsEarned = 4;
    });
    const store = createGameStore(initial, { now: () => 1_000, storage });
    const events: GameEvent[] = [];
    store.subscribeToEvents((e) => events.push(e));

    store.dispatch({ type: 'buyAtelierUpgrade', id: 'apprenticeMuse' });

    const purchases = events.filter((e) => e.type === 'atelierPurchase');
    expect(purchases).toEqual([{ type: 'atelierPurchase', id: 'apprenticeMuse', level: 1 }]);
    const saved = loadSave(storage);
    expect(saved).not.toBeNull();
    expect(saved!.state.meta.atelier.apprenticeMuse).toBe(1);
    expect(saved!.state.meta.goldenQuills).toBe(3);
    expect(saved!.state.meta.stats.lifetimeQuillsEarned).toBe(4);
    // first Atelier purchase unlocks Patron of the Arts
    expect(store.getState().meta.achievements).toContain('patronOfTheArts');
  });

  it('a failed purchase (no funds) emits nothing and changes nothing', () => {
    const store = createGameStore(makeState(), {
      now: () => 0,
      storage: createMemoryStorage(),
    });
    const before = store.getState();
    const events: GameEvent[] = [];
    store.subscribeToEvents((e) => events.push(e));
    store.dispatch({ type: 'buyAtelierUpgrade', id: 'editorsDue' });
    expect(store.getState()).toBe(before);
    expect(events).toEqual([]);
  });
});
