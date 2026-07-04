// BottomNav (04 §3.3) — fixed mobile nav, 4 tabs ≥48px tall, gold badge-dot
// when something new is affordable/unlocked inside a tab, safe-area padding.
// Locked tabs (Upgrades, Fable) are not rendered until their milestone.

import './BottomNav.css';

export interface NavDef<T extends string> {
  id: T;
  label: string;
  icon: string;
  badge?: boolean;
  /** v2: violet badge for the Atelier tab (12 §1.3). */
  badgeVariant?: 'quill';
  testId?: string;
  /** Act 2 staggered reveal (12 §1.4). */
  revealDelayMs?: number;
}

interface BottomNavProps<T extends string> {
  items: NavDef<T>[];
  active: T;
  onSelect: (id: T) => void;
}

export function BottomNav<T extends string>({ items, active, onSelect }: BottomNavProps<T>) {
  return (
    // 5 tabs (post-Publish, 12 §1.3): labels drop from 12px to 11px so
    // "Upgrades" still fits untruncated at 375px.
    <nav className={`bottom-nav${items.length >= 5 ? ' bottom-nav--five' : ''}`} aria-label="Game sections">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`bottom-nav__item anim-reveal-in${item.id === active ? ' is-active' : ''}`}
          aria-current={item.id === active ? 'page' : undefined}
          style={
            item.revealDelayMs
              ? { animationDelay: `${item.revealDelayMs}ms`, animationFillMode: 'backwards' }
              : undefined
          }
          onClick={() => onSelect(item.id)}
          data-testid={item.testId ?? `tab-${item.id}`}
        >
          <span className="bottom-nav__icon" aria-hidden="true">
            {item.icon}
            {item.badge && (
              <span
                className={`bottom-nav__badge${
                  item.badgeVariant === 'quill' ? ' bottom-nav__badge--quill' : ''
                }`}
                aria-hidden="true"
              />
            )}
          </span>
          <span className="bottom-nav__label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
