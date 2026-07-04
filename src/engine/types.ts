// types.ts — GameState, RunState, MetaState, Action + literal id unions.
// Contract fixed by ai-memory/02-technical-architecture.md §2.1.

export type GeneratorId =
  | 'wanderingMuse'
  | 'inkSprite'
  | 'talkingRaven'
  | 'enchantedQuill'
  | 'storyLoom'
  | 'dreamLibrary'
  | 'fableForge'
  // v2 — generator 8 (10 §3.1). Shop visibility additionally requires the
  // blueprintOfMyths Atelier upgrade (see isGeneratorVisibleInShop).
  | 'mythEngine'
  // v3 — generators 9–14 (13 §1 / 14 §2). Shop visibility is gated on the
  // corresponding level of The New Wing (isGeneratorVisibleInShop): 9–10 need
  // L1, 11–12 need L2, 13–14 need L3. Cost/production/qty-milestones otherwise
  // follow the exact same rules as tiers 1–8.
  | 'sagaCitadel'
  | 'narratorsGuild'
  | 'pantheonPress'
  | 'worldTreeArchive'
  | 'sleepingCity'
  | 'onceUponATime';

// ---------------------------------------------------------------------------
// v2 id unions (09/10 — the ids are the shared contract, used literally)
// ---------------------------------------------------------------------------

export type AtelierUpgradeId =
  | 'apprenticeMuse'
  | 'selfWritingContract'
  | 'strokeOfGenius'
  | 'blueprintOfMyths'
  | 'restlessHeart'
  | 'thunderousApplause'
  | 'nightOwlPact'
  | 'sparkcatchersNet'
  | 'secondBookmark'
  | 'editorsDue'
  // v3 — The Gilded Atelier extended (13 §4.1 / 14 §6.1).
  | 'theNewWing'
  | 'clockworkUnderstudy'
  | 'curatorsPatience'
  | 'perpetualManuscript'
  | 'strengthOfTheStacks'
  | 'atlasOfUntoldLands';

export type RelicId =
  | 'dogEaredPage'
  | 'standingOvation'
  | 'inkThatRemembers'
  | 'readersLetter'
  // v3 — relics at tomes 50/75/100/200 (13 §4.2 / 14 §6.2).
  | 'forewordByTheEditor'
  | 'pilgrimsPages'
  | 'hundredthTelling'
  | 'endlessShelf';

export type SparkRewardKind =
  | 'inkBurst'
  | 'quillFrenzy'
  | 'gossipBonanza'
  | 'timeSlip'
  | 'storyFragment'
  | 'goldenQuillDrop';

export type SparkBuffKind = 'quillFrenzy' | 'gossipBonanza';

export interface SparkBuffState {
  kind: SparkBuffKind;
  /** epoch ms — expires naturally, same pattern as the v1 buff. */
  activeUntil: number;
}

export interface FableRunStats {
  /** run totalEarned of the published run. */
  totalEarned: number;
  /** now − run.startedAt; null when the run started before v2 (startedAt = 0 sentinel). */
  durationMs: number | null;
  /** Golden Quills this publish granted (incl. Editor's Due). */
  quillsEarned: number;
}

export interface Fable {
  /** Tome number, 1-based. */
  n: number;
  /** Procedurally generated, deterministic (fables.ts). */
  title: string;
  /** epoch ms. */
  publishedAt: number;
  /** null = "faded" fable from the v1→v2 migration (stats lost to time). */
  runStats: FableRunStats | null;
  /** quillsEarned >= 5 → golden spine (cosmetic). */
  gilded: boolean;
}

/** Leaderboard identity — lives in meta.settings (10 §0 A1: travels with export/import). */
export interface LeaderboardIdentity {
  playerId: string;
  token: string;
  nickname: string;
  lastSubmittedAt: number;
}

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
  | 'quillResonance'
  // v3 — the 7 run-scoped re-scalers for tiers 1–7 (13 §2.4 / 14 §4.3).
  // Run-scoped (reset at prestige) and NOT kept by Perpetual Manuscript.
  | 'hundredNamesOfMuse'
  | 'inkTide'
  | 'parliamentOfRavens'
  | 'quillstorm'
  | 'theGreatTapestry'
  | 'infiniteStacks'
  | 'forgeOfLegends';

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
  | 'serialNovelist'
  // v2 (09 §5.1)
  | 'patronOfTheArts'
  | 'sparkChaser'
  | 'lightningInABottle'
  | 'pieceByPiece'
  | 'shelfOfOnesOwn'
  | 'collectedWorks'
  | 'mythmaker'
  | 'nameInLights'
  | 'speedReader'
  | 'fullPatronage'
  // v3 (13 §5.1) — 12 new achievements, total 36.
  | 'aLongerRoad'
  | 'cosmologySection'
  | 'twoHundredVoices'
  | 'deepShelves'
  | 'aNumberNeedsAName'
  | 'beyondTheAlphabet'
  | 'masterOfTheWing'
  | 'aThousandFeathers'
  | 'marathonNovelist'
  | 'completeWorks'
  | 'onceUponAHundred'
  | 'nothingLeftUnwritten';

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
  | 'heatOfCreation'
  // v2 (09 §5.2)
  | 'aLightAtTheWindow'
  | 'theGildedDoor'
  | 'theFirstSpine'
  | 'wordTravelsFast'
  // v3 (13 §5.2) — 6 reveal milestones, one per new tier.
  | 'bannersOnTheHorizon'
  | 'aDistantHarmony'
  | 'rumorsOfDivinity'
  | 'rootsUnderTheFloorboards'
  | 'lightsBeyondTheHills'
  | 'theOldestSentence';

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
  // --- v2 (10 §3.1) ---
  /** epoch ms the run started; 0 = unknown (run migrated from v1 — deviation A5). */
  startedAt: number;
  /** Active Stray Spark buff (quillFrenzy/gossipBonanza); null = none. */
  sparkBuff: SparkBuffState | null;
  /** Manual buff activations this run (Standing Ovation doubles the FIRST one). */
  buffActivationsThisRun: number;
  /** epoch ms of the last Self-Writing Contract auto-buy (max 1/sec). */
  lastAutoBuyAt: number;
  // --- v3 (14 §5.4) ---
  /** Seed capital granted at the START of this run (Dog-Eared Page + Foreword by
   *  the Editor). It flows into inspiration AND totalEarned, but the prestige
   *  formula runs on (totalEarnedThisRun − seededInspiration) — an anti-exploit
   *  guard so a big Foreword head-start cannot mint quills on an instant publish.
   *  Set once when the run is created; clamped to [0, totalEarned] on load. */
  seededInspiration: number;
}

export interface MetaStats {
  totalClicks: number;
  /** All-time earned Inspiration, across all runs. */
  lifetimeInspiration: number;
  buffActivations: number;
  offlineSessionsOver30Min: number;
  bestSingleOfflineGain: number;
  // --- v2 (10 §3.1) ---
  /** MONOTONIC — basis of the +30%/quill bonus (GOLDEN RULE; never decreases). */
  lifetimeQuillsEarned: number;
  sparksCaught: number;
  /** Golden Quills bound from Story Fragments (pieceByPiece achievement). */
  quillsFromFragments: number;
  /** min duration over runs ended with a timed Publish; null until the first one. */
  fastestPublishMs: number | null;
}

export interface Settings {
  numberNotation?: 'suffix' | 'scientific';
  buyQty?: BuyQty;
  reduceMotion?: boolean;
  /** v2 — Hall of Fables identity (10 §0 A1). Absent until the player opts in. */
  leaderboard?: LeaderboardIdentity;
}

export interface MetaState {
  /** v2 SEMANTICS: the spendable WALLET (Atelier purchases decrease it).
   *  The production bonus reads stats.lifetimeQuillsEarned, never this. */
  goldenQuills: number;
  tomesPublished: number;
  achievements: AchievementId[];
  /** Upgrade #11 — persists across prestige once bought. */
  quillResonance: boolean;
  stats: MetaStats;
  settings: Settings;
  // --- v2 (10 §3.1) ---
  /** Atelier upgrade id → current level (1-based; absent = 0). Permanent. */
  atelier: Partial<Record<AtelierUpgradeId, number>>;
  /** 0–4; at 5 a Golden Quill is bound automatically (wallet AND lifetime). */
  storyFragments: number;
  /** The Bookshelf — append-only, one entry per published Tome. */
  fables: Fable[];
}

export interface GameState {
  run: RunState;
  meta: MetaState;
  /** epoch ms — delta-time anchor; persisted as savedAt. */
  lastTickAt: number;
}

export type BuyQty = 1 | 10 | 'max';

export type Action =
  // critRoll (v2): the shell passes Math.random() ∈ [0,1) so the reducer stays
  // RNG-free; absent = no crit possible (v1 dispatches remain valid).
  | { type: 'click'; critRoll?: number }
  | { type: 'buyGenerator'; id: GeneratorId; qty: BuyQty }
  | { type: 'buyUpgrade'; id: UpgradeId }
  | { type: 'activateBuff' }
  // v2 — spends the wallet (meta.goldenQuills) only; lifetimeQuillsEarned never drops.
  | { type: 'buyAtelierUpgrade'; id: AtelierUpgradeId }
  // v2 — kind is rolled in the shell (rollSparkKind); magnitude is computed
  // deterministically in the reducer from the CURRENT state.
  | { type: 'collectSpark'; kind: SparkRewardKind }
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
  | { kind: 'tomesPublished'; count: number }
  // v2 (10 §3.5) — all purely derivable from state/counters
  | { kind: 'sparksCaught'; count: number }
  | { kind: 'quillsFromFragments'; count: number }
  | { kind: 'fableCount'; count: number }
  | { kind: 'uniqueFableCount'; count: number }
  | { kind: 'atelierAny' }
  | { kind: 'atelierComplete' }
  | { kind: 'fastestPublishBelow'; ms: number }
  | { kind: 'leaderboardJoined' }
  // --- v3 (13 §5.1) — all purely derivable from state/counters ---
  /** Any generator of tier >= tierAtLeast is owned (≥1). */
  | { kind: 'anyGeneratorFromTier'; tierAtLeast: number }
  /** At least one of every generator (all 14 tiers). */
  | { kind: 'allGeneratorsV3' }
  /** owned(any single generator) reaches `count` (highest single stack). */
  | { kind: 'anyGeneratorCount'; count: number }
  /** run totalEarned reaches `amount` in a single run. */
  | { kind: 'runTotalEarned'; amount: number }
  /** lifetimeInspiration reaches `amount`. */
  | { kind: 'lifetimeInspirationAmount'; amount: number }
  /** The New Wing at a given level. */
  | { kind: 'atelierLevel'; upgrade: AtelierUpgradeId; level: number }
  /** lifetimeQuillsEarned reaches `count`. */
  | { kind: 'lifetimeQuills'; count: number }
  /** Every relic unlocked AND every Atelier upgrade maxed (100% meta). */
  | { kind: 'metaComplete' };

export type MilestoneRequirement =
  | { kind: 'totalEarned'; amount: number }
  | { kind: 'firstAchievement' }
  // v2 — re-added instantly after every prestige (same mechanism as hallOfDeeds)
  | { kind: 'tomesPublished'; count: number }
  // v3 — a tier-9+ reveal: run totalEarned reached AND The New Wing at `wing`
  // (13 §5.2 / 14 §2). Like blueprintOfMyths, the row does not render at all
  // without the wing level; the reveal toast fires when both hold.
  | { kind: 'totalEarnedAndWing'; amount: number; wing: number };

export interface GeneratorConfig {
  readonly id: GeneratorId;
  readonly name: string;
  readonly flavor: string;
  readonly baseCost: number;
  readonly baseProd: number;
  readonly growth: number;
  /** Generator becomes visible in the shop at this run totalEarned. */
  readonly revealAt: number;
  /** v3 — required level of The New Wing to render this row (1/2/3). Absent for
   *  tiers 1–8 (no wing gate; mythEngine keeps its own blueprintOfMyths gate). */
  readonly wing?: number;
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

// ---------------------------------------------------------------------------
// v2 config shapes (numbers live ONLY in config.ts)
// ---------------------------------------------------------------------------

export interface AtelierUpgradeConfig {
  readonly id: AtelierUpgradeId;
  readonly name: string;
  readonly flavor: string;
  /** Cost in Golden Quills per level (index 0 = level 1). Length = max level. */
  readonly costs: readonly number[];
  /** Effect description per level (same length as costs), for the UI cards. */
  readonly levelDescriptions: readonly string[];
}

export interface RelicConfig {
  readonly id: RelicId;
  readonly name: string;
  readonly description: string;
  readonly flavor: string;
  /** Unlocks automatically at this meta.tomesPublished (derived, never saved). */
  readonly tomes: number;
}
