// Font family tokens. Use these instead of stringy literals so a misspell
// breaks the type checker, not just runtime rendering.
// The values are the keys passed to expo-font's `useFonts()` in app/_layout.tsx
// — they must match exactly.

// NOTE: keys must match the registration keys in app/_layout.tsx exactly.
// We register Pretendard under unique `PretendardKR_*` keys because the
// stock `Pretendard-Regular` key path silently failed to load on Expo Go
// (iOS resolved the family-name collision wrong). The PretendardKR_ prefix
// is a workaround — internally we still use the Pretendard `Std` variant
// .otf files; the user-facing typography is still Pretendard.
export const FONT_FAMILIES = {
  pretendard: 'PretendardKR_Regular',
  pretendardMedium: 'PretendardKR_Medium',
  pretendardSemiBold: 'PretendardKR_SemiBold',
  pretendardBold: 'PretendardKR_Bold',
  mono: 'GeistMono_400Regular',
} as const;

export type FontFamilyKey = keyof typeof FONT_FAMILIES;
