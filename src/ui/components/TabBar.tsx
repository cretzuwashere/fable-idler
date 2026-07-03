// TabBar (04 §4.14 / §3.1–3.2) — real tabs (role=tablist/tab, aria-selected,
// animated gold underline) for the center column: Generators | Upgrades
// (| Fable on tablet). Locked tabs are NOT rendered at all; they arrive with
// revealIn (+ toast from the milestone event).

import './TabBar.css';

export interface TabDef<T extends string> {
  id: T;
  label: string;
  icon?: string;
  testId?: string;
}

interface TabBarProps<T extends string> {
  tabs: TabDef<T>[];
  active: T;
  onSelect: (id: T) => void;
  ariaLabel: string;
}

export function TabBar<T extends string>({ tabs, active, onSelect, ariaLabel }: TabBarProps<T>) {
  // WAI-ARIA tabs pattern: roving tabindex (only the active tab is in the Tab
  // order) + ArrowLeft/ArrowRight/Home/End move selection AND focus.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = tabs.findIndex((t) => t.id === active);
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = tabs.length - 1;
    if (nextIdx === null || nextIdx === idx) return;
    e.preventDefault();
    const next = tabs[nextIdx];
    onSelect(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };

  return (
    <div className="tab-bar" role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={tab.id === active}
          // Only the ACTIVE tabpanel exists in the DOM (App renders one), so
          // aria-controls must only reference it from the selected tab.
          aria-controls={tab.id === active ? `tabpanel-${tab.id}` : undefined}
          tabIndex={tab.id === active ? 0 : -1}
          className={`tab-bar__tab anim-reveal-in${tab.id === active ? ' is-active' : ''}`}
          onClick={() => onSelect(tab.id)}
          data-testid={tab.testId ?? `tab-${tab.id}`}
        >
          {tab.icon && <span aria-hidden="true">{tab.icon} </span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
