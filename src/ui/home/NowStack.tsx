// "지금" on the home screen as a stack of time blocks — board H1/H2 (2026-11-11,
// ADR-014). One block per kid in the calendar's block style (kid colour fill +
// deep side bar). Collapsed: the most pressing block on top, the next ones
// peeking out underneath like an iOS notification stack; tap to fan out.

import { memo, useState } from 'react';
import { LayoutAnimation, Pressable, Text, View } from 'react-native';

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
const PEEK_INSET = 10;

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

function NowStackImpl({ kids, rows, nowMinutes }: Props): React.ReactElement | null {
  const theme = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const ordered = orderForStack(rows).filter((r) => kids.some((k) => k.id === r.childId));
  const kidOf = (id: number): Child | undefined => kids.find((k) => k.id === id);
  const toggle = (): void => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };
  const first = ordered[0];
  if (first === undefined) return null;
  const firstKid = kidOf(first.childId);
  if (firstKid === undefined) return null;

  if (ordered.length === 1) return <NowBlock kid={firstKid} row={first} nowMinutes={nowMinutes} />;

  if (open) {
    return (
      <View style={styles.list} testID="now-stack-open">
        {ordered.map((r) => {
          const kid = kidOf(r.childId);
          return kid === undefined ? null : <NowBlock key={r.childId} kid={kid} row={r} nowMinutes={nowMinutes} />;
        })}
        <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel="접기" hitSlop={8} style={styles.fold}>
          <Text style={styles.foldLabel}>접기</Text>
        </Pressable>
      </View>
    );
  }

  const peeks = ordered.slice(1, 1 + MAX_PEEK);
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={`지금 일정 ${ordered.length}명, 펼치기`}
      accessibilityHint="모든 아이의 일정을 펼쳐요"
      testID="now-stack"
      style={{ marginBottom: peeks.length * PEEK_STEP }}
    >
      {peeks.map((r, i) => {
        const kid = kidOf(r.childId);
        const fill = kid !== undefined && (r.current ?? r.next) !== null
          ? withAlpha(theme.kid(kid.colorIndex).source, Math.max(0.15, theme.cardFill - (i + 1) * 0.08))
          : theme.t.surface;
        return (
          <View
            key={r.childId}
            pointerEvents="none"
            style={[
              styles.peek,
              {
                left: (i + 1) * PEEK_INSET,
                right: (i + 1) * PEEK_INSET,
                bottom: -(i + 1) * PEEK_STEP,
                zIndex: MAX_PEEK - i,
                backgroundColor: fill,
              },
            ]}
          />
        );
      })}
      <View style={styles.topCard} pointerEvents="none">
        <NowBlock kid={firstKid} row={first} nowMinutes={nowMinutes} />
      </View>
    </Pressable>
  );
}

export const NowStack = memo(NowStackImpl);

const useStyles = makeStyles((th) => ({
  list: { gap: SPACING.sm },
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
  peek: { position: 'absolute', height: 40, borderRadius: RADIUS.card - 4 },
  topCard: { zIndex: MAX_PEEK + 1 },
  fold: { alignSelf: 'center', paddingVertical: SPACING.xs },
  foldLabel: { ...TYPE.subhead, color: th.t.primaryDeep },
}));
