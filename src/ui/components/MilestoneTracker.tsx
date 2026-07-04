// MilestoneTracker (04 §4.9, extended for v3) — "Next unlocks": max 3 rows,
// always about what comes NEXT (history lives in toasts). Row 1: the nearest
// un-reached reveal milestone (by run totalEarned). A v3 Wing-gated reveal
// (totalEarnedAndWing) only appears once its Wing is already owned — otherwise
// the gate is an Atelier purchase, surfaced there, not a production goal here.
// Rows 2–3: the two closest quantity thresholds across owned generators
// (v1 25/50/100, the unique bonus at 200, and v3 150/300/400/500), ranked by
// completion, each labelled with what that threshold grants.

import {
  atelierLevel,
  formatNumber,
  GENERATOR_INDEX,
  GENERATORS,
  hasMilestone,
  QTY_FINALE_MULT,
  QTY_FINALE_THRESHOLD,
  QTY_MILESTONE_THRESHOLDS,
  QTY_STEP_MULT,
  QTY_THRESHOLDS_V3,
  qtyMilestoneId,
  REVEAL_MILESTONES,
  uniqueThreshold,
} from '../../engine';
import type { GameState, GeneratorId } from '../../engine';
import { ICON } from '../icons';
import { UNIQUE_BONUS_INFO } from '../unique-bonuses-info';
import { ProgressBar } from './ProgressBar';
import './MilestoneTracker.css';

interface NextUnlock {
  key: string;
  name: string;
  detail: string;
  progress: number;
}

/** All quantity thresholds a card can hit, ascending: v1 + the unique bonus +
 *  v3 — derived from config, so a new threshold needs no edit here. */
const ALL_QTY_THRESHOLDS = (state: GameState): number[] =>
  [...QTY_MILESTONE_THRESHOLDS, uniqueThreshold(state), ...QTY_THRESHOLDS_V3].sort((a, b) => a - b);

/** What owning `threshold` of `gen` grants — the label for the tracker row. */
function thresholdLabel(gen: GeneratorId, threshold: number, uThreshold: number): string {
  const name = GENERATOR_INDEX[gen].name;
  if (threshold === uThreshold) {
    const bonus = UNIQUE_BONUS_INFO[gen];
    return bonus ? `${name}: ${bonus.name}` : `${name}: unique bonus`;
  }
  const mult = threshold === QTY_FINALE_THRESHOLD ? QTY_FINALE_MULT : QTY_STEP_MULT;
  return `${name} ×${mult}`;
}

function collectNextUnlocks(state: GameState): NextUnlock[] {
  const rows: NextUnlock[] = [];

  // Nearest reveal milestone by run totalEarned. Two requirement shapes qualify:
  //  - kind 'totalEarned'      (v1/v2 tiers): always a production goal.
  //  - kind 'totalEarnedAndWing' (v3 tiers): only once the required Wing is
  //    owned — then the remaining gate IS just totalEarned, so it belongs here.
  //    Before the Wing is bought, the gate is an Atelier purchase (surfaced in
  //    the Atelier), not a production goal, so it stays out of this tracker.
  const newWing = atelierLevel(state, 'theNewWing');
  const revealCandidates = REVEAL_MILESTONES.filter((m) => {
    if (hasMilestone(state, m.id)) return false;
    if (m.requirement.kind === 'totalEarned') return true;
    if (m.requirement.kind === 'totalEarnedAndWing') return newWing >= m.requirement.wing;
    return false;
  }).sort((a, b) => revealAmount(a) - revealAmount(b));

  const nextReveal = revealCandidates[0];
  if (nextReveal) {
    const target = revealAmount(nextReveal);
    rows.push({
      key: nextReveal.id,
      name: nextReveal.name,
      detail: `${formatNumber(Math.min(state.run.totalEarned, target))} / ${formatNumber(target)} earned`,
      progress: state.run.totalEarned / target,
    });
  }

  // Two closest quantity thresholds among owned generators.
  const thresholds = ALL_QTY_THRESHOLDS(state);
  const uThreshold = uniqueThreshold(state);
  const qty: NextUnlock[] = [];
  for (const g of GENERATORS) {
    const owned = state.run.generators[g.id];
    if (owned < 1) continue;
    const next = thresholds.find(
      (t) => owned < t && !hasMilestone(state, qtyMilestoneId(g.id, t)),
    );
    if (next === undefined) continue;
    qty.push({
      key: qtyMilestoneId(g.id, next),
      name: thresholdLabel(g.id, next, uThreshold),
      detail: `${owned} / ${next} owned`,
      progress: owned / next,
    });
  }
  qty.sort((a, b) => b.progress - a.progress);
  rows.push(...qty.slice(0, 2));

  return rows.slice(0, 3);
}

/** The totalEarned target of a reveal milestone (both v1 and v3 shapes). */
function revealAmount(m: (typeof REVEAL_MILESTONES)[number]): number {
  if (m.requirement.kind === 'totalEarned') return m.requirement.amount;
  if (m.requirement.kind === 'totalEarnedAndWing') return m.requirement.amount;
  return Infinity;
}

export function MilestoneTracker({ state }: { state: GameState }) {
  const rows = collectNextUnlocks(state);
  if (rows.length === 0) return null;

  return (
    <section className="milestone-tracker anim-reveal-in" data-testid="milestone-tracker" aria-label="Next unlocks">
      <header className="panel-header">
        <h3 className="panel-header__title">
          <span aria-hidden="true">{ICON.milestones}</span> Next unlocks
        </h3>
      </header>
      <ul className="milestone-tracker__list">
        {rows.map((row) => (
          <li key={row.key} className="milestone-tracker__row">
            <div className="milestone-tracker__labels">
              <span className="milestone-tracker__name">{row.name}</span>
              <span className="milestone-tracker__detail num">{row.detail}</span>
            </div>
            <ProgressBar value={row.progress} label={row.name} />
          </li>
        ))}
      </ul>
    </section>
  );
}
