// BottomNav (04 §3.3) — fixed mobile nav, 4 tabs ≥48px tall, gold badge-dot
// when something new is affordable/unlocked inside a tab, safe-area padding.
// Locked tabs (Upgrades, Fable) are not rendered until their milestone.

import './BottomNav.css';

export interface NavDef<T extends string> {
  id: T;
  label: string;
  icon: string;
  badge?: boolean;
  testId?: string;
}

interface BottomNavProps<T extends string> {
  items: NavDef<T>[];
  active: T;
  onSelect: (id: T) => void;
}

export function BottomNav<T extends string>({ items, active, onSelect }: BottomNavProps<T>) {
  return (
    <nav className="bottom-nav" aria-label="Game sections">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`bottom-nav__item anim-reveal-in${item.id === active ? ' is-active' : ''}`}
          aria-current={item.id === active ? 'page' : undefined}
          onClick={() => onSelect(item.id)}
          data-testid={item.testId ?? `tab-${item.id}`}
        >
          <span className="bottom-nav__icon" aria-hidden="true">
            {item.icon}
            {item.badge && <span className="bottom-nav__badge" aria-hidden="true" />}
          </span>
          <span className="bottom-nav__label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
