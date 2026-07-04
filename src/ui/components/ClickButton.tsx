// ClickButton (04 §4.2) + FloatingNumber (04 §4.3) + v2 crit feedback (12 §2.3).
// Big disc, radial gold gradient, double gold-deep border. States: idle
// (breatheGlow), pressed (pressDown via :active), buff-active (ember border).
// Every click emits a FloatingNumber from a pool of MAX 12 DOM nodes — the
// 13th recycles the oldest. Reduced motion: a single static "+X" for 500ms.
//
// Crit (Stroke of Genius): the shell rolls ONE Math.random() per click, sends
// it as critRoll in the dispatch AND uses the SAME roll for the visual
// feedback via isCritRoll — UI and engine can never disagree (10 §3.2).
// Crit feedback: 22px gold "+X ✦" [data-crit] + critFlash (#21) + the
// "A stroke of genius!" caption 800ms; reduced motion: static
// "+X ✦ (a stroke of genius!)" for 500ms.

import { useCallback, useEffect, useRef, useState } from 'react';
import { clickValue, formatNumber, isBuffActive, isCritRoll } from '../../engine';
import type { GameState } from '../../engine';
import { useDispatch, useStore } from '../hooks/useGameStore';
import { ICON } from '../icons';
import './ClickButton.css';

const MAX_FLOATS = 12;

interface Float {
  id: number;
  text: string;
  x: number;
  buffed: boolean;
  crit: boolean;
}

interface ClickButtonProps {
  state: GameState;
  reduceMotion: boolean;
  /** Solo-mode guide text below the button (first 30 seconds). */
  showGuide: boolean;
}

export function ClickButton({ state, reduceMotion, showGuide }: ClickButtonProps) {
  const store = useStore();
  const dispatch = useDispatch();
  const [floats, setFloats] = useState<Float[]>([]);
  const [staticFloat, setStaticFloat] = useState<Float | null>(null);
  const [critNonce, setCritNonce] = useState(0);
  const [showCaption, setShowCaption] = useState(false);
  const nextId = useRef(1);
  const staticTimer = useRef<number | null>(null);

  const buffed = isBuffActive(state, state.lastTickAt);

  // Clear the reduced-motion timer on unmount (tab switch right after a tap
  // would otherwise call setState on an unmounted component).
  useEffect(
    () => () => {
      if (staticTimer.current !== null) window.clearTimeout(staticTimer.current);
    },
    [],
  );

  const removeFloat = useCallback((id: number) => {
    setFloats((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClick = useCallback(() => {
    const now = Date.now();
    const current = store.getState();
    // ONE roll per click, shared by dispatch and feedback (contract, 10 §3.2).
    const critRoll = Math.random();
    const crit = isCritRoll(current, critRoll);
    const value = clickValue(current, now, critRoll);
    dispatch({ type: 'click', critRoll });
    const float: Float = {
      id: nextId.current++,
      text: crit
        ? reduceMotion
          ? `+${formatNumber(value)} ✦ (a stroke of genius!)`
          : `+${formatNumber(value)} ✦`
        : `+${formatNumber(value)}`,
      x: Math.round((Math.random() * 2 - 1) * 30),
      buffed: isBuffActive(store.getState(), now),
      crit,
    };
    if (crit && !reduceMotion) {
      setCritNonce((n) => n + 1); // retriggers critFlash on the disc
      setShowCaption(true);
    }
    if (reduceMotion) {
      // Static "+X" for 500ms next to the button (04 §5, reduced motion).
      setStaticFloat(float);
      if (staticTimer.current !== null) window.clearTimeout(staticTimer.current);
      staticTimer.current = window.setTimeout(() => setStaticFloat(null), 500);
    } else {
      setFloats((prev) => {
        const next = [...prev, float];
        // Pool: never more than 12 nodes — recycle the oldest.
        return next.length > MAX_FLOATS ? next.slice(next.length - MAX_FLOATS) : next;
      });
    }
  }, [dispatch, reduceMotion, store]);

  return (
    <div className="click-area-wrap">
      <div className="click-floats" aria-hidden="true">
        {floats.map((f) => (
          <span
            key={f.id}
            className={`floating-number anim-float-up num${f.buffed ? ' floating-number--buff' : ''}${
              f.crit ? ' floating-number--crit' : ''
            }`}
            style={{ marginLeft: `${f.x}px` }}
            onAnimationEnd={() => removeFloat(f.id)}
            data-testid="floating-number"
            data-crit={f.crit ? 'true' : undefined}
          >
            {f.text}
          </span>
        ))}
        {staticFloat && (
          <span
            key={`s${staticFloat.id}`}
            className={`floating-number floating-number--static num${
              staticFloat.buffed ? ' floating-number--buff' : ''
            }${staticFloat.crit ? ' floating-number--crit' : ''}`}
            data-testid="floating-number"
            data-crit={staticFloat.crit ? 'true' : undefined}
          >
            {staticFloat.text}
          </span>
        )}
      </div>
      <button
        type="button"
        // key remount on critNonce would drop focus — instead the flash lives
        // on an overlay span so the disc itself never re-mounts.
        className={`click-button anim-pressable${buffed ? ' click-button--buff anim-ember-pulse' : ' anim-breathe-glow'}`}
        onClick={handleClick}
        data-testid="click-area"
      >
        {critNonce > 0 && (
          <span key={critNonce} className="click-button__crit-flash anim-crit-flash" aria-hidden="true" />
        )}
        <span className="click-button__label">
          Weave <span aria-hidden="true">{ICON.inspiration}</span>
        </span>
      </button>
      {showCaption && (
        <p
          key={critNonce}
          className="crit-caption anim-crit-caption"
          data-testid="crit-caption"
          onAnimationEnd={() => setShowCaption(false)}
        >
          A stroke of genius!
        </p>
      )}
      {showGuide && (
        <p className="click-guide" data-testid="click-guide">
          Weave your first sparks of Inspiration <span aria-hidden="true">{ICON.inspiration}</span>
        </p>
      )}
    </div>
  );
}
