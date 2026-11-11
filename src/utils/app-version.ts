// The app version shown in 설정 / 약관 — read from app.json (expo.version) so
// a release bump is one edit there (+ package.json), not a hunt for literals.

import Constants from 'expo-constants';

export const APP_VERSION: string = Constants.expoConfig?.version ?? '2.0.0';
