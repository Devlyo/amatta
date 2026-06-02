// Avatar mapping helper. amatta-v1 (`app-tokens.jsx`) gives each kid an
// `avatar: 'face-wink'`-style key. Our domain `Child` carries only
// `colorIndex` (no avatar column). Per the R2 plan (Option B), we derive a
// stable avatar key from colorIndex 0..5 → one of the 6 face PNGs so the same
// kid always renders the same face.
//
// Extending the schema with a real `avatar_key` column is a v2 migration —
// out of R2 scope. When that lands, swap this function for `child.avatarKey`.

import type { ColorIndex } from '../domain/types';
import type { AvatarFaceKey } from './assets';

// 6-color → 6-face mapping. Order matches the docs/design/README.md §2 palette:
//   0 Petunia Pink   → wink     (cheerful, "첫째" energy)
//   1 Vibrant Mint   → happy    (warm/smile)
//   2 Glacier Blue   → cool     (calm/icy)
//   3 Soft Peach     → calm     (soft/sleepy)
//   4 Citrus Green   → surprise (bright/zingy)
//   5 French Lavender→ dizzy    (playful/relaxed)
const INDEX_TO_FACE: readonly AvatarFaceKey[] = [
  'wink',
  'happy',
  'cool',
  'calm',
  'surprise',
  'dizzy',
] as const;

export function avatarForColorIndex(i: ColorIndex): AvatarFaceKey {
  return INDEX_TO_FACE[i] ?? 'wink';
}
