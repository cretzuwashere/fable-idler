// BookshelfPanel (12 §5) — "The Bookshelf": one CSS spine per published Tome.
// Spine width/height/ridges/color come from a deterministic visual seed
// (title + tome number → mulberry32), so the shelf is stable across refreshes.
// Gilded spines (≥5 quills) are gold; faded spines (v1 migration) are
// grayscale with no date. Header: "12 fables · +24% production" (cap 25).

import { useEffect, useRef, useState } from 'react';
import {
  BOOKSHELF,
  formatNumber,
  mulberry32,
  uniqueFableCount,
} from '../../engine';
import type { Fable, GameState } from '../../engine';
import { formatDuration } from '../format';
import { ICON } from '../icons';
import { Tooltip } from './Tooltip';
import './BookshelfPanel.css';

/** Deterministic per-fable visual seed: tome number + title characters. */
function visualSeed(fable: Fable): number {
  let h = (0x2f6e2b1 ^ fable.n) >>> 0;
  for (let i = 0; i < fable.title.length; i++) {
    h = (Math.imul(h ^ fable.title.charCodeAt(i), 0x01000193) >>> 0);
  }
  return h >>> 0;
}

function spineDate(publishedAt: number): string {
  return new Date(publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function BookshelfPanel({
  state,
  revealDelayMs = 0,
}: {
  state: GameState;
  /** Act 2 staggered reveal (12 §1.4) — 0 outside the first-Publish moment. */
  revealDelayMs?: number;
}) {
  const fables = state.meta.fables;
  const counted = Math.min(uniqueFableCount(fables), BOOKSHELF.countedCap);
  const bonusPct = Math.round(counted * BOOKSHELF.bonusPerUniqueFable * 100);
  const atCap = counted >= BOOKSHELF.countedCap;

  // bookSlideIn (#19) only for the spine appended while mounted (a fresh
  // publish), never for the whole shelf on mount. The class is held for the
  // full 500ms animation, then dropped (re-renders must not cut it short).
  const prevLen = useRef(fables.length);
  const [slideN, setSlideN] = useState<number | null>(null);
  useEffect(() => {
    if (fables.length > prevLen.current) {
      prevLen.current = fables.length;
      setSlideN(fables[fables.length - 1].n);
      const t = window.setTimeout(() => setSlideN(null), 700);
      return () => window.clearTimeout(t);
    }
    prevLen.current = fables.length;
    return undefined;
  }, [fables]);

  return (
    <section
      className="bookshelf-panel anim-reveal-in"
      style={
        revealDelayMs > 0
          ? { animationDelay: `${revealDelayMs}ms`, animationFillMode: 'backwards' }
          : undefined
      }
      data-testid="bookshelf-panel"
      aria-label="The Bookshelf"
    >
      <header className="panel-header">
        <h3 className="panel-header__title">
          The Bookshelf <span aria-hidden="true">{ICON.bookshelf}</span>
        </h3>
      </header>
      <p className="bookshelf-panel__count num" data-testid="bookshelf-count">
        {atCap ? (
          <>
            <strong>
              {BOOKSHELF.countedCap}/{BOOKSHELF.countedCap} counted
            </strong>{' '}
            — the shelf is full of wonders (+{bonusPct}%)
          </>
        ) : (
          <>
            <strong>{fables.length === 1 ? '1 fable' : `${fables.length} fables`}</strong> · +{bonusPct}%
            production
          </>
        )}
      </p>
      <div className="bookshelf-panel__shelf" role="list" aria-label="Published fables">
        {fables.map((f) => (
          <FableSpine key={f.n} fable={f} slideIn={f.n === slideN} />
        ))}
      </div>
    </section>
  );
}

function FableSpine({ fable, slideIn }: { fable: Fable; slideIn: boolean }) {
  const rand = mulberry32(visualSeed(fable));
  const spineIndex = (visualSeed(fable) % 8) + 1; // --spine-1..8
  const width = 18 + Math.floor(rand() * 9); // 18–26px
  const height = 64 + Math.floor(rand() * 17); // 64–80px
  const doubleRidge = rand() < 0.5; // 1–2 horizontal ridges
  const stats = fable.runStats;
  const faded = stats === null;

  const tooltip = (
    <>
      <span className="tooltip-title bookshelf-tooltip__title">{fable.title}</span>
      {stats === null ? (
        <>
          <span className="tooltip-dim num">Tome #{fable.n}</span>
          <span className="tooltip-dim bookshelf-tooltip__faded">
            The ink has faded — stats lost to time.
          </span>
        </>
      ) : (
        <>
          <span className="tooltip-dim num">
            Tome #{fable.n} · {spineDate(fable.publishedAt)}
          </span>
          <span className="tooltip-dim num">
            Earned {formatNumber(stats.totalEarned)}
            {stats.durationMs !== null && <> in {formatDuration(stats.durationMs)}</>}
            {' · '}+{formatNumber(stats.quillsEarned)}{' '}
            <span aria-hidden="true">{ICON.goldenQuills}</span>
          </span>
        </>
      )}
    </>
  );

  return (
    <Tooltip content={tooltip} className="bookshelf-spine-wrap">
      <button
        type="button"
        role="listitem"
        className={`fable-spine${fable.gilded ? ' fable-spine--gilded' : ''}${
          faded ? ' fable-spine--faded' : ''
        }${doubleRidge ? ' fable-spine--double-ridge' : ''}${slideIn ? ' anim-book-slide-in' : ''}`}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          background: fable.gilded ? undefined : `var(--spine-${spineIndex})`,
        }}
        data-testid={`fable-spine-${fable.n}`}
        data-gilded={fable.gilded ? 'true' : undefined}
        data-faded={faded ? 'true' : undefined}
        aria-label={`${fable.title} — Tome #${fable.n}`}
      />
    </Tooltip>
  );
}
