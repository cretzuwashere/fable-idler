// StraySpark (12 §4) — the clickable drifting spark + catch burst + the
// secondary spark-buff pill. A real <button> (Tab + Enter/Space work), 48×48px
// hitbox around a 10px core, flying 10s along a lane chosen AT SPAWN so it
// never crosses the keep-out rects (click-area, buff/prestige buttons, header,
// nav bars, toast corner — inflated 24px). Fallback lane: the horizontal band
// 72–160px below the header. Reduced motion: a static corner slot, fade only.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { atelierLevel, SPARK } from '../../engine';
import type { GameState, SparkRewardKind } from '../../engine';
import { ICON } from '../icons';
import type { LayoutMode } from '../hooks/useLayoutMode';
import type { ActiveSpark } from '../hooks/useStraySpark';
import './StraySpark.css';

interface Lane {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Burst {
  id: number;
  x: number;
  y: number;
}

interface StraySparkLayerProps {
  spark: ActiveSpark | null;
  reduceMotion: boolean;
  layout: LayoutMode;
  /** Collect the spark; returns the rolled kind (null if it was already gone). */
  onCollect: () => SparkRewardKind | null;
}

const KEEP_OUT_SELECTORS = [
  '[data-testid="click-area"]',
  '[data-testid="buff-button"]',
  '[data-testid="spark-buff-pill"]',
  '[data-testid="prestige-button"]',
  '.app-header',
  '.tab-bar',
  '.bottom-nav',
  '.toast-container',
];
const KEEP_OUT_INFLATE = 24;

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function keepOutRects(): Rect[] {
  const rects: Rect[] = [];
  for (const sel of KEEP_OUT_SELECTORS) {
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      rects.push({
        left: r.left - KEEP_OUT_INFLATE,
        top: r.top - KEEP_OUT_INFLATE,
        right: r.right + KEEP_OUT_INFLATE,
        bottom: r.bottom + KEEP_OUT_INFLATE,
      });
    }
  }
  return rects;
}

function laneHitsRect(lane: Lane, rects: Rect[]): boolean {
  // 25 sample points along the segment — simple, robust, fast enough at spawn.
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = lane.x0 + (lane.x1 - lane.x0) * t;
    const y = lane.y0 + (lane.y1 - lane.y0) * t;
    for (const r of rects) {
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
    }
  }
  return false;
}

/** The safe flight region per layout (12 §4.2). */
function flightRegion(layout: LayoutMode): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (layout === 'mobile') {
    const resource = document.querySelector('.app-mobile__resource')?.getBoundingClientRect();
    const nav = document.querySelector('.bottom-nav')?.getBoundingClientRect();
    const click = document.querySelector('[data-testid="click-area"]')?.getBoundingClientRect();
    const top = (resource?.bottom ?? 56) + 8;
    let bottom = (nav?.top ?? vh) - 16;
    // On the Weave tab keep to the band ABOVE the 200px click disc.
    if (click && click.top < bottom) bottom = Math.max(top + 40, click.top - KEEP_OUT_INFLATE);
    return { left: 0, top, right: vw, bottom };
  }
  const center = document.querySelector('.col-center')?.getBoundingClientRect();
  if (center && center.width > 0) {
    return { left: center.left, top: center.top, right: center.right, bottom: Math.min(center.bottom, vh) };
  }
  // Solo mode / no center column yet: the band under the header.
  const header = document.querySelector('.app-header')?.getBoundingClientRect();
  const top = (header?.bottom ?? 56) + 40;
  return { left: 0, top, right: vw, bottom: vh - 40 };
}

/** Pick a diagonal lane across the safe region that misses every keep-out rect;
 *  guaranteed fallback: the horizontal band 72–160px below the header. */
function chooseLane(layout: LayoutMode): Lane {
  const region = flightRegion(layout);
  const rects = keepOutRects();
  const h = Math.max(80, region.bottom - region.top);
  const candidates: Lane[] = [
    { x0: region.left - 40, y0: region.top + h * 0.25, x1: region.right + 40, y1: region.top + h * 0.55 },
    { x0: region.right + 40, y0: region.top + h * 0.2, x1: region.left - 40, y1: region.top + h * 0.5 },
    { x0: region.left - 40, y0: region.top + h * 0.6, x1: region.right + 40, y1: region.top + h * 0.3 },
    { x0: region.right + 40, y0: region.top + h * 0.65, x1: region.left - 40, y1: region.top + h * 0.35 },
  ];
  for (const lane of candidates) {
    if (!laneHitsRect(lane, rects)) return lane;
  }
  // Guaranteed fallback (12 §4.2): horizontal band 72–160px below the header.
  const header = document.querySelector('.app-header')?.getBoundingClientRect();
  const y = (header?.bottom ?? 56) + 72 + Math.random() * 88;
  return { x0: -60, y0: y, x1: window.innerWidth + 60, y1: y };
}

/** Static slot for reduced motion (12 §4.4) — deterministic corner position. */
function staticSlot(layout: LayoutMode): { left: number; top: number } {
  if (layout === 'mobile') {
    const resource = document.querySelector('.app-mobile__resource')?.getBoundingClientRect();
    return { left: window.innerWidth - 72, top: (resource?.bottom ?? 104) + 16 };
  }
  const center = document.querySelector('.col-center')?.getBoundingClientRect();
  if (center && center.width > 0) return { left: center.right - 72, top: center.top + 16 };
  const header = document.querySelector('.app-header')?.getBoundingClientRect();
  return { left: window.innerWidth - 88, top: (header?.bottom ?? 56) + 24 };
}

export function StraySparkLayer({ spark, reduceMotion, layout, onCollect }: StraySparkLayerProps) {
  const [burst, setBurst] = useState<Burst | null>(null);
  const burstId = useRef(1);

  // Lane / slot chosen ONCE per spark id, at spawn (rects read at that moment).
  const flight = useMemo(() => {
    if (!spark) return null;
    if (reduceMotion) return { lane: null as Lane | null, slot: staticSlot(layout) };
    return { lane: chooseLane(layout), slot: null as { left: number; top: number } | null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spark?.id, reduceMotion, layout]);

  // Clear a stale burst node if the layer unmounts mid-animation.
  useEffect(() => () => setBurst(null), []);

  if (!spark && !burst) return null;

  const handleCatch = (clientX: number, clientY: number): void => {
    const kind = onCollect();
    if (kind === null) return;
    setBurst({ id: burstId.current++, x: clientX, y: clientY });
  };

  let sparkStyle: CSSProperties | undefined;
  if (spark && flight) {
    if (flight.lane) {
      sparkStyle = {
        '--spark-x0': `${flight.lane.x0}px`,
        '--spark-y0': `${flight.lane.y0}px`,
        '--spark-x1': `${flight.lane.x1}px`,
        '--spark-y1': `${flight.lane.y1}px`,
      } as CSSProperties;
    } else if (flight.slot) {
      sparkStyle = { left: `${flight.slot.left}px`, top: `${flight.slot.top}px` };
    }
  }

  return (
    <div className="stray-spark-layer" aria-hidden={spark ? undefined : true}>
      {spark && (
        <div
          key={spark.id}
          className={`stray-spark-track${flight?.lane ? ' anim-spark-float' : ' stray-spark-track--static anim-spark-fade'}`}
          style={sparkStyle}
        >
          <button
            type="button"
            className={`stray-spark${flight?.lane ? ' anim-spark-bob' : ''}`}
            data-testid="stray-spark"
            aria-label="A stray spark drifts by — catch it!"
            onPointerDown={(e) => {
              // pointerdown, not click — the catch must feel instant (12 §4.3).
              e.preventDefault();
              handleCatch(e.clientX, e.clientY);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                handleCatch(r.left + r.width / 2, r.top + r.height / 2);
              }
            }}
          >
            <span className="stray-spark__core" aria-hidden="true" />
          </button>
        </div>
      )}
      {burst && (
        <SparkBurst
          key={burst.id}
          x={burst.x}
          y={burst.y}
          reduceMotion={reduceMotion}
          onDone={() => setBurst(null)}
        />
      )}
    </div>
  );
}

/**
 * SparkBuffPill (12 §4.3.3) — the secondary buff pill next to the BuffButton
 * while a quillFrenzy/gossipBonanza spark buff runs. Same anatomy as the main
 * pill (conic-gradient duration ring driven by the tick) but GOLD-BRIGHT, so
 * it never reads as the ember Moment of Inspiration.
 */
export function SparkBuffPill({ state }: { state: GameState }) {
  const sb = state.run.sparkBuff;
  const now = state.lastTickAt;
  if (!sb || now >= sb.activeUntil) return null;

  const netL2 = atelierLevel(state, 'sparkcatchersNet') >= 2;
  const baseMs =
    sb.kind === 'quillFrenzy' ? SPARK.frenzy.durationMs : SPARK.gossip.durationMs;
  const totalMs = baseMs * (netL2 ? SPARK.netRewardMult : 1);
  const remaining = sb.activeUntil - now;
  const pct = Math.max(0, Math.min(100, (remaining / totalMs) * 100));
  const label =
    sb.kind === 'quillFrenzy'
      ? `Frenzy ×${SPARK.frenzy.clickMult}`
      : `Gossip ×${SPARK.gossip.prodMult}`;

  return (
    <div
      className="spark-buff-pill anim-reveal-in"
      style={{ '--ring': `${pct}%` } as CSSProperties}
      data-testid="spark-buff-pill"
      data-buff={sb.kind}
      role="status"
      aria-label={`${label} — ${Math.ceil(remaining / 1000)} seconds left`}
    >
      <span className="spark-buff-pill__ring" aria-hidden="true" />
      <span className="spark-buff-pill__icon" aria-hidden="true">
        {ICON.spark}
      </span>
      <span className="spark-buff-pill__label num">
        {label} · {Math.ceil(remaining / 1000)}s
      </span>
    </div>
  );
}

/** Transient catch feedback (#17): 8 radial particles + a dilating ring, 450ms.
 *  Reduced motion: a single 200ms fading dot. Node removed when done. */
function SparkBurst({
  x,
  y,
  reduceMotion,
  onDone,
}: {
  x: number;
  y: number;
  reduceMotion: boolean;
  onDone: () => void;
}) {
  // Failsafe removal — onAnimationEnd can be missed if the tab hides mid-burst.
  useEffect(() => {
    const t = window.setTimeout(onDone, reduceMotion ? 260 : 520);
    return () => window.clearTimeout(t);
  }, [onDone, reduceMotion]);

  const particles = reduceMotion
    ? []
    : Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return {
          dx: `${Math.round(Math.cos(angle) * 40)}px`,
          dy: `${Math.round(Math.sin(angle) * 40)}px`,
        };
      });

  return (
    <div className="spark-burst" style={{ left: `${x}px`, top: `${y}px` }} aria-hidden="true">
      <span
        className={reduceMotion ? 'spark-burst__ring anim-spark-burst-fade' : 'spark-burst__ring anim-spark-burst-ring'}
        onAnimationEnd={onDone}
      />
      {particles.map((p, i) => (
        <span
          key={i}
          className="spark-burst__particle anim-spark-burst-particle"
          style={{ '--dx': p.dx, '--dy': p.dy } as CSSProperties}
        />
      ))}
    </div>
  );
}
