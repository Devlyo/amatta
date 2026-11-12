// Static asset map. Faces + welcome hero are WebP (288 px faces, 2026-11-12) — PNG was 5–8× bigger.
// Metro statically resolves these require() expressions at build time —
// they must be literal string paths (no template strings) so the bundler
// can inline the module IDs. See assets/amatta/ for the raw files.

// Map a domain AvatarKey (`face-wink`, `face-cool`, …) onto its image
// source. Keeps the schema-level identifier ('face-…') as the source of
// truth while letting the asset module preserve the short-key
// AVATAR_FACES table.
import type { AvatarKey } from '../domain/avatar';

export const AVATAR_FACES = {
  calm: require('../../assets/amatta/avatar-face-calm.webp'),
  cool: require('../../assets/amatta/avatar-face-cool.webp'),
  dizzy: require('../../assets/amatta/avatar-face-dizzy.webp'),
  happy: require('../../assets/amatta/avatar-face-happy.webp'),
  sleep: require('../../assets/amatta/avatar-face-sleep.webp'),
  surprise: require('../../assets/amatta/avatar-face-surprise.webp'),
  wink: require('../../assets/amatta/avatar-face-wink.webp'),
} as const;
export type AvatarFaceKey = keyof typeof AVATAR_FACES;
export const AVATAR_IMAGE_BY_KEY: Readonly<Record<AvatarKey, number>> = {
  'face-wink': AVATAR_FACES.wink,
  'face-cool': AVATAR_FACES.cool,
  'face-calm': AVATAR_FACES.calm,
  'face-sleep': AVATAR_FACES.sleep,
  'face-surprise': AVATAR_FACES.surprise,
  'face-dizzy': AVATAR_FACES.dizzy,
};


// Orange "WeM[face]a" wordmark (ADR-011) — also the native splash image.
// 1200 × 263; keep that aspect when sizing.
export const WORDMARK = require('../../assets/images/splash-icon.png');
export const WORDMARK_ASPECT = 1200 / 263;

// Onboarding welcome hero — the kids around a calendar (owner, 2026-11-12). Transparent WebP (~90 KB; was a 490 KB PNG).
export const WELCOME_HERO = require('../../assets/images/welcome-hero.webp');
export const WELCOME_HERO_ASPECT = 1080 / 720;
