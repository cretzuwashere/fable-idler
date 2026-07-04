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
  ATLAS_GLOBAL_MULT,
  AUTOSAVE_TICKS,
  BOOKSHELF,
  BUFF,
  BUFF_UNLOCK_MILESTONE,
  CLICK_BASE,
  CURATORS_PATIENCE_EXTRA_CAP_MS,
  DEEP_SHELVES,
  DOG_EARED_PAGE_START_INSPIRATION,
  EDITORS_DUE_BONUS_QUILLS,
  ENDLESS_SHELF_BOOKSHELF_CAP,
  FABLE_ADJECTIVES,
  FABLE_CREATURES,
  FABLE_OBJECTS,
  FABLE_VERB_PHRASES,
  FOREWORD_CAP,
  FOREWORD_START_FRACTION,
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
  OFFLINE_EFFICIENCY_CAP,
  PATRONS_FAVOR_DISCOUNT,
  PERPETUAL_MANUSCRIPT_KEPT_IDS,
  PILGRIMS_PAGES_FRAGMENTS_PER_QUILL,
  PRESTIGE_DIVISOR,
  PRESTIGE_MIN_TOTAL_EARNED,
  PRESTIGE_V3,
  QTY_FINALE_MULT,
  QTY_FINALE_THRESHOLD,
  QTY_MILESTONE_MULT,
  QTY_MILESTONE_THRESHOLDS,
  QTY_STEP_MULT,
  QTY_THRESHOLDS_V3,
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
  STRENGTH_OF_STACKS,
  STROKE_OF_GENIUS,
  THUNDEROUS_APPLAUSE_PROD_SECONDS,
  TICK_MS,
  UNIQUE_BONUSES,
  UNIQUE_THRESHOLD,
  UNIQUE_THRESHOLD_TELLING,
  UPGRADES,
  UPGRADE_INDEX,
  V3_RUN_UPGRADES,
  V3_RUN_UPGRADE_BY_GEN,
  V3_RUN_UPGRADE_ID_SET,
  V3_RUN_UPGRADE_UNLOCK_OWNED,
  WEAVERS_RHYTHM_RATE,
  WELL_ROUNDED_GENERATOR_IDS,
} from './config';
export type { UniqueBonusConfig, V3RunUpgradeConfig } from './config';

// State factories
export {
  createInitialMetaState,
  createInitialRunState,
  createInitialState,
} from './state';

// Generators
export {
  bandGrowth,
  bestPaybackGenerator,
  bulkCost,
  buyGenerator,
  costOf,
  isGeneratorRevealed,
  maxAffordable,
  totalGeneratorCount,
} from './generators';

// Upgrades
export { buyUpgrade, hasUpgrade, isUpgradeUnlocked, meetsUnlockCondition } from './upgrades';

// Atelier (v2 + v3)
export {
  apprenticeStartMuses,
  atelierLevel,
  atelierMaxLevel,
  atelierNextCost,
  bookmarkedUpgrades,
  buyAtelierUpgrade,
  canBuyAtelierUpgrade,
  hasAnyAtelierUpgrade,
  hasClockworkUnderstudy,
  hasRelic,
  isAtelierComplete,
  newWingLevel,
  unlockedRelics,
} from './atelier';

// Unique bonuses (v3)
export {
  activeUniqueBonus,
  isUniqueBonusActive,
  uniqueThreshold,
} from './unique-bonuses';

// Stray Spark (v2 + v3)
export {
  applySparkReward,
  fragmentsPerQuill,
  rollSparkKind,
  SPARK_KINDS,
  sparkRewardMult,
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
  prestigeNetTotalEarned,
  prestigePreview,
  publishTheTome,
  quillsForTotalEarned,
  seedInspirationForNextRun,
  totalEarnedForQuills,
} from './prestige';

// Offline
export { applyOfflineReport, computeOfflineReport } from './offline';
export type { OfflineReport } from './offline';

// Selectors (all derived values)
export {
  achievementMultiplier,
  bookshelfMultiplier,
  buffProdMult,
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
  v3GlobalMultiplier,
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
export type { LoadedSave, Migration, SaveDataV1, SaveDataV2, SaveDataV3, StorageLike } from './save';

// Number formatting
export { formatNumber, formatRate } from './format-numbers';

// Store (imperative shell)
export { applyAction, createGameStore, createMemoryStorage } from './game-loop';
export type { GameEvent, GameStore, GameStoreDeps } from './game-loop';
