// unique-bonuses-info.ts — UI presentation data for the 14 unique bonuses that
// fire at the UNIQUE_THRESHOLD (200 owned, or 150 with The Hundredth Telling).
//
// The engine's config.UNIQUE_BONUSES holds ONLY the numeric effect fields
// (clickMult, offlineEffBonus, …) — deliberately no display strings. The
// human-readable name + one-line effect for each bonus is presentation, so it
// lives here (source of truth: 13 §2.3 "Cele 14 BONUSURI UNICE la 200"). Keyed
// by GeneratorId so a card can look up its own bonus with no branching.

import type { GeneratorId } from '../engine';

export interface UniqueBonusInfo {
  /** The bonus's proper name (shown on the badge tooltip title). */
  readonly name: string;
  /** One-line effect description (shown in the tooltip body). */
  readonly effect: string;
}

export const UNIQUE_BONUS_INFO: Readonly<Partial<Record<GeneratorId, UniqueBonusInfo>>> = {
  wanderingMuse: {
    name: 'A Hundred Whispers',
    effect: 'Click power ×2 — the muses whisper straight into your writing hand.',
  },
  inkSprite: {
    name: 'Ink in the Margins',
    effect: 'Ink Echo returns 2% of production per click, up from 1%.',
  },
  talkingRaven: {
    name: 'A Conspiracy of Ravens',
    effect: 'Every generator costs 3% less (stacks with Patron’s Favor).',
  },
  enchantedQuill: {
    name: 'The Quills Write Back',
    effect: 'Moment of Inspiration lasts 5 seconds longer.',
  },
  storyLoom: {
    name: 'Warp and Weft',
    effect: 'Tiers 1–4 produce ×3 — old threads, re-woven on a new loom.',
  },
  dreamLibrary: {
    name: 'The Library Never Closes',
    effect: 'Offline efficiency +5 points (capped at 90%).',
  },
  fableForge: {
    name: 'White-Hot Archetypes',
    effect: 'The buff’s production multiplier rises from ×2 to ×2.5.',
  },
  mythEngine: {
    name: 'Perpetual Myth',
    effect: 'Moment of Inspiration cooldown −10s (floor 45s).',
  },
  sagaCitadel: {
    name: 'The Garrison Sallies Forth',
    effect: 'Stray Sparks appear 25% more often.',
  },
  narratorsGuild: {
    name: 'Everyone’s Biographer',
    effect: 'Each achievement gives 50% more global production.',
  },
  pantheonPress: {
    name: 'Divine Royalties',
    effect: '+1 Golden Quill every time you Publish this run.',
  },
  worldTreeArchive: {
    name: 'Deep Roots',
    effect: 'Offline earnings cap +12 hours.',
  },
  sleepingCity: {
    name: 'The City Dreams of You',
    effect: 'Stray Spark rewards ×2 (stacks with the Sparkcatcher’s Net).',
  },
  onceUponATime: {
    name: '…Happily Ever After',
    effect: 'Global production ×2 — the capstone of a single run.',
  },
};
