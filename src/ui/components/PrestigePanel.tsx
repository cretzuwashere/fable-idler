// PrestigePanel (04 §4.10) — "Publish the Tome 📖", quill-bordered card.
// States: teaser (visible from The Publisher's Letter at 50k, disabled button,
// bar to 100k) / ready (violet button + glow, live "+N 🪶" preview, bar to the
// next quill) / confirming (dialog listing what resets and what stays +
// "I understand my run resets" checkbox gating the final Publish) /
// post-prestige (handled by App via the 1400ms prestigeFade overlay).

import { useState } from 'react';
import {
  atelierLevel,
  bookmarkedUpgrades,
  canPrestige,
  EDITORS_DUE_BONUS_QUILLS,
  formatNumber,
  PRESTIGE_MIN_TOTAL_EARNED,
  prestigeNetTotalEarned,
  prestigePreview,
  quillsForTotalEarned,
  QUILL_BONUS,
  totalEarnedForQuills,
  UPGRADE_INDEX,
} from '../../engine';
import type { GameState, RunUpgradeId } from '../../engine';
import { ICON } from '../icons';
import { Modal } from './Modal';
import { ProgressBar } from './ProgressBar';
import './PrestigePanel.css';

interface PrestigePanelProps {
  state: GameState;
  /** App owns the prestigeFade sequence + the actual dispatch. */
  onPublish: () => void;
}

export function PrestigePanel({ state, onPublish }: PrestigePanelProps) {
  const [confirming, setConfirming] = useState(false);
  const [understood, setUnderstood] = useState(false);

  const ready = canPrestige(state);
  const quills = prestigePreview(state);
  const totalEarned = state.run.totalEarned;
  // The bar/caption track the SEGMENTED formula on the NET total earned (te −
  // seed), and on quills WITHOUT the Editor's Due / Divine Royalties flat bonus
  // (those add quills but never move a totalEarned threshold). Using the preview
  // quills or raw totalEarned here would desync the bar across the whole v3
  // range and even in the v1 range once Editor's Due is owned.
  const netTotalEarned = prestigeNetTotalEarned(state);
  const barQuills = quillsForTotalEarned(netTotalEarned);
  // v2: the passive bonus reads the LIFETIME total (GOLDEN RULE, 09 §1.1) —
  // the wallet shown above it can drop at the Atelier, the % never does.
  const lifetimeQuills = state.meta.stats.lifetimeQuillsEarned;
  const hasEditorsDue = atelierLevel(state, 'editorsDue') >= 1;
  const keptUpgrades = Object.keys(bookmarkedUpgrades(state)) as RunUpgradeId[];

  // Progress: teaser → bar to the 100k threshold; ready → bar toward the next quill.
  let barValue: number;
  let barCaption: string;
  if (!ready) {
    barValue = totalEarned / PRESTIGE_MIN_TOTAL_EARNED;
    barCaption = `First quill at ${formatNumber(PRESTIGE_MIN_TOTAL_EARNED)}`;
  } else {
    const currentFloor = totalEarnedForQuills(barQuills);
    const nextTarget = totalEarnedForQuills(barQuills + 1);
    const span = nextTarget - currentFloor;
    barValue = span > 0 ? (netTotalEarned - currentFloor) / span : 1;
    barCaption = `Next quill at ${formatNumber(nextTarget)}`;
  }

  const closeConfirm = () => {
    setConfirming(false);
    setUnderstood(false);
  };

  return (
    <section
      className="prestige-panel anim-reveal-in"
      data-testid="prestige-panel"
      aria-label="Publish the Tome"
    >
      <header className="panel-header">
        <h3 className="panel-header__title panel-header__title--quill">
          Publish the Tome <span aria-hidden="true">{ICON.prestige}</span>
        </h3>
      </header>

      <div className="prestige-panel__quills num" data-testid="prestige-quills">
        <span aria-hidden="true">{ICON.goldenQuills}</span> {formatNumber(state.meta.goldenQuills)} Golden Quills
        <span className="prestige-panel__quill-bonus num">
          +{Math.round(lifetimeQuills * QUILL_BONUS * 100)}% production
        </span>
      </div>

      <button
        type="button"
        className={`prestige-panel__publish${ready ? ' is-ready' : ''}`}
        disabled={!ready}
        onClick={() => setConfirming(true)}
        data-testid="prestige-button"
      >
        {ready ? (
          <span data-testid="prestige-preview" className="num">
            Publish now: +{formatNumber(quills)} <span aria-hidden="true">{ICON.goldenQuills}</span>
            {hasEditorsDue && (
              <em className="prestige-panel__due">
                {' '}
                (+{EDITORS_DUE_BONUS_QUILLS} Editor&apos;s Due)
              </em>
            )}
          </span>
        ) : (
          <span>The Tome is not ready…</span>
        )}
      </button>

      <div className="prestige-panel__progress">
        <ProgressBar value={barValue} variant="quill" label={barCaption} testId="prestige-progress" />
        <span className="prestige-panel__caption num">{barCaption}</span>
      </div>

      {confirming && (
        <Modal
          title={
            <>
              Bind these pages into a Tome? <span aria-hidden="true">{ICON.prestige}</span>
            </>
          }
          onClose={closeConfirm}
          testId="prestige-confirm-dialog"
        >
          <p className="prestige-confirm__lede">Your workshop resets — your fame does not.</p>
          <div className="prestige-confirm__columns">
            <div>
              <h4 className="prestige-confirm__col-title prestige-confirm__col-title--lost">The ink dries on…</h4>
              <ul className="prestige-confirm__list">
                <li>{formatNumber(state.run.inspiration)} Inspiration</li>
                <li>All generators &amp; their milestones</li>
                <li>All run upgrades</li>
              </ul>
            </div>
            <div>
              <h4 className="prestige-confirm__col-title prestige-confirm__col-title--kept">Bound forever…</h4>
              <ul className="prestige-confirm__list">
                <li className="num">
                  +{formatNumber(quills)} <span aria-hidden="true">{ICON.goldenQuills}</span> Golden Quills (
                  +{Math.round(quills * QUILL_BONUS * 100)}% production)
                </li>
                <li>Achievements &amp; their bonuses</li>
                <li>Lifetime records</li>
              </ul>
            </div>
          </div>
          {keptUpgrades.length > 0 && (
            <p className="prestige-confirm__bookmarked">
              Bookmarked:{' '}
              <em>{keptUpgrades.map((id) => UPGRADE_INDEX[id].name).join(', ')}</em> survive the
              reset.
            </p>
          )}
          <label className="prestige-confirm__ack">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              data-testid="prestige-checkbox"
            />
            I understand my run resets
          </label>
          <div className="prestige-confirm__actions">
            <button type="button" className="btn-ghost" onClick={closeConfirm}>
              Keep writing
            </button>
            <button
              type="button"
              className="btn-quill"
              disabled={!understood}
              onClick={() => {
                closeConfirm();
                onPublish();
              }}
              data-testid="prestige-confirm"
            >
              Publish <span aria-hidden="true">{ICON.prestige}</span>
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
