// StatsStrip (04 §4.5) — three mini-stats under the buff button:
// Total earned (run) · Clicks · Tomes 📖. 12.5px muted, tabular numbers.

import { formatNumber } from '../../engine';
import type { GameState } from '../../engine';
import { ICON } from '../icons';
import './StatsStrip.css';

export function StatsStrip({ state }: { state: GameState }) {
  return (
    <dl className="stats-strip" data-testid="stats-strip">
      <div className="stats-strip__item">
        {/* Short label: "Earned this run" wrapped to two lines in the 300px
            tablet column and broke the vertical alignment of the strip. */}
        <dt>This run</dt>
        <dd className="num" data-testid="stats-total-earned">
          {formatNumber(state.run.totalEarned)}
        </dd>
      </div>
      <div className="stats-strip__item">
        <dt>Clicks</dt>
        <dd className="num" data-testid="stats-clicks">
          {formatNumber(state.meta.stats.totalClicks)}
        </dd>
      </div>
      <div className="stats-strip__item">
        <dt>
          Tomes <span aria-hidden="true">{ICON.prestige}</span>
        </dt>
        <dd className="num" data-testid="stats-tomes">
          {formatNumber(state.meta.tomesPublished)}
        </dd>
      </div>
    </dl>
  );
}
