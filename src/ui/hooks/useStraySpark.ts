// useStraySpark.ts — the shell OWNS all Stray Spark nondeterminism (10 §3.1):
// the spawn timer (visibility-gated), the uniform interval draw from the
// engine's sparkIntervalRange(state), and the reward roll at CLICK time
// (rollSparkKind(Math.random()) → dispatch { type:'collectSpark', kind }).
// Nothing here is persisted: a refresh mid-flight loses the spark (09 §2.3),
// the next-spawn moment is re-drawn on every load, and tab-hidden despawns.
//
// forceSpark(kind?) (10 §4.3) bypasses the timer AND the milestone gate for
// E2E — registered through a module-level bridge used by test-hook.ts.

import { useCallback, useEffect, useRef, useState } from 'react';
import { hasMilestone, rollSparkKind, SPARK, sparkIntervalRange } from '../../engine';
import type { GameStore, SparkRewardKind } from '../../engine';
import { useStore } from './useGameStore';

export interface ActiveSpark {
  /** Monotonic id — keys the DOM node so every spawn re-runs its animation. */
  id: number;
  /** Reward fixed by forceSpark; null = roll normally at collect time. */
  forcedKind: SparkRewardKind | null;
}

export interface StraySparkState {
  spark: ActiveSpark | null;
  /** Collect the active spark (pointerdown/Enter). Rolls the kind, dispatches. */
  collect: () => SparkRewardKind | null;
  /** Remove the active spark without reward (flight ended). */
  despawn: () => void;
}

// ---- test bridge (window.__FABLE_TEST__.forceSpark) ----
let forceHandler: ((kind?: SparkRewardKind) => void) | null = null;

/** Called by the E2E test hook; no-op when the app is not mounted. */
export function invokeForceSpark(kind?: SparkRewardKind): void {
  forceHandler?.(kind);
}

function drawIntervalMs(store: GameStore): number {
  const { minMs, maxMs } = sparkIntervalRange(store.getState());
  return minMs + Math.random() * (maxMs - minMs);
}

export function useStraySpark(): StraySparkState {
  const store = useStore();
  const [spark, setSpark] = useState<ActiveSpark | null>(null);
  const nextId = useRef(1);
  const spawnTimer = useRef<number | null>(null);
  const flightTimer = useRef<number | null>(null);
  const sparkRef = useRef<ActiveSpark | null>(null);
  sparkRef.current = spark;

  const clearSpawnTimer = useCallback(() => {
    if (spawnTimer.current !== null) {
      window.clearTimeout(spawnTimer.current);
      spawnTimer.current = null;
    }
  }, []);

  const clearFlightTimer = useCallback(() => {
    if (flightTimer.current !== null) {
      window.clearTimeout(flightTimer.current);
      flightTimer.current = null;
    }
  }, []);

  const armSpawnTimer = useCallback(() => {
    clearSpawnTimer();
    if (document.visibilityState !== 'visible') return;
    spawnTimer.current = window.setTimeout(() => {
      spawnTimer.current = null;
      if (document.visibilityState !== 'visible') return;
      // Milestone gate is checked at FIRE time (per-run milestone) — if the
      // gate is closed the timer simply re-arms (no spark accumulates).
      if (!hasMilestone(store.getState(), 'aLightAtTheWindow')) {
        armSpawnTimerRef.current();
        return;
      }
      if (sparkRef.current !== null) return; // max 1 on screen
      spawnRef.current(null);
    }, drawIntervalMs(store));
  }, [clearSpawnTimer, store]);

  // Self-references through refs (arm ↔ spawn call each other).
  const armSpawnTimerRef = useRef(armSpawnTimer);
  armSpawnTimerRef.current = armSpawnTimer;

  const despawn = useCallback(() => {
    clearFlightTimer();
    setSpark(null);
    sparkRef.current = null;
    armSpawnTimerRef.current();
  }, [clearFlightTimer]);

  const spawn = useCallback(
    (forcedKind: SparkRewardKind | null) => {
      clearSpawnTimer();
      clearFlightTimer();
      const s: ActiveSpark = { id: nextId.current++, forcedKind };
      sparkRef.current = s;
      setSpark(s);
      // Despawn at the end of the 10s flight (same clock under reduced motion).
      flightTimer.current = window.setTimeout(() => {
        flightTimer.current = null;
        setSpark(null);
        sparkRef.current = null;
        armSpawnTimerRef.current();
      }, SPARK.flightMs);
    },
    [clearFlightTimer, clearSpawnTimer],
  );
  const spawnRef = useRef(spawn);
  spawnRef.current = spawn;

  const collect = useCallback((): SparkRewardKind | null => {
    const active = sparkRef.current;
    if (!active) return null;
    // RNG stays in the shell: the reward is rolled HERE, at click time.
    const kind = active.forcedKind ?? rollSparkKind(Math.random());
    clearFlightTimer();
    setSpark(null);
    sparkRef.current = null;
    store.dispatch({ type: 'collectSpark', kind });
    armSpawnTimerRef.current();
    return kind;
  }, [clearFlightTimer, store]);

  // Visibility gate: hidden → despawn + stop the clock; visible → fresh draw.
  useEffect(() => {
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        clearSpawnTimer();
        clearFlightTimer();
        setSpark(null);
        sparkRef.current = null;
      } else {
        armSpawnTimerRef.current();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    armSpawnTimerRef.current(); // initial arm (visible tab)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearSpawnTimer();
      clearFlightTimer();
    };
  }, [clearFlightTimer, clearSpawnTimer]);

  // Test bridge registration (E2E: forceSpark ignores timer + milestone gate).
  useEffect(() => {
    const handler = (kind?: SparkRewardKind): void => {
      if (document.visibilityState !== 'visible') return; // tab must be visible
      spawnRef.current(kind ?? null);
    };
    forceHandler = handler;
    return () => {
      if (forceHandler === handler) forceHandler = null;
    };
  }, []);

  return { spark, collect, despawn };
}
