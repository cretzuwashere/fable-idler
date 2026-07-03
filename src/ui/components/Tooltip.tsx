// Tooltip — the single reusable tooltip (04 §4.15): hover on desktop, focus,
// tap on mobile. 150ms delay, max 260px, ink-deep background, shadow-pop.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import './Tooltip.css';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  /** Extra class on the wrapper (layout contexts like grid cells). */
  className?: string;
}

export function Tooltip({ content, children, className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | null>(null);

  // Clear the pending 150ms show-timer if the wrapper unmounts mid-hover
  // (e.g. the hovered row disappears at prestige).
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const show = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(true), 150);
  }, []);

  const hide = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setVisible(false);
  }, []);

  return (
    <span
      className={className ? `tooltip-wrap ${className}` : 'tooltip-wrap'}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span role="tooltip" className="tooltip-bubble">
          {content}
        </span>
      )}
    </span>
  );
}
