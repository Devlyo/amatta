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

export const AVATAR_KEYS = [
  'face-wink',     // 0 — Petunia Pink
  'face-cool',     // 1 — Vibrant Mint
  'face-calm',     // 2 — Glacier Blue
  'face-sleep',    // 3 — Soft Peach
  'face-surprise', // 4 — Citrus Green
  'face-dizzy',    // 5 — French Lavender
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
