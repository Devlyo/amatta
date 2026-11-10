// "지금 · 다음" rows on the home screen — one per kid (ADR-007 §6-1).

import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatUntil, type KidNowNext } from '../../domain/now-next';
import type { Child, ScheduleType } from '../../domain/types';
import { ItemLine } from './ItemLine';
import { KidAvatar } from '../common/KidAvatar';
import { withAlpha } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';
import { fmt12hrShort, fmtRange } from '../utils/date';
import { makeStyles, useTheme } from '../appearance';

interface Props {
  kids: readonly Child[];
  rows: readonly KidNowNext[];
}

function describe(row: KidNowNext): {
  title: string;
  type: ScheduleType | null;
  detail: string;
  /** Spoken form of `detail` ("~8:30PM" reads badly aloud). */
  spoken: string;
  sub: string | null;
} {
  const { current, next } = row;
  if (current !== null) {
    return {
      title: current.title,
      type: current.type,
      detail: `~${fmt12hrShort(current.endMinutes)}`,
      spoken: `${fmt12hrShort(current.endMinutes)}까지`,
      sub: next !== null ? `다음 ${fmt12hrShort(next.startMinutes)} ${next.title}` : '이후 일정 없음',
    };
  }
  if (next !== null) {
    const range = fmtRange(next.startMinutes, next.endMinutes);
    return { title: next.title, type: next.type, detail: range, spoken: range, sub: null };
  }
  return { title: row.status === 'doneForToday' ? '오늘 일정 끝' : '오늘 일정 없음', type: null, detail: '', spoken: '', sub: null };
}

function NowNextListImpl({ kids, rows }: Props): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View>
      {rows.map((row, i) => {
        const kid = kids.find((k) => k.id === row.childId);
        if (kid === undefined) return null;
        const d = describe(row);
        const isLast = i === rows.length - 1;
        return (
          <View
            key={row.childId}
            style={[styles.row, isLast ? null : styles.rowDivider]}
            accessible
            accessibilityLabel={`${kid.name}, ${d.title} ${d.spoken}${d.sub !== null ? `, ${d.sub}` : ''}`}
          >
            <KidAvatar child={kid} size={30} />
            <View style={styles.text}>
              {/* Whose row it is, right before what they do — the avatar
                  alone was hard to tell apart. */}
              <ItemLine name={kid.name} title={d.title} type={d.type} detail={d.detail} />
              {d.sub !== null ? (
                <Text style={styles.sub} numberOfLines={1}>
                  {d.sub}
                </Text>
              ) : null}
            </View>
            {row.status === 'inProgress' ? (
              <View style={[styles.chip, { backgroundColor: withAlpha(theme.kid(kid.colorIndex).source, theme.blockFill) }]}>
                <Text style={styles.chipLabel}>진행 중</Text>
              </View>
            ) : row.status === 'upcoming' && row.minutesUntilNext !== null ? (
              <View style={[styles.chip, styles.chipMuted]}>
                <Text style={[styles.chipLabel, styles.chipLabelMuted]}>
                  {formatUntil(row.minutesUntilNext)}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export const NowNextList = memo(NowNextListImpl);

const useStyles = makeStyles((th) => ({
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: SPACING.sm,
    paddingLeft: 14,
    paddingRight: 14,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: th.t.separator,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  sub: { ...TYPE.footnote, color: th.t.inkSub },
  chip: {
    height: 22,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipMuted: { backgroundColor: th.t.ink06 },
  // 진행 중 sits on the kid fill → dark text in both schemes (ADR-009).
  chipLabel: { ...TYPE.caption, color: th.t.onLight },
  chipLabelMuted: { color: th.t.ink70 },
}));
