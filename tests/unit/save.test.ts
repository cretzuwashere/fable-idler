// save.test.ts — round-trip, base64 export/import, corruption fallback with
// backup, unknown version rejection, the migration mechanism, and the store's
// persistence side effects (autosave-on-critical-action, hard reset).
import { describe, expect, it } from 'vitest';
import {
  applyMigrations,
  BUFF,
  createGameStore,
  createInitialState,
  createMemoryStorage,
  exportSave,
  importSaveString,
  loadSave,
  parseSave,
  persistSave,
  SAVE_BACKUP_KEY,
  SAVE_KEY,
  serializeState,
} from '../../src/engine';
import type { GameState, Migration } from '../../src/engine';
import { makeState } from './helpers';

function richState(): GameState {
  return makeState((s) => {
    s.run.inspiration = 1234.5678;
    s.run.totalEarned = 98_765.4321;
    s.run.generators.wanderingMuse = 42;
    s.run.generators.storyLoom = 3;
    s.run.upgrades.sharpenedNib = true;
    s.run.upgrades.patronsFavor = true;
    s.run.milestones = ['theFirstSpark', 'qty:wanderingMuse:25'];
    s.run.buff = { activeUntil: 111, cooldownUntil: 222 };
    s.meta.goldenQuills = 7;
    s.meta.tomesPublished = 2;
    s.meta.achievements = ['firstWords', 'publishedAuthor'];
    s.meta.quillResonance = true;
    s.meta.stats.totalClicks = 999;
    s.meta.stats.lifetimeInspiration = 5e6;
    s.meta.stats.bestSingleOfflineGain = 44_000;
    s.meta.settings = { buyQty: 'max', reduceMotion: true };
  });
}

describe('serialize / parse round-trip', () => {
  it('deserialize(serialize(s)) preserves run and meta exactly', () => {
    const s = richState();
    const data = parseSave(serializeState(s, 555));
    expect(data).not.toBeNull();
    expect(data!.savedAt).toBe(555);
    expect(data!.run).toEqual(s.run);
    expect(data!.meta).toEqual(s.meta);
  });

  it('persistSave → loadSave round-trips through storage', () => {
    const storage = createMemoryStorage();
    const s = richState();
    persistSave(storage, s, 987);
    const loaded = loadSave(storage);
    expect(loaded).not.toBeNull();
    expect(loaded!.savedAt).toBe(987);
    expect(loaded!.state.run).toEqual(s.run);
    expect(loaded!.state.meta).toEqual(s.meta);
    expect(loaded!.state.lastTickAt).toBe(987); // anchored at savedAt for offline calc
  });

  it('loadSave returns null on an empty storage', () => {
    expect(loadSave(createMemoryStorage())).toBeNull();
  });
});

describe('export / import (base64)', () => {
  it('round-trips through the base64 export string', () => {
    const s = richState();
    const exported = exportSave(s, 123);
    expect(exported).not.toContain('{'); // actually encoded
    const imported = importSaveString(exported);
    expect(imported).not.toBeNull();
    expect(imported!.state.run).toEqual(s.run);
    expect(imported!.state.meta).toEqual(s.meta);
  });

  it('accepts surrounding whitespace and rejects garbage', () => {
    const exported = exportSave(richState(), 1);
    expect(importSaveString(`  ${exported}\n`)).not.toBeNull();
    expect(importSaveString('definitely-not-a-save')).toBeNull();
    expect(importSaveString('')).toBeNull();
  });
});

describe('corruption guard — load never crashes', () => {
  it('unparseable JSON → null + raw payload moved to the backup key', () => {
    const storage = createMemoryStorage();
    storage.setItem(SAVE_KEY, '{not json at all%%%');
    expect(loadSave(storage)).toBeNull();
    expect(storage.getItem(SAVE_BACKUP_KEY)).toBe('{not json at all%%%');
    expect(storage.getItem(SAVE_KEY)).toBeNull(); // moved, not duplicated
  });

  it('valid JSON with a broken shape → null + backup', () => {
    const storage = createMemoryStorage();
    const bad = JSON.stringify({
      version: 1,
      savedAt: 1,
      run: { inspiration: 'lots', totalEarned: 5, generators: {} },
      meta: { goldenQuills: 0, tomesPublished: 0 },
    });
    storage.setItem(SAVE_KEY, bad);
    expect(loadSave(storage)).toBeNull();
    expect(storage.getItem(SAVE_BACKUP_KEY)).toBe(bad);
  });

  it('unknown future version → rejected safely', () => {
    expect(
      parseSave(JSON.stringify({ version: 99, savedAt: 1, run: {}, meta: {} })),
    ).toBeNull();
  });

  it('non-finite numbers are rejected', () => {
    const s = richState();
    const json = serializeState(s, 1).replace('1234.5678', '1e999'); // Infinity after parse
    expect(parseSave(json)).toBeNull();
  });
});

describe('import sanitization — states the engine itself cannot produce', () => {
  /** Serialize richState at savedAt=555, apply a hostile mutation, re-parse. */
  function tampered(mutate: (json: ReturnType<typeof JSON.parse>) => void) {
    const json = JSON.parse(serializeState(richState(), 555));
    mutate(json);
    return parseSave(JSON.stringify(json));
  }

  it('deduplicates meta.achievements (duplicates would inflate the global multiplier forever)', () => {
    const data = tampered((j) => {
      j.meta.achievements = ['firstWords', 'firstWords', 'publishedAuthor', 'firstWords'];
    });
    expect(data).not.toBeNull();
    expect(data!.meta.achievements).toEqual(['firstWords', 'publishedAuthor']);
  });

  it('deduplicates run.milestones', () => {
    const data = tampered((j) => {
      j.run.milestones = ['theFirstSpark', 'theFirstSpark', 'qty:wanderingMuse:25'];
    });
    expect(data!.run.milestones).toEqual(['theFirstSpark', 'qty:wanderingMuse:25']);
  });

  it('clamps buff timestamps to what the engine could have written at savedAt', () => {
    // activeUntil = year ~287,000 → would mean a permanent ×2/×5 buff.
    const data = tampered((j) => {
      j.run.buff = { activeUntil: 9e15, cooldownUntil: 9e15 };
    });
    expect(data!.run.buff.activeUntil).toBe(555 + BUFF.durationUpgradedMs);
    expect(data!.run.buff.cooldownUntil).toBe(555 + BUFF.cooldownMs);
  });

  it('legitimate buff timestamps survive the clamp untouched', () => {
    const data = tampered(() => {});
    expect(data!.run.buff).toEqual({ activeUntil: 111, cooldownUntil: 222 });
  });

  it('repairs inspiration > totalEarned by lifting totalEarned (invariant: balance ≤ run earnings)', () => {
    const data = tampered((j) => {
      j.run.inspiration = 1e9;
      j.run.totalEarned = 5_000;
    });
    // Balance is never destroyed (a legacy migration may only know the
    // balance); the invariant is restored on the other side.
    expect(data!.run.inspiration).toBe(1e9);
    expect(data!.run.totalEarned).toBe(1e9);
  });
});

describe('migration mechanism', () => {
  it('applies the chain until the current version', () => {
    const v0 = { version: 0, savedAt: 10, legacyRun: { inspiration: 50 } };
    const migrations: Record<number, Migration> = {
      0: (old) => {
        const o = old as { savedAt: number; legacyRun: { inspiration: number } };
        const fresh = createInitialState(o.savedAt);
        return {
          version: 1,
          savedAt: o.savedAt,
          run: { ...fresh.run, inspiration: o.legacyRun.inspiration },
          meta: fresh.meta,
        };
      },
    };
    const migrated = applyMigrations(v0, migrations);
    const data = parseSave(JSON.stringify(migrated), migrations);
    expect(data).not.toBeNull();
    expect(data!.run.inspiration).toBe(50);
  });

  it('a version with no migration path is left as-is and then rejected', () => {
    const v0 = { version: 0, savedAt: 10 };
    expect(applyMigrations(v0, {})).toBe(v0);
    expect(parseSave(JSON.stringify(v0), {})).toBeNull();
  });
});

describe('store persistence side effects', () => {
  it('critical actions (buyUpgrade) persist immediately', () => {
    const storage = createMemoryStorage();
    const initial = makeState((s) => {
      s.run.inspiration = 500;
      s.run.totalEarned = 500; // sharpenedNib unlocked (≥ 50)
    });
    const store = createGameStore(initial, { now: () => 1_000, storage });
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    store.dispatch({ type: 'buyUpgrade', id: 'sharpenedNib' });
    const saved = loadSave(storage);
    expect(saved).not.toBeNull();
    expect(saved!.state.run.upgrades.sharpenedNib).toBe(true);
    expect(saved!.state.run.inspiration).toBe(400);
  });

  it('importSave replaces the state through dispatch', () => {
    const storage = createMemoryStorage();
    const store = createGameStore(createInitialState(0), { now: () => 5_000, storage });
    const exported = exportSave(richState(), 100);
    store.dispatch({ type: 'importSave', data: exported });
    expect(store.getState().run.generators.wanderingMuse).toBe(42);
    expect(store.getState().lastTickAt).toBe(5_000); // re-anchored at import time
  });

  it('an invalid import is a harmless no-op', () => {
    // fresh state = nothing pending in milestone/achievement checks,
    // so the state reference must stay identical
    const store = createGameStore(createInitialState(0), {
      now: () => 0,
      storage: createMemoryStorage(),
    });
    const before = store.getState();
    store.dispatch({ type: 'importSave', data: 'garbage!!!' });
    expect(store.getState()).toBe(before);
  });

  it('hardReset with confirm wipes the save key and the in-memory state (quills included)', () => {
    const storage = createMemoryStorage();
    const store = createGameStore(richState(), { now: () => 42, storage });
    store.save();
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
    store.dispatch({ type: 'hardReset', confirm: true });
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(store.getState().run.inspiration).toBe(0);
    expect(store.getState().meta.goldenQuills).toBe(0);
    expect(store.getState().meta.quillResonance).toBe(false);
    expect(store.getState().meta.achievements).toEqual([]);
    expect(store.getState().lastTickAt).toBe(42);
  });

  it('hardReset WITHOUT confirm is a guaranteed no-op — save and state untouched', () => {
    const storage = createMemoryStorage();
    const store = createGameStore(richState(), { now: () => 42, storage });
    store.save();
    const savedRaw = storage.getItem(SAVE_KEY);
    const before = store.getState();
    // The Action type requires confirm: true; simulate a raw runtime caller
    // (E2E hook / console) dispatching without it.
    store.dispatch({ type: 'hardReset' } as unknown as Parameters<typeof store.dispatch>[0]);
    expect(store.getState()).toBe(before);
    expect(storage.getItem(SAVE_KEY)).toBe(savedRaw);
    expect(store.getState().meta.goldenQuills).toBe(7);
  });
});
