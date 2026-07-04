// AtelierPanel (12 §2–§3) — "The Gilded Atelier": the Golden Quill shop.
// Violet meta panel with the GOLDEN RULE made visible: a sticky double-balance
// header (Purse spends, Lifetime never moves) + the permanent anti-fear
// microcopy. Cards: affordable / expensive (with "Need N more 🪶") /
// leveled-partial (pips) / maxed ("Fully Commissioned" collapsed section).
// Purchases ≥ 10 🪶 require a confirmation dialog. Below the upgrades:
// "Relics of the Published" — 4 always-visible slots derived from tomes.

import { useEffect, useRef, useState } from 'react';
import {
  ATELIER_UPGRADES,
  atelierLevel,
  atelierMaxLevel,
  atelierNextCost,
  canBuyAtelierUpgrade,
  formatNumber,
  hasRelic,
  QUILL_BONUS,
  RELICS,
} from '../../engine';
import type { AtelierUpgradeConfig, GameState, RelicConfig } from '../../engine';
import { useDispatch } from '../hooks/useGameStore';
import { ATELIER_ICONS, ICON, RELIC_ICONS } from '../icons';
import { ATELIER_CONFIRM_THRESHOLD_QUILLS } from '../meta';
import { IconCoin } from './IconCoin';
import { Modal } from './Modal';
import { ProgressBar } from './ProgressBar';
import { Tooltip } from './Tooltip';
import './AtelierPanel.css';

/** "two more bind a golden quill" — librarian numbers, not digits (12 §2.1). */
const NUMBER_WORDS = ['five', 'four', 'three', 'two', 'one'] as const;

export function AtelierPanel({ state }: { state: GameState }) {
  const dispatch = useDispatch();
  const wallet = state.meta.goldenQuills;
  const lifetime = state.meta.stats.lifetimeQuillsEarned;
  const fragments = state.meta.storyFragments;

  // walletSpend (#23) on the panel purse when the wallet DECREASES.
  const prevWallet = useRef(wallet);
  const [spendNonce, setSpendNonce] = useState(0);
  useEffect(() => {
    if (wallet < prevWallet.current) setSpendNonce((n) => n + 1);
    prevWallet.current = wallet;
  }, [wallet]);

  // Confirmation dialog for purchases ≥ 10 🪶 (threshold lives in ui/meta.ts).
  const [confirming, setConfirming] = useState<AtelierUpgradeConfig | null>(null);

  const buy = (config: AtelierUpgradeConfig): void => {
    const cost = atelierNextCost(state, config.id);
    if (cost === null || !canBuyAtelierUpgrade(state, config.id)) return;
    if (cost >= ATELIER_CONFIRM_THRESHOLD_QUILLS) {
      setConfirming(config);
      return;
    }
    dispatch({ type: 'buyAtelierUpgrade', id: config.id });
  };

  const confirmBuy = (): void => {
    if (confirming) dispatch({ type: 'buyAtelierUpgrade', id: confirming.id });
    setConfirming(null);
  };

  const active = ATELIER_UPGRADES.filter(
    (u) => atelierLevel(state, u.id) < atelierMaxLevel(u.id),
  );
  const maxed = ATELIER_UPGRADES.filter(
    (u) => atelierLevel(state, u.id) >= atelierMaxLevel(u.id),
  );
  const [showMaxed, setShowMaxed] = useState(false);

  const remaining = 5 - fragments;
  const remainingWord = NUMBER_WORDS[fragments] ?? 'five';
  const confirmCost = confirming ? atelierNextCost(state, confirming.id) : null;

  return (
    <section className="atelier-panel" data-testid="atelier-panel" aria-label="The Gilded Atelier">
      <div className="atelier-panel__sticky">
        <header className="panel-header atelier-panel__head">
          <h3 className="panel-header__title panel-header__title--quill">
            The Gilded Atelier <span aria-hidden="true">{ICON.goldenQuills}</span>
          </h3>
        </header>
        <p className="atelier-panel__subtitle">
          Spend your quills on wonders. Your renown is not for sale — every quill you&apos;ve{' '}
          <em>earned</em> keeps its +{Math.round(QUILL_BONUS * 100)}%, forever.
        </p>
        <div className="atelier-balances">
          <div className="atelier-balances__purse">
            <span className="atelier-balances__label">Purse</span>
            <span
              key={spendNonce}
              className={`atelier-balances__purse-value num${spendNonce > 0 ? ' anim-wallet-spend' : ''}`}
              data-testid="atelier-purse"
            >
              {formatNumber(wallet)} <span aria-hidden="true">{ICON.goldenQuills}</span>
            </span>
          </div>
          <div className="atelier-balances__lifetime">
            <span className="atelier-balances__label">Lifetime earned</span>
            <span className="atelier-balances__lifetime-value num" data-testid="atelier-lifetime">
              {formatNumber(lifetime)} <span aria-hidden="true">{ICON.goldenQuills}</span>
            </span>
            <span className="atelier-balances__lifetime-note num">
              → +{Math.round(lifetime * QUILL_BONUS * 100)}% production, forever.
            </span>
          </div>
        </div>
        {/* Permanent anti-fear microcopy — NOT a tooltip (12 §2.1). */}
        <p className="atelier-panel__golden-rule">
          Spending from your purse never touches your renown.
        </p>
        <p className="atelier-panel__fragments num" data-testid="atelier-fragments">
          <span aria-hidden="true">{ICON.fragments}</span> Story Fragments: {fragments}/5
          {' · '}
          {remaining === 1
            ? 'one more binds a golden quill'
            : `${remainingWord} more bind a golden quill`}
        </p>
      </div>

      <div className="atelier-grid">
        {active.map((u) => (
          <AtelierCard key={u.id} state={state} config={u} onBuy={() => buy(u)} />
        ))}
      </div>

      {maxed.length > 0 && (
        <div className="atelier-maxed">
          <button
            type="button"
            className="atelier-maxed__toggle"
            aria-expanded={showMaxed}
            onClick={() => setShowMaxed((v) => !v)}
            data-testid="atelier-maxed-toggle"
          >
            <span className={`atelier-maxed__chevron${showMaxed ? ' is-open' : ''}`} aria-hidden="true">
              ▸
            </span>
            Fully Commissioned ({maxed.length})
          </button>
          {showMaxed && (
            <div className="atelier-grid">
              {maxed.map((u) => (
                <AtelierCard key={u.id} state={state} config={u} onBuy={() => undefined} />
              ))}
            </div>
          )}
        </div>
      )}

      <RelicsSection state={state} />

      {confirming && confirmCost !== null && (
        <Modal
          title={<>Commission this wonder?</>}
          onClose={() => setConfirming(null)}
          testId="atelier-confirm-dialog"
        >
          <p className="atelier-confirm__lede">
            Commission the <strong>{confirming.name}</strong> for{' '}
            <span className="num">{formatNumber(confirmCost)}</span>{' '}
            <span aria-hidden="true">{ICON.goldenQuills}</span>?
          </p>
          <p className="atelier-confirm__rule">
            Your purse pays. Your renown keeps every feather it ever earned.
          </p>
          <div className="atelier-confirm__actions">
            <button type="button" className="btn-ghost" onClick={() => setConfirming(null)}>
              Not yet
            </button>
            <button type="button" className="btn-quill" onClick={confirmBuy} data-testid="atelier-confirm">
              Commission
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function AtelierCard({
  state,
  config,
  onBuy,
}: {
  state: GameState;
  config: AtelierUpgradeConfig;
  onBuy: () => void;
}) {
  const level = atelierLevel(state, config.id);
  const max = atelierMaxLevel(config.id);
  const cost = atelierNextCost(state, config.id);
  const maxedOut = cost === null;
  const affordable = canBuyAtelierUpgrade(state, config.id);
  const wallet = state.meta.goldenQuills;

  // Violet flash 300ms on purchase (the Atelier's "just-bought", 12 §2.2).
  const prevLevel = useRef(level);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (level > prevLevel.current) {
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 300);
      prevLevel.current = level;
      return () => window.clearTimeout(t);
    }
    prevLevel.current = level;
    return undefined;
  }, [level]);

  // pulseAffordable on the expensive→affordable transition, stopped on hover.
  const prevAffordable = useRef(affordable);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (affordable && !prevAffordable.current) setPulse(true);
    if (!affordable) setPulse(false);
    prevAffordable.current = affordable;
  }, [affordable]);

  const stateClass = maxedOut
    ? ' atelier-card--maxed'
    : affordable
      ? ' atelier-card--affordable'
      : ' atelier-card--expensive';

  return (
    <div
      className={`atelier-card anim-reveal-in${stateClass}${flash ? ' atelier-card--flash' : ''}${
        pulse ? ' anim-pulse-affordable' : ''
      }`}
      onMouseEnter={() => setPulse(false)}
      data-testid={`atelier-upgrade-${config.id}`}
    >
      <IconCoin emoji={ATELIER_ICONS[config.id]} small />
      <div className="atelier-card__body">
        <div className="atelier-card__name-line">
          <span className="atelier-card__name">
            {config.name}
            {maxedOut && (
              <span className="atelier-card__check" aria-label="fully commissioned">
                {' '}✓
              </span>
            )}
          </span>
          {max > 1 && (
            <span className="atelier-card__pips" aria-label={`Level ${level} of ${max}`}>
              {Array.from({ length: max }, (_, i) => (
                <span
                  key={i}
                  className={`atelier-card__pip${i < level ? ' is-filled' : ''}`}
                  aria-hidden="true"
                >
                  {i < level ? '●' : '○'}
                </span>
              ))}
            </span>
          )}
        </div>
        <span className="atelier-card__desc">
          {maxedOut ? config.levelDescriptions[max - 1] : config.levelDescriptions[level]}
        </span>
        {!maxedOut && level > 0 && (
          <span className="atelier-card__now">Now: {config.levelDescriptions[level - 1]}</span>
        )}
        <span className="atelier-card__flavor">{config.flavor}</span>
        {cost !== null && (
          <div className="atelier-card__buy-row">
            <button
              type="button"
              className={`atelier-buy${affordable ? ' atelier-buy--affordable' : ' atelier-buy--expensive'}`}
              disabled={!affordable}
              onClick={onBuy}
              data-testid={`atelier-buy-${config.id}`}
            >
              {level > 0 ? `Commission level ${level + 1}` : 'Commission'}
              <span className="atelier-buy__cost num">
                {formatNumber(cost)} <span aria-hidden="true">{ICON.goldenQuills}</span>
              </span>
            </button>
            {!affordable && (
              <span className="atelier-card__need num">
                Need {formatNumber(cost - wallet)} more{' '}
                <span aria-hidden="true">{ICON.goldenQuills}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Relics of the Published (12 §3) — 4 slots, ALL visible from the first open.
 *  Derived entirely from meta.tomesPublished; the UI holds no relic state. */
function RelicsSection({ state }: { state: GameState }) {
  const tomes = state.meta.tomesPublished;

  // relicUnlock (#18) once, on the locked→unlocked transition while mounted.
  const prevUnlocked = useRef<Set<string>>(
    new Set(RELICS.filter((r) => hasRelic(state, r.id)).map((r) => r.id)),
  );
  const [justUnlocked, setJustUnlocked] = useState<string | null>(null);
  useEffect(() => {
    for (const r of RELICS) {
      const unlocked = tomes >= r.tomes;
      if (unlocked && !prevUnlocked.current.has(r.id)) {
        prevUnlocked.current.add(r.id);
        setJustUnlocked(r.id);
      }
    }
  }, [tomes]);

  return (
    <div className="relics" aria-label="Relics of the Published">
      <h4 className="relics__title">Relics of the Published</h4>
      <div className="relics__grid">
        {RELICS.map((r) => (
          <RelicSlot
            key={r.id}
            config={r}
            tomes={tomes}
            justUnlocked={justUnlocked === r.id}
            onAnimDone={() => setJustUnlocked((v) => (v === r.id ? null : v))}
          />
        ))}
      </div>
    </div>
  );
}

function RelicSlot({
  config,
  tomes,
  justUnlocked,
  onAnimDone,
}: {
  config: RelicConfig;
  tomes: number;
  justUnlocked: boolean;
  onAnimDone: () => void;
}) {
  const unlocked = tomes >= config.tomes;
  const tooltip = unlocked ? (
    <>
      <span className="tooltip-title">{config.name}</span>
      <span>{config.description}</span>
      <span className="tooltip-dim">{config.flavor}</span>
    </>
  ) : (
    <>
      <span className="tooltip-title">{config.name}</span>
      <span>{config.description}</span>
      <span className="tooltip-dim">
        Sealed until <strong>{config.tomes} Tomes</strong> are published — {Math.min(tomes, config.tomes)}/
        {config.tomes}. The Hall keeps count.
      </span>
      <span className="tooltip-dim">{config.flavor}</span>
    </>
  );

  return (
    <Tooltip content={tooltip} className="relic-slot-wrap">
      <div
        className={`relic-slot${unlocked ? ' relic-slot--unlocked' : ' relic-slot--locked'}${
          justUnlocked ? ' anim-relic-unlock' : ''
        }`}
        data-testid={`relic-${config.id}`}
        data-state={unlocked ? 'unlocked' : 'locked'}
        tabIndex={0}
        onAnimationEnd={justUnlocked ? onAnimDone : undefined}
      >
        <span className="relic-slot__icon icon-coin" aria-hidden="true">
          {RELIC_ICONS[config.id]}
        </span>
        <span className="relic-slot__name">{config.name}</span>
        {unlocked ? (
          <span className="relic-slot__effect">{config.description}</span>
        ) : (
          <>
            <span className="relic-slot__progress num" data-testid={`relic-progress-${config.id}`}>
              <strong>
                {Math.min(tomes, config.tomes)}/{config.tomes} tomes
              </strong>
            </span>
            <ProgressBar value={tomes / config.tomes} variant="quill" label={`${config.name} progress`} />
          </>
        )}
      </div>
    </Tooltip>
  );
}
