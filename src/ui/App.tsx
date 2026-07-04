// App.tsx — layout (04 §3 + 12 §1), progressive UI reveal (04 §6, driven ONLY
// by engine milestone flags — no thresholds duplicated here), toast queue fed
// by store.subscribeToEvents, prestigeFade sequence, offline + settings modals.
//
// Layouts: ≥1100px 3 zones (sticky left 340px) · 720–1099px 2 zones (Fable tab)
// · <720px stack + bottom nav. "Solo mode" (centered altar) until the first
// reveal milestone / first achievement.
//
// v2 (12): center tabs grow to Generators|Upgrades|Atelier|Hall of Fables on
// desktop (Hall is a SECTION inside Fable on tablet/mobile); the mobile nav
// gains a 5th Atelier tab after the first Publish; BookshelfPanel sits right
// under PrestigePanel; the StraySparkLayer floats over everything (below
// toasts/modals); "Act 2" reveals stagger Bookshelf → Atelier → Hall 250ms
// apart as the prestige overlay clears.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACHIEVEMENTS,
  ATELIER_UPGRADES,
  bulkCost,
  canBuyAtelierUpgrade,
  canPrestige,
  costOf,
  formatNumber,
  GENERATOR_INDEX,
  GENERATORS,
  hasMilestone,
  hasUpgrade,
  isGeneratorVisibleInShop,
  isUpgradeUnlocked,
  maxAffordable,
  prestigePreview,
  QTY_FINALE_MULT,
  QTY_FINALE_THRESHOLD,
  QTY_STEP_MULT,
  QUILL_BONUS,
  RELIC_INDEX,
  REVEAL_MILESTONES,
  uniqueThreshold,
  UPGRADES,
} from '../engine';
import type { GameEvent, GeneratorId, OfflineReport, SparkRewardSummary } from '../engine';
import { AchievementGrid } from './components/AchievementGrid';
import { AtelierPanel } from './components/AtelierPanel';
import { BookshelfPanel } from './components/BookshelfPanel';
import { BottomNav, type NavDef } from './components/BottomNav';
import { BuffButton } from './components/BuffButton';
import { ClickButton } from './components/ClickButton';
import { GeneratorList } from './components/GeneratorList';
import { HallOfFablesPanel } from './components/HallOfFablesPanel';
import { IconCoin } from './components/IconCoin';
import { MilestoneTracker } from './components/MilestoneTracker';
import { OfflineModal } from './components/OfflineModal';
import { PrestigePanel } from './components/PrestigePanel';
import { ResourceHeader } from './components/ResourceHeader';
import { SettingsPanel } from './components/SettingsPanel';
import { SparkBuffPill, StraySparkLayer } from './components/StraySpark';
import { StatsStrip } from './components/StatsStrip';
import { TabBar, type TabDef } from './components/TabBar';
import { ToastHost, type ToastData, type ToastKind } from './components/Toast';
import { UpgradeList } from './components/UpgradeList';
import { useDispatch, useGameEvents, useGameStore, useStore } from './hooks/useGameStore';
import { useLayoutMode, usePrefersReducedMotion } from './hooks/useLayoutMode';
import { useStraySpark } from './hooks/useStraySpark';
import { ICON, RELIC_ICONS } from './icons';
import type { LeaderboardClient } from './leaderboard-client';
import {
  ACT2_REVEAL_BASE_MS,
  ACT2_REVEAL_STAGGER_MS,
  OFFLINE_MODAL_UI_MIN_MS,
  SPARK_TUTORIAL_KEY,
} from './meta';
import { UNIQUE_BONUS_INFO } from './unique-bonuses-info';
import './App.css';

type CenterTab = 'generators' | 'upgrades' | 'atelier' | 'hall' | 'fable';
type MobileTab = 'weave' | 'shop' | 'upgrades' | 'atelier' | 'fable';

interface PrestigeFx {
  quills: number;
}

/** One-shot lifetime flag for the spark tutorial toast (UI-only, 09 §5.2). */
function sparkTutorialSeen(): boolean {
  try {
    return localStorage.getItem(SPARK_TUTORIAL_KEY) === '1';
  } catch {
    return true; // storage unavailable → skip the tutorial rather than repeat it
  }
}

function markSparkTutorialSeen(): void {
  try {
    localStorage.setItem(SPARK_TUTORIAL_KEY, '1');
  } catch {
    /* non-fatal */
  }
}

export function App({
  offlineReport,
  leaderboard,
}: {
  offlineReport: OfflineReport | null;
  leaderboard: LeaderboardClient;
}) {
  const state = useGameStore();
  const store = useStore();
  const dispatch = useDispatch();
  const layout = useLayoutMode();
  const osReducedMotion = usePrefersReducedMotion();
  const reduceMotion = osReducedMotion || state.meta.settings.reduceMotion === true;

  // ---- progressive reveal flags (engine milestones only, 04 §6 / 12 §1) ----
  const genPanelVisible = hasMilestone(state, 'theFirstSpark');
  const upgradesTabVisible = hasMilestone(state, 'craftsmansTools');
  const achievementsVisible = hasMilestone(state, 'hallOfDeeds');
  const prestigeVisible = hasMilestone(state, 'thePublishersLetter');
  const atelierVisible = hasMilestone(state, 'theGildedDoor');
  const bookshelfVisible = hasMilestone(state, 'theFirstSpine');
  const hallVisible = hasMilestone(state, 'wordTravelsFast');
  const fableVisible = achievementsVisible || prestigeVisible;
  const solo = !genPanelVisible && !fableVisible;

  // ---- toasts (max 3 visible + queue, in ToastHost) ----
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toastId = useRef(1);
  const pushToast = useCallback(
    (kind: ToastKind, title: string, body?: string, icon?: string) => {
      setToasts((prev) => [...prev, { id: toastId.current++, kind, title, body, icon }]);
    },
    [],
  );
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ---- resource shimmer on milestone unlock ----
  const [shimmerNonce, setShimmerNonce] = useState(0);

  // ---- "While you were away" modal ----
  const [activeOfflineReport, setActiveOfflineReport] = useState<OfflineReport | null>(
    offlineReport,
  );

  // ---- spark reward toasts (microcopy from 12 §8, numbers from the event) ----
  const sparkToast = useCallback(
    (reward: SparkRewardSummary) => {
      const nowMs = Date.now();
      switch (reward.kind) {
        case 'inkBurst':
          pushToast(
            'spark',
            'A stray spark!',
            `+${formatNumber(reward.inspiration)} Inspiration, straight from the aether.`,
          );
          return;
        case 'quillFrenzy': {
          const secs = reward.buff ? Math.round((reward.buff.activeUntil - nowMs) / 1000) : 30;
          pushToast('spark', 'The quill is frenzied!', `Clicks ×7 for ${secs}s. Write faster.`);
          return;
        }
        case 'gossipBonanza': {
          const secs = reward.buff ? Math.round((reward.buff.activeUntil - nowMs) / 1000) : 60;
          pushToast(
            'spark',
            'Gossip Bonanza!',
            `Muses, sprites and ravens produce ×5 for ${secs}s.`,
          );
          return;
        }
        case 'timeSlip':
          pushToast(
            'spark',
            'A slip in time.',
            'Your Moment of Inspiration returns at once — already lit.',
          );
          return;
        case 'storyFragment': {
          if (reward.boundQuill) {
            pushToast(
              'spark',
              'Five fragments, one truth:',
              `+${formatNumber(reward.quills)} Golden Quill${reward.quills > 1 ? 's' : ''}, bound by hand.`,
              ICON.fragments,
            );
          } else {
            const have = store.getState().meta.storyFragments;
            pushToast(
              'spark',
              'A fragment of an untold story.',
              `${have}/5 collected.`,
              ICON.fragments,
            );
          }
          return;
        }
        case 'goldenQuillDrop':
          pushToast(
            'spark',
            'A golden quill, out of thin air.',
            `The library pretends not to notice. +${formatNumber(reward.quills)} ${ICON.goldenQuills}`,
            ICON.goldenQuills,
          );
          return;
      }
    },
    [pushToast, store],
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
          // Spark tutorial — once per LIFETIME, at the first unlock (09 §5.2).
          if (event.id === 'aLightAtTheWindow' && !sparkTutorialSeen()) {
            markSparkTutorialSeen();
            pushToast('spark', 'Something glimmers past the window.', 'Catch it.');
          }
          return;
        }
        // quantity milestone: `qty:<generatorId>:<threshold>` — the message
        // depends on which threshold fired: a unique bonus (200/150), the ×4
        // grand finale (500), or a plain doubling (25/50/100/150/300/400).
        const [, generatorId, thresholdStr] = event.id.split(':');
        const cfg = GENERATOR_INDEX[generatorId as GeneratorId];
        if (cfg) {
          const threshold = Number(thresholdStr);
          const uThreshold = uniqueThreshold(store.getState());
          const bonus = UNIQUE_BONUS_INFO[generatorId as GeneratorId];
          if (threshold === uThreshold && bonus) {
            pushToast('milestone', `${cfg.name}: ${bonus.name}`, `${threshold} owned — ${bonus.effect}`);
          } else if (threshold === QTY_FINALE_THRESHOLD) {
            pushToast(
              'milestone',
              `${cfg.name} ×${QTY_FINALE_MULT}!`,
              `${threshold} owned — a grand finale for the deep shelves.`,
            );
          } else {
            pushToast(
              'milestone',
              `${cfg.name} ×${QTY_STEP_MULT}!`,
              `${threshold} owned — their production doubles.`,
            );
          }
        }
        return;
      }
      if (event.type === 'achievement') {
        const achievement = ACHIEVEMENTS.find((a) => a.id === event.id);
        if (achievement) {
          const pct = hasUpgrade(store.getState(), 'boundAnthology') ? 2 : 1;
          pushToast('achievement', achievement.name, `${achievement.description} · +${pct}% production`);
        }
        return;
      }
      // ---- v2 events (05 Engine v2 contract) ----
      if (event.type === 'sparkCollected') {
        sparkToast(event.reward);
        return;
      }
      if (event.type === 'relicUnlocked') {
        const relic = RELIC_INDEX[event.id];
        pushToast(
          'relic',
          'A relic takes its place in the Atelier:',
          relic.name,
          RELIC_ICONS[event.id],
        );
        return;
      }
      if (event.type === 'fablePenned') {
        const titles = store.getState().meta.fables.filter((f) => f.title === event.fable.title);
        if (titles.length > 1) {
          pushToast('fable', 'A reprint!', 'The shelf counts it but once.');
        } else {
          pushToast('fable', 'A new fable joins your shelf:', `“${event.fable.title}”`);
        }
        return;
      }
      // atelierPurchase: feedback is the card flash + walletSpend — no toast.
    },
    [pushToast, sparkToast, store],
  );
  useGameEvents(handleEvent);

  // ---- Stray Spark (shell owns the timer + RNG — 10 §3.1) ----
  const { spark, collect } = useStraySpark();

  // ---- tabs ----
  const [centerTab, setCenterTab] = useState<CenterTab>('generators');
  const [mobileTab, setMobileTab] = useState<MobileTab>('weave');

  // ---- "Act 2" staggered reveal at the FIRST Publish (12 §1.4) ----
  const [act2, setAct2] = useState(false);
  const act2Timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (act2Timer.current !== null) window.clearTimeout(act2Timer.current);
    },
    [],
  );
  const act2Delay = (index: number): number =>
    act2 ? ACT2_REVEAL_BASE_MS + index * ACT2_REVEAL_STAGGER_MS : 0;

  // Atelier badge: an upgrade is affordable (12 §1.1 — violet dot).
  const anyAtelierAffordable = ATELIER_UPGRADES.some((u) => canBuyAtelierUpgrade(state, u.id));

  const centerTabs: TabDef<CenterTab>[] = [
    { id: 'generators', label: 'Generators', testId: 'tab-generators' },
  ];
  if (upgradesTabVisible) centerTabs.push({ id: 'upgrades', label: 'Upgrades', testId: 'tab-upgrades' });
  if (atelierVisible) {
    centerTabs.push({
      id: 'atelier',
      label: 'Atelier',
      testId: 'tab-atelier',
      variant: 'quill',
      badge: anyAtelierAffordable,
      revealDelayMs: act2Delay(1),
    });
  }
  if (layout === 'desktop' && hallVisible) {
    centerTabs.push({
      id: 'hall',
      label: 'Hall of Fables',
      testId: 'tab-hall',
      variant: 'quill',
      revealDelayMs: act2Delay(2),
    });
  }
  if (layout === 'tablet' && fableVisible) {
    centerTabs.push({ id: 'fable', label: 'Fable', testId: 'tab-fable' });
  }
  const activeCenterTab: CenterTab = centerTabs.some((t) => t.id === centerTab)
    ? centerTab
    : 'generators';

  // mobile badges: something new to buy / a decision waiting (04 §3.3)
  const anyGeneratorAffordable = GENERATORS.some((g) => {
    if (!isGeneratorVisibleInShop(state, g.id)) return false;
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

  const mobileNavItems: NavDef<MobileTab>[] = [
    { id: 'weave', label: 'Weave', icon: ICON.inspiration, testId: 'tab-weave' },
  ];
  if (genPanelVisible) {
    mobileNavItems.push({ id: 'shop', label: 'Shop', icon: ICON.shop, badge: anyGeneratorAffordable, testId: 'tab-shop' });
  }
  if (upgradesTabVisible) {
    mobileNavItems.push({ id: 'upgrades', label: 'Upgrades', icon: ICON.upgrades, badge: anyUpgradeAffordable, testId: 'tab-upgrades' });
  }
  if (atelierVisible) {
    // The 5th tab exists ONLY post-Publish (12 §1.3) — fresh runs keep the v1 nav.
    mobileNavItems.push({
      id: 'atelier',
      label: 'Atelier',
      icon: ICON.atelier,
      badge: anyAtelierAffordable,
      badgeVariant: 'quill',
      testId: 'tab-atelier',
      revealDelayMs: act2Delay(1),
    });
  }
  if (fableVisible) {
    mobileNavItems.push({ id: 'fable', label: 'Fable', icon: ICON.prestige, badge: canPrestige(state), testId: 'tab-fable' });
  }
  const activeMobileTab: MobileTab = mobileNavItems.some((t) => t.id === mobileTab) ? mobileTab : 'weave';

  // ---- modals ----
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ---- wallet chip: walletSpend (#23) when the purse DECREASES ----
  const wallet = state.meta.goldenQuills;
  const lifetimeQuills = state.meta.stats.lifetimeQuillsEarned;
  const prevWallet = useRef(wallet);
  const [walletNonce, setWalletNonce] = useState(0);
  useEffect(() => {
    if (wallet < prevWallet.current) setWalletNonce((n) => n + 1);
    prevWallet.current = wallet;
  }, [wallet]);

  // ---- prestigeFade (04 §5 #11): fade-out 500ms → hold 400ms → fade-in 500ms ----
  const [prestigeFx, setPrestigeFx] = useState<PrestigeFx | null>(null);
  const prestigeFxRef = useRef<PrestigeFx | null>(null);
  const handlePublish = useCallback(() => {
    const current = store.getState();
    const quills = prestigePreview(current);
    if (current.meta.tomesPublished === 0) {
      // First Publish → Act 2: Bookshelf → Atelier → Hall reveal stagger.
      setAct2(true);
      if (act2Timer.current !== null) window.clearTimeout(act2Timer.current);
      act2Timer.current = window.setTimeout(() => setAct2(false), 5000);
    }
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
      <SparkBuffPill state={state} />
      {genPanelVisible && <StatsStrip state={state} />}
    </div>
  );

  const hallPanel = hallVisible ? (
    <HallOfFablesPanel
      state={state}
      client={leaderboard}
      onToast={(title, body) => pushToast('unlock', title, body, ICON.hall)}
      revealDelayMs={act2Delay(2)}
    />
  ) : null;

  /** Prestige → Bookshelf → Milestones → Achievements (→ Hall on tablet/mobile).
   *  The section order is contract (12 §1.2/§1.3). */
  const fableStack = (includeHall: boolean) => (
    <div className="fable-stack">
      {prestigeVisible && <PrestigePanel state={state} onPublish={handlePublish} />}
      {bookshelfVisible && <BookshelfPanel state={state} revealDelayMs={act2Delay(0)} />}
      {genPanelVisible && <MilestoneTracker state={state} />}
      {achievementsVisible && <AchievementGrid state={state} />}
      {includeHall && hallPanel}
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
      {activeCenterTab === 'atelier' && <AtelierPanel state={state} />}
      {/* Hall tab (desktop only): mounted ⇒ visible — the 60s refresh rule
          becomes structural (12 §1.1). */}
      {activeCenterTab === 'hall' && hallPanel}
      {activeCenterTab === 'fable' && fableStack(true)}
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
          {(wallet > 0 || state.meta.tomesPublished > 0 || lifetimeQuills > 0) && (
            <span
              key={walletNonce}
              className={`app-header__quills num${walletNonce > 0 ? ' anim-wallet-spend' : ''}`}
              data-testid="golden-quills"
              // v2 semantics (12 §2.1): the chip shows the PURSE; the tooltip
              // carries the lifetime anchor of the production bonus.
              title={`Purse ${formatNumber(wallet)} ${ICON.goldenQuills} · Lifetime ${formatNumber(
                lifetimeQuills,
              )} ${ICON.goldenQuills} — your +${Math.round(
                lifetimeQuills * QUILL_BONUS * 100,
              )}% production never decreases.`}
            >
              <span aria-hidden="true">{ICON.goldenQuills}</span> {formatNumber(wallet)}
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
                <SparkBuffPill state={state} />
                {genPanelVisible && <StatsStrip state={state} />}
              </div>
            )}
            {activeMobileTab === 'shop' && <GeneratorList state={state} />}
            {activeMobileTab === 'upgrades' && <UpgradeList state={state} />}
            {activeMobileTab === 'atelier' && <AtelierPanel state={state} />}
            {activeMobileTab === 'fable' && fableStack(true)}
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
          {showRight && <aside className="col-right anim-reveal-in">{fableStack(false)}</aside>}
        </main>
      )}

      <StraySparkLayer
        spark={spark}
        reduceMotion={reduceMotion}
        layout={layout}
        onCollect={collect}
      />

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
