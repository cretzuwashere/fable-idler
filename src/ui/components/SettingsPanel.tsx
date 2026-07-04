// SettingsPanel (04 §4.13) — modal from ⚙️: Export save (readonly base64 +
// Copy), Import save (textarea + Load with inline validation error), Reduce
// motion toggle (persisted via setSettings), Hard reset with DOUBLE
// confirmation (warning dialog → type RESET to arm the final button, dispatch
// { type:'hardReset', confirm:true }), and the game version.

import { useEffect, useRef, useState } from 'react';
import { exportSave, importSaveString } from '../../engine';
import type { GameState } from '../../engine';
import { useDispatch, useStore } from '../hooks/useGameStore';
import { ICON } from '../icons';
import { APP_VERSION } from '../meta';
import { Modal } from './Modal';
import './SettingsPanel.css';

interface SettingsPanelProps {
  state: GameState;
  onClose: () => void;
}

type ResetStep = 0 | 1 | 2;

export function SettingsPanel({ state, onClose }: SettingsPanelProps) {
  const store = useStore();
  const dispatch = useDispatch();

  // Frozen at panel open: the state prop changes ~10×/s (every engine tick),
  // which would regenerate the textarea value continuously and make manual
  // selection/copy impossible. A snapshot from open time is what you back up.
  const [exported] = useState(() => exportSave(store.getState(), Date.now()));
  const exportRef = useRef<HTMLTextAreaElement>(null);
  const [copyResult, setCopyResult] = useState<'copied' | 'failed' | null>(null);
  const copiedTimer = useRef<number | null>(null);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importOk, setImportOk] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>(0);
  const [resetText, setResetText] = useState('');

  const reduceMotion = state.meta.settings.reduceMotion === true;

  useEffect(
    () => () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    },
    [],
  );

  const handleCopy = () => {
    const finish = (ok: boolean) => {
      setCopyResult(ok ? 'copied' : 'failed');
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopyResult(null), 2000);
    };
    // Fallback for contexts without the async clipboard API (e.g. plain http
    // on a LAN): select the textarea and use the legacy copy command. Honest
    // feedback — "Copied ✓" only when a copy actually happened.
    const fallbackCopy = (): boolean => {
      const el = exportRef.current;
      if (!el) return false;
      el.focus();
      el.select();
      try {
        return document.execCommand('copy');
      } catch {
        return false;
      }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(exported).then(
        () => finish(true),
        () => finish(fallbackCopy()),
      );
    } else {
      finish(fallbackCopy());
    }
  };

  const handleImport = () => {
    setImportOk(false);
    const parsed = importSaveString(importText);
    if (!parsed) {
      setImportError('That save cannot be read — the ink is smudged. Check the string and try again.');
      return;
    }
    setImportError(null);
    dispatch({ type: 'importSave', data: importText.trim() });
    store.save();
    setImportOk(true);
    setImportText('');
  };

  const closeReset = () => {
    setResetStep(0);
    setResetText('');
  };

  const armed = resetText.trim().toUpperCase() === 'RESET';

  return (
    <>
      <Modal
        title={
          <>
            <span aria-hidden="true">{ICON.settings}</span> Settings
          </>
        }
        onClose={onClose}
        testId="settings-panel"
        maxWidth={520}
      >
        <div className="settings__section">
          <h3 className="settings__heading">Export save</h3>
          <p className="settings__hint">
            Copy this string somewhere safe — it is your whole library.
            {state.meta.settings.leaderboard !== undefined && (
              <> It also carries your Hall of Fables seal — don&apos;t post it publicly.</>
            )}
          </p>
          <textarea
            ref={exportRef}
            className="settings__textarea"
            readOnly
            value={exported}
            rows={3}
            aria-label="Exported save string"
            onFocus={(e) => e.currentTarget.select()}
            data-testid="settings-export"
          />
          <button type="button" className="btn-ghost" onClick={handleCopy} data-testid="settings-copy">
            {copyResult === 'copied'
              ? 'Copied ✓'
              : copyResult === 'failed'
                ? 'Copy failed — select the text manually'
                : 'Copy'}
          </button>
        </div>

        <div className="settings__section">
          <h3 className="settings__heading">Import save</h3>
          <p className="settings__hint">Pasting a save overwrites your current progress.</p>
          <textarea
            className="settings__textarea"
            value={importText}
            rows={3}
            aria-label="Save string to import"
            placeholder="Paste an exported save string…"
            onChange={(e) => {
              setImportText(e.target.value);
              setImportError(null);
              setImportOk(false);
            }}
            data-testid="settings-import"
          />
          {importError && (
            <p className="settings__error" role="alert" data-testid="settings-import-error">
              {importError}
            </p>
          )}
          {importOk && (
            <p className="settings__ok" data-testid="settings-import-ok">
              The library remembers. Save loaded.
            </p>
          )}
          <button
            type="button"
            className="btn-ghost"
            disabled={importText.trim().length === 0}
            onClick={handleImport}
            data-testid="settings-import-load"
          >
            Load
          </button>
        </div>

        <div className="settings__section">
          <h3 className="settings__heading">Comfort</h3>
          <label className="settings__toggle">
            <input
              type="checkbox"
              checked={reduceMotion}
              onChange={(e) =>
                dispatch({ type: 'setSettings', settings: { reduceMotion: e.target.checked } })
              }
              data-testid="settings-reduce-motion"
            />
            Reduce motion
          </label>
        </div>

        <div className="settings__section settings__section--danger">
          <h3 className="settings__heading settings__heading--danger">Dangerous shelf</h3>
          <button
            type="button"
            className="btn-danger"
            onClick={() => setResetStep(1)}
            data-testid="settings-reset"
          >
            Hard reset
          </button>
        </div>

        <p className="settings__version num">
          Fable Idler v{APP_VERSION}
        </p>
      </Modal>

      {resetStep === 1 && (
        <Modal title="Burn the library?" onClose={closeReset} testId="reset-dialog-1">
          <p>
            This burns the whole library. <strong>Even the golden quills.</strong> Every generator,
            every upgrade, every achievement, every tome — gone. Consider exporting your save first.
          </p>
          <div className="prestige-confirm__actions">
            <button type="button" className="btn-ghost" onClick={closeReset}>
              Keep the library
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => setResetStep(2)}
              data-testid="settings-reset-continue"
            >
              Continue…
            </button>
          </div>
        </Modal>
      )}

      {resetStep === 2 && (
        <Modal title="Last chance" onClose={closeReset} testId="reset-dialog-2">
          <p>
            Type <strong className="settings__reset-word">RESET</strong> to light the match.
          </p>
          <input
            type="text"
            className="settings__reset-input"
            value={resetText}
            onChange={(e) => setResetText(e.target.value)}
            aria-label="Type RESET to confirm"
            autoComplete="off"
            data-testid="settings-reset-input"
          />
          <div className="prestige-confirm__actions">
            <button type="button" className="btn-ghost" onClick={closeReset}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={!armed}
              onClick={() => {
                dispatch({ type: 'hardReset', confirm: true });
                closeReset();
                onClose();
              }}
              data-testid="settings-reset-confirm"
            >
              Burn it all
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
