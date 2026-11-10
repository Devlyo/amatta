// All-day row above the time grid — ADR-007 §8 (iPhone-style).
//
// Same columns as the grid below (TIME_GUTTER on the left, "하루 종일" label).
// Each column stacks up to MAX_PER_COLUMN chips; more become "+N". Hidden
// entirely when the visible range has no all-day events.

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TOKENS, withAlpha } from '../palette';
import { RADIUS } from '../radius';
import { TYPE } from '../typography';
import { monthCellChips } from './calendar-layout';
import { TIME_GUTTER } from './time-axis';

const MAX_PER_COLUMN = 2;
const CHIP_H = 20;

export interface AllDayItem {
  id: string;
  column: number;
  title: string;
  color: string;
  deep: string;
  focused: boolean;
  dimmed: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}

interface Props {
  columns: number;
  items: readonly AllDayItem[];
}

function AllDayRowImpl({ columns, items }: Props): React.ReactElement | null {
  if (items.length === 0) return null;
  const byColumn = Array.from({ length: columns }, (_, c) => items.filter((i) => i.column === c));
  const rows = Math.min(MAX_PER_COLUMN, Math.max(...byColumn.map((l) => l.length)));
  return (
    <View style={[styles.row, { minHeight: rows * (CHIP_H + 2) + 6 }]} testID="all-day-row">
      <View style={styles.gutter}>
        <Text style={styles.label}>하루 종일</Text>
      </View>
      {byColumn.map((list, c) => {
        const { shown, more } = monthCellChips(list, MAX_PER_COLUMN);
        return (
          <View key={c} style={styles.column}>
            {shown.map((item) => (
              <Pressable
                key={item.id}
                onPress={item.onPress}
                accessibilityRole="button"
                accessibilityLabel={item.accessibilityLabel}
                testID={`all-day-${item.id}`}
                style={[
                  styles.chip,
                  {
                    backgroundColor: withAlpha(item.color, item.focused ? 0.8 : 0.6),
                    borderLeftColor: item.deep,
                    opacity: item.dimmed ? 0.2 : 1,
                  },
                ]}
              >
                <Text style={styles.chipTitle} numberOfLines={1}>
                  {item.title}
                </Text>
              </Pressable>
            ))}
            {more > 0 ? <Text style={styles.more}>+{more}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

export const AllDayRow = memo(AllDayRowImpl);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: TOKENS.hair,
  },
  gutter: { width: TIME_GUTTER, justifyContent: 'center', paddingRight: 4 },
  label: { ...TYPE.axisMeridiem, color: TOKENS.inkSub, textAlign: 'right' },
  column: { flex: 1, minWidth: 0, paddingHorizontal: 1, gap: 2 },
  chip: {
    height: CHIP_H,
    borderRadius: RADIUS.xs,
    borderLeftWidth: 1.5,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  chipTitle: { ...TYPE.caption2, color: TOKENS.ink },
  more: { ...TYPE.caption2, color: TOKENS.inkSub, paddingHorizontal: 3 },
});
