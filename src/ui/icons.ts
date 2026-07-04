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
};

/** Relic icons — fixed by 12 §3 (extension of 04 §1.2). */
export const RELIC_ICONS: Record<RelicId, string> = {
  dogEaredPage: '📑',
  standingOvation: '👏',
  inkThatRemembers: '🏺',
  readersLetter: '💌',
};

/** Atelier upgrade icons — chosen by Agent UI v2 (04 §1.2 does not define them). */
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
};
