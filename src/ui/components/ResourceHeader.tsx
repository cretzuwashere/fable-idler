// ResourceHeader (04 §4.1) — ✨ + current Inspiration (display font, gold-bright)
// + "+X/sec" below. States: normal / buff-active (ember pulse) / milestone-shimmer
// (900ms shimmerGold each time a milestone unlocks — driven by App via shimmerNonce).

import { useEffect, useState } from 'react';
import { formatNumber, formatRate, isBuffActive, perSecond } from '../../engine';
import type { GameState } from '../../engine';
import { ICON } from '../icons';
import { IconCoin } from './IconCoin';
import './ResourceHeader.css';

interface ResourceHeaderProps {
  state: GameState;
  /** Increments on every milestone unlock; retriggers the shimmer. */
  shimmerNonce: number;
  compact?: boolean;
}

export function ResourceHeader({ state, shimmerNonce, compact }: ResourceHeaderProps) {
  const now = state.lastTickAt;
  const buffed = isBuffActive(state, now);
  const rate = perSecond(state, now);

  const [shimmering, setShimmering] = useState(false);
  useEffect(() => {
    if (shimmerNonce > 0) setShimmering(true);
  }, [shimmerNonce]);

  return (
    <div className={compact ? 'resource-header resource-header--compact' : 'resource-header'}>
      <div className="resource-header__amount-row">
        <IconCoin emoji={ICON.inspiration} small={compact} />
        <span
          className={`resource-header__amount num${shimmering ? ' anim-shimmer-gold' : ''}`}
          onAnimationEnd={() => setShimmering(false)}
          data-testid="inspiration-amount"
        >
          {formatNumber(state.run.inspiration)}
        </span>
      </div>
      <div
        className={`resource-header__rate num${buffed ? ' resource-header__rate--buff anim-ember-pulse' : ''}`}
        data-testid="per-second"
      >
        {buffed && <span aria-hidden="true">{ICON.inspiration} </span>}+{formatRate(rate)}/sec
      </div>
    </div>
  );
}
