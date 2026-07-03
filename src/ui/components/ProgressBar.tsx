// ProgressBar — shared bar with progressFill transition (04 §5 #9) and a
// gold-bright flash when it reaches 100%. role="progressbar" + aria-valuenow.

import { useEffect, useRef, useState } from 'react';
import './ProgressBar.css';

interface ProgressBarProps {
  /** 0..1 */
  value: number;
  label?: string;
  /** quill-colored variant for the prestige panel */
  variant?: 'gold' | 'quill';
  testId?: string;
}

export function ProgressBar({ value, label, variant = 'gold', testId }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const pct = Math.round(clamped * 1000) / 10;
  const wasFull = useRef(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (clamped >= 1 && !wasFull.current) {
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 250);
      wasFull.current = true;
      return () => window.clearTimeout(t);
    }
    if (clamped < 1) wasFull.current = false;
    return undefined;
  }, [clamped]);

  return (
    <div
      className={`progress-bar progress-bar--${variant}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.floor(pct)}
      aria-label={label}
      data-testid={testId}
    >
      <div
        className={`progress-bar__fill anim-progress-fill${flash ? ' anim-progress-flash' : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
