// BuffButton — Moment of Inspiration (04 §4.4). Pill with 💡 under the click
// button. States: ready (ember border, slow pulse) / active (ember bg, "12s",
// ring = remaining duration) / cooldown (desaturated, conic ring filling, "54s")
// / locked (NOT rendered until Racing Heart). The ring is a conic-gradient on
// ::before whose percentage is set from the game tick — never a CSS animation.

import type { CSSProperties } from 'react';
import {
  buffCooldownMs,
  buffCooldownRemainingMs,
  buffDurationMs,
  buffRemainingMs,
  canActivateBuff,
  isBuffActive,
  isBuffUnlocked,
} from '../../engine';
import type { GameState } from '../../engine';
import { useDispatch } from '../hooks/useGameStore';
import { ICON } from '../icons';
import './BuffButton.css';

export function BuffButton({ state }: { state: GameState }) {
  const dispatch = useDispatch();
  const now = state.lastTickAt;

  if (!isBuffUnlocked(state)) return null; // locked: not rendered at all

  const active = isBuffActive(state, now);
  const cooldownMs = buffCooldownRemainingMs(state, now);
  const ready = canActivateBuff(state, now);

  let mode: 'ready' | 'active' | 'cooldown';
  let ringPct: number;
  let label: string;
  if (active) {
    mode = 'active';
    const remaining = buffRemainingMs(state, now);
    // v2: a Standing Ovation window can be 2× the plain duration — the ring
    // still starts full and drains monotonically (denominator adapts).
    ringPct = (remaining / Math.max(buffDurationMs(state), remaining)) * 100;
    label = `${Math.ceil(remaining / 1000)}s`;
  } else if (!ready) {
    mode = 'cooldown';
    // v2: Restless Heart shortens the cooldown (90/75/60s) — read the live one.
    ringPct = (1 - cooldownMs / buffCooldownMs(state)) * 100;
    label = `${Math.ceil(cooldownMs / 1000)}s`;
  } else {
    mode = 'ready';
    ringPct = 100;
    label = 'Moment of Inspiration';
  }

  const style = { '--ring': `${Math.max(0, Math.min(100, ringPct))}%` } as CSSProperties;

  return (
    <button
      type="button"
      className={`buff-button buff-button--${mode} anim-reveal-in${mode === 'ready' ? ' buff-button--pulse' : ''}`}
      style={style}
      disabled={!ready}
      onClick={() => dispatch({ type: 'activateBuff' })}
      data-testid="buff-button"
      aria-label={
        mode === 'ready'
          ? 'Activate Moment of Inspiration'
          : mode === 'active'
            ? `Moment of Inspiration active, ${label} left`
            : `Moment of Inspiration on cooldown, ${label}`
      }
    >
      <span className="buff-button__ring" aria-hidden="true" />
      <span className="buff-button__icon icon-coin icon-coin--sm" aria-hidden="true">
        {ICON.buff}
      </span>
      <span className={`buff-button__label${mode !== 'ready' ? ' num' : ''}`}>{label}</span>
    </button>
  );
}
