// People filter row — ADR-007 §2. Shared by the day / week / month views.
//
// One pill per kid plus 보호자 (guardian). Border = the owner's deep tone,
// fill = owner colour at 25% (guardian 40%), avatar + name centred.
// Short tap = switch that person off/on. Press and slide sideways = every pill
// the finger passes takes the opposite of the first pill's state, like
// selecting photos by sliding (owner 2026-11-12; long press "only this person"
// removed). Inactive pills fade to 45%.

import { memo, useMemo, useRef } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import type { Child } from '../../domain/types';
import { emphasisOf, type PersonKey } from '../../domain/people-filter';
import { KidAvatar } from '../common/KidAvatar';
import { IconPerson } from '../icons';
import { withAlpha } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';
import { makeStyles, useTheme } from '../appearance';

export const PILL_FADED_OPACITY = 0.45;

interface Props {
  kids: readonly Child[];
  inactive: readonly PersonKey[];
  onToggle: (key: PersonKey) => void;
  /** Slide-select: set this person on/off. */
  onSet: (key: PersonKey, on: boolean) => void;
  /** A slide across the pills finished (the coach tip listens). */
  onSlideEnd?: () => void;
  /** 보호자 as a person (pill / column). False while 보호자 일정 is off in 설정. */
  guardian?: boolean;
}

/** From this many pills (kids + 보호자) on, pills switch to the compact size. */
const COMPACT_FROM = 5;
/** From this many pills on, names are dropped (avatar only; name stays the a11y label). */
const AVATAR_ONLY_FROM = 7;

function Pill({
  label,
  border,
  fill,
  faded,
  selected,
  onPress,
  compact,
  avatarOnly,
  testID,
  children,
}: {
  label: string;
  border: string;
  fill: string;
  faded: boolean;
  selected: boolean;
  onPress: () => void;
  compact: boolean;
  avatarOnly: boolean;
  testID: string;
  children: React.ReactNode;
}): React.ReactElement {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="누르면 켜고 끄기, 옆으로 밀면 여러 명을 한 번에"
      accessibilityState={{ selected }}
      testID={testID}
      style={[
        styles.pill,
        compact ? styles.pillCompact : null,
        { borderColor: border, backgroundColor: fill, opacity: faded ? PILL_FADED_OPACITY : 1 },
      ]}
    >
      {children}
      {avatarOnly ? null : (
        <Text style={compact ? styles.nameCompact : styles.name} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function KidFilterBarImpl({ kids, inactive, onToggle, onSet, onSlideEnd, guardian = true }: Props): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const everyone: PersonKey[] = guardian ? [...kids.map((k) => k.id), 'guardian'] : kids.map((k) => k.id);
  const faded = (key: PersonKey): boolean => emphasisOf(inactive, everyone, key) === 'inactive';
  // Up to 6 people (5 kids + 보호자) must fit one row on a 375pt phone.
  const compact = everyone.length >= COMPACT_FROM;
  const avatarOnly = everyone.length >= AVATAR_ONLY_FROM;
  // Kids and 보호자 are both circles now (board AV1-B) → same size.
  const guardianDot = avatarOnly ? 24 : compact ? 18 : 22;
  const avatar = guardianDot;

  // Slide-select. Pills are equal flex boxes: side padding md, gap xs.
  const width = useRef(0);
  const latest = useRef({ everyone, faded, onSet, onSlideEnd });
  latest.current = { everyone, faded, onSet, onSlideEnd };
  const slide = useRef<{ target: boolean; touched: Set<PersonKey> } | null>(null);
  const keyAt = (x: number): PersonKey | undefined => {
    const all = latest.current.everyone;
    const n = all.length;
    const pillW = (width.current - SPACING.md * 2 - SPACING.xs * (n - 1)) / n;
    if (pillW <= 0) return undefined;
    const i = Math.floor((x - SPACING.md + SPACING.xs / 2) / (pillW + SPACING.xs));
    return all[Math.min(Math.max(i, 0), n - 1)];
  };
  const touch = (x: number): void => {
    const s = slide.current;
    const key = keyAt(x);
    if (s === null || key === undefined || s.touched.has(key)) return;
    s.touched.add(key);
    latest.current.onSet(key, s.target);
  };
  const begin = (x: number): void => {
    const key = keyAt(x);
    if (key === undefined) return;
    // Start on a faded pill → switch everyone passed on; on an active one → off.
    slide.current = { target: latest.current.faded(key), touched: new Set() };
    touch(x);
  };
  const end = (): void => {
    if (slide.current !== null) latest.current.onSlideEnd?.();
    slide.current = null;
  };
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-14, 14])
        .onStart((e) => runOnJS(begin)(e.x - e.translationX))
        .onUpdate((e) => runOnJS(touch)(e.x))
        .onFinalize(() => runOnJS(end)())
        .withTestId('kid-filter-slide'),
    // begin/touch/end read refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const onLayout = (e: LayoutChangeEvent): void => {
    width.current = e.nativeEvent.layout.width;
  };

  return (
    <GestureDetector gesture={pan}>
    <View style={styles.row} onLayout={onLayout} testID="kid-filter-bar">
      {kids.map((kid) => {
        const p = theme.kid(kid.colorIndex); // dark deep tones in dark (ADR-009)
        return (
          <Pill
            key={kid.id}
            label={kid.name}
            border={theme.scheme === 'dark' ? p.deep : p.bar}
            fill={withAlpha(p.source, 0.25)}
            faded={faded(kid.id)}
            selected={!faded(kid.id)}
            onPress={() => onToggle(kid.id)}
            compact={compact}
            avatarOnly={avatarOnly}
            testID={`kid-filter-${kid.id}`}
          >
            <KidAvatar child={kid} size={avatar} />
          </Pill>
        );
      })}
      {guardian ? (
      <Pill
        label="보호자"
        border={theme.t.guardianDeep}
        fill={withAlpha(theme.t.guardian, 0.4)}
        faded={faded('guardian')}
        selected={!faded('guardian')}
        onPress={() => onToggle('guardian')}
        compact={compact}
        avatarOnly={avatarOnly}
        testID="kid-filter-guardian"
      >
        <View style={[styles.guardianAvatar, { width: guardianDot, height: guardianDot }]}>
          <IconPerson size={avatarOnly ? 15 : compact ? 12 : 14} color={theme.t.ink} />
        </View>
      </Pill>
      ) : null}
    </View>
    </GestureDetector>
  );
}

export const KidFilterBar = memo(KidFilterBarImpl);

const useStyles = makeStyles((th) => ({
  row: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
  },
  pill: {
    flex: 1,
    minWidth: 0,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
  },
  pillCompact: { gap: 3, paddingHorizontal: 4 },
  name: { ...TYPE.footnote, fontFamily: TYPE.caption.fontFamily, color: th.t.ink, flexShrink: 1 },
  nameCompact: { ...TYPE.caption2, color: th.t.ink, flexShrink: 1, letterSpacing: -0.4 },
  guardianAvatar: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    backgroundColor: th.t.guardian,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
