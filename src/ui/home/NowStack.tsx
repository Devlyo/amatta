// "지금" on the home screen as a stack of time blocks — board H1/H2 (2026-11-11,
// ADR-014). One block per kid in the calendar's block style (kid colour fill +
// deep side bar). Collapsed: the most pressing block on top, the next ones
// peeking out underneath like an iOS notification stack; tap to fan out.

import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { formatUntil, type KidNowNext } from '../../domain/now-next';
import type { Child } from '../../domain/types';
import { KidAvatar } from '../common/KidAvatar';
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
const PEEK_STEP = 9;

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
  const left = occ.endMinutes - nowMinutes;
  const status = live ? `진행 중 · ${formatLeft(left)}` : row.minutesUntilNext !== null ? formatUntil(row.minutesUntilNext) : '';
  const range = fmtRange(occ.startMinutes, occ.endMinutes);
  const after = live && row.next !== null ? `다음 ${fmt12hrShort(row.next.startMinutes)} ${row.next.title}` : null;
  return (
    <View
      style={[styles.block, { backgroundColor: withAlpha(p.source, theme.cardFill) }]}
      accessible
      accessibilityLabel={`${kid.name}, ${occ.title} ${range}, ${status}${after !== null ? `, ${after}` : ''}`}
      testID={`now-block-${kid.id}`}
    >
      <View style={[styles.bar, { backgroundColor: p.deep }]} />
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
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: p.deep }]} />
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

function formatLeft(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}분 남음`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}시간 남음` : `${h}시간 ${r}분 남음`;
}

const GAP = SPACING.sm;
const FOLD_H = 36;
const DURATION = 340;
const EST_H = 92;

/** One card's resting place: folded (stacked under the top card) vs open (listed). */
function StackCard({
  index,
  progress,
  heights,
  onHeight,
  hidden,
  children,
}: {
  index: number;
  progress: SharedValue<number>;
  heights: SharedValue<number[]>;
  onHeight: (index: number, h: number) => void;
  /** Folded and not one of the peeking cards — fully faded. */
  hidden: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  const style = useAnimatedStyle(() => {
    const hs = heights.value;
    const h0 = hs[0] ?? EST_H;
    const h = hs[index] ?? EST_H;
    let openY = 0;
    for (let i = 0; i < index; i++) openY += (hs[i] ?? EST_H) + GAP;
    // Folded: the bottom of card i peeks PEEK_STEP·i below the top card.
    const depth = Math.min(index, MAX_PEEK);
    const foldScale = 1 - depth * 0.05;
    // Scale is about the centre, so the scaled bottom sits at y + h·(1+s)/2.
    const foldY = index === 0 ? 0 : h0 + depth * PEEK_STEP - (h * (1 + foldScale)) / 2;
    const p = progress.value;
    const foldOpacity = index === 0 ? 1 : index <= MAX_PEEK ? 1 - depth * 0.15 : 0;
    return {
      transform: [
        { translateY: interpolate(p, [0, 1], [foldY, openY]) },
        { scale: interpolate(p, [0, 1], [foldScale, 1]) },
      ],
      opacity: interpolate(p, [0, 1], [foldOpacity, 1]),
      zIndex: index === 0 ? 10 : 10 - index,
    };
  });
  // The text on cards under the top one fades in as they fan out.
  const content = useAnimatedStyle(() => ({
    opacity: index === 0 ? 1 : interpolate(progress.value, [0, 0.6, 1], [0, 0.2, 1]),
  }));
  return (
    <Reanimated.View
      style={[stackStyles.card, style]}
      onLayout={(e) => onHeight(index, e.nativeEvent.layout.height)}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={hidden}
    >
      <Reanimated.View style={content}>{children}</Reanimated.View>
    </Reanimated.View>
  );
}

function NowStackImpl({ kids, rows, nowMinutes }: Props): React.ReactElement | null {
  const styles = useStyles();
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
  const onHeight = (index: number, h: number): void => {
    const hs = [...heights.value];
    if (hs[index] === h) return;
    hs[index] = h;
    heights.value = hs;
  };
  const n = ordered.length;
  const box = useAnimatedStyle(() => {
    const hs = heights.value;
    const h0 = hs[0] ?? EST_H;
    let openH = 0;
    for (let i = 0; i < n; i++) openH += (hs[i] ?? EST_H) + GAP;
    openH += FOLD_H;
    const foldH = h0 + Math.min(n - 1, MAX_PEEK) * PEEK_STEP;
    return { height: interpolate(progress.value, [0, 1], [foldH, openH]) };
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
            hidden={!open && i > 0}
          >
            <NowBlock kid={kid} row={r} nowMinutes={nowMinutes} />
          </StackCard>
        );
      })}
      {/* Folded: the whole stack is one button. */}
      {!open ? (
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={`지금 일정 ${n}명, 펼치기`}
          accessibilityHint="모든 아이의 일정을 펼쳐요"
          testID="now-stack-toggle"
          style={stackStyles.cover}
        />
      ) : null}
      <Reanimated.View style={[stackStyles.foldRow, foldBtn]} pointerEvents={open ? 'auto' : 'none'}>
        <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel="접기" hitSlop={8} style={styles.fold}>
          <Text style={styles.foldLabel}>접기</Text>
        </Pressable>
      </Reanimated.View>
    </Reanimated.View>
  );
}

const stackStyles = StyleSheet.create({
  box: { position: 'relative' },
  card: { position: 'absolute', left: 0, right: 0, top: 0 },
  cover: { ...StyleSheet.absoluteFillObject, zIndex: 20 },
  foldRow: { position: 'absolute', left: 0, right: 0, bottom: 0, height: FOLD_H, alignItems: 'center', justifyContent: 'center' },
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
  fold: { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md },
  foldLabel: { ...TYPE.subhead, color: th.t.primaryDeep },
}));
