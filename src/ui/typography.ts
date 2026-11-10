import type { TextStyle } from 'react-native';
import { FONT_FAMILIES } from './fonts';

// Typography scale. Source of truth: docs/design/README.md §4.
//
// Weight is carried by the Pretendard *family* (each weight is a separately
// registered font), NOT by `fontWeight` — so these presets set `fontFamily`
// only. README weight policy: 400/500/600/700 → pretendard / *Medium /
// *SemiBold / *Bold.
//
// `lineHeight` is the README unitless ratio rounded to an absolute px value
// (RN requires absolute). `letterSpacing` is the README em value converted to
// points at the given size (em × size); 0 where README says "normal".
//
// Spread a preset into a Text style and override color/textAlign as needed:
//   <Text style={[TYPE.title, { color: TOKENS.ink }]}>…</Text>
export const TYPE = {
  // Display 32 / 700 / 1.15 / -0.02em
  display: {
    fontFamily: FONT_FAMILIES.pretendardBold,
    fontSize: 32,
    lineHeight: 37,
    letterSpacing: -0.64,
  },
  // Title L 24 / 700 / 1.20 / -0.01em
  titleL: {
    fontFamily: FONT_FAMILIES.pretendardBold,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.24,
  },
  // Title M 20 / 600 / 1.25 / normal
  titleM: {
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: 0,
  },
  // Title S 16 / 600 / 1.30 / normal
  titleS: {
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: 0,
  },
  // Body L 16 / 400 / 1.50 / normal
  bodyL: {
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
  // Body 14 / 400 / 1.45 / normal — default body + button label
  body: {
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
  },
  // Caption 12 / 500 / 1.40 / normal
  caption: {
    fontFamily: FONT_FAMILIES.pretendardMedium,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0,
  },
  // Caption2 11 / 500 — tighter chip label (SelectChip 자녀/종류/반복/알림). One
  // step below caption; intentional scale extension for the dense form chips.
  caption2: {
    fontFamily: FONT_FAMILIES.pretendardMedium,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0,
  },
  // ── ADR-007 iOS-scale presets (system screens, grouped lists, event form).
  // Older presets above stay until the Phase 7 sweep maps their call sites.
  // Large title 30 / 700 — home "오늘"
  largeTitle: {
    fontFamily: FONT_FAMILIES.pretendardBold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  // Headline 17 / 600 — nav bar title, section heading
  headline: {
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  // Row 17 / 400 — grouped list row label / input
  row: {
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  // Subhead 15 / 400 — secondary row text, inline links
  subhead: {
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  // Footnote 13 / 400 — section header, helper text
  footnote: {
    fontFamily: FONT_FAMILIES.pretendard,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  // Block title 13 / 600 — time block title (day view)
  blockTitle: {
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    fontSize: 13,
    lineHeight: 15,
    letterSpacing: -0.3,
  },
  // Axis meridiem 9 / 500 — the small "AM"/"PM" after a time-axis hour label
  axisMeridiem: {
    fontFamily: FONT_FAMILIES.pretendardMedium,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0,
  },
  // Mono 12 / 400 / 1.00 / normal — grid time column
  mono: {
    fontFamily: FONT_FAMILIES.mono,
    fontSize: 12,
    lineHeight: 12,
    letterSpacing: 0,
  },
} as const satisfies Record<string, TextStyle>;

export type TypeKey = keyof typeof TYPE;
