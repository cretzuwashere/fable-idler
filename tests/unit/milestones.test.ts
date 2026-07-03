// milestones.test.ts — reveal thresholds #1–11, qty:<gen>:<n> format,
// and the run-scoped reset after prestige (meta stays intact).
import { describe, expect, it } from 'vitest';
import { checkMilestones, publishTheTome, qtyMilestoneId } from '../../src/engine';
import { makeState } from './helpers';

describe('reveal milestones on run totalEarned', () => {
  const cases: [string, number][] = [
    ['theFirstSpark', 10],
    ['whispersInInk', 60],
    ['craftsmansTools', 100],
    ['racingHeart', 500],
    ['aFeatheredFriend', 600],
    ['theQuillStirs', 6_000],
    ['thePublishersLetter', 50_000],
    ['threadsOfNarrative', 65_000],
    ['doorsOfTheLibrary', 700_000],
    ['heatOfCreation', 10_000_000],
  ];

  it.each(cases)('%s unlocks exactly at %d totalEarned', (id, threshold) => {
    const below = checkMilestones(makeState((s) => void (s.run.totalEarned = threshold - 1)));
    expect(below.run.milestones).not.toContain(id);
    const at = checkMilestones(makeState((s) => void (s.run.totalEarned = threshold)));
    expect(at.run.milestones).toContain(id);
  });

  it('hallOfDeeds unlocks on the first achievement, not on totalEarned', () => {
    const rich = checkMilestones(makeState((s) => void (s.run.totalEarned = 10_000_000)));
    expect(rich.run.milestones).not.toContain('hallOfDeeds');
    const withAch = checkMilestones(
      makeState((s) => void (s.meta.achievements = ['firstWords'])),
    );
    expect(withAch.run.milestones).toContain('hallOfDeeds');
  });

  it('all 10 totalEarned milestones present at 10M', () => {
    const s = checkMilestones(makeState((x) => void (x.run.totalEarned = 10_000_000)));
    for (const [id] of cases) expect(s.run.milestones).toContain(id);
  });
});

describe('quantity milestones', () => {
  it('uses the qty:<generatorId>:<threshold> id format', () => {
    expect(qtyMilestoneId('inkSprite', 25)).toBe('qty:inkSprite:25');
    const s = checkMilestones(
      makeState((x) => void (x.run.generators.wanderingMuse = 25)),
    );
    expect(s.run.milestones).toContain('qty:wanderingMuse:25');
    expect(s.run.milestones).not.toContain('qty:wanderingMuse:50');
  });

  it('records every crossed threshold (25/50/100)', () => {
    const s = checkMilestones(
      makeState((x) => void (x.run.generators.talkingRaven = 100)),
    );
    expect(s.run.milestones).toContain('qty:talkingRaven:25');
    expect(s.run.milestones).toContain('qty:talkingRaven:50');
    expect(s.run.milestones).toContain('qty:talkingRaven:100');
  });

  it('24 owned unlocks nothing', () => {
    const s = makeState((x) => void (x.run.generators.wanderingMuse = 24));
    expect(checkMilestones(s)).toBe(s); // same reference — no change
  });
});

describe('idempotence and prestige reset', () => {
  it('returns the same reference when nothing new is reached', () => {
    const once = checkMilestones(makeState((s) => void (s.run.totalEarned = 700)));
    const twice = checkMilestones(once);
    expect(twice).toBe(once);
  });

  it('prestige clears run milestones (they are re-earned next run), meta stays', () => {
    const s = checkMilestones(
      makeState((x) => {
        x.run.totalEarned = 150_000;
        x.run.generators.wanderingMuse = 30;
        x.meta.achievements = ['firstWords'];
      }),
    );
    expect(s.run.milestones.length).toBeGreaterThan(5);
    const after = publishTheTome(s, 0);
    expect(after.run.milestones).toEqual([]);
    expect(after.meta.achievements).toEqual(['firstWords']); // meta intact
    // fresh run re-earns them as thresholds are crossed again
    const rerun = checkMilestones({
      ...after,
      run: { ...after.run, totalEarned: 10 },
    });
    expect(rerun.run.milestones).toEqual(['theFirstSpark', 'hallOfDeeds']);
  });
});
