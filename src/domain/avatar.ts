// Avatar identity for a Child — the 6-face icon set ported from
// docs/design/amatta-v1/assets/avatar-face-*.png.
//
// Per user direction (2026-06-03), each AvatarKey is paired 1:1 with a
// ColorIndex. Picking an avatar therefore implicitly chooses the kid's
// palette slot too; the kid-edit screen only renders the avatar picker
// and dispatches both fields together. Keep the mapping stable — it's
// stored as `children.avatar` (TEXT) AND `children.color_index` (INT)
// for redundancy / clarity, and the two MUST always agree.
//
// face-happy is excluded per docs/design/README.md §10 Q7 (its orange
// hue would collide with TOKENS.primary brand color).

import type { ColorIndex } from './types';

// Canonical pairing from docs/design/amatta-v1/app-tokens.jsx KIDS demo:
//   민준 → peach (0) + face-wink
//   서윤 → mint  (1) + face-dizzy
//   지호 → sky   (2) + face-cool
//   서아 → butter(3) + face-sleep
// Slots 4 (citrus) and 5 (lavender) aren't in the 4-kid KIDS demo;
// face-surprise reads as "bright/zingy" → citrus and face-calm reads as
// "relaxed" → lavender. Easy to re-pair if reference assets land.
export const AVATAR_KEYS = [
  'face-wink',     // 0 — Petunia Pink (peach)
  'face-dizzy',    // 1 — Vibrant Mint
  'face-cool',     // 2 — Glacier Blue (sky)
  'face-sleep',    // 3 — Soft Peach (butter)
  'face-surprise', // 4 — Citrus Green
  'face-calm',     // 5 — French Lavender
] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];

export const DEFAULT_AVATAR_KEY: AvatarKey = 'face-wink';

export function isAvatarKey(s: string): s is AvatarKey {
  return (AVATAR_KEYS as readonly string[]).includes(s);
}

export function avatarKeyForColorIndex(ci: ColorIndex): AvatarKey {
  const k = AVATAR_KEYS[ci];
  if (k === undefined) {
    throw new Error(`avatarKeyForColorIndex: invalid colorIndex ${String(ci)}`);
  }
  return k;
}

export function colorIndexForAvatarKey(k: AvatarKey): ColorIndex {
  const ci = AVATAR_KEYS.indexOf(k);
  if (ci < 0) {
    throw new Error(`colorIndexForAvatarKey: unknown avatar key "${k}"`);
  }
  return ci as ColorIndex;
}
