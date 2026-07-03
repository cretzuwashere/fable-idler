// achievements.test.ts — every condition fires exactly once, the global bonus
// shows up in production, and achievements survive prestige (meta state).
import { describe, expect, it } from 'vitest';
import {
  checkAchievements,
  perSecondNoBuff,
  publishTheTome,
} from '../../src/engine';
import type { AchievementId, GameState } from '../../src/engine';
import { makeState } from './helpers';

function unlockedIds(state: GameState): readonly AchievementId[] {
  return checkAchievements(state, 0).meta.achievements;
}

describe('conditions (01 §6.1)', () => {
  it('firstWords: first click', () => {
    expect(unlockedIds(makeState((s) => void (s.meta.stats.totalClicks = 1)))).toContain(
      'firstWords',
    );
    expect(unlockedIds(makeState())).not.toContain('firstWords');
  });

  it('storytellerAwakens: first generator of any type', () => {
    const s = makeState((x) => void (x.run.generators.talkingRaven = 1));
    expect(unlockedIds(s)).toContain('storytellerAwakens');
  });

  it('busyFingers: 1,000 total clicks', () => {
    expect(
      unlockedIds(makeState((s) => void (s.meta.stats.totalClicks = 999))),
    ).not.toContain('busyFingers');
    expect(unlockedIds(makeState((s) => void (s.meta.stats.totalClicks = 1_000)))).toContain(
      'busyFingers',
    );
  });

  it('whisperedLegends / aThousandTales: lifetime inspiration 1k / 100k', () => {
    const ids = unlockedIds(
      makeState((s) => void (s.meta.stats.lifetimeInspiration = 100_000)),
    );
    expect(ids).toContain('whisperedLegends');
    expect(ids).toContain('aThousandTales');
  });

  it('hoarderOfIdeas: 1,000,000 held at once', () => {
    expect(unlockedIds(makeState((s) => void (s.run.inspiration = 1_000_000)))).toContain(
      'hoarderOfIdeas',
    );
    expect(
      unlockedIds(makeState((s) => void (s.run.inspiration = 999_999))),
    ).not.toContain('hoarderOfIdeas');
  });

  it('museMenagerie / fullAviary: 25 muses / 25 ravens', () => {
    expect(
      unlockedIds(makeState((s) => void (s.run.generators.wanderingMuse = 25))),
    ).toContain('museMenagerie');
    expect(
      unlockedIds(makeState((s) => void (s.run.generators.talkingRaven = 25))),
    ).toContain('fullAviary');
  });

  it('wellRoundedLibrary: at least one of each of the 7 generators', () => {
    const all = makeState((s) => {
      for (const id of Object.keys(s.run.generators) as (keyof typeof s.run.generators)[]) {
        s.run.generators[id] = 1;
      }
    });
    expect(unlockedIds(all)).toContain('wellRoundedLibrary');
    const missingOne = makeState((s) => {
      for (const id of Object.keys(s.run.generators) as (keyof typeof s.run.generators)[]) {
        s.run.generators[id] = 1;
      }
      s.run.generators.fableForge = 0;
    });
    expect(unlockedIds(missingOne)).not.toContain('wellRoundedLibrary');
  });

  it('industrialFiction: 1,000 Inspiration/sec', () => {
    const s = makeState((x) => void (x.run.generators.dreamLibrary = 1)); // 1400/s
    expect(unlockedIds(s)).toContain('industrialFiction');
  });

  it('nightShift: 1,000+ Inspiration from one offline return', () => {
    const s = makeState((x) => void (x.meta.stats.bestSingleOfflineGain = 1_000));
    expect(unlockedIds(s)).toContain('nightShift');
  });

  it('momentSeizer: 10 buff activations', () => {
    const s = makeState((x) => void (x.meta.stats.buffActivations = 10));
    expect(unlockedIds(s)).toContain('momentSeizer');
  });

  it('publishedAuthor / serialNovelist: 1 / 3 tomes', () => {
    const one = unlockedIds(makeState((s) => void (s.meta.tomesPublished = 1)));
    expect(one).toContain('publishedAuthor');
    expect(one).not.toContain('serialNovelist');
    const three = unlockedIds(makeState((s) => void (s.meta.tomesPublished = 3)));
    expect(three).toContain('serialNovelist');
  });
});

describe('unlock mechanics', () => {
  it('each achievement triggers exactly once (idempotent re-check)', () => {
    const s = makeState((x) => void (x.meta.stats.totalClicks = 5));
    const once = checkAchievements(s, 0);
    expect(once.meta.achievements).toEqual(['firstWords']);
    const twice = checkAchievements(once, 0);
    expect(twice).toBe(once); // same reference — nothing new
    expect(twice.meta.achievements).toHaveLength(1);
  });

  it('the global bonus is reflected in production (+1% each)', () => {
    const zero = makeState((x) => void (x.run.generators.inkSprite = 10));
    expect(perSecondNoBuff(zero)).toBeCloseTo(10, 12);
    const one = makeState((x) => {
      x.run.generators.inkSprite = 10;
      x.meta.achievements = ['firstWords'];
    });
    expect(perSecondNoBuff(one)).toBeCloseTo(10.1, 12);
  });

  it('achievements persist through prestige (meta state)', () => {
    const s = makeState((x) => {
      x.run.totalEarned = 200_000;
      x.meta.achievements = ['firstWords', 'whisperedLegends', 'aThousandTales'];
    });
    const after = publishTheTome(s, 0);
    expect(after.meta.achievements).toEqual([
      'firstWords',
      'whisperedLegends',
      'aThousandTales',
    ]);
  });
});
