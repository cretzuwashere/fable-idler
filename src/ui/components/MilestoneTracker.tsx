// MilestoneTracker (04 §4.9) — "Next unlocks": max 3 rows, always about what
// comes NEXT (history lives in toasts). Row 1: the nearest un-reached reveal
// milestone (by run totalEarned). Rows 2–3: the two closest quantity thresholds
// (25/50/100) across owned generators, ranked by completion.

import {
  formatNumber,
  GENERATOR_INDEX,
  GENERATORS,
  hasMilestone,
  QTY_MILESTONE_THRESHOLDS,
  qtyMilestoneId,
  REVEAL_MILESTONES,
} from '../../engine';
import type { GameState } from '../../engine';
import { ICON } from '../icons';
import { ProgressBar } from './ProgressBar';
import './MilestoneTracker.css';

interface NextUnlock {
  key: string;
  name: string;
  detail: string;
  progress: number;
}

function collectNextUnlocks(state: GameState): NextUnlock[] {
  const rows: NextUnlock[] = [];

  // Nearest reveal milestone on totalEarned
  const nextReveal = REVEAL_MILESTONES.filter(
    (m) => m.requirement.kind === 'totalEarned' && !hasMilestone(state, m.id),
  ).sort((a, b) => {
    const av = a.requirement.kind === 'totalEarned' ? a.requirement.amount : 0;
    const bv = b.requirement.kind === 'totalEarned' ? b.requirement.amount : 0;
    return av - bv;
  })[0];
  if (nextReveal && nextReveal.requirement.kind === 'totalEarned') {
    const target = nextReveal.requirement.amount;
    rows.push({
      key: nextReveal.id,
      name: nextReveal.name,
      detail: `${formatNumber(Math.min(state.run.totalEarned, target))} / ${formatNumber(target)} earned`,
      progress: state.run.totalEarned / target,
    });
  }

  // Two closest quantity thresholds among owned generators
  const qty: NextUnlock[] = [];
  for (const g of GENERATORS) {
    const owned = state.run.generators[g.id];
    if (owned < 1) continue;
    const next = QTY_MILESTONE_THRESHOLDS.find(
      (t) => owned < t && !hasMilestone(state, qtyMilestoneId(g.id, t)),
    );
    if (next === undefined) continue;
    qty.push({
      key: qtyMilestoneId(g.id, next),
      name: `${GENERATOR_INDEX[g.id].name} ×2`,
      detail: `${owned} / ${next} owned`,
      progress: owned / next,
    });
  }
  qty.sort((a, b) => b.progress - a.progress);
  rows.push(...qty.slice(0, 2));

  return rows.slice(0, 3);
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
