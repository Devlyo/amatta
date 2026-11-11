// "지금" on the home screen as a stack of time blocks — board H1/H2 (2026-11-11,
// ADR-014). One block per kid in the calendar's block style (kid colour fill +
// deep side bar). Collapsed: the most pressing block on top, the next ones
// peeking out underneath like an iOS notification stack; tap to fan out.

import { memo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import Ionicons from '@expo/vector-icons/Ionicons';

import { formatUntil, type KidNowNext } from '../../domain/now-next';
import type { Child } from '../../domain/types';
import { KidAvatar } from '../common/KidAvatar';
import { elevationFor } from '../elevation';
import { IconClock } from '../icons';
import { withAlpha } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';
import { fmt12hrShort, fmtRange } from '../utils/date';
import { makeStyles, useTheme } from '../appearance';

interface Props {
  kids: readonly Child[];
  rows: readonly KidNowNext[];
  nowMinutes: number;
}

/** Peeking cards drawn under the top one when collapsed. */
const MAX_PEEK = 2;
const PEEK_STEP = 11;
/** Opacity step per card behind the stack top. */
const PEEK_FADE = 0.03;

/** In progress (ending soonest) → upcoming (starting soonest) → nothing left. */
export function orderForStack(rows: readonly KidNowNext[]): KidNowNext[] {
  const rank = (r: KidNowNext): number =>
    r.status === 'inProgress' ? 0 : r.status === 'upcoming' ? 1 : r.status === 'doneForToday' ? 2 : 3;
  const key = (r: KidNowNext): number =>
    r.current !== null ? r.current.endMinutes : r.next !== null ? r.next.startMinutes : 0;
  return [...rows].sort((a, b) => rank(a) - rank(b) || key(a) - key(b) || a.childId - b.childId);
}

function NowBlock({ kid, row, nowMinutes }: { kid: Child; row: KidNowNext; nowMinutes: number }): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const p = theme.kid(kid.colorIndex);
  const occ = row.current ?? row.next;
  if (occ === null) {
    const label = row.status === 'doneForToday' ? '오늘 일정 끝' : '오늘 일정 없음';
    return (
      <View style={[styles.block, styles.blockEmpty]} accessible accessibilityLabel={`${kid.name}, ${label}`}>
        <KidAvatar child={kid} size={34} />
        <View style={styles.text}>
          <Text style={styles.name}>{kid.name}</Text>
          <Text style={styles.empty}>{label}</Text>
        </View>
      </View>
    );
  }
  const live = row.current !== null;
  const span = Math.max(1, occ.endMinutes - occ.startMinutes);
  const progress = live ? Math.min(1, Math.max(0, (nowMinutes - occ.startMinutes) / span)) : 0;
  // Owner 2026-11-11: just "진행 중" — the progress bar shows how far along.
  const status = live ? '진행 중' : row.minutesUntilNext !== null ? formatUntil(row.minutesUntilNext) : '';
  const range = fmtRange(occ.startMinutes, occ.endMinutes);
  const after = live && row.next !== null ? `다음 ${fmt12hrShort(row.next.startMinutes)} ${row.next.title}` : null;
  return (
    <View
      style={[styles.block, { backgroundColor: withAlpha(p.source, theme.cardFill) }]}
      accessible
      accessibilityLabel={`${kid.name}, ${occ.title} ${range}, ${status}${after !== null ? `, ${after}` : ''}`}
      testID={`now-block-${kid.id}`}
    >
      <View style={[styles.bar, { backgroundColor: p.bar }]} />
      <View style={styles.top}>
        <KidAvatar child={kid} size={34} />
        <View style={styles.text}>
          <Text style={styles.nameOnFill} numberOfLines={1}>
            {kid.name}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {occ.title}
          </Text>
        </View>
        <View style={styles.right}>
          <View style={styles.timeRow}>
            <IconClock size={12} color={theme.t.onLight} />
            <Text style={styles.time}>{range}</Text>
          </View>
          <View style={[styles.pill, live ? styles.pillLive : styles.pillMuted]}>
            <Text style={[styles.pillLabel, live ? null : styles.pillLabelMuted]}>{status}</Text>
          </View>
        </View>
      </View>
      {live ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: p.bar }]} />
        </View>
      ) : null}
      {after !== null ? (
        <Text style={styles.after} numberOfLines={1}>
          {after}
        </Text>
      ) : null}
    </View>
  );
}


const GAP = 6;
const FOLD_H = 46;
const DURATION = 340;
const EST_H = 92;

/**
 * Where card `index` sits at progress p (0 = folded, 1 = open). Pure, so it
 * runs as a worklet and is unit-tested.
 *   open:   listed, GAP apart.
 *   folded: card 0 on top; cards 1–2 scaled 95% / 90% with their bottom edge
 *           PEEK_STEP·depth below the top card; the rest faded out.
 */
export function cardGeometry(
  hs: readonly number[],
  index: number,
  p: number,
  live = 0,
): { y: number; scale: number; opacity: number; height: number; wash: number; radius: number; lift: number } {
  'worklet';
  const h = hs[index] ?? EST_H;
  let openY = 0;
  for (let i = 0; i < index; i++) openY += (hs[i] ?? EST_H) + GAP;
  // In-progress cards (the first `live`) are always listed, never stacked.
  if (index < live) return { y: openY, scale: 1, opacity: 1, height: h, wash: 0, radius: RADIUS.card, lift: 0 };
  let stackY = 0;
  for (let i = 0; i < live; i++) stackY += (hs[i] ?? EST_H) + GAP;
  const top = hs[live] ?? EST_H;
  const j = index - live;
  const depth = Math.min(j, MAX_PEEK);
  const foldScale = 1 - depth * 0.05;
  // Folded, a card behind is drawn at the stack-top card's height (its content
  // is hidden), so a taller one never pokes out above the stack.
  const foldH = j === 0 ? h : top;
  // Scale is about the centre, so the scaled bottom sits at y + h·(1+s)/2.
  const foldY = j === 0 ? stackY : stackY + top + depth * PEEK_STEP - (foldH * (1 + foldScale)) / 2;
  // Cards behind fade one step per level — kept light (97% / 94%) so they still
  // stand out from the page (owner, 2026-11-11; 85/70% blended into it).
  const foldOpacity = j === 0 ? 1 : j <= MAX_PEEK ? 1 - depth * PEEK_FADE : 0;
  const foldWash = 0;
  // Smaller corners behind, so the thin peeking edge isn't all curve.
  const foldRadius = j === 0 ? RADIUS.card : RADIUS.card - 4 - (depth - 1) * 2;
  return {
    y: foldY + (openY - foldY) * p,
    scale: foldScale + (1 - foldScale) * p,
    opacity: foldOpacity + (1 - foldOpacity) * p,
    height: foldH + (h - foldH) * p,
    wash: foldWash * (1 - p),
    radius: foldRadius + (RADIUS.card - foldRadius) * p,
    // Soft all-round shadow behind every stacked card while folded.
    lift: j <= MAX_PEEK ? 1 - p : 0,
  };
}

/** Folded height of the whole stack (listed live cards + the stack). */
export function foldedHeight(hs: readonly number[], n: number, live: number): number {
  'worklet';
  let y = 0;
  for (let i = 0; i < live; i++) y += (hs[i] ?? EST_H) + GAP;
  if (live >= n) return y - GAP;
  return y + (hs[live] ?? EST_H) + Math.min(n - live - 1, MAX_PEEK) * PEEK_STEP;
}

/** One card's resting place: folded (stacked under the top card) vs open (listed). */
function StackCard({
  index,
  progress,
  heights,
  onHeight,
  hidden,
  base,
  lift,
  live,
  children,
}: {
  index: number;
  /** In-progress cards listed above the stack. */
  live: number;
  progress: SharedValue<number>;
  heights: SharedValue<number[]>;
  onHeight: (index: number, h: number) => void;
  /** Folded and not one of the peeking cards — fully faded. */
  hidden: boolean;
  /** Opaque base so a card behind never shows through the translucent fill. */
  base: { backgroundColor: string; borderRadius: number };
  /** Shadow under the stack's top card (ELEVATION.stack). */
  lift: { shadowColor: string; shadowOpacity: number; shadowRadius: number; shadowOffset: { width: number; height: number }; elevation: number };
  children: React.ReactNode;
}): React.ReactElement {
  const style = useAnimatedStyle(() => {
    const g = cardGeometry(heights.value, index, progress.value, live);
    return {
      transform: [{ translateY: g.y }, { scale: g.scale }],
      opacity: g.opacity,
      // Until measured, let the card size itself.
      height: heights.value[index] === undefined ? undefined : g.height,
      zIndex: index <= live ? 10 : 10 - index,
      borderRadius: g.radius,
      shadowOpacity: lift.shadowOpacity * g.lift,
    };
  });
  const clip = useAnimatedStyle(() => ({ borderRadius: cardGeometry(heights.value, index, progress.value, live).radius }));
  const wash = useAnimatedStyle(() => ({ opacity: cardGeometry(heights.value, index, progress.value, live).wash }));
  // The text on cards under the top one fades in as they fan out.
  const content = useAnimatedStyle(() => ({
    opacity: index <= live ? 1 : interpolate(progress.value, [0, 0.6, 1], [0, 0.2, 1]),
  }));
  return (
    <Reanimated.View
      style={[stackStyles.card, lift, style]}
      testID={`now-card-${index}`}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={hidden}
    >
      <Reanimated.View style={[stackStyles.clip, base, clip]}>
        <Reanimated.View style={content} onLayout={(e) => onHeight(index, e.nativeEvent.layout.height)} testID={`now-card-body-${index}`}>
          {children}
        </Reanimated.View>
        {/* Lighter by one step per level while folded (no extra fade). */}
        <Reanimated.View pointerEvents="none" style={[stackStyles.wash, { backgroundColor: base.backgroundColor }, wash]} />
      </Reanimated.View>
    </Reanimated.View>
  );
}

function NowStackImpl({ kids, rows, nowMinutes }: Props): React.ReactElement | null {
  const styles = useStyles();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);
  const heights = useSharedValue<number[]>([]);
  const ordered = orderForStack(rows).filter((r) => kids.some((k) => k.id === r.childId));
  const kidOf = (id: number): Child | undefined => kids.find((k) => k.id === id);
  const toggle = (): void => {
    const next = !open;
    setOpen(next);
    progress.value = withTiming(next ? 1 : 0, { duration: DURATION, easing: Easing.out(Easing.cubic) });
  };
  // Measured card heights live in a JS ref (several onLayout calls land in the
  // same tick; reading the shared value back on JS could be stale and leave a
  // card at the estimate → too-wide gaps). The worklets read the copy.
  const measured = useRef<number[]>([]);
  const onHeight = (index: number, h: number): void => {
    if (measured.current[index] === h) return;
    measured.current[index] = h;
    heights.value = [...measured.current];
  };
  const n = ordered.length;
  // In-progress kids are always listed; only the rest stack (owner, 2026-11-11).
  const live = ordered.filter((r) => r.status === 'inProgress').length;
  // A "stack" of one card is just a card — nothing to fold.
  const foldable = n - live >= 2;
  const box = useAnimatedStyle(() => {
    const hs = heights.value;
    let openH = 0;
    for (let i = 0; i < n; i++) openH += (hs[i] ?? EST_H) + GAP;
    openH += foldable ? FOLD_H : -GAP;
    const foldH = foldable ? foldedHeight(hs, n, live) : openH;
    return { height: interpolate(progress.value, [0, 1], [foldH, openH]) };
  });
  const cover = useAnimatedStyle(() => {
    let y = 0;
    for (let i = 0; i < live; i++) y += (heights.value[i] ?? EST_H) + GAP;
    return { top: y };
  });
  const foldBtn = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0.5, 1], [0, 1], 'clamp') }));

  const first = ordered[0];
  if (first === undefined) return null;
  const firstKid = kidOf(first.childId);
  if (firstKid === undefined) return null;
  if (n === 1) return <NowBlock kid={firstKid} row={first} nowMinutes={nowMinutes} />;

  return (
    <Reanimated.View style={[stackStyles.box, box]} testID={open ? 'now-stack-open' : 'now-stack'}>
      {ordered.map((r, i) => {
        const kid = kidOf(r.childId);
        if (kid === undefined) return null;
        return (
          <StackCard
            key={r.childId}
            index={i}
            progress={progress}
            heights={heights}
            onHeight={onHeight}
            hidden={foldable && !open && i > live}
            base={styles.cardBase}
            lift={styles.cardLift}
            live={foldable ? live : n}
          >
            <NowBlock kid={kid} row={r} nowMinutes={nowMinutes} />
          </StackCard>
        );
      })}
      {/* Folded: the stack (below the listed in-progress cards) is one button. */}
      {foldable && !open ? (
        <Reanimated.View style={[stackStyles.cover, cover]}>
          <Pressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityLabel={`다음 일정 ${n - live}명, 펼치기`}
            accessibilityHint="쌓인 일정을 펼쳐요"
            testID="now-stack-toggle"
            style={StyleSheet.absoluteFill}
          />
        </Reanimated.View>
      ) : null}
      {foldable ? (
        <Reanimated.View style={[stackStyles.foldRow, foldBtn]} pointerEvents={open ? 'auto' : 'none'}>
          <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel="접기" hitSlop={8} style={styles.fold} testID="now-stack-fold">
            <Ionicons name="chevron-up" size={14} color={theme.t.ink70} />
            <Text style={styles.foldLabel}>접기</Text>
          </Pressable>
        </Reanimated.View>
      ) : null}
    </Reanimated.View>
  );
}

const stackStyles = StyleSheet.create({
  box: { position: 'relative' },
  card: { position: 'absolute', left: 0, right: 0, top: 0 },
  clip: { flex: 1, overflow: 'hidden' },
  wash: { ...StyleSheet.absoluteFillObject },
  cover: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20 },
  foldRow: { position: 'absolute', left: 0, right: 0, bottom: 0, height: FOLD_H, alignItems: 'center', justifyContent: 'flex-end', zIndex: 30 },
});

export const NowStack = memo(NowStackImpl);

const useStyles = makeStyles((th) => ({
  block: {
    borderRadius: RADIUS.card,
    paddingVertical: SPACING.md,
    paddingLeft: 18,
    paddingRight: 14,
    gap: SPACING.sm,
    overflow: 'hidden',
  },
  blockEmpty: { backgroundColor: th.t.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: { position: 'absolute', left: 7, top: SPACING.md, bottom: SPACING.md, width: 3, borderRadius: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { flex: 1, minWidth: 0, gap: 1 },
  name: { ...TYPE.footnote, color: th.t.inkSub },
  nameOnFill: { ...TYPE.footnote, color: withAlpha(th.t.onLight, 0.75) },
  title: { ...TYPE.headline, color: th.t.onLight },
  empty: { ...TYPE.subhead, color: th.t.inkSub },
  right: { alignItems: 'flex-end', gap: 5 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  time: { ...TYPE.footnote, color: th.t.onLight },
  pill: { height: 22, paddingHorizontal: 9, borderRadius: RADIUS.full, justifyContent: 'center' },
  pillLive: { backgroundColor: th.t.surfaceOnFill },
  pillMuted: { backgroundColor: th.t.surfaceOnFillMuted },
  pillLabel: { ...TYPE.caption, color: th.t.onLight },
  pillLabelMuted: { color: withAlpha(th.t.onLight, 0.7) },
  track: { height: 4, borderRadius: RADIUS.full, backgroundColor: th.t.surfaceOnFillMuted, overflow: 'hidden' },
  fill: { height: 4, borderRadius: RADIUS.full },
  after: { ...TYPE.footnote, color: withAlpha(th.t.onLight, 0.75) },
  cardBase: { backgroundColor: th.t.surface, borderRadius: RADIUS.card },
  cardLift: { ...elevationFor(th).stack },
  // iOS "간략히 보기"-style capsule.
  fold: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    borderRadius: RADIUS.full,
    backgroundColor: th.t.ink06,
  },
  foldLabel: { ...TYPE.subhead, fontFamily: TYPE.headline.fontFamily, color: th.t.ink70 },
}));
