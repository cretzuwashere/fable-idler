// index.ts — the public API of the engine. UI code imports ONLY from here.

// Types
export type {
  Action,
  AchievementCondition,
  AchievementConfig,
  AchievementId,
  BuffState,
  BuyQty,
  GameState,
  GeneratorConfig,
  GeneratorId,
  MetaState,
  MetaStats,
  MilestoneId,
  MilestoneRequirement,
  RevealMilestoneConfig,
  RevealMilestoneId,
  RunState,
  RunUpgradeId,
  Settings,
  UnlockCondition,
  UpgradeConfig,
  UpgradeId,
} from './types';

// Balance config (read-only data for UI lists; numbers live ONLY here)
export {
  ACHIEVEMENTS,
  ACHIEVEMENT_BONUS,
  ACHIEVEMENT_BONUS_ANTHOLOGY,
  AUTOSAVE_TICKS,
  BUFF,
  BUFF_UNLOCK_MILESTONE,
  CLICK_BASE,
  GENERATORS,
  GENERATOR_IDS,
  GENERATOR_INDEX,
  GOLDEN_INKWELL_MULT,
  INK_ECHO_RATE,
  MAX_TICK_DT_MS,
  MUSES_CHORUS_MULT,
  OFFLINE,
  PATRONS_FAVOR_DISCOUNT,
  PRESTIGE_DIVISOR,
  PRESTIGE_MIN_TOTAL_EARNED,
  QTY_MILESTONE_MULT,
  QTY_MILESTONE_THRESHOLDS,
  QUILL_BONUS,
  RAVENS_GOSSIP_RATE,
  REVEAL_MILESTONES,
  SHARPENED_NIB_MULT,
  TICK_MS,
  UPGRADES,
  UPGRADE_INDEX,
  WEAVERS_RHYTHM_RATE,
} from './config';

// State factories
export {
  createInitialMetaState,
  createInitialRunState,
  createInitialState,
} from './state';

// Generators
export {
  bulkCost,
  buyGenerator,
  costOf,
  isGeneratorRevealed,
  maxAffordable,
  totalGeneratorCount,
} from './generators';

// Upgrades
export { buyUpgrade, hasUpgrade, isUpgradeUnlocked, meetsUnlockCondition } from './upgrades';

// Achievements
export {
  checkAchievements,
  hasAchievement,
  isAchievementConditionMet,
} from './achievements';

// Milestones
export {
  checkMilestones,
  hasMilestone,
  isRevealMilestoneReached,
  qtyMilestoneId,
} from './milestones';

// Buff
export {
  activateBuff,
  buffCooldownRemainingMs,
  buffDurationMs,
  buffRemainingMs,
  canActivateBuff,
  isBuffActive,
  isBuffUnlocked,
} from './buff';

// Prestige
export {
  canPrestige,
  prestigePreview,
  publishTheTome,
  quillsForTotalEarned,
} from './prestige';

// Offline
export { applyOfflineReport, computeOfflineReport } from './offline';
export type { OfflineReport } from './offline';

// Selectors (all derived values)
export {
  achievementMultiplier,
  clickPower,
  generatorProduction,
  globalMultiplier,
  perSecond,
  perSecondNoBuff,
  qtyMilestoneMultiplier,
  quillMultiplier,
  rawProduction,
} from './selectors';

// Tick
export { tick } from './tick';

// Save
export {
  applyMigrations,
  CURRENT_SAVE_VERSION,
  exportSave,
  importSaveString,
  loadSave,
  MIGRATIONS,
  parseSave,
  persistSave,
  sanitizeSaveData,
  SAVE_BACKUP_KEY,
  SAVE_KEY,
  serializeState,
} from './save';
export type { LoadedSave, Migration, SaveDataV1, StorageLike } from './save';

// Number formatting
export { formatNumber, formatRate } from './format-numbers';

// Store (imperative shell)
export { applyAction, createGameStore, createMemoryStorage } from './game-loop';
export type { GameEvent, GameStore, GameStoreDeps } from './game-loop';
