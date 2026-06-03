// Static asset map for amatta-v1 PNG sources.
// Metro statically resolves these require() expressions at build time —
// they must be literal string paths (no template strings) so the bundler
// can inline the module IDs. See assets/amatta/ for the raw files.

export const AVATAR_FACES = {
  calm: require('../../assets/amatta/avatar-face-calm.png'),
  cool: require('../../assets/amatta/avatar-face-cool.png'),
  dizzy: require('../../assets/amatta/avatar-face-dizzy.png'),
  happy: require('../../assets/amatta/avatar-face-happy.png'),
  sleep: require('../../assets/amatta/avatar-face-sleep.png'),
  surprise: require('../../assets/amatta/avatar-face-surprise.png'),
  wink: require('../../assets/amatta/avatar-face-wink.png'),
} as const;
export type AvatarFaceKey = keyof typeof AVATAR_FACES;

// Map a domain AvatarKey (`face-wink`, `face-cool`, …) onto its image
// source. Keeps the schema-level identifier ('face-…') as the source of
// truth while letting the asset module preserve the short-key
// AVATAR_FACES table.
import type { AvatarKey } from '../domain/avatar';
export const AVATAR_IMAGE_BY_KEY: Readonly<Record<AvatarKey, number>> = {
  'face-wink': AVATAR_FACES.wink,
  'face-cool': AVATAR_FACES.cool,
  'face-calm': AVATAR_FACES.calm,
  'face-sleep': AVATAR_FACES.sleep,
  'face-surprise': AVATAR_FACES.surprise,
  'face-dizzy': AVATAR_FACES.dizzy,
};

export const AVATAR_ANIMALS = {
  bear: require('../../assets/amatta/avatar-bear.png'),
  cat: require('../../assets/amatta/avatar-cat.png'),
  deer: require('../../assets/amatta/avatar-deer.png'),
  rabbit: require('../../assets/amatta/avatar-rabbit.png'),
} as const;
export type AvatarAnimalKey = keyof typeof AVATAR_ANIMALS;

export const MASCOTS = {
  orange: require('../../assets/amatta/mascot-orange.png'),
  pink: require('../../assets/amatta/mascot-pink.png'),
  sleep: require('../../assets/amatta/mascot-sleep.png'),
  yellow: require('../../assets/amatta/mascot-yellow.png'),
} as const;
export type MascotKey = keyof typeof MASCOTS;

export const LOGOS = {
  sparkle: require('../../assets/amatta/logo-sparkle.png'),
  wordmark: require('../../assets/amatta/logo-wordmark.png'),
} as const;
export type LogoKey = keyof typeof LOGOS;
