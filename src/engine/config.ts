// config.ts — THE single place for every balance number in the game.
// Numbers are FINAL per ai-memory/03-economy-balance.md (which overrides
// 01-game-design.md where they differ: +30% per Golden Quill, Quill Resonance 2500).
// No other module (and no UI code) may hardcode balance values.

import type {
  AchievementConfig,
  GeneratorConfig,
  GeneratorId,
  RevealMilestoneConfig,
  RevealMilestoneId,
  UpgradeConfig,
  UpgradeId,
} from './types';

// ---------------------------------------------------------------------------
// Generators (03 §1) — cost(gen) = ceil(baseCost * growth^owned * patronDiscount)
// ---------------------------------------------------------------------------

export const GENERATORS: readonly GeneratorConfig[] = [
  {
    id: 'wanderingMuse',
    name: 'Wandering Muse',
    flavor: 'A wandering muse whispers ideas as she drifts past your window.',
    baseCost: 15,
    baseProd: 0.1,
    growth: 1.15,
    revealAt: 10,
  },
  {
    id: 'inkSprite',
    name: 'Ink Sprite',
    flavor: 'An ink sprite that doodles by itself in the margins of your pages.',
    baseCost: 100,
    baseProd: 1,
    growth: 1.15,
    revealAt: 60,
  },
  {
    id: 'talkingRaven',
    name: 'Talking Raven',
    flavor: 'A talking raven that gathers gossip and legends from seven lands.',
    baseCost: 1_100,
    baseProd: 8,
    growth: 1.14,
    revealAt: 600,
  },
  {
    id: 'enchantedQuill',
    name: 'Enchanted Quill',
    flavor: 'An enchanted quill that writes on its own and never tires.',
    baseCost: 12_000,
    baseProd: 47,
    growth: 1.13,
    revealAt: 6_000,
  },
  {
    id: 'storyLoom',
    name: 'Story Loom',
    flavor: 'A loom that weaves narrative threads into tapestries of story.',
    baseCost: 130_000,
    baseProd: 260,
    growth: 1.13,
    revealAt: 65_000,
  },
  {
    id: 'dreamLibrary',
    name: 'Dream Library',
    flavor: 'A library that collects the dreams of sleeping readers.',
    baseCost: 1_400_000,
    baseProd: 1_400,
    growth: 1.12,
    revealAt: 700_000,
  },
  {
    id: 'fableForge',
    name: 'Fable Forge',
    flavor: 'A mythic forge where archetypes are melted and cast into new fables.',
    baseCost: 20_000_000,
    baseProd: 7_800,
    growth: 1.12,
    revealAt: 10_000_000,
  },
];

export const GENERATOR_IDS: readonly GeneratorId[] = GENERATORS.map((g) => g.id);

export const GENERATOR_INDEX: Readonly<Record<GeneratorId, GeneratorConfig>> = Object.fromEntries(
  GENERATORS.map((g) => [g.id, g]),
) as Record<GeneratorId, GeneratorConfig>;

// ---------------------------------------------------------------------------
// Quantity milestones (03 §5): 25/50/100 owned of one generator → that generator ×2 each.
// Milestone id format (02 §8.3): `qty:<generatorId>:<threshold>`
// ---------------------------------------------------------------------------

export const QTY_MILESTONE_THRESHOLDS: readonly number[] = [25, 50, 100];
export const QTY_MILESTONE_MULT = 2;

// ---------------------------------------------------------------------------
// Click (03 §3)
// ---------------------------------------------------------------------------

export const CLICK_BASE = 1;
export const SHARPENED_NIB_MULT = 2;
/** Ink Echo: each click also adds this fraction of effective production/sec.
 *  NOT multiplied by the buff clickMult (production already carries buff ×2). */
export const INK_ECHO_RATE = 0.01;

// ---------------------------------------------------------------------------
// Production multipliers (03 §2)
// ---------------------------------------------------------------------------

export const GOLDEN_INKWELL_MULT = 1.5;
export const MUSES_CHORUS_MULT = 2;
/** Raven's Gossip: inkSprite ×(1 + rate × owned(talkingRaven)) */
export const RAVENS_GOSSIP_RATE = 0.05;
/** Weaver's Rhythm: enchantedQuill ×(1 + rate × owned(storyLoom)) */
export const WEAVERS_RHYTHM_RATE = 0.1;
export const PATRONS_FAVOR_DISCOUNT = 0.95;

/** +1% global production per achievement (additive between achievements). */
export const ACHIEVEMENT_BONUS = 0.01;
/** With Bound Anthology the per-achievement bonus doubles. */
export const ACHIEVEMENT_BONUS_ANTHOLOGY = 0.02;

// ---------------------------------------------------------------------------
// Prestige (03 §6) — quills = floor(sqrt(totalEarnedThisRun / PRESTIGE_DIVISOR))
// ---------------------------------------------------------------------------

export const PRESTIGE_DIVISOR = 1e5;
export const PRESTIGE_MIN_TOTAL_EARNED = 100_000;
/** +30% global production per Golden Quill, additive between quills ([DECIZIE DE CALIBRARE] 03 §6). */
export const QUILL_BONUS = 0.3;

// ---------------------------------------------------------------------------
// Moment of Inspiration buff (03 §7) — cooldown runs FROM ACTIVATION.
// ---------------------------------------------------------------------------

export const BUFF = {
  durationMs: 15_000,
  /** With Burst of Genius (+50% duration). */
  durationUpgradedMs: 22_500,
  cooldownMs: 90_000,
  /** Applies only to the base part of the click, never to the Ink Echo part. */
  clickMult: 5,
  prodMult: 2,
} as const;

/** The reveal milestone that unlocks the buff button (Racing Heart, 500 totalEarned). */
export const BUFF_UNLOCK_MILESTONE: RevealMilestoneId = 'racingHeart';

// ---------------------------------------------------------------------------
// Offline progress (03 §8)
// ---------------------------------------------------------------------------

export const OFFLINE = {
  baseEfficiency: 0.5,
  /** With Lucid Dreaming. */
  upgradedEfficiency: 0.75,
  capMsBase: 8 * 3_600_000, // 8h
  /** With Lucid Dreaming. */
  capMsUpgraded: 12 * 3_600_000, // 12h
  /** An offline session at least this long counts toward the Lucid Dreaming unlock. */
  longSessionMs: 30 * 60_000,
} as const;

// ---------------------------------------------------------------------------
// Loop timing (02 §2.2)
// ---------------------------------------------------------------------------

export const TICK_MS = 100;
export const AUTOSAVE_TICKS = 100; // ~10s
/** dt above this per tick is clamped; longer gaps go through the offline path
 *  (game-loop.ts routes them through offline.ts and emits an 'offline' event).
 *  The modal threshold is a UI concern: OFFLINE_MODAL_UI_MIN_MS in src/ui/meta.ts
 *  (60s per 04 §4.11, which supersedes the 5-minute mention in 02). */
export const MAX_TICK_DT_MS = 60_000;

// ---------------------------------------------------------------------------
// Upgrades (03 §4) — cost + unlock conditions as data; effects live in selectors.ts.
// ---------------------------------------------------------------------------

export const UPGRADES: readonly UpgradeConfig[] = [
  {
    id: 'sharpenedNib',
    name: 'Sharpened Nib',
    description: 'Click power ×2.',
    cost: 100,
    unlock: [{ kind: 'totalEarned', amount: 50 }],
  },
  {
    id: 'musesChorus',
    name: "Muse's Chorus",
    description: 'Wandering Muse production ×2.',
    cost: 500,
    unlock: [{ kind: 'generatorCount', generator: 'wanderingMuse', count: 10 }],
  },
  {
    id: 'goldenInkwell',
    name: 'Golden Inkwell',
    description: 'All production ×1.5.',
    cost: 15_000,
    unlock: [{ kind: 'totalEarned', amount: 10_000 }],
  },
  {
    id: 'ravensGossip',
    name: "Raven's Gossip",
    description: 'Each Talking Raven grants +5% Ink Sprite production.',
    cost: 25_000,
    unlock: [
      { kind: 'generatorCount', generator: 'talkingRaven', count: 5 },
      { kind: 'generatorCount', generator: 'inkSprite', count: 10 },
    ],
  },
  {
    id: 'weaversRhythm',
    name: "Weaver's Rhythm",
    description: 'Each Story Loom grants +10% Enchanted Quill production.',
    cost: 1_000_000,
    unlock: [
      { kind: 'generatorCount', generator: 'storyLoom', count: 5 },
      { kind: 'generatorCount', generator: 'enchantedQuill', count: 10 },
    ],
  },
  {
    id: 'lucidDreaming',
    name: 'Lucid Dreaming',
    description: 'Offline efficiency 50% → 75% and offline cap 8h → 12h.',
    cost: 50_000,
    unlock: [{ kind: 'offlineSessions', count: 1 }],
  },
  {
    id: 'burstOfGenius',
    name: 'Burst of Genius',
    description: 'Moment of Inspiration lasts 50% longer (15s → 22.5s).',
    cost: 75_000,
    unlock: [{ kind: 'buffActivations', count: 5 }],
  },
  {
    id: 'inkEcho',
    name: 'Ink Echo',
    description: 'Each click also adds 1% of your production per second.',
    cost: 200_000,
    unlock: [{ kind: 'totalGeneratorCount', count: 25 }],
  },
  {
    id: 'patronsFavor',
    name: "Patron's Favor",
    description: 'All generators cost 5% less.',
    cost: 2_000_000,
    unlock: [{ kind: 'totalEarned', amount: 1_000_000 }],
  },
  {
    id: 'boundAnthology',
    name: 'Bound Anthology',
    description: 'Each achievement bonus doubles (+1% → +2% global production).',
    cost: 5_000_000,
    unlock: [{ kind: 'achievementCount', count: 10 }],
  },
  {
    id: 'quillResonance',
    name: 'Quill Resonance',
    description: 'The Golden Quill bonus also applies to click power. Persists through prestige.',
    cost: 2_500, // [DECIZIE DE CALIBRARE] 03 §4: 10.000 → 2.500
    unlock: [{ kind: 'tomesPublished', count: 1 }],
  },
];

export const UPGRADE_INDEX: Readonly<Record<UpgradeId, UpgradeConfig>> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
) as Record<UpgradeId, UpgradeConfig>;

// ---------------------------------------------------------------------------
// Achievements (01 §6.1) — each grants +ACHIEVEMENT_BONUS global production, permanent.
// ---------------------------------------------------------------------------

export const ACHIEVEMENTS: readonly AchievementConfig[] = [
  {
    id: 'firstWords',
    name: 'First Words',
    description: 'Make your first click.',
    condition: { kind: 'totalClicks', count: 1 },
  },
  {
    id: 'storytellerAwakens',
    name: 'The Storyteller Awakens',
    description: 'Buy your first generator.',
    condition: { kind: 'totalGeneratorCount', count: 1 },
  },
  {
    id: 'busyFingers',
    name: 'Busy Fingers',
    description: 'Click 1,000 times in total.',
    condition: { kind: 'totalClicks', count: 1_000 },
  },
  {
    id: 'whisperedLegends',
    name: 'Whispered Legends',
    description: 'Earn 1,000 total Inspiration.',
    condition: { kind: 'lifetimeInspiration', amount: 1_000 },
  },
  {
    id: 'aThousandTales',
    name: 'A Thousand Tales',
    description: 'Earn 100,000 total Inspiration.',
    condition: { kind: 'lifetimeInspiration', amount: 100_000 },
  },
  {
    id: 'hoarderOfIdeas',
    name: 'Hoarder of Ideas',
    description: 'Hold 1,000,000 Inspiration at once.',
    condition: { kind: 'currentBalance', amount: 1_000_000 },
  },
  {
    id: 'museMenagerie',
    name: 'Muse Menagerie',
    description: 'Own 25 Wandering Muses.',
    condition: { kind: 'generatorCount', generator: 'wanderingMuse', count: 25 },
  },
  {
    id: 'fullAviary',
    name: 'Full Aviary',
    description: 'Own 25 Talking Ravens.',
    condition: { kind: 'generatorCount', generator: 'talkingRaven', count: 25 },
  },
  {
    id: 'wellRoundedLibrary',
    name: 'Well-Rounded Library',
    description: 'Own at least one of every generator.',
    condition: { kind: 'allGenerators' },
  },
  {
    id: 'industrialFiction',
    name: 'Industrial Fiction',
    description: 'Reach 1,000 Inspiration per second.',
    condition: { kind: 'perSecond', amount: 1_000 },
  },
  {
    id: 'nightShift',
    name: 'Night Shift',
    description: 'Collect at least 1,000 Inspiration from a single offline return.',
    condition: { kind: 'bestOfflineGain', amount: 1_000 },
  },
  {
    id: 'momentSeizer',
    name: 'Moment Seizer',
    description: 'Activate Moment of Inspiration 10 times.',
    condition: { kind: 'buffActivations', count: 10 },
  },
  {
    id: 'publishedAuthor',
    name: 'Published Author',
    description: 'Publish your first Tome.',
    condition: { kind: 'tomesPublished', count: 1 },
  },
  {
    id: 'serialNovelist',
    name: 'Serial Novelist',
    description: 'Publish 3 Tomes.',
    condition: { kind: 'tomesPublished', count: 3 },
  },
];

export const ACHIEVEMENT_IDS: readonly string[] = ACHIEVEMENTS.map((a) => a.id);

// ---------------------------------------------------------------------------
// Reveal milestones #1–11 (01 §6.2) — run-scoped, re-earned after prestige.
// ---------------------------------------------------------------------------

export const REVEAL_MILESTONES: readonly RevealMilestoneConfig[] = [
  {
    id: 'theFirstSpark',
    name: 'The First Spark',
    description: 'The generator panel opens — the Wandering Muse awaits.',
    requirement: { kind: 'totalEarned', amount: 10 },
  },
  {
    id: 'whispersInInk',
    name: 'Whispers in Ink',
    description: 'The Ink Sprite appears in the shop.',
    requirement: { kind: 'totalEarned', amount: 60 },
  },
  {
    id: 'craftsmansTools',
    name: "Craftsman's Tools",
    description: 'The Upgrades tab is revealed.',
    requirement: { kind: 'totalEarned', amount: 100 },
  },
  {
    id: 'racingHeart',
    name: 'Racing Heart',
    description: 'Moment of Inspiration becomes available.',
    requirement: { kind: 'totalEarned', amount: 500 },
  },
  {
    id: 'aFeatheredFriend',
    name: 'A Feathered Friend',
    description: 'The Talking Raven appears in the shop.',
    requirement: { kind: 'totalEarned', amount: 600 },
  },
  {
    id: 'hallOfDeeds',
    name: 'Hall of Deeds',
    description: 'The Achievements tab is revealed.',
    requirement: { kind: 'firstAchievement' },
  },
  {
    id: 'theQuillStirs',
    name: 'The Quill Stirs',
    description: 'The Enchanted Quill appears in the shop.',
    requirement: { kind: 'totalEarned', amount: 6_000 },
  },
  {
    id: 'thePublishersLetter',
    name: "The Publisher's Letter",
    description: 'The Prestige panel is revealed.',
    requirement: { kind: 'totalEarned', amount: 50_000 },
  },
  {
    id: 'threadsOfNarrative',
    name: 'Threads of Narrative',
    description: 'The Story Loom appears in the shop.',
    requirement: { kind: 'totalEarned', amount: 65_000 },
  },
  {
    id: 'doorsOfTheLibrary',
    name: 'Doors of the Library',
    description: 'The Dream Library appears in the shop.',
    requirement: { kind: 'totalEarned', amount: 700_000 },
  },
  {
    id: 'heatOfCreation',
    name: 'Heat of Creation',
    description: 'The Fable Forge appears in the shop.',
    requirement: { kind: 'totalEarned', amount: 10_000_000 },
  },
];
