// index.ts — the public API of the engine. UI code imports ONLY from here.

// Types
export type {
  Action,
  AchievementCondition,
  AchievementConfig,
  AchievementId,
  AtelierUpgradeConfig,
  AtelierUpgradeId,
  BuffState,
  BuyQty,
  Fable,
  FableRunStats,
  GameState,
  GeneratorConfig,
  GeneratorId,
  LeaderboardIdentity,
  MetaState,
  MetaStats,
  MilestoneId,
  MilestoneRequirement,
  RelicConfig,
  RelicId,
  RevealMilestoneConfig,
  RevealMilestoneId,
  RunState,
  RunUpgradeId,
  Settings,
  SparkBuffKind,
  SparkBuffState,
  SparkRewardKind,
  UnlockCondition,
  UpgradeConfig,
  UpgradeId,
} from './types';

// Balance config (read-only data for UI lists; numbers live ONLY here)
export {
  ACHIEVEMENTS,
  ACHIEVEMENT_BONUS,
  ACHIEVEMENT_BONUS_ANTHOLOGY,
  APPRENTICE_MUSE_START_MUSES,
  ATELIER_UPGRADES,
  ATELIER_UPGRADE_IDS,
  ATELIER_UPGRADE_INDEX,
  AUTOSAVE_TICKS,
  BOOKSHELF,
  BUFF,
  BUFF_UNLOCK_MILESTONE,
  CLICK_BASE,
  DOG_EARED_PAGE_START_INSPIRATION,
  EDITORS_DUE_BONUS_QUILLS,
  FABLE_ADJECTIVES,
  FABLE_CREATURES,
  FABLE_OBJECTS,
  FABLE_VERB_PHRASES,
  GENERATORS,
  GENERATOR_IDS,
  GENERATOR_INDEX,
  GILDED_QUILLS_THRESHOLD,
  GOLDEN_INKWELL_MULT,
  INK_ECHO_RATE,
  INK_REMEMBERS_RATE,
  MAX_TICK_DT_MS,
  MUSES_CHORUS_MULT,
  NIGHT_OWL_EXTRA_CAP_MS,
  OFFLINE,
  PATRONS_FAVOR_DISCOUNT,
  PRESTIGE_DIVISOR,
  PRESTIGE_MIN_TOTAL_EARNED,
  QTY_MILESTONE_MULT,
  QTY_MILESTONE_THRESHOLDS,
  QUILL_BONUS,
  RAVENS_GOSSIP_RATE,
  READERS_LETTER_OFFLINE_BONUS,
  RELICS,
  RELIC_INDEX,
  RESTLESS_HEART_COOLDOWN_MS,
  REVEAL_MILESTONES,
  SECOND_BOOKMARK_KEPT,
  SELF_WRITING_CONTRACT,
  SHARPENED_NIB_MULT,
  SPARK,
  STANDING_OVATION_DURATION_MULT,
  STROKE_OF_GENIUS,
  THUNDEROUS_APPLAUSE_PROD_SECONDS,
  TICK_MS,
  UPGRADES,
  UPGRADE_INDEX,
  WEAVERS_RHYTHM_RATE,
  WELL_ROUNDED_GENERATOR_IDS,
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

// Atelier (v2)
export {
  apprenticeStartMuses,
  atelierLevel,
  atelierMaxLevel,
  atelierNextCost,
  bookmarkedUpgrades,
  buyAtelierUpgrade,
  canBuyAtelierUpgrade,
  hasAnyAtelierUpgrade,
  hasRelic,
  isAtelierComplete,
  unlockedRelics,
} from './atelier';

// Stray Spark (v2)
export {
  applySparkReward,
  rollSparkKind,
  SPARK_KINDS,
  sparkRewardSummary,
  sparkWeightTotal,
} from './spark';
export type { SparkRewardSummary } from './spark';

// Fables / Bookshelf (v2)
export {
  createFable,
  createFadedFable,
  fableSeed,
  fadedFableSeed,
  generateFableTitle,
  generateFadedTitle,
  mulberry32,
  uniqueFableCount,
} from './fables';

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
  buffCooldownMs,
  buffCooldownRemainingMs,
  buffDurationMs,
  buffRemainingMs,
  canActivateBuff,
  isBuffActive,
  isBuffUnlocked,
  nextManualBuffDurationMs,
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
  bookshelfMultiplier,
  clickPower,
  clickValue,
  critChance,
  generatorProduction,
  globalMultiplier,
  inkRemembersMultiplier,
  isCritRoll,
  isGeneratorVisibleInShop,
  isSparkBuffActive,
  offlineCapMs,
  offlineEfficiency,
  perSecond,
  perSecondNoBuff,
  qtyMilestoneMultiplier,
  quillMultiplier,
  rawProduction,
  sparkIntervalRange,
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
export type { LoadedSave, Migration, SaveDataV1, SaveDataV2, StorageLike } from './save';

// Number formatting
export { formatNumber, formatRate } from './format-numbers';

// Store (imperative shell)
export { applyAction, createGameStore, createMemoryStorage } from './game-loop';
export type { GameEvent, GameStore, GameStoreDeps } from './game-loop';
