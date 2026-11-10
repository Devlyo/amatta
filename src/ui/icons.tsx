// Icon set — amatta custom SVG icons (react-native-svg) + @expo/vector-icons fallback.
//
// A-ICONS (ADR-005): the brand/category icons are the amatta set in
// `docs/design/amatta-icons/` (single-path, viewBox 0 0 24 24, currentColor),
// hand-ported to react-native-svg so they tint via the `color` prop. Icons with
// no amatta asset (search/chevrons/plus/check/x/trash/repeat) stay on
// @expo/vector-icons.
//
// ⚠️ react-native-svg does NOT load in the Expo Go SDK 54 binary (RNSVG Fabric
// components throw "Could not find component config for native component"). This
// file therefore requires an EAS dev/prod build — which is now the project's
// runtime (ADR-005). Do NOT run this in Expo Go.

import { memo, type ComponentType } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Path } from 'react-native-svg';

import type { ScheduleType } from '../domain/types';
import { TOKENS } from './palette';

export interface IconProps {
  size?: number;
  color?: string;
}

export type IconComponent = ComponentType<IconProps>;

// ── amatta SVG icon factory ──────────────────────────────────────────────────
// Every amatta-icons asset is a single path on a 24×24 canvas using
// `fill="currentColor"`; we map that to `fill={color}` so the icon honors the
// design-token color passed by the call site.

function makeAmattaIcon(pathD: string, defaultSize: number): IconComponent {
  return memo(function AmattaIcon({
    size = defaultSize,
    color = TOKENS.ink,
  }: IconProps) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={pathD} fill={color} />
      </Svg>
    );
  });
}

// Path data copied verbatim from docs/design/amatta-icons/*.svg.
const PATH = {
  school:
    'M23 18.9999H22V8.99991H18V6.58569L12 0.585693L6 6.58569V8.99991H2V18.9999H1V20.9999H23V18.9999ZM6 19H4V11H6V19ZM18 11H20V19H18V11ZM11 12H13V19H11V12Z',
  book: 'M21 4H7C5.89543 4 5 4.89543 5 6C5 7.10457 5.89543 8 7 8H21V21C21 21.5523 20.5523 22 20 22H7C4.79086 22 3 20.2091 3 18V6C3 3.79086 4.79086 2 7 2H20C20.5523 2 21 2.44772 21 3V4ZM20 7H7C6.44772 7 6 6.55228 6 6C6 5.44772 6.44772 5 7 5H20V7Z',
  starSmile:
    'M11.9996 0.5L16.2256 6.68342L23.4123 8.7918L18.8374 14.7217L19.053 22.2082L11.9996 19.6897L4.94617 22.2082L5.16179 14.7217L0.586914 8.7918L7.7736 6.68342L11.9996 0.5ZM9.99959 12H7.99959C7.99959 14.2091 9.79045 16 11.9996 16C14.1418 16 15.8907 14.316 15.9947 12.1996L15.9996 12H13.9996C13.9996 13.1046 13.1042 14 11.9996 14C10.9452 14 10.0814 13.1841 10.0051 12.1493L9.99959 12Z',
  more: 'M5 10C3.9 10 3 10.9 3 12C3 13.1 3.9 14 5 14C6.1 14 7 13.1 7 12C7 10.9 6.1 10 5 10ZM19 10C17.9 10 17 10.9 17 12C17 13.1 17.9 14 19 14C20.1 14 21 13.1 21 12C21 10.9 20.1 10 19 10ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z',
  homeSmile:
    'M20 20C20 20.5523 19.5523 21 19 21H5C4.44772 21 4 20.5523 4 20V11L1 11L11.3273 1.6115C11.7087 1.26475 12.2913 1.26475 12.6727 1.6115L23 11L20 11V20ZM7.5 13C7.5 15.4853 9.51472 17.5 12 17.5C14.4853 17.5 16.5 15.4853 16.5 13H14.5C14.5 14.3807 13.3807 15.5 12 15.5C10.6193 15.5 9.5 14.3807 9.5 13H7.5Z',
  settings:
    'M2.13127 13.6308C1.9492 12.5349 1.95521 11.434 2.13216 10.3695C3.23337 10.3963 4.22374 9.86798 4.60865 8.93871C4.99357 8.00944 4.66685 6.93557 3.86926 6.17581C4.49685 5.29798 5.27105 4.51528 6.17471 3.86911C6.9345 4.66716 8.0087 4.99416 8.93822 4.60914C9.86774 4.22412 10.3961 3.23332 10.369 2.13176C11.4649 1.94969 12.5658 1.9557 13.6303 2.13265C13.6036 3.23385 14.1319 4.22422 15.0612 4.60914C15.9904 4.99406 17.0643 4.66733 17.8241 3.86975C18.7019 4.49734 19.4846 5.27153 20.1308 6.1752C19.3327 6.93499 19.0057 8.00919 19.3907 8.93871C19.7757 9.86823 20.7665 10.3966 21.8681 10.3695C22.0502 11.4654 22.0442 12.5663 21.8672 13.6308C20.766 13.6041 19.7756 14.1324 19.3907 15.0616C19.0058 15.9909 19.3325 17.0648 20.1301 17.8245C19.5025 18.7024 18.7283 19.4851 17.8247 20.1312C17.0649 19.3332 15.9907 19.0062 15.0612 19.3912C14.1316 19.7762 13.6033 20.767 13.6303 21.8686C12.5344 22.0507 11.4335 22.0447 10.3691 21.8677C10.3958 20.7665 9.86749 19.7761 8.93822 19.3912C8.00895 19.0063 6.93508 19.333 6.17532 20.1306C5.29749 19.503 4.51479 18.7288 3.86862 17.8252C4.66667 17.0654 4.99367 15.9912 4.60865 15.0616C4.22363 14.1321 3.23284 13.6038 2.13127 13.6308ZM11.9997 15.0002C13.6565 15.0002 14.9997 13.657 14.9997 12.0002C14.9997 10.3433 13.6565 9.00018 11.9997 9.00018C10.3428 9.00018 8.99969 10.3433 8.99969 12.0002C8.99969 13.657 10.3428 15.0002 11.9997 15.0002Z',
} as const;

// ── Brand / navigation icons (no amatta asset → @expo/vector-icons) ───────────

export const IconSearch = memo(function IconSearch({ size = 18, color = TOKENS.ink }: IconProps) {
  return <Ionicons name="search" size={size} color={color} />;
});

export const IconChevronLeft = memo(function IconChevronLeft({ size = 18, color = TOKENS.ink }: IconProps) {
  return <Ionicons name="chevron-back" size={size} color={color} />;
});

export const IconChevronRight = memo(function IconChevronRight({ size = 18, color = TOKENS.ink }: IconProps) {
  return <Ionicons name="chevron-forward" size={size} color={color} />;
});

export const IconChevronDown = memo(function IconChevronDown({ size = 16, color = TOKENS.ink }: IconProps) {
  return <Ionicons name="chevron-down" size={size} color={color} />;
});

export const IconPlus = memo(function IconPlus({ size = 24, color = TOKENS.ink }: IconProps) {
  return <Ionicons name="add" size={size} color={color} />;
});

export const IconCheck = memo(function IconCheck({ size = 16, color = TOKENS.ink }: IconProps) {
  return <Ionicons name="checkmark" size={size} color={color} />;
});

export const IconXMark = memo(function IconXMark({ size = 16, color = TOKENS.ink }: IconProps) {
  return <Ionicons name="close" size={size} color={color} />;
});

export const IconTrash = memo(function IconTrash({ size = 18, color = TOKENS.ink }: IconProps) {
  return <Ionicons name="trash-outline" size={size} color={color} />;
});

export const IconRepeat = memo(function IconRepeat({ size = 13, color = TOKENS.ink }: IconProps) {
  return <Ionicons name="repeat" size={size} color={color} />;
});

// ── amatta brand / nav icons ─────────────────────────────────────────────────

export const IconHome: IconComponent = makeAmattaIcon(PATH.homeSmile, 22);
export const IconGear: IconComponent = makeAmattaIcon(PATH.settings, 22);

// ── Category icons (학교/학원/활동/기타) — amatta set ─────────────────────────
// Mapping: 학교=school, 학원=book, 활동=star-smile, 기타=more.

export const IconSchool: IconComponent = makeAmattaIcon(PATH.school, 14);
export const IconAcademy: IconComponent = makeAmattaIcon(PATH.book, 14);
export const IconActivity: IconComponent = makeAmattaIcon(PATH.starSmile, 14);
export const IconEtc: IconComponent = makeAmattaIcon(PATH.more, 14);

// ── Domain mapping ────────────────────────────────────────────────────────
// amatta-v1 names the "other" kind as `etc`; our domain types use `other`.

export const KIND_ICON: Record<ScheduleType, IconComponent> = {
  school: IconSchool,
  academy: IconAcademy,
  activity: IconActivity,
  other: IconEtc,
};
