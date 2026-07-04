// icons.ts — the fixed emoji map from 04 §1.2 (+ upgrade icons chosen by Agent UI,
// documented in 05). Emoji are never raw in text: always rendered via <IconCoin>.

import type { AtelierUpgradeId, GeneratorId, RelicId, UpgradeId } from '../engine';

export const ICON = {
  inspiration: '✨',
  goldenQuills: '🪶',
  buff: '💡',
  prestige: '📖',
  achievements: '🏆',
  milestones: '🗝️',
  settings: '⚙️',
  offline: '⏳',
  shop: '🏭',
  upgrades: '📜',
  // v2 (12 §1.3 / §9 — 🏛️ belongs to the Myth Engine, ⚙️ to Settings)
  atelier: '🪶',
  hall: '🏅',
  fragments: '🧩',
  spark: '✨',
  bookshelf: '📖',
} as const;

export const GENERATOR_ICONS: Record<GeneratorId, string> = {
  wanderingMuse: '🧚',
  inkSprite: '💧',
  talkingRaven: '🐦‍⬛',
  enchantedQuill: '✒️',
  storyLoom: '🧵',
  dreamLibrary: '📚',
  fableForge: '⚒️',
  mythEngine: '🏛️', // v2 — fixed in 09 §1.3 (⚙️ is taken by Settings)
  // v3 — tiers 9–14 (13 §1.2 icons; all distinct from mythEngine 🏛️).
  sagaCitadel: '🏰',
  narratorsGuild: '🎭',
  pantheonPress: '⚜️',
  worldTreeArchive: '🌳',
  sleepingCity: '💤',
  onceUponATime: '📜',
};

/** Relic icons — fixed by 12 §3 (extension of 04 §1.2); v3 relics chosen here. */
export const RELIC_ICONS: Record<RelicId, string> = {
  dogEaredPage: '📑',
  standingOvation: '👏',
  inkThatRemembers: '🏺',
  readersLetter: '💌',
  // v3
  forewordByTheEditor: '✍️',
  pilgrimsPages: '🧭',
  hundredthTelling: '🔁',
  endlessShelf: '🗄️',
};

/** Atelier upgrade icons — chosen by Agent UI v2/v3 (04 §1.2 does not define them). */
export const ATELIER_ICONS: Record<AtelierUpgradeId, string> = {
  apprenticeMuse: '🕯️',
  selfWritingContract: '📝',
  strokeOfGenius: '⚡',
  blueprintOfMyths: '📐',
  restlessHeart: '💓',
  thunderousApplause: '🎭',
  nightOwlPact: '🦉',
  sparkcatchersNet: '🕸️',
  secondBookmark: '🔖',
  editorsDue: '🖋️',
  // v3 (note: 🎭 is taken by thunderousApplause here — narratorsGuild uses it
  // in GENERATOR_ICONS, a different map, so no collision).
  theNewWing: '🏛️',
  clockworkUnderstudy: '⏱️',
  curatorsPatience: '⏳',
  perpetualManuscript: '♾️',
  strengthOfTheStacks: '💪',
  atlasOfUntoldLands: '🗺️',
};

export const UPGRADE_ICONS: Record<UpgradeId, string> = {
  sharpenedNib: '✒️',
  musesChorus: '🎶',
  goldenInkwell: '🏺',
  ravensGossip: '🐦‍⬛',
  weaversRhythm: '🧵',
  lucidDreaming: '🌙',
  burstOfGenius: '💡',
  inkEcho: '💧',
  patronsFavor: '👑',
  boundAnthology: '📚',
  quillResonance: '🪶',
  // v3 — the 7 run-scoped re-scalers.
  hundredNamesOfMuse: '🧚',
  inkTide: '🌊',
  parliamentOfRavens: '🐦‍⬛',
  quillstorm: '🌀',
  theGreatTapestry: '🧶',
  infiniteStacks: '📚',
  forgeOfLegends: '⚒️',
};
