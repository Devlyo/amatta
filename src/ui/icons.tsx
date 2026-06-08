// Icon set — @expo/vector-icons (Ionicons + MaterialCommunityIcons).
//
// react-native-svg can NOT be loaded in the Expo Go SDK 54 binary (its Fabric
// component modules — Circle/Defs/etc. — throw "Could not find component config
// for native component" the moment the package is evaluated). Since we're still
// developing on Expo Go (no EAS build yet), this file uses vector-icons only —
// any react-native-svg reference, even lazy, risks loading it and crashing.
//
// TODO(A-ICONS, EAS build): re-introduce the custom amatta SVG icons
// (docs/design/amatta-icons/) once running on an EAS dev/prod build, where the
// native RNSVG components ARE registered. Gate so Expo Go never loads RNSVG.

import { memo, type ComponentType } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import type { ScheduleType } from '../domain/types';
import { TOKENS } from './palette';

export interface IconProps {
  size?: number;
  color?: string;
}

export type IconComponent = ComponentType<IconProps>;

// ── Brand / navigation icons ────────────────────────────────────────────────

export const IconCar = memo(function IconCar({ size = 16, color = TOKENS.ink }: IconProps) {
  return <Ionicons name="car" size={size} color={color} />;
});

export const IconSearch = memo(function IconSearch({ size = 18, color = TOKENS.ink }: IconProps) {
  return <Ionicons name="search" size={size} color={color} />;
});

export const IconGrid = memo(function IconGrid({ size = 18, color = TOKENS.ink }: IconProps) {
  return <Ionicons name="calendar" size={size} color={color} />;
});

export const IconHome = memo(function IconHome({ size = 22, color = TOKENS.ink }: IconProps) {
  return <Ionicons name="home" size={size} color={color} />;
});

export const IconGear = memo(function IconGear({ size = 22, color = TOKENS.ink }: IconProps) {
  return <Ionicons name="settings-outline" size={size} color={color} />;
});

export const IconBell = memo(function IconBell({ size = 16, color = TOKENS.ink }: IconProps) {
  return <Ionicons name="notifications" size={size} color={color} />;
});

export const IconSparkle = memo(function IconSparkle({ size = 14, color = TOKENS.ink }: IconProps) {
  return <Ionicons name="sparkles" size={size} color={color} />;
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

// ── Category icons (학교/학원/활동/기타) ───────────────────────────────────────
// Approximations of the amatta set; replaced by the real SVG icons on EAS build.

export const IconSchool = memo(function IconSchool({ size = 14, color = TOKENS.ink }: IconProps) {
  return <MaterialCommunityIcons name="school" size={size} color={color} />;
});

export const IconAcademy = memo(function IconAcademy({ size = 14, color = TOKENS.ink }: IconProps) {
  return <MaterialCommunityIcons name="book-open-page-variant" size={size} color={color} />;
});

export const IconActivity = memo(function IconActivity({ size = 14, color = TOKENS.ink }: IconProps) {
  return <MaterialCommunityIcons name="star" size={size} color={color} />;
});

export const IconEtc = memo(function IconEtc({ size = 14, color = TOKENS.ink }: IconProps) {
  return <MaterialCommunityIcons name="dots-horizontal" size={size} color={color} />;
});

// ── Domain mapping ────────────────────────────────────────────────────────
// amatta-v1 names the "other" kind as `etc`; our domain types use `other`.

export const KIND_ICON: Record<ScheduleType, IconComponent> = {
  school: IconSchool,
  academy: IconAcademy,
  activity: IconActivity,
  other: IconEtc,
};
