// icons.ts — the fixed emoji map from 04 §1.2 (+ upgrade icons chosen by Agent UI,
// documented in 05). Emoji are never raw in text: always rendered via <IconCoin>.

import type { GeneratorId, UpgradeId } from '../engine';

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
} as const;

export const GENERATOR_ICONS: Record<GeneratorId, string> = {
  wanderingMuse: '🧚',
  inkSprite: '💧',
  talkingRaven: '🐦‍⬛',
  enchantedQuill: '✒️',
  storyLoom: '🧵',
  dreamLibrary: '📚',
  fableForge: '⚒️',
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
