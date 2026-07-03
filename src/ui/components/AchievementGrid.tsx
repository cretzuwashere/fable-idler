// AchievementGrid (04 §4.8) — grid of 56px squares. Locked: "?" silhouette with
// the condition visible in a tooltip ("Not yet written."). Unlocked: 🏆 with a
// warm gold gradient + tooltip (name, condition, bonus). Header: "9/14 · +9%".
// Root carries data-testid="tab-achievements" — the E2E contract point that
// "the Achievements tab appears after the first achievement" on all layouts.

import { useEffect, useRef, useState } from 'react';
import {
  ACHIEVEMENT_BONUS,
  ACHIEVEMENT_BONUS_ANTHOLOGY,
  ACHIEVEMENTS,
  hasAchievement,
  hasUpgrade,
} from '../../engine';
import type { GameState } from '../../engine';
import { ICON } from '../icons';
import { Tooltip } from './Tooltip';
import './AchievementGrid.css';

export function AchievementGrid({ state }: { state: GameState }) {
  const unlockedCount = state.meta.achievements.length;
  const bonusPct = Math.round(
    unlockedCount *
      (hasUpgrade(state, 'boundAnthology') ? ACHIEVEMENT_BONUS_ANTHOLOGY : ACHIEVEMENT_BONUS) *
      100,
  );

  return (
    <section className="achievement-grid anim-reveal-in" data-testid="tab-achievements" aria-label="Achievements">
      <header className="panel-header">
        <h3 className="panel-header__title">
          <span aria-hidden="true">{ICON.achievements}</span> Achievements
        </h3>
        <span className="panel-header__meta num" data-testid="achievements-count">
          {unlockedCount}/{ACHIEVEMENTS.length} · +{bonusPct}% production
        </span>
      </header>
      <div className="achievement-grid__cells">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = hasAchievement(state, a.id);
          return (
            <AchievementCell
              key={a.id}
              id={a.id}
              unlocked={unlocked}
              name={a.name}
              description={a.description}
              bonusPct={hasUpgrade(state, 'boundAnthology') ? 2 : 1}
            />
          );
        })}
      </div>
    </section>
  );
}

interface CellProps {
  id: string;
  unlocked: boolean;
  name: string;
  description: string;
  bonusPct: number;
}

function AchievementCell({ id, unlocked, name, description, bonusPct }: CellProps) {
  // just-unlocked: unlockGlow 600ms on the transition (the toast comes from App)
  const prev = useRef(unlocked);
  const [justUnlocked, setJustUnlocked] = useState(false);
  useEffect(() => {
    if (unlocked && !prev.current) {
      setJustUnlocked(true);
      const t = window.setTimeout(() => setJustUnlocked(false), 700);
      prev.current = unlocked;
      return () => window.clearTimeout(t);
    }
    prev.current = unlocked;
    return undefined;
  }, [unlocked]);

  return (
    <Tooltip
      content={
        unlocked ? (
          <>
            <span className="tooltip-title">{name}</span>
            <span className="tooltip-dim">{description}</span>
            <span className="tooltip-bonus">+{bonusPct}% global production</span>
          </>
        ) : (
          <>
            <span className="tooltip-title">Not yet written.</span>
            <span className="tooltip-dim">{description}</span>
          </>
        )
      }
    >
      <span
        className={`achievement-cell${unlocked ? ' achievement-cell--unlocked' : ' achievement-cell--locked'}${
          justUnlocked ? ' anim-unlock-glow' : ''
        }`}
        tabIndex={0}
        role="img"
        aria-label={unlocked ? `${name} — unlocked` : `Locked achievement: ${description}`}
        data-testid={`achievement-${id}`}
      >
        {unlocked ? <span aria-hidden="true">{ICON.achievements}</span> : '?'}
      </span>
    </Tooltip>
  );
}
