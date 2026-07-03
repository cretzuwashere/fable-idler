// Modal — shared dialog shell (04 §4.11/13, §7.4): focus trap, Escape,
// aria-modal + aria-labelledby, backdrop click to close, modalIn animation (220ms).

import { useEffect, useId, useRef, type ReactNode } from 'react';
import './Modal.css';

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
  /** Max width in px (default 420 per OfflineModal spec; Settings uses 520). */
  maxWidth?: number;
  /** Hide the corner ✕ (offline modal has a single CTA). */
  hideClose?: boolean;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select, [tabindex]:not([tabindex="-1"])';

/** Stack of open modals so Escape/Tab only act on the TOPMOST one
 *  (Settings can have a reset confirmation dialog layered on top). */
const modalStack: symbol[] = [];

export function Modal({ title, onClose, children, testId, maxWidth = 420, hideClose }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);
  const titleId = useId();
  const stackId = useRef<symbol | null>(null);
  if (stackId.current === null) stackId.current = Symbol('modal');

  useEffect(() => {
    const id = stackId.current as symbol;
    modalStack.push(id);
    return () => {
      const i = modalStack.indexOf(id);
      if (i >= 0) modalStack.splice(i, 1);
    };
  }, []);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    const panel = panelRef.current;
    if (panel) {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus();
    }
    return () => {
      const prev = previouslyFocused.current;
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (modalStack[modalStack.length - 1] !== stackId.current) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      // Focus outside the panel (e.g. lost to <body> after a chained dialog
      // closed) is recaptured in BOTH directions — the trap must be airtight.
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return (
    <div className="modal-backdrop anim-backdrop-in" onClick={onClose}>
      <div
        ref={panelRef}
        className="modal-panel anim-modal-in"
        style={{ maxWidth: `${maxWidth}px` }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 className="modal-title" id={titleId}>{title}</h2>
          {!hideClose && (
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Close"
              data-testid={testId ? `${testId}-close` : undefined}
            >
              ✕
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
