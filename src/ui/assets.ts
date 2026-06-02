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
