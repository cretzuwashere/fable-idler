// HallOfFablesPanel (12 §6) — the leaderboard card. NOTHING in here may ever
// block the game: every error lives inside the card, every network failure is
// silent. The panel only CONSUMES the leaderboard-client mini-store — no
// fetch calls in the component tree. Refresh rules: first GET when the panel
// becomes visible (IntersectionObserver ∧ tab visible), then every 60s while
// visible; manual "Update now" has a 5s cooldown and bypasses throttles.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { formatNumber } from '../../engine';
import type { GameState } from '../../engine';
import { formatDuration } from '../format';
import { ICON } from '../icons';
import type {
  LeaderboardClient,
  LeaderboardMetric,
  LeaderboardTop,
} from '../leaderboard-client';
import { LEADERBOARD_MANUAL_COOLDOWN_MS, LEADERBOARD_REFRESH_MS } from '../meta';
import './HallOfFablesPanel.css';

type ScoreTabKey = 'lifetimeInspiration' | 'tomesPublished' | 'lifetimeQuills' | 'fastestPublish';

/** Segmented-control keys (12 §9.1) mapped to the API metrics (10 §1.4). */
const SCORE_TABS: readonly { key: ScoreTabKey; api: LeaderboardMetric; label: string }[] = [
  { key: 'lifetimeInspiration', api: 'lifetimeInspiration', label: 'Inspiration' },
  { key: 'tomesPublished', api: 'tomesPublished', label: 'Tomes' },
  { key: 'lifetimeQuills', api: 'lifetimeQuillsEarned', label: 'Quills' },
  { key: 'fastestPublish', api: 'fastestPublishMs', label: 'Fastest' },
];

function formatValue(metric: LeaderboardMetric, value: number): string {
  return metric === 'fastestPublishMs' ? formatDuration(value) : formatNumber(value);
}

function agoLabel(fetchedAt: number): string {
  const mins = Math.floor((Date.now() - fetchedAt) / 60_000);
  if (mins <= 0) return 'just now';
  return mins === 1 ? '1m ago' : `${mins}m ago`;
}

function asOfLabel(generatedAt: number): string {
  return new Date(generatedAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface HallOfFablesPanelProps {
  state: GameState;
  client: LeaderboardClient;
  onToast: (title: string, body?: string) => void;
  /** Act 2 staggered reveal (12 §1.4) — 0 outside the first-Publish moment. */
  revealDelayMs?: number;
}

export function HallOfFablesPanel({
  state,
  client,
  onToast,
  revealDelayMs = 0,
}: HallOfFablesPanelProps) {
  const cs = useSyncExternalStore(client.subscribe, client.getState, client.getState);
  const identity = state.meta.settings.leaderboard;

  const [selected, setSelected] = useState<ScoreTabKey>('lifetimeInspiration');
  const apiBy = SCORE_TABS.find((t) => t.key === selected)?.api ?? 'lifetimeInspiration';

  // ---- visibility: mounted ∧ intersecting ∧ tab visible (12 §6.2) ----
  const rootRef = useRef<HTMLElement>(null);
  const [intersecting, setIntersecting] = useState(false);
  const [tabVisible, setTabVisible] = useState(
    typeof document === 'undefined' || document.visibilityState === 'visible',
  );
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIntersecting(true); // graceful fallback: treat mounted as visible
      return undefined;
    }
    const obs = new IntersectionObserver((entries) => {
      setIntersecting(entries.some((e) => e.isIntersecting));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    const onVis = (): void => setTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const visible = intersecting && tabVisible;
  const canFetch = !cs.disabled && identity !== undefined;

  // First fetch on entering visibility + 60s cadence while visible.
  useEffect(() => {
    if (!visible || !canFetch) return undefined;
    void client.refresh(apiBy);
    const id = window.setInterval(() => {
      void client.refresh(apiBy);
    }, LEADERBOARD_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [visible, canFetch, apiBy, client]);

  // ---- opt-in form ----
  const [nickname, setNickname] = useState('');
  const [inlineError, setInlineError] = useState<'taken' | 'invalid' | 'network' | null>(null);

  const submitClaim = useCallback(async () => {
    const value = nickname;
    if (!client.isValidNickname(value)) {
      setInlineError('invalid');
      return;
    }
    setInlineError(null);
    const result = await client.claim(value);
    if (result === 'ok') {
      onToast(`Welcome to the Hall, ${value.trim()}.`, 'May your shelf grow heavy.');
      void client.refresh(apiBy, true);
    } else if (result === 'taken' || result === 'invalid' || result === 'network') {
      setInlineError(result); // the input KEEPS its value (12 §6.1)
    }
  }, [apiBy, client, nickname, onToast]);

  // ---- manual refresh cooldown (5s) ----
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const nowMs = state.lastTickAt; // re-renders every tick — drives the countdown
  const manualDisabled = nowMs < cooldownUntil;
  const manualRefresh = (): void => {
    setCooldownUntil(Date.now() + LEADERBOARD_MANUAL_COOLDOWN_MS);
    client.submitNow(apiBy);
  };

  // ---- own-row highlight when the rank improves (#20) ----
  const prevRank = useRef<Partial<Record<LeaderboardMetric, number>>>({});
  const [highlightNonce, setHighlightNonce] = useState(0);
  const ownRank =
    cs.top && identity
      ? (cs.top.entries.find((e) => e.playerId === identity.playerId)?.rank ??
        cs.top.me?.rank ??
        null)
      : null;
  useEffect(() => {
    if (!cs.top || ownRank === null) return;
    const prev = prevRank.current[cs.top.by];
    if (prev !== undefined && ownRank < prev) setHighlightNonce((n) => n + 1);
    prevRank.current[cs.top.by] = ownRank;
  }, [cs.top, ownRank]);

  // ---- derived panel state (data-state contract, 12 §9.1) ----
  const showTopFor = cs.top && cs.top.by === apiBy ? cs.top : null;
  let panelState: 'local-only' | 'opt-in' | 'loading' | 'active' | 'offline' | 'empty';
  if (cs.disabled) panelState = 'local-only';
  else if (!identity) panelState = 'opt-in';
  else if (cs.unreachable) panelState = 'offline';
  else if (cs.loading && !showTopFor) panelState = 'loading';
  else if (showTopFor && showTopFor.entries.length === 0) panelState = 'empty';
  else if (showTopFor) panelState = 'active';
  else panelState = 'loading';

  return (
    <section
      ref={rootRef}
      className="hall-panel anim-reveal-in"
      style={
        revealDelayMs > 0
          ? { animationDelay: `${revealDelayMs}ms`, animationFillMode: 'backwards' }
          : undefined
      }
      data-testid="leaderboard-panel"
      data-state={panelState}
      aria-label="Hall of Fables"
    >
      <header className="panel-header hall-panel__head">
        <h3 className="panel-header__title panel-header__title--quill">
          Hall of Fables <span aria-hidden="true">{ICON.hall}</span>
        </h3>
        {panelState === 'offline' && (
          <p className="hall-panel__badge" data-testid="leaderboard-offline">
            <strong>The courier seems lost between libraries.</strong> The Hall is unreachable —
            your library doesn&apos;t mind.
          </p>
        )}
        {cs.sealLost && !identity && (
          <p className="hall-panel__badge">
            The Hall no longer knows your seal. Claim a new name to rejoin.
          </p>
        )}
      </header>

      {panelState === 'local-only' && (
        <p className="hall-panel__local-only">
          The Hall exists in a library far away. This build keeps to itself.
        </p>
      )}

      {panelState === 'opt-in' && (
        <div className="hall-optin">
          <h4 className="hall-optin__heading">Join the fellowship of the Hall</h4>
          <label className="hall-optin__label" htmlFor="hall-nickname">
            Your name in the ledger
          </label>
          <input
            id="hall-nickname"
            className={`hall-optin__input${inlineError ? ' hall-optin__input--error' : ''}`}
            type="text"
            value={nickname}
            maxLength={20}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setNickname(e.target.value);
              if (inlineError === 'invalid') setInlineError(null);
            }}
            onBlur={() => {
              if (nickname !== '' && !client.isValidNickname(nickname)) setInlineError('invalid');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !cs.claiming) void submitClaim();
            }}
            data-testid="leaderboard-nickname-input"
          />
          {inlineError && (
            <p className="hall-optin__error" data-testid="leaderboard-error">
              {inlineError === 'taken' && 'That name is already inked in the ledger. Try another.'}
              {inlineError === 'invalid' &&
                'A name needs 3 to 20 characters — letters, numbers, spaces, dashes.'}
              {inlineError === 'network' &&
                'The courier seems lost between libraries. Try again in a moment.'}
            </p>
          )}
          <p className="hall-optin__privacy">
            Only your nickname and these four numbers ever leave this device.
          </p>
          <button
            type="button"
            className="btn-quill hall-optin__claim"
            disabled={cs.claiming}
            onClick={() => void submitClaim()}
            data-testid="leaderboard-join"
          >
            {cs.claiming ? (
              <>
                <span className="hall-optin__spinner" aria-hidden="true" /> Sending word…
              </>
            ) : (
              'Claim your place'
            )}
          </button>
        </div>
      )}

      {/* token-invalid (401): back to opt-in but the cached board STAYS visible (12 §6.1) */}
      {!identity && cs.sealLost && cs.top && (
        <>
          <HallTable top={cs.top} selfId="" highlightNonce={0} />
          <footer className="hall-panel__footer">
            <span className="hall-panel__updated num" data-testid="leaderboard-updated">
              as of {asOfLabel(cs.top.generatedAt)}
            </span>
          </footer>
        </>
      )}

      {identity && panelState !== 'local-only' && (
        <>
          <div className="hall-tabs" role="group" aria-label="Leaderboard score">
            {SCORE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`hall-tabs__tab${t.key === selected ? ' is-selected' : ''}`}
                aria-pressed={t.key === selected}
                onClick={() => setSelected(t.key)}
                data-testid={`leaderboard-score-tab-${t.key}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {panelState === 'loading' && (
            <div className="hall-skeleton" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="hall-skeleton__row anim-skeleton-pulse" />
              ))}
            </div>
          )}

          {panelState === 'empty' && (
            <p className="hall-panel__empty">The Hall stands empty. Be the first name on its walls.</p>
          )}

          {(panelState === 'active' || (panelState === 'offline' && cs.top)) && cs.top && (
            <HallTable
              top={cs.top}
              selfId={identity.playerId}
              highlightNonce={highlightNonce}
            />
          )}

          <footer className="hall-panel__footer">
            <span className="hall-panel__updated num" data-testid="leaderboard-updated">
              {panelState === 'offline' && cs.top
                ? `as of ${asOfLabel(cs.top.generatedAt)}`
                : cs.fetchedAt !== null
                  ? `Last updated ${agoLabel(cs.fetchedAt)}`
                  : ''}
            </span>
            <button
              type="button"
              className="hall-panel__refresh"
              disabled={manualDisabled}
              onClick={manualRefresh}
              data-testid="leaderboard-refresh"
            >
              Update now
            </button>
          </footer>
        </>
      )}
    </section>
  );
}

function HallTable({
  top,
  selfId,
  highlightNonce,
}: {
  top: LeaderboardTop;
  selfId: string;
  highlightNonce: number;
}) {
  const selfInTop = top.entries.some((e) => e.playerId === selfId);
  return (
    <>
      <table className="hall-table" data-testid="leaderboard-table">
        <thead>
          <tr>
            <th scope="col" className="hall-table__rank">
              #
            </th>
            <th scope="col">Name</th>
            <th scope="col" className="hall-table__value">
              Score
            </th>
          </tr>
        </thead>
        <tbody>
          {top.entries.map((e) => {
            const self = e.playerId === selfId;
            return (
              <tr
                key={e.playerId}
                className={`hall-table__row${self ? ' hall-table__row--self' : ''}${
                  self && highlightNonce > 0 ? ' anim-leaderboard-row-highlight' : ''
                }`}
                data-testid={self ? 'leaderboard-row-self' : undefined}
              >
                <td className="hall-table__rank num">{e.rank}</td>
                <td className="hall-table__name">{e.nickname}</td>
                <td className="hall-table__value num">{formatValue(top.by, e.value)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* Own rank below the table — ONLY when not inside the top 20 (12 §9.2). */}
      {!selfInTop && top.me && (
        <p
          className={`hall-panel__self-rank num${highlightNonce > 0 ? ' anim-leaderboard-row-highlight' : ''}`}
          data-testid="leaderboard-rank-self"
        >
          <strong>#{top.me.rank}</strong> — you · {formatValue(top.by, top.me.value)}
        </p>
      )}
    </>
  );
}
