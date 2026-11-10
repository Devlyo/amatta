// Week date strip above the day view — ADR-007 §4 (iPhone day view style).
//
// Sun..Sat of the selected date's week. Today = orange circle with white
// number; the selected (non-today) date = dark circle; Sunday labels red,
// Saturday blue.

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ISODate } from '../../domain/types';
import { RADIUS } from '../radius';
import { TYPE } from '../typography';
import { weekDatesIso } from '../utils/date';
import { makeStyles, useTheme } from '../appearance';

const NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;

interface Props {
  selected: ISODate;
  today: ISODate;
  onSelect: (date: ISODate) => void;
}

function DateStripImpl({ selected, today, onSelect }: Props): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const dates = weekDatesIso(selected);
  return (
    <View style={styles.row}>
      {dates.map((date, i) => {
        const key = date as unknown as string;
        const isToday = key === (today as unknown as string);
        const isSelected = key === (selected as unknown as string);
        const day = Number(key.slice(8, 10));
        const nameColor = i === 0 ? theme.t.sunday : i === 6 ? theme.t.saturday : theme.t.inkSub;
        const circle = isToday ? styles.circleToday : isSelected ? styles.circleSelected : null;
        const numberColor = isToday || isSelected ? theme.t.surface : theme.t.ink;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(date)}
            accessibilityRole="button"
            accessibilityLabel={`${Number(key.slice(5, 7))}월 ${day}일 ${NAMES[i]}요일${isToday ? ', 오늘' : ''}`}
            accessibilityState={{ selected: isSelected }}
            testID={`date-strip-${key}`}
            style={styles.cell}
          >
            <Text style={[styles.name, { color: nameColor }]}>{NAMES[i]}</Text>
            <View style={[styles.circle, circle]}>
              <Text style={[styles.number, { color: numberColor }]}>{day}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export const DateStrip = memo(DateStripImpl);

const useStyles = makeStyles((th) => ({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    height: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: th.t.gridLine,
  },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  name: { ...TYPE.caption },
  circle: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleToday: { backgroundColor: th.t.primary },
  circleSelected: { backgroundColor: th.t.controlActive },
  number: { ...TYPE.subhead, fontFamily: TYPE.mono.fontFamily },
}));
