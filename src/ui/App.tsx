// App.tsx — layout (04 §3), progressive UI reveal (04 §6, driven ONLY by
// engine milestone flags — no thresholds duplicated here), toast queue fed by
// store.subscribeToEvents, prestigeFade sequence, offline + settings modals.
//
// Layouts: ≥1100px 3 zones (sticky left 340px) · 720–1099px 2 zones (Fable tab)
// · <720px stack + 4-tab bottom nav. "Solo mode" (centered altar) until the
// first reveal milestone / first achievement.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACHIEVEMENTS,
  bulkCost,
  canPrestige,
  costOf,
  formatNumber,
  GENERATOR_INDEX,
  GENERATORS,
  hasMilestone,
  hasUpgrade,
  isGeneratorRevealed,
  isUpgradeUnlocked,
  maxAffordable,
  prestigePreview,
  REVEAL_MILESTONES,
  UPGRADES,
} from '../engine';
import type { GameEvent, GeneratorId, OfflineReport } from '../engine';
import { AchievementGrid } from './components/AchievementGrid';
import { BottomNav, type NavDef } from './components/BottomNav';
import { BuffButton } from './components/BuffButton';
import { ClickButton } from './components/ClickButton';
import { GeneratorList } from './components/GeneratorList';
import { IconCoin } from './components/IconCoin';
import { MilestoneTracker } from './components/MilestoneTracker';
import { OfflineModal } from './components/OfflineModal';
import { PrestigePanel } from './components/PrestigePanel';
import { ResourceHeader } from './components/ResourceHeader';
import { SettingsPanel } from './components/SettingsPanel';
import { StatsStrip } from './components/StatsStrip';
import { TabBar, type TabDef } from './components/TabBar';
import { ToastHost, type ToastData, type ToastKind } from './components/Toast';
import { UpgradeList } from './components/UpgradeList';
import { useDispatch, useGameEvents, useGameStore, useStore } from './hooks/useGameStore';
import { useLayoutMode, usePrefersReducedMotion } from './hooks/useLayoutMode';
import { ICON } from './icons';
import { OFFLINE_MODAL_UI_MIN_MS } from './meta';
import './App.css';

type CenterTab = 'generators' | 'upgrades' | 'fable';
type MobileTab = 'weave' | 'shop' | 'upgrades' | 'fable';

interface PrestigeFx {
  quills: number;
}

export function App({ offlineReport }: { offlineReport: OfflineReport | null }) {
  const state = useGameStore();
  const store = useStore();
  const dispatch = useDispatch();
  const layout = useLayoutMode();
  const osReducedMotion = usePrefersReducedMotion();
  const reduceMotion = osReducedMotion || state.meta.settings.reduceMotion === true;

  // ---- progressive reveal flags (engine milestones only, 04 §6) ----
  const genPanelVisible = hasMilestone(state, 'theFirstSpark');
  const upgradesTabVisible = hasMilestone(state, 'craftsmansTools');
  const achievementsVisible = hasMilestone(state, 'hallOfDeeds');
  const prestigeVisible = hasMilestone(state, 'thePublishersLetter');
  const fableVisible = achievementsVisible || prestigeVisible;
  const solo = !genPanelVisible && !fableVisible;

  // ---- toasts (max 3 visible + queue, in ToastHost) ----
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toastId = useRef(1);
  const pushToast = useCallback((kind: ToastKind, title: string, body?: string) => {
    setToasts((prev) => [...prev, { id: toastId.current++, kind, title, body }]);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ---- resource shimmer on milestone unlock ----
  const [shimmerNonce, setShimmerNonce] = useState(0);

  // ---- "While you were away" modal: bootstrap report (prop) OR a runtime
  // gap > 60s routed through the offline path by the game loop (offline event).
  const [activeOfflineReport, setActiveOfflineReport] = useState<OfflineReport | null>(
    offlineReport,
  );

  const handleEvent = useCallback(
    (event: GameEvent) => {
      if (event.type === 'offline') {
        // Same UI threshold as bootstrap (04 §4.11): ≥60s away AND a real gain.
        if (event.report.elapsedMs >= OFFLINE_MODAL_UI_MIN_MS && event.report.gained > 0) {
          setActiveOfflineReport(event.report);
        }
        return;
      }
      if (event.type === 'milestone') {
        setShimmerNonce((n) => n + 1);
        const reveal = REVEAL_MILESTONES.find((m) => m.id === event.id);
        if (reveal) {
          pushToast('milestone', reveal.name, reveal.description);
          return;
        }
        // quantity milestone: `qty:<generatorId>:<threshold>`
        const [, generatorId, threshold] = event.id.split(':');
        const cfg = GENERATOR_INDEX[generatorId as GeneratorId];
        if (cfg) {
          pushToast('milestone', `${cfg.name} ×2!`, `${threshold} owned — their production doubles.`);
        }
        return;
      }
      const achievement = ACHIEVEMENTS.find((a) => a.id === event.id);
      if (achievement) {
        const pct = hasUpgrade(store.getState(), 'boundAnthology') ? 2 : 1;
        pushToast('achievement', achievement.name, `${achievement.description} · +${pct}% production`);
      }
    },
    [pushToast, store],
  );
  useGameEvents(handleEvent);

  // ---- tabs ----
  const [centerTab, setCenterTab] = useState<CenterTab>('generators');
  const [mobileTab, setMobileTab] = useState<MobileTab>('weave');

  const centerTabs: TabDef<CenterTab>[] = [{ id: 'generators', label: 'Generators', testId: 'tab-generators' }];
  if (upgradesTabVisible) centerTabs.push({ id: 'upgrades', label: 'Upgrades', testId: 'tab-upgrades' });
  if (layout === 'tablet' && fableVisible) centerTabs.push({ id: 'fable', label: 'Fable', testId: 'tab-fable' });
  const activeCenterTab: CenterTab = centerTabs.some((t) => t.id === centerTab) ? centerTab : 'generators';

  // mobile badges: something new to buy / a decision waiting (04 §3.3)
  const anyGeneratorAffordable = GENERATORS.some((g) => {
    if (!isGeneratorRevealed(state, g.id)) return false;
    const qty = state.meta.settings.buyQty ?? 1;
    if (qty === 'max') return maxAffordable(state, g.id) >= 1;
    const cost = qty === 1 ? costOf(state, g.id) : bulkCost(state, g.id, qty);
    return cost <= state.run.inspiration;
  });
  const anyUpgradeAffordable = UPGRADES.some(
    (u) =>
      !hasUpgrade(state, u.id) &&
      isUpgradeUnlocked(state, u.id) &&
      state.run.inspiration >= u.cost,
  );

  const mobileNavItems: NavDef<MobileTab>[] = [{ id: 'weave', label: 'Weave', icon: ICON.inspiration, testId: 'tab-weave' }];
  if (genPanelVisible) {
    mobileNavItems.push({ id: 'shop', label: 'Shop', icon: ICON.shop, badge: anyGeneratorAffordable, testId: 'tab-shop' });
  }
  if (upgradesTabVisible) {
    mobileNavItems.push({ id: 'upgrades', label: 'Upgrades', icon: ICON.upgrades, badge: anyUpgradeAffordable, testId: 'tab-upgrades' });
  }
  if (fableVisible) {
    mobileNavItems.push({ id: 'fable', label: 'Fable', icon: ICON.prestige, badge: canPrestige(state), testId: 'tab-fable' });
  }
  const activeMobileTab: MobileTab = mobileNavItems.some((t) => t.id === mobileTab) ? mobileTab : 'weave';

  // ---- modals ----
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ---- prestigeFade (04 §5 #11): fade-out 500ms → hold 400ms → fade-in 500ms ----
  // The quills value also lives in a ref so finishPrestige never runs a side
  // effect (pushToast) inside a state updater — updaters must stay pure
  // (StrictMode double-invokes them and would double the toast).
  const [prestigeFx, setPrestigeFx] = useState<PrestigeFx | null>(null);
  const prestigeFxRef = useRef<PrestigeFx | null>(null);
  const handlePublish = useCallback(() => {
    const quills = prestigePreview(store.getState());
    prestigeFxRef.current = { quills };
    setPrestigeFx({ quills });
  }, [store]);
  const commitPrestige = useCallback(() => {
    dispatch({ type: 'prestige' });
  }, [dispatch]);
  const finishPrestige = useCallback(() => {
    const fx = prestigeFxRef.current;
    prestigeFxRef.current = null;
    if (fx) {
      pushToast('prestige', 'The Tome is published!', `+${formatNumber(fx.quills)} Golden Quills`);
    }
    setPrestigeFx(null);
  }, [pushToast]);

  // ---- shared fragments ----
  const altar = (
    <div className="altar">
      <ResourceHeader state={state} shimmerNonce={shimmerNonce} />
      <ClickButton state={state} reduceMotion={reduceMotion} showGuide={solo} />
      <BuffButton state={state} />
      {genPanelVisible && <StatsStrip state={state} />}
    </div>
  );

  const fableStack = (
    <div className="fable-stack">
      {prestigeVisible && <PrestigePanel state={state} onPublish={handlePublish} />}
      {genPanelVisible && <MilestoneTracker state={state} />}
      {achievementsVisible && <AchievementGrid state={state} />}
    </div>
  );

  const centerPanel = (
    <div
      role="tabpanel"
      id={`tabpanel-${activeCenterTab}`}
      aria-labelledby={`tab-${activeCenterTab}`}
      className="center-panel"
    >
      {activeCenterTab === 'generators' && <GeneratorList state={state} />}
      {activeCenterTab === 'upgrades' && <UpgradeList state={state} />}
      {activeCenterTab === 'fable' && fableStack}
    </div>
  );

  // ---- grid columns per layout / visibility ----
  const showCenter = !solo && genPanelVisible;
  const showRight = !solo && layout === 'desktop' && (prestigeVisible || genPanelVisible || achievementsVisible);
  const columns: string[] = [];
  if (!solo) {
    columns.push(layout === 'desktop' ? '340px' : '300px');
    if (showCenter) columns.push('minmax(0, 1fr)');
    if (showRight) columns.push('320px');
  }

  return (
    <div className={`app${reduceMotion ? ' reduce-motion' : ''}`} data-layout={layout}>
      <header className={`app-header${layout === 'mobile' ? ' app-header--compact' : ''}`}>
        <div className="app-header__brand">
          <IconCoin emoji={ICON.prestige} small />
          <h1 className="app-header__title">Fable Idler</h1>
        </div>
        <div className="app-header__side">
          {(state.meta.goldenQuills > 0 || state.meta.tomesPublished > 0) && (
            <span className="app-header__quills num" data-testid="golden-quills" title="Golden Quills">
              <span aria-hidden="true">{ICON.goldenQuills}</span> {formatNumber(state.meta.goldenQuills)}
              {layout !== 'mobile' && <span className="app-header__quills-label"> Golden Quills</span>}
            </span>
          )}
          <button
            type="button"
            className="app-header__settings"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
            data-testid="settings-open"
          >
            <span aria-hidden="true">{ICON.settings}</span>
          </button>
        </div>
      </header>

      {solo ? (
        <main className="app-solo">{altar}</main>
      ) : layout === 'mobile' ? (
        <main className="app-mobile">
          <div className="app-mobile__resource">
            <ResourceHeader state={state} shimmerNonce={shimmerNonce} compact />
          </div>
          <div className="app-mobile__content">
            {activeMobileTab === 'weave' && (
              <div className="altar altar--mobile">
                <ClickButton state={state} reduceMotion={reduceMotion} showGuide={solo} />
                <BuffButton state={state} />
                {genPanelVisible && <StatsStrip state={state} />}
              </div>
            )}
            {activeMobileTab === 'shop' && <GeneratorList state={state} />}
            {activeMobileTab === 'upgrades' && <UpgradeList state={state} />}
            {activeMobileTab === 'fable' && fableStack}
          </div>
          {mobileNavItems.length > 1 && (
            <BottomNav items={mobileNavItems} active={activeMobileTab} onSelect={setMobileTab} />
          )}
        </main>
      ) : (
        <main className="app-main" style={{ gridTemplateColumns: columns.join(' ') }}>
          <section className="col-left">{altar}</section>
          {showCenter && (
            <section className="col-center anim-reveal-in">
              <TabBar tabs={centerTabs} active={activeCenterTab} onSelect={setCenterTab} ariaLabel="Workshop" />
              {centerPanel}
            </section>
          )}
          {showRight && <aside className="col-right anim-reveal-in">{fableStack}</aside>}
        </main>
      )}

      <ToastHost toasts={toasts} onDismiss={dismissToast} />

      {activeOfflineReport && (
        <OfflineModal
          report={activeOfflineReport}
          reduceMotion={reduceMotion}
          onClose={() => setActiveOfflineReport(null)}
        />
      )}

      {settingsOpen && <SettingsPanel state={state} onClose={() => setSettingsOpen(false)} />}

      {prestigeFx && (
        <PrestigeOverlay
          quills={prestigeFx.quills}
          reduceMotion={reduceMotion}
          onCommit={commitPrestige}
          onDone={finishPrestige}
        />
      )}
    </div>
  );
}

/**
 * prestigeFade (04 §5 #11): overlay covers the UI (500ms ease-in), holds 400ms
 * with the message while the run is reset, then clears (500ms ease-out).
 * Reduced motion: a plain 300ms fade (CSS side) with the same sequence.
 */
function PrestigeOverlay({
  quills,
  reduceMotion,
  onCommit,
  onDone,
}: {
  quills: number;
  reduceMotion: boolean;
  onCommit: () => void;
  onDone: () => void;
}) {
  const [stage, setStage] = useState<'cover' | 'hold' | 'clear'>('cover');
  const [opaque, setOpaque] = useState(false);
  const committed = useRef(false);

  useEffect(() => {
    const coverMs = reduceMotion ? 300 : 500;
    const holdMs = 400;
    const clearMs = reduceMotion ? 300 : 500;
    const raf = requestAnimationFrame(() => setOpaque(true));
    const t1 = window.setTimeout(() => {
      if (!committed.current) {
        committed.current = true;
        onCommit();
      }
      setStage('hold');
    }, coverMs);
    const t2 = window.setTimeout(() => {
      setStage('clear');
      setOpaque(false);
    }, coverMs + holdMs);
    const t3 = window.setTimeout(onDone, coverMs + holdMs + clearMs);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
    // The sequence runs exactly once per overlay mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`prestige-overlay anim-prestige-overlay${stage === 'clear' ? ' is-clearing' : ''}`}
      style={{ opacity: opaque ? 1 : 0 }}
      data-testid="prestige-overlay"
    >
      {stage !== 'cover' && (
        <p className="prestige-overlay__message anim-reveal-in num">
          The Tome is published. +{formatNumber(quills)}{' '}
          <span aria-hidden="true">{ICON.goldenQuills}</span>
        </p>
      )}
    </div>
  );
}
