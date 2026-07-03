// types.ts — GameState, RunState, MetaState, Action + literal id unions.
// Contract fixed by ai-memory/02-technical-architecture.md §2.1.

export type GeneratorId =
  | 'wanderingMuse'
  | 'inkSprite'
  | 'talkingRaven'
  | 'enchantedQuill'
  | 'storyLoom'
  | 'dreamLibrary'
  | 'fableForge';

export type UpgradeId =
  | 'sharpenedNib'
  | 'musesChorus'
  | 'goldenInkwell'
  | 'ravensGossip'
  | 'weaversRhythm'
  | 'lucidDreaming'
  | 'burstOfGenius'
  | 'inkEcho'
  | 'patronsFavor'
  | 'boundAnthology'
  | 'quillResonance';

/** Upgrades that live in run state and reset at prestige (all except quillResonance). */
export type RunUpgradeId = Exclude<UpgradeId, 'quillResonance'>;

export type AchievementId =
  | 'firstWords'
  | 'storytellerAwakens'
  | 'busyFingers'
  | 'whisperedLegends'
  | 'aThousandTales'
  | 'hoarderOfIdeas'
  | 'museMenagerie'
  | 'fullAviary'
  | 'wellRoundedLibrary'
  | 'industrialFiction'
  | 'nightShift'
  | 'momentSeizer'
  | 'publishedAuthor'
  | 'serialNovelist';

export type RevealMilestoneId =
  | 'theFirstSpark'
  | 'whispersInInk'
  | 'craftsmansTools'
  | 'racingHeart'
  | 'aFeatheredFriend'
  | 'hallOfDeeds'
  | 'theQuillStirs'
  | 'thePublishersLetter'
  | 'threadsOfNarrative'
  | 'doorsOfTheLibrary'
  | 'heatOfCreation';

/** Reveal milestone ids plus quantity milestones in the form `qty:<generatorId>:<threshold>`. */
export type MilestoneId = string;

export interface BuffState {
  /** epoch ms; 0 = inactive */
  activeUntil: number;
  /** epoch ms; 0 = available */
  cooldownUntil: number;
}

export interface RunState {
  /** Current spendable balance. */
  inspiration: number;
  /** Cumulative earnings this run — basis for milestones + prestige. */
  totalEarned: number;
  generators: Record<GeneratorId, number>;
  /** Purchased run upgrades (quillResonance lives in meta, not here). */
  upgrades: Partial<Record<RunUpgradeId, true>>;
  milestones: MilestoneId[];
  buff: BuffState;
}

export interface MetaStats {
  totalClicks: number;
  /** All-time earned Inspiration, across all runs. */
  lifetimeInspiration: number;
  buffActivations: number;
  offlineSessionsOver30Min: number;
  bestSingleOfflineGain: number;
}

export interface Settings {
  numberNotation?: 'suffix' | 'scientific';
  buyQty?: BuyQty;
  reduceMotion?: boolean;
}

export interface MetaState {
  goldenQuills: number;
  tomesPublished: number;
  achievements: AchievementId[];
  /** Upgrade #11 — persists across prestige once bought. */
  quillResonance: boolean;
  stats: MetaStats;
  settings: Settings;
}

export interface GameState {
  run: RunState;
  meta: MetaState;
  /** epoch ms — delta-time anchor; persisted as savedAt. */
  lastTickAt: number;
}

export type BuyQty = 1 | 10 | 'max';

export type Action =
  | { type: 'click' }
  | { type: 'buyGenerator'; id: GeneratorId; qty: BuyQty }
  | { type: 'buyUpgrade'; id: UpgradeId }
  | { type: 'activateBuff' }
  | { type: 'prestige' }
  | { type: 'importSave'; data: string }
  // hardReset REQUIRES confirm: true (API-level protection — Agent 6).
  // Without it the action is a guaranteed no-op, both at compile time and at
  // runtime (a raw dispatch from the E2E hook cannot wipe a save by accident).
  | { type: 'hardReset'; confirm: true }
  // Persist UI preferences (Buy ×N toggle, Reduce motion — 04 §"persistă în save").
  // Additive extension by Agent UI: shallow-merges into meta.settings.
  | { type: 'setSettings'; settings: Partial<Settings> }
  // Debug actions backing the E2E test hook (02 §6.3: addInspiration/fastForward).
  // Never wired to UI controls; the game is local/single-player so this is not
  // a cheat surface beyond what localStorage already allows.
  | { type: 'debugAddInspiration'; amount: number }
  | { type: 'debugFastForward'; ms: number };

// ---------------------------------------------------------------------------
// Data-driven condition descriptors (evaluated in upgrades.ts / achievements.ts /
// milestones.ts; the numbers themselves live in config.ts).
// ---------------------------------------------------------------------------

export type UnlockCondition =
  | { kind: 'totalEarned'; amount: number }
  | { kind: 'generatorCount'; generator: GeneratorId; count: number }
  | { kind: 'totalGeneratorCount'; count: number }
  | { kind: 'buffActivations'; count: number }
  | { kind: 'offlineSessions'; count: number }
  | { kind: 'achievementCount'; count: number }
  | { kind: 'tomesPublished'; count: number };

export type AchievementCondition =
  | { kind: 'totalClicks'; count: number }
  | { kind: 'totalGeneratorCount'; count: number }
  | { kind: 'lifetimeInspiration'; amount: number }
  | { kind: 'currentBalance'; amount: number }
  | { kind: 'generatorCount'; generator: GeneratorId; count: number }
  | { kind: 'allGenerators' }
  | { kind: 'perSecond'; amount: number }
  | { kind: 'bestOfflineGain'; amount: number }
  | { kind: 'buffActivations'; count: number }
  | { kind: 'tomesPublished'; count: number };

export type MilestoneRequirement =
  | { kind: 'totalEarned'; amount: number }
  | { kind: 'firstAchievement' };

export interface GeneratorConfig {
  readonly id: GeneratorId;
  readonly name: string;
  readonly flavor: string;
  readonly baseCost: number;
  readonly baseProd: number;
  readonly growth: number;
  /** Generator becomes visible in the shop at this run totalEarned. */
  readonly revealAt: number;
}

export interface UpgradeConfig {
  readonly id: UpgradeId;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
  /** All conditions must hold for the upgrade to appear in the shop. */
  readonly unlock: readonly UnlockCondition[];
}

export interface AchievementConfig {
  readonly id: AchievementId;
  readonly name: string;
  readonly description: string;
  readonly condition: AchievementCondition;
}

export interface RevealMilestoneConfig {
  readonly id: RevealMilestoneId;
  readonly name: string;
  readonly description: string;
  readonly requirement: MilestoneRequirement;
}
