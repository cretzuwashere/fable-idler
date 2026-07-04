// GeneratorList + GeneratorRow (04 §4.6, extended for v3 in 13 §2).
// Buy ×1/×10/×Max segmented toggle (persisted via setSettings), one row per
// revealed generator, plus a "? ? ?" teaser row for the next unrevealed base
// tier (never for a Wing-gated or Blueprint-gated tier — those are surprises).
// Row states: affordable (green button + pulse on the expensive→affordable
// transition, cleared on hover) / expensive (disabled, ETA from /sec) /
// just-bought (300ms green flash) / milestone badge ×N (badgePop) + the unique
// violet/gold badge at 200 with an effect tooltip / the "1 more → …" hint at
// every threshold-1 (24/49/99/149/199/299/399/499) / newly-revealed (revealIn).

import { memo, useEffect, useRef, useState } from 'react';
import {
  atelierLevel,
  bulkCost,
  costOf,
  formatNumber,
  formatRate,
  GENERATORS,
  generatorProduction,
  isGeneratorVisibleInShop,
  isUniqueBonusActive,
  maxAffordable,
  perSecond,
  QTY_FINALE_MULT,
  QTY_FINALE_THRESHOLD,
  QTY_MILESTONE_THRESHOLDS,
  QTY_STEP_MULT,
  QTY_THRESHOLDS_V3,
  qtyMilestoneMultiplier,
  uniqueThreshold,
} from '../../engine';
import type { BuyQty, GameState, GeneratorConfig } from '../../engine';
import { formatEta } from '../format';
import { useDispatch } from '../hooks/useGameStore';
import { GENERATOR_ICONS, ICON } from '../icons';
import { UNIQUE_BONUS_INFO } from '../unique-bonuses-info';
import { IconCoin } from './IconCoin';
import { Tooltip } from './Tooltip';
import './GeneratorList.css';

const BUY_QTYS: readonly BuyQty[] = [1, 10, 'max'];

/** Every MULTIPLIER threshold, ascending — v1 25/50/100 (×2) plus v3 150/300/
 *  400 (×2) and 500 (×4). The unique-bonus threshold (200) is NOT here: it is a
 *  separate special badge with its own copy. Derived from config so adding a
 *  threshold never needs a UI edit (13 §2.1). */
const MULT_THRESHOLDS: readonly number[] = [...QTY_MILESTONE_THRESHOLDS, ...QTY_THRESHOLDS_V3].sort(
  (a, b) => a - b,
);

/** The base step multiplier label at a threshold (500 → ×4, else ×2). Strength
 *  of the Stacks scaling is folded into qtyMilestoneMultiplier already; this is
 *  only the "1 more → ×N" hint and badge-tooltip copy, which quote the step. */
function stepMultLabel(threshold: number): string {
  return `×${threshold === QTY_FINALE_THRESHOLD ? QTY_FINALE_MULT : QTY_STEP_MULT}`;
}

function qtyLabel(qty: BuyQty): string {
  return qty === 'max' ? '×Max' : `×${qty}`;
}

export function GeneratorList({ state }: { state: GameState }) {
  const dispatch = useDispatch();
  const buyQty: BuyQty = state.meta.settings.buyQty ?? 1;

  // v2/v3: isGeneratorVisibleInShop is MANDATORY here (05 Engine v2/v3). A tier
  // whose gate is not yet met must not exist AT ALL — not even as the "? ? ?"
  // teaser. That covers BOTH the Blueprint of Myths (mythEngine) and every New
  // Wing level (tiers 9–14, the `wing` field): each is the Atelier's surprise,
  // revealed only when its Atelier gate is purchased (09 §1.3 / 13 §1.1). So the
  // teaser candidate is the next generator that is (a) not yet shop-visible and
  // (b) NOT held back purely by an unmet Atelier gate.
  const revealed = GENERATORS.filter((g) => isGeneratorVisibleInShop(state, g.id));
  const hasBlueprint = atelierLevel(state, 'blueprintOfMyths') >= 1;
  const nextHidden = GENERATORS.find((g) => {
    if (isGeneratorVisibleInShop(state, g.id)) return false;
    if (g.id === 'mythEngine' && !hasBlueprint) return false; // gated by Blueprint
    if (g.wing !== undefined && atelierLevel(state, 'theNewWing') < g.wing) return false; // gated by Wing
    return true;
  });

  return (
    <section className="generator-list" aria-label="Generators">
      <div className="generator-list__toolbar">
        <span className="generator-list__toolbar-label" id="buy-qty-label">
          Buy
        </span>
        <div className="buy-qty-toggle" role="group" aria-labelledby="buy-qty-label">
          {BUY_QTYS.map((q) => (
            <button
              key={String(q)}
              type="button"
              className={`buy-qty-toggle__option${q === buyQty ? ' is-selected' : ''}`}
              aria-pressed={q === buyQty}
              onClick={() => dispatch({ type: 'setSettings', settings: { buyQty: q } })}
              data-testid={`buy-qty-${q}`}
            >
              {qtyLabel(q)}
            </button>
          ))}
        </div>
      </div>
      {revealed.map((g) => (
        <GeneratorRow key={g.id} state={state} config={g} buyQty={buyQty} />
      ))}
      {nextHidden && <MysteryRow key={nextHidden.id} config={nextHidden} />}
    </section>
  );
}

interface RowProps {
  state: GameState;
  config: GeneratorConfig;
  buyQty: BuyQty;
}

const GeneratorRow = memo(function GeneratorRow({ state, config, buyQty }: RowProps) {
  const dispatch = useDispatch();
  const id = config.id;
  const owned = state.run.generators[id];

  // Cost + affordability for the selected quantity (×10 is all-or-nothing).
  const maxCount = buyQty === 'max' ? maxAffordable(state, id) : 0;
  const count = buyQty === 'max' ? Math.max(1, maxCount) : buyQty;
  const cost = buyQty === 1 ? costOf(state, id) : bulkCost(state, id, count);
  const affordable = buyQty === 'max' ? maxCount >= 1 : cost <= state.run.inspiration;

  // Production copy: "0.4/sec each · 12/sec total"
  const total = generatorProduction(state, id);
  const each = owned > 0 ? total / owned : config.baseProd;

  // Quantity milestone badge: the cumulative ×N (v1 25/50/100 and v3 150/300/
  // 400/500, incl. Strength of the Stacks), plus a "1 more → …" hint whenever
  // the NEXT unit crosses any threshold — a multiplier step OR the unique bonus.
  const mult = qtyMilestoneMultiplier(state, id);
  const highestMult = [...MULT_THRESHOLDS].reverse().find((t) => owned >= t);
  const uniqueActive = isUniqueBonusActive(state, id);
  const bonusInfo = UNIQUE_BONUS_INFO[id];
  const uThreshold = uniqueThreshold(state);
  // The next threshold the following purchase would cross (mult step or unique).
  const nextMultStep = MULT_THRESHOLDS.includes(owned + 1) ? owned + 1 : undefined;
  const crossingUnique = owned + 1 === uThreshold;

  // just-bought flash (300ms)
  const prevOwned = useRef(owned);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (owned > prevOwned.current) {
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 300);
      prevOwned.current = owned;
      return () => window.clearTimeout(t);
    }
    prevOwned.current = owned;
    return undefined;
  }, [owned]);

  // pulseAffordable only on the expensive→affordable transition; stops on hover
  const prevAffordable = useRef(affordable);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (affordable && !prevAffordable.current) setPulse(true);
    if (!affordable) setPulse(false);
    prevAffordable.current = affordable;
  }, [affordable]);

  // ETA until affordable (only meaningful when /sec > 0)
  const rate = perSecond(state, state.lastTickAt);
  const eta = affordable ? null : formatEta(cost - state.run.inspiration, rate);

  return (
    <div
      className={`generator-row anim-reveal-in${flash ? ' generator-row--flash' : ''}`}
      data-testid={`generator-${id}`}
    >
      <IconCoin emoji={GENERATOR_ICONS[id]} />
      <div className="generator-row__info">
        <div className="generator-row__name-line">
          <span className="generator-row__name">{config.name}</span>
          {owned > 0 && <span className="generator-row__owned num">×{owned} owned</span>}
          {id === 'wanderingMuse' && atelierLevel(state, 'selfWritingContract') >= 1 && (
            <Tooltip
              content={
                <>
                  <span className="tooltip-title">Self-Writing Contract</span>
                  <span className="tooltip-dim">
                    The contract hires one whenever it costs under 1% of your ink.
                  </span>
                </>
              }
            >
              <span className="generator-row__auto" tabIndex={0}>
                auto
              </span>
            </Tooltip>
          )}
          {mult > 1 && (
            <Tooltip
              content={
                <>
                  <span className="tooltip-title">Milestone bonus</span>
                  <span className="tooltip-dim">
                    Production ×{mult} for owning {highestMult}+ of this generator.
                  </span>
                </>
              }
            >
              <span key={mult} className="generator-row__badge anim-badge-pop num" tabIndex={0}>
                ×{formatNumber(mult)}
              </span>
            </Tooltip>
          )}
          {uniqueActive && bonusInfo && (
            <Tooltip
              content={
                <>
                  <span className="tooltip-title">{bonusInfo.name}</span>
                  <span className="tooltip-dim">{bonusInfo.effect}</span>
                  <span className="tooltip-dim">Unique bonus — {uThreshold} owned.</span>
                </>
              }
            >
              <span
                className="generator-row__badge generator-row__badge--unique anim-badge-pop"
                tabIndex={0}
                aria-label={`Unique bonus: ${bonusInfo.name}`}
              >
                ✦ {bonusInfo.name}
              </span>
            </Tooltip>
          )}
        </div>
        <div className="generator-row__prod num">
          {formatRate(each)}/sec each{owned > 0 && <> · {formatRate(total)}/sec total</>}
        </div>
        {crossingUnique && bonusInfo ? (
          <div className="generator-row__hint generator-row__hint--unique">
            1 more → <strong>{bonusInfo.name}</strong>!
          </div>
        ) : (
          nextMultStep !== undefined && (
            <div className="generator-row__hint">1 more → {stepMultLabel(nextMultStep)}!</div>
          )
        )}
      </div>
      <div className="generator-row__buy">
        <button
          type="button"
          className={`buy-button${affordable ? ' buy-button--affordable' : ' buy-button--expensive'}${
            pulse ? ' anim-pulse-affordable' : ''
          }`}
          disabled={!affordable}
          onClick={() => dispatch({ type: 'buyGenerator', id, qty: buyQty })}
          onMouseEnter={() => setPulse(false)}
          data-testid={`buy-${id}`}
        >
          <span className="buy-button__qty">
            Buy {buyQty === 'max' ? (maxCount > 0 ? `×${maxCount}` : '×Max') : qtyLabel(buyQty)}
          </span>
          <span className="buy-button__cost num">
            <span aria-hidden="true">{ICON.inspiration}</span> {formatNumber(cost)}
          </span>
        </button>
        {eta && (
          <span className="buy-button__eta num">
            {eta} <span aria-hidden="true">{ICON.inspiration}</span>
          </span>
        )}
      </div>
    </div>
  );
});

/** Teaser for the NEXT unrevealed generator: silhouette, "? ? ?" name (04 §4.6). */
function MysteryRow({ config }: { config: GeneratorConfig }) {
  return (
    <div className="generator-row generator-row--mystery" data-testid="generator-next-teaser">
      <span className="icon-coin generator-row__mystery-coin" aria-hidden="true">
        ?
      </span>
      <div className="generator-row__info">
        <div className="generator-row__name-line">
          <span className="generator-row__name generator-row__name--mystery">? ? ?</span>
        </div>
        <div className="generator-row__prod">A new wonder stirs in the stacks…</div>
      </div>
      <div className="generator-row__buy">
        <span className="buy-button buy-button--expensive generator-row__mystery-cost num">
          <span aria-hidden="true">{ICON.inspiration}</span> {formatNumber(config.baseCost)}
        </span>
      </div>
    </div>
  );
}
