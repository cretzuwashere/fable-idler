// config.ts — THE single place for every balance number in the game.
// v1 numbers are FINAL per ai-memory/03-economy-balance.md; v2 numbers are
// FINAL per ai-memory/11-v2-economy.md (which overrides 09-v2-game-design.md
// where they differ: inkBurst 45s not 900s, Thunderous Applause 20s not 60s,
// Atelier total 92 quills). No other module (and no UI code) may hardcode
// balance values.

import type {
  AchievementConfig,
  AtelierUpgradeConfig,
  AtelierUpgradeId,
  GeneratorConfig,
  GeneratorId,
  RelicConfig,
  RelicId,
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
  // v2 — generator 8 (11 §3, unchanged from 09 §1.3). A normal generator for
  // production/cost/qty-milestones; its SHOP visibility additionally requires
  // the blueprintOfMyths Atelier upgrade (isGeneratorVisibleInShop selector) —
  // without the Blueprint the row does not render at all (no teaser).
  {
    id: 'mythEngine',
    name: 'Myth Engine',
    flavor:
      'A colossal clockwork engine that dreams entire mythologies and wakes up embarrassed about them.',
    baseCost: 300_000_000,
    baseProd: 45_000,
    growth: 1.12,
    revealAt: 150_000_000,
  },
];

export const GENERATOR_IDS: readonly GeneratorId[] = GENERATORS.map((g) => g.id);

export const GENERATOR_INDEX: Readonly<Record<GeneratorId, GeneratorConfig>> = Object.fromEntries(
  GENERATORS.map((g) => [g.id, g]),
) as Record<GeneratorId, GeneratorConfig>;

/** The 7 base-game generators — the "Well-Rounded Library" achievement stays
 *  evaluable without the (Atelier-gated) Myth Engine, exactly as in v1. */
export const WELL_ROUNDED_GENERATOR_IDS: readonly GeneratorId[] = GENERATORS.filter(
  (g) => g.id !== 'mythEngine',
).map((g) => g.id);

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
  // --- v2 achievements (09 §5.1) — total 24 ---
  {
    id: 'patronOfTheArts',
    name: 'Patron of the Arts',
    description: 'Buy your first upgrade in the Gilded Atelier.',
    condition: { kind: 'atelierAny' },
  },
  {
    id: 'sparkChaser',
    name: 'Spark Chaser',
    description: 'Catch your first Stray Spark.',
    condition: { kind: 'sparksCaught', count: 1 },
  },
  {
    id: 'lightningInABottle',
    name: 'Lightning in a Bottle',
    description: 'Catch 25 Stray Sparks.',
    condition: { kind: 'sparksCaught', count: 25 },
  },
  {
    id: 'pieceByPiece',
    name: 'Piece by Piece',
    description: 'Bind your first Golden Quill from 5 Story Fragments.',
    condition: { kind: 'quillsFromFragments', count: 1 },
  },
  {
    id: 'shelfOfOnesOwn',
    name: "A Shelf of One's Own",
    description: 'Collect 5 fables on the Bookshelf.',
    condition: { kind: 'fableCount', count: 5 },
  },
  {
    id: 'collectedWorks',
    name: 'Collected Works',
    description: 'Collect 15 uniquely titled fables.',
    condition: { kind: 'uniqueFableCount', count: 15 },
  },
  {
    id: 'mythmaker',
    name: 'Mythmaker',
    description: 'Buy your first Myth Engine.',
    condition: { kind: 'generatorCount', generator: 'mythEngine', count: 1 },
  },
  {
    id: 'nameInLights',
    name: 'Name in Lights',
    description: 'Claim your place in the Hall of Fables.',
    condition: { kind: 'leaderboardJoined' },
  },
  {
    id: 'speedReader',
    name: 'Speed Reader',
    description: 'Publish a Tome in under 10 minutes.',
    condition: { kind: 'fastestPublishBelow', ms: 600_000 },
  },
  {
    id: 'fullPatronage',
    name: 'Full Patronage',
    description: 'Bring every Atelier upgrade to its maximum level.',
    condition: { kind: 'atelierComplete' },
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
  // --- v2 reveal milestones (09 §5.2) ---
  {
    id: 'aLightAtTheWindow',
    name: 'A Light at the Window',
    description: 'Something glimmers past the window. Catch it.',
    requirement: { kind: 'totalEarned', amount: 1_000 },
  },
  {
    id: 'theGildedDoor',
    name: 'The Gilded Door',
    description: 'The Gilded Atelier opens its door.',
    requirement: { kind: 'tomesPublished', count: 1 },
  },
  {
    id: 'theFirstSpine',
    name: 'The First Spine',
    description: 'The Bookshelf holds its first fable.',
    requirement: { kind: 'tomesPublished', count: 1 },
  },
  {
    id: 'wordTravelsFast',
    name: 'Word Travels Fast',
    description: 'The Hall of Fables awaits your name.',
    requirement: { kind: 'tomesPublished', count: 1 },
  },
];

// ===========================================================================
// v2 — The Gilded Atelier (11 §2; cost total 92 quills)
// ===========================================================================

export const ATELIER_UPGRADES: readonly AtelierUpgradeConfig[] = [
  {
    id: 'apprenticeMuse',
    name: 'Apprentice Muse',
    flavor: 'She opens the shop, lights the candles, and judges your handwriting.',
    costs: [1, 3, 8],
    levelDescriptions: [
      'Start each run with 5 Wandering Muses.',
      'Start each run with 15 Wandering Muses.',
      'Start each run with 30 Wandering Muses.',
    ],
  },
  {
    id: 'selfWritingContract',
    name: 'Self-Writing Contract',
    flavor: 'The quill signs. The quill hires. The quill does not ask.',
    costs: [4],
    levelDescriptions: [
      'Auto-buys 1 Wandering Muse per second while she costs at most 1% of your Inspiration.',
    ],
  },
  {
    id: 'strokeOfGenius',
    name: 'Stroke of Genius',
    flavor: 'Sometimes the ink knows before you do.',
    costs: [2, 6],
    levelDescriptions: [
      '5% chance a click is worth ×10.',
      '10% chance a click is worth ×10.',
    ],
  },
  {
    id: 'blueprintOfMyths',
    name: 'Blueprint of Myths',
    flavor: 'Some machines print pages. This one prints pantheons.',
    costs: [12],
    levelDescriptions: ['Unlocks generator 8: the Myth Engine.'],
  },
  {
    id: 'restlessHeart',
    name: 'Restless Heart',
    flavor: 'The heart wants what it wants. Mostly: more, sooner.',
    costs: [3, 7],
    levelDescriptions: [
      'Moment of Inspiration cooldown 90s → 75s.',
      'Moment of Inspiration cooldown 75s → 60s.',
    ],
  },
  {
    id: 'thunderousApplause',
    name: 'Thunderous Applause',
    flavor: 'Somewhere, an audience you cannot see is on its feet.',
    costs: [4],
    levelDescriptions: [
      'Activating Moment of Inspiration instantly grants 20 seconds of current production.',
    ],
  },
  {
    id: 'nightOwlPact',
    name: 'Night Owl Pact',
    flavor: 'The ravens agreed to take notes. The owls demanded a contract.',
    costs: [5],
    levelDescriptions: ['Offline cap +12h: 8h → 20h (with Lucid Dreaming: 12h → 24h).'],
  },
  {
    id: 'sparkcatchersNet',
    name: "Sparkcatcher's Net",
    flavor: 'Woven from patience and a little greed.',
    costs: [2, 5],
    levelDescriptions: [
      'Stray Sparks appear twice as often.',
      'Stray Spark rewards ×2.',
    ],
  },
  {
    id: 'secondBookmark',
    name: 'Second Bookmark',
    flavor: 'You may keep your place in two stories at once. The book disapproves.',
    costs: [6, 14],
    levelDescriptions: [
      'Your 2 cheapest owned run upgrades survive each Publish.',
      'Your 4 cheapest owned run upgrades survive each Publish.',
    ],
  },
  {
    id: 'editorsDue',
    name: "Editor's Due",
    flavor: 'The editor takes their cut. This time, in your favour.',
    costs: [10],
    levelDescriptions: ['Each Publish the Tome grants +1 bonus Golden Quill.'],
  },
];

export const ATELIER_UPGRADE_IDS: readonly AtelierUpgradeId[] = ATELIER_UPGRADES.map(
  (u) => u.id,
);

export const ATELIER_UPGRADE_INDEX: Readonly<Record<AtelierUpgradeId, AtelierUpgradeConfig>> =
  Object.fromEntries(ATELIER_UPGRADES.map((u) => [u.id, u])) as Record<
    AtelierUpgradeId,
    AtelierUpgradeConfig
  >;

// Effect numbers (11 §9 — copied literally).
export const APPRENTICE_MUSE_START_MUSES: readonly number[] = [5, 15, 30];
export const SELF_WRITING_CONTRACT = {
  autoBuyMaxCostFraction: 0.01,
  autoBuyIntervalMs: 1_000,
} as const;
export const STROKE_OF_GENIUS = {
  critChance: [0.05, 0.1] as readonly number[],
  /** Applies to the WHOLE click, Ink Echo included (11 RUN F decision). */
  critMult: 10,
} as const;
export const RESTLESS_HEART_COOLDOWN_MS: readonly number[] = [75_000, 60_000]; // base: 90_000
/** [DECIZIE DE CALIBRARE 11 §2] 60s → 20s; production WITHOUT the just-started buff. */
export const THUNDEROUS_APPLAUSE_PROD_SECONDS = 20;
export const NIGHT_OWL_EXTRA_CAP_MS = 12 * 3_600_000; // 8h→20h; 12h→24h
export const SECOND_BOOKMARK_KEPT: readonly number[] = [2, 4]; // cheapest by config cost
export const EDITORS_DUE_BONUS_QUILLS = 1;

// ===========================================================================
// v2 — Relics (derived from tomesPublished, NEVER stored in the save; 11 §4)
// ===========================================================================

export const RELICS: readonly RelicConfig[] = [
  {
    id: 'dogEaredPage',
    name: 'Dog-Eared Page',
    description: 'Start each run with 300 Inspiration.',
    flavor: "You marked where the story gets good. It's near the beginning.",
    tomes: 3,
  },
  {
    id: 'standingOvation',
    name: 'Standing Ovation',
    description: 'The first manual Moment of Inspiration each run lasts twice as long.',
    flavor: 'They stood. They clapped. One raven whistled.',
    tomes: 7,
  },
  {
    id: 'inkThatRemembers',
    name: 'Ink That Remembers',
    description: 'Global production +1% per Tome published, forever.',
    flavor: 'Every book you bound left a little of itself in the inkwell.',
    tomes: 15,
  },
  {
    id: 'readersLetter',
    name: "The Reader's Letter",
    description: 'Offline efficiency +10 percentage points.',
    flavor: 'Someone, somewhere, stayed up all night reading you. They wrote to say so.',
    tomes: 30,
  },
];

export const RELIC_INDEX: Readonly<Record<RelicId, RelicConfig>> = Object.fromEntries(
  RELICS.map((r) => [r.id, r]),
) as Record<RelicId, RelicConfig>;

/** Enters BOTH run.inspiration AND run.totalEarned (keeps balance ≤ totalEarned). */
export const DOG_EARED_PAGE_START_INSPIRATION = 300;
export const STANDING_OVATION_DURATION_MULT = 2;
export const INK_REMEMBERS_RATE = 0.01; // ×(1 + rate × tomesPublished), only once unlocked
export const READERS_LETTER_OFFLINE_BONUS = 0.1; // 0.5→0.6; 0.75→0.85

// ===========================================================================
// v2 — Stray Spark (11 §5; inkBurst 45s is a [DECIZIE DE CALIBRARE], not 900s)
// ===========================================================================

export const SPARK = {
  unlockTotalEarned: 1_000, // milestone aLightAtTheWindow
  intervalMinMs: 150_000,
  intervalMaxMs: 330_000, // uniform → 4 min average
  flightMs: 10_000,
  netIntervalDiv: 2, // Sparkcatcher's Net L1: [75s, 165s]
  netRewardMult: 2, // Sparkcatcher's Net L2 (sums/durations/fragments/quills; NOT timeSlip)
  weights: {
    inkBurst: 45,
    quillFrenzy: 20,
    gossipBonanza: 15,
    timeSlip: 10,
    storyFragment: 8,
    goldenQuillDrop: 2,
  },
  /** [DECIZIE DE CALIBRARE 11 §5] 900 → 45 × effectiveProd (snapshot at click, buffs included). */
  inkBurstSeconds: 45,
  inkBurstFloorClicks: 50, // floor: 50 × current click value
  frenzy: { durationMs: 30_000, clickMult: 7 }, // base part of the click only
  gossip: {
    durationMs: 60_000,
    prodMult: 5,
    tiers: ['wanderingMuse', 'inkSprite', 'talkingRaven'] as readonly GeneratorId[],
  },
  fragmentsPerQuill: 5,
} as const;

// ===========================================================================
// v2 — The Bookshelf (11 §6) + procedural fable titles (09 §3.1)
// ===========================================================================

export const BOOKSHELF = { bonusPerUniqueFable: 0.02, countedCap: 25 } as const; // max +50%

/** A fable spine turns golden at this many quills earned by its publish. */
export const GILDED_QUILLS_THRESHOLD = 5;

// Word tables — APPEND-ONLY (09 §3.1): inserting/reordering would silently
// change every historical regenerable title. fables.test.ts hardcodes exact
// titles to guard this.
export const FABLE_ADJECTIVES: readonly string[] = [
  'Curious', 'Gilded', 'Sleepless', 'Whispering', 'Ink-Stained', 'Moonlit', 'Stubborn',
  'Threadbare', 'Velvet', 'Forgetful', 'Clockwork', 'Humble', 'Boastful', 'Wandering',
];
export const FABLE_CREATURES: readonly string[] = [
  'Raven', 'Muse', 'Fox', 'Tortoise', 'Owl', 'Moth', 'Librarian', 'Quill', 'Sprite',
  'Dragonfly', 'Bookworm', 'Cartographer', 'Lantern', 'Nightingale',
];
export const FABLE_OBJECTS: readonly string[] = [
  'Inkwell', 'Unwritten Page', 'Borrowed Star', 'Last Candle', 'Paper Crown',
  'Silver Thread', 'Midnight Library', 'Lost Footnote', 'Golden Feather',
  'Sealed Letter', 'Endless Margin', 'Second Moon',
];
export const FABLE_VERB_PHRASES: readonly string[] = [
  'Outwrote the Dawn', 'Counted the Stars Twice', 'Borrowed Tomorrow',
  'Argued with the Moon', 'Sold Silence', 'Misplaced Thursday',
  'Taught the Rain to Read', 'Slept Through the Ending',
];
