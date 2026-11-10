// Calendar top bar — ADR-007 §1.
//
//   [ 오늘  11월 10일 · 화 ⌄ ]      [▭ ▥ ▦]  🔍  +
//
// Left: big title (today → "오늘" + date caption; other day → "11월 12일" +
// weekday; week/month → "11월" + caption), tap opens the date picker sheet.
// Right: icon segment for day/week/month, search, and the red "+" (new event).
// No "today" button (ADR-007): getting back to today is the date strip /
// title picker.

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CalendarView } from '../../state/ui-store';
import {
  IconChevronDown,
  IconPlus,
  IconSearch,
  IconViewDay,
  IconViewMonth,
  IconViewWeek,
  type IconProps,
} from '../icons';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';

interface Props {
  title: string;
  caption: string;
  /** Sunday / holiday → red title and caption. */
  holiday?: boolean;
  view: CalendarView;
  /** Views that can be selected yet (others render disabled). */
  enabledViews: readonly CalendarView[];
  onChangeView: (view: CalendarView) => void;
  onPressTitle: () => void;
  onPressSearch: () => void;
  onPressAdd: () => void;
}

const VIEWS: { key: CalendarView; label: string; Icon: React.ComponentType<IconProps> }[] = [
  { key: 'day', label: '일간 보기', Icon: IconViewDay },
  { key: 'week', label: '주간 보기', Icon: IconViewWeek },
  { key: 'month', label: '월간 보기', Icon: IconViewMonth },
];

function CalendarTopBarImpl({
  title,
  caption,
  holiday = false,
  view,
  enabledViews,
  onChangeView,
  onPressTitle,
  onPressSearch,
  onPressAdd,
}: Props): React.ReactElement {
  const tint = holiday ? { color: TOKENS.sunday } : null;
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={onPressTitle}
        accessibilityRole="button"
        accessibilityLabel={`${title} ${caption} — 날짜 선택`}
        style={styles.titleButton}
      >
        <Text style={[styles.title, tint]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.captionRow}>
          <Text style={[styles.caption, tint]} numberOfLines={1}>
            {caption}
          </Text>
          <IconChevronDown size={16} color={TOKENS.inkSub} />
        </View>
      </Pressable>

      <View style={styles.segment} accessibilityRole="tablist">
        {VIEWS.map(({ key, label, Icon }) => {
          const active = key === view;
          const enabled = enabledViews.includes(key);
          return (
            <Pressable
              key={key}
              onPress={() => onChangeView(key)}
              disabled={!enabled}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: active, disabled: !enabled }}
              testID={`view-${key}`}
              style={[styles.segmentItem, active ? styles.segmentItemActive : null]}
            >
              <Icon size={20} color={active ? TOKENS.ink : enabled ? TOKENS.inkSub : TOKENS.ink30} />
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={onPressSearch}
        accessibilityRole="button"
        accessibilityLabel="검색"
        style={styles.iconButton}
      >
        <IconSearch size={20} color={TOKENS.ink} />
      </Pressable>
      <Pressable
        onPress={onPressAdd}
        accessibilityRole="button"
        accessibilityLabel="일정 추가"
        testID="calendar-add"
        style={styles.iconButton}
      >
        <IconPlus size={26} color={TOKENS.sunday} />
      </Pressable>
    </View>
  );
}

export const CalendarTopBar = memo(CalendarTopBarImpl);

const styles = StyleSheet.create({
  bar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: SPACING.xs,
    gap: 2,
  },
  titleButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingVertical: SPACING.sm,
  },
  title: { ...TYPE.titleL, fontFamily: TYPE.titleM.fontFamily, color: TOKENS.ink },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
  caption: { ...TYPE.body, color: TOKENS.inkSub },
  segment: {
    flexDirection: 'row',
    padding: 2,
    gap: 2,
    borderRadius: RADIUS.full,
    backgroundColor: TOKENS.ink04,
  },
  segmentItem: {
    width: 40,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentItemActive: {
    backgroundColor: TOKENS.surface,
    borderColor: TOKENS.hair,
  },
  iconButton: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
