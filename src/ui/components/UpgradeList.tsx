// UpgradeList + UpgradeCard (04 §4.7).
// Cards appear ONLY once their unlock condition holds (hidden ≠ disabled).
// States: affordable (grow border + glow) / expensive (ink border, muted cost)
// / purchased (collapsed "Purchased (N)" section, desaturated, gold ✓).
// Quill Resonance is the single violet-bordered card.

import { useEffect, useRef, useState } from 'react';
import { formatNumber, hasUpgrade, isUpgradeUnlocked, UPGRADES } from '../../engine';
import type { GameState, UpgradeConfig } from '../../engine';
import { useDispatch } from '../hooks/useGameStore';
import { ICON, UPGRADE_ICONS } from '../icons';
import { IconCoin } from './IconCoin';
import './UpgradeList.css';

export function UpgradeList({ state }: { state: GameState }) {
  const available = UPGRADES.filter((u) => !hasUpgrade(state, u.id) && isUpgradeUnlocked(state, u.id));
  const purchased = UPGRADES.filter((u) => hasUpgrade(state, u.id));
  const [showPurchased, setShowPurchased] = useState(false);

  return (
    <section className="upgrade-list" aria-label="Upgrades">
      {available.length === 0 && purchased.length === 0 && (
        <p className="upgrade-list__empty">Nothing on the workbench yet — keep weaving.</p>
      )}
      {available.length === 0 && purchased.length > 0 && (
        <p className="upgrade-list__empty">The workbench is clear. New tools will present themselves.</p>
      )}
      <div className="upgrade-list__grid">
        {available.map((u) => (
          <UpgradeCard key={u.id} state={state} config={u} />
        ))}
      </div>
      {purchased.length > 0 && (
        <div className="upgrade-list__purchased">
          <button
            type="button"
            className="upgrade-list__purchased-toggle"
            aria-expanded={showPurchased}
            onClick={() => setShowPurchased((v) => !v)}
            data-testid="upgrades-purchased-toggle"
          >
            <span className={`upgrade-list__chevron${showPurchased ? ' is-open' : ''}`} aria-hidden="true">
              ▸
            </span>
            Purchased ({purchased.length})
          </button>
          {showPurchased && (
            <div className="upgrade-list__grid" data-testid="upgrades-purchased">
              {purchased.map((u) => (
                <PurchasedCard key={u.id} config={u} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function UpgradeCard({ state, config }: { state: GameState; config: UpgradeConfig }) {
  const dispatch = useDispatch();
  const affordable = state.run.inspiration >= config.cost;
  const isQuill = config.id === 'quillResonance';

  // pulse on the expensive→affordable transition, stop after hover (04 §5 #4)
  const prevAffordable = useRef(affordable);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (affordable && !prevAffordable.current) setPulse(true);
    if (!affordable) setPulse(false);
    prevAffordable.current = affordable;
  }, [affordable]);

  return (
    <button
      type="button"
      className={`upgrade-card anim-reveal-in${affordable ? ' upgrade-card--affordable' : ' upgrade-card--expensive'}${
        isQuill ? ' upgrade-card--quill' : ''
      }${pulse ? ' anim-pulse-affordable' : ''}`}
      disabled={!affordable}
      onClick={() => dispatch({ type: 'buyUpgrade', id: config.id })}
      onMouseEnter={() => setPulse(false)}
      data-testid={`upgrade-${config.id}`}
    >
      <IconCoin emoji={UPGRADE_ICONS[config.id]} small />
      <span className="upgrade-card__body">
        <span className="upgrade-card__name">{config.name}</span>
        <span className="upgrade-card__desc">{config.description}</span>
        <span className="upgrade-card__cost num">
          <span aria-hidden="true">{ICON.inspiration}</span> {formatNumber(config.cost)}
        </span>
      </span>
    </button>
  );
}

function PurchasedCard({ config }: { config: UpgradeConfig }) {
  return (
    <div
      className={`upgrade-card upgrade-card--purchased${
        config.id === 'quillResonance' ? ' upgrade-card--quill' : ''
      }`}
      data-testid={`upgrade-${config.id}`}
    >
      <IconCoin emoji={UPGRADE_ICONS[config.id]} small />
      <span className="upgrade-card__body">
        <span className="upgrade-card__name">
          {config.name} <span className="upgrade-card__check" aria-label="purchased">✓</span>
        </span>
        <span className="upgrade-card__desc">{config.description}</span>
      </span>
    </div>
  );
}
