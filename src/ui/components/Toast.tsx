// Toast (04 §4.12) — bottom-right stack (above the bottom nav on mobile),
// max 3 visible + queue, auto-dismiss 4s, pause on hover, dismiss on click,
// aria-live="polite". Types: milestone / achievement / unlock / prestige.
// App owns the queue (fed by store.subscribeToEvents) — this file renders it.

import { useEffect, useRef, useState } from 'react';
import { ICON } from '../icons';
import './Toast.css';

export type ToastKind = 'milestone' | 'achievement' | 'unlock' | 'prestige';

export interface ToastData {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 4000;

const KIND_ICON: Record<ToastKind, string> = {
  milestone: ICON.milestones,
  achievement: ICON.achievements,
  unlock: ICON.inspiration,
  prestige: ICON.prestige,
};

interface ToastHostProps {
  toasts: ToastData[];
  onDismiss: (id: number) => void;
}

export function ToastHost({ toasts, onDismiss }: ToastHostProps) {
  const visible = toasts.slice(0, MAX_VISIBLE);
  return (
    <div className="toast-container" aria-live="polite" data-testid="toast-container">
      {visible.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: number) => void }) {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | null>(null);
  const remaining = useRef(AUTO_DISMISS_MS);
  const startedAt = useRef(0);

  const beginLeave = () => setLeaving(true);

  useEffect(() => {
    startedAt.current = Date.now();
    timer.current = window.setTimeout(beginLeave, remaining.current);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const pause = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
      remaining.current = Math.max(600, remaining.current - (Date.now() - startedAt.current));
    }
  };

  const resume = () => {
    if (timer.current === null && !leaving) {
      startedAt.current = Date.now();
      timer.current = window.setTimeout(beginLeave, remaining.current);
    }
  };

  return (
    <button
      type="button"
      className={`toast toast--${toast.kind} ${leaving ? 'anim-toast-out' : 'anim-toast-in'}`}
      onClick={beginLeave}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onAnimationEnd={() => {
        if (leaving) onDismiss(toast.id);
      }}
      data-testid="toast"
      data-toast-kind={toast.kind}
    >
      <span className="toast__icon icon-coin icon-coin--sm" aria-hidden="true">
        {KIND_ICON[toast.kind]}
      </span>
      <span className="toast__text">
        <span className="toast__title">{toast.title}</span>
        {toast.body && <span className="toast__body">{toast.body}</span>}
      </span>
    </button>
  );
}
