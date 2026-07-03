// click.test.ts — click value per 03 §3:
// clickValue = 1 ×2(nib) ×(1+0.30q)(resonance) ×5(buff) + 0.01·effectiveProd (Ink Echo)
// The Ink Echo part is NEVER multiplied by the buff ×5 (production already has ×2).
import { describe, expect, it } from 'vitest';
import { applyAction, clickPower } from '../../src/engine';
import { makeState } from './helpers';

describe('clickPower', () => {
  it('base click is worth exactly 1', () => {
    expect(clickPower(makeState(), 0)).toBe(1);
  });

  it('Sharpened Nib doubles it', () => {
    const s = makeState((x) => void (x.run.upgrades.sharpenedNib = true));
    expect(clickPower(s, 0)).toBe(2);
  });

  it('buff multiplies the base part by 5', () => {
    const s = makeState((x) => void (x.run.buff.activeUntil = 1_000));
    expect(clickPower(s, 0)).toBe(5);
    const nib = makeState((x) => {
      x.run.buff.activeUntil = 1_000;
      x.run.upgrades.sharpenedNib = true;
    });
    expect(clickPower(nib, 0)).toBe(10);
    expect(clickPower(nib, 1_000)).toBe(2); // expired at activeUntil
  });

  it('Quill Resonance applies the quill bonus to the click', () => {
    const withRes = makeState((x) => {
      x.meta.goldenQuills = 2;
      x.meta.quillResonance = true;
    });
    expect(clickPower(withRes, 0)).toBeCloseTo(1.6, 12); // 1 · (1 + 0.30·2)
    const withoutRes = makeState((x) => void (x.meta.goldenQuills = 2));
    expect(clickPower(withoutRes, 0)).toBe(1); // quills alone do NOT boost the click
  });

  it('Ink Echo adds 1% of effective production per second', () => {
    const s = makeState((x) => {
      x.run.generators.inkSprite = 10; // 10/s
      x.run.upgrades.inkEcho = true;
    });
    expect(clickPower(s, 0)).toBeCloseTo(1.1, 12); // 1 + 0.01·10
  });

  it('Ink Echo does NOT take the ×5 click multiplier under buff (03 §3 rule)', () => {
    const s = makeState((x) => {
      x.run.generators.inkSprite = 10; // 10/s without buff, 20/s with buff
      x.run.upgrades.inkEcho = true;
      x.run.buff.activeUntil = 1_000;
    });
    // base 1 ×5 = 5; echo = 0.01 · 20 = 0.2 → 5.2 (NOT 1·5 + 0.01·20·5 = 6)
    expect(clickPower(s, 0)).toBeCloseTo(5.2, 12);
  });

  it('all click multipliers stack per the 03 §3 formula', () => {
    const s = makeState((x) => {
      x.run.upgrades.sharpenedNib = true;
      x.run.upgrades.inkEcho = true;
      x.meta.quillResonance = true;
      x.meta.goldenQuills = 1;
      x.run.generators.inkSprite = 10;
      x.run.buff.activeUntil = 1_000;
    });
    // base = 1·2·1.3·5 = 13; prod = 10·1.3(quills)·2(buff) = 26 → echo 0.26 → 13.26
    expect(clickPower(s, 0)).toBeCloseTo(13.26, 9);
  });
});

describe('click action', () => {
  it('credits inspiration, totalEarned, lifetime stats and the click counter', () => {
    const s = makeState((x) => void (x.run.upgrades.sharpenedNib = true));
    const after = applyAction(s, { type: 'click' }, 0);
    expect(after.run.inspiration).toBe(2);
    expect(after.run.totalEarned).toBe(2);
    expect(after.meta.stats.lifetimeInspiration).toBe(2);
    expect(after.meta.stats.totalClicks).toBe(1);
  });

  it('first click unlocks the First Words achievement', () => {
    const after = applyAction(makeState(), { type: 'click' }, 0);
    expect(after.meta.achievements).toContain('firstWords');
  });
});
