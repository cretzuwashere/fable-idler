// OfflineModal (04 §4.11) — "While you were away…", max 420px, ⏳, absence
// duration, gained Inspiration with a 1200ms countUp JS tween (instant under
// reduced motion), efficiency line, single "Collect ✨" CTA. Escape / click
// outside collect too — the reward was already credited at bootstrap, the
// modal is the celebration, never a decision.

import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '../../engine';
import type { OfflineReport } from '../../engine';
import { formatDuration } from '../format';
import { ICON } from '../icons';
import { Modal } from './Modal';
import './OfflineModal.css';

interface OfflineModalProps {
  report: OfflineReport;
  reduceMotion: boolean;
  onClose: () => void;
}

function useCountUp(target: number, durationMs: number, instant: boolean): number {
  const [value, setValue] = useState(instant ? target : 0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (instant) {
      setValue(target);
      return undefined;
    }
    const start = performance.now();
    const step = (t: number) => {
      const progress = Math.min(1, (t - start) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [target, durationMs, instant]);

  return value;
}

export function OfflineModal({ report, reduceMotion, onClose }: OfflineModalProps) {
  const shown = useCountUp(report.gained, 1200, reduceMotion);

  return (
    <Modal
      title={
        <>
          <span aria-hidden="true">{ICON.offline}</span> While you were away…
        </>
      }
      onClose={onClose}
      testId="offline-modal"
      hideClose
    >
      <p className="offline-modal__whisper">
        …the library kept whispering. You were gone{' '}
        <strong className="num">{formatDuration(report.elapsedMs)}</strong>.
      </p>
      <div className="offline-modal__gained num" data-testid="offline-gained">
        +{formatNumber(shown)} <span aria-hidden="true">{ICON.inspiration}</span>
      </div>
      <p className="offline-modal__efficiency">
        at {Math.round(report.efficiency * 100)}% efficiency
        {/* v2: The Reader's Letter alone gives 60% — only ≥75% means Lucid Dreaming */}
        {report.efficiency >= 0.75 && <> — Lucid Dreaming</>}
        {report.cappedMs < report.elapsedMs && (
          <> · capped at {formatDuration(report.cappedMs)}</>
        )}
      </p>
      <button type="button" className="offline-modal__collect" onClick={onClose} data-testid="offline-collect">
        Collect <span aria-hidden="true">{ICON.inspiration}</span>
      </button>
    </Modal>
  );
}
