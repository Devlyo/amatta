// Font family tokens. Use these instead of stringy literals so a misspell
// breaks the type checker, not just runtime rendering.
// The values are the keys passed to expo-font's `useFonts()` in app/_layout.tsx
// — they must match exactly.

export const FONT_FAMILIES = {
  pretendard: 'Pretendard-Regular',
  pretendardMedium: 'Pretendard-Medium',
  pretendardSemiBold: 'Pretendard-SemiBold',
  pretendardBold: 'Pretendard-Bold',
  mono: 'GeistMono_400Regular',
} as const;

export type FontFamilyKey = keyof typeof FONT_FAMILIES;
