// settings.test.ts — the additive `setSettings` action (added by Agent UI so the
// Buy ×1/×10/×Max toggle and the Reduce motion toggle persist in the save, 04 §4/§13).
// Guarantees: shallow merge into meta.settings only, no other state touched,
// immediate persistence (critical action), survives prestige and save round-trip.

import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGameStore,
  createMemoryStorage,
  loadSave,
  SAVE_KEY,
} from '../../src/engine';
import { makeState } from './helpers';

describe('setSettings action', () => {
  it('merges partial settings without touching anything else', () => {
    const s = makeState((st) => {
      st.run.inspiration = 123;
      st.meta.goldenQuills = 2;
    });
    const next = applyAction(s, { type: 'setSettings', settings: { buyQty: 10 } }, 0);
    expect(next.meta.settings.buyQty).toBe(10);
    expect(next.run).toBe(s.run); // run untouched (same reference)
    expect(next.meta.goldenQuills).toBe(2);
    expect(next.meta.stats).toBe(s.meta.stats);
  });

  it('a second setSettings preserves previously set keys (shallow merge)', () => {
    const s = makeState();
    const a = applyAction(s, { type: 'setSettings', settings: { buyQty: 'max' } }, 0);
    const b = applyAction(a, { type: 'setSettings', settings: { reduceMotion: true } }, 0);
    expect(b.meta.settings.buyQty).toBe('max');
    expect(b.meta.settings.reduceMotion).toBe(true);
  });

  it('persists immediately through the store (critical action)', () => {
    const storage = createMemoryStorage();
    const store = createGameStore(makeState(), { now: () => 1_000, storage });
    store.dispatch({ type: 'setSettings', settings: { buyQty: 10, reduceMotion: true } });
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
    const loaded = loadSave(storage);
    expect(loaded).not.toBeNull();
    expect(loaded!.state.meta.settings.buyQty).toBe(10);
    expect(loaded!.state.meta.settings.reduceMotion).toBe(true);
  });

  it('settings survive prestige (meta persists)', () => {
    const s = makeState((st) => {
      st.run.totalEarned = 400_000;
      st.meta.settings = { buyQty: 10, reduceMotion: true };
    });
    const next = applyAction(s, { type: 'prestige' }, 0);
    expect(next.meta.goldenQuills).toBe(2);
    expect(next.meta.settings).toEqual({ buyQty: 10, reduceMotion: true });
  });

  it('does not disturb milestones/achievements checks (idempotent afterwards)', () => {
    const s = makeState((st) => {
      st.run.totalEarned = 15; // theFirstSpark already implied — normalize first
    });
    const normalized = applyAction(s, { type: 'setSettings', settings: {} }, 0);
    expect(normalized.run.milestones).toContain('theFirstSpark');
    const again = applyAction(normalized, { type: 'setSettings', settings: {} }, 0);
    expect(again.run.milestones).toEqual(normalized.run.milestones);
  });
});
