// Calendar top bar — ADR-007 §1.
//
//   [ 오늘  11월 10일 · 화 ⌄ ]        [▭ ▥ ▦]  🔍
//
// Left: big title (today → "오늘" + date caption; other day → "11월 12일" +
// weekday; week/month → "11월" + caption), tap opens the date picker sheet.
// Right: icon segment for day/week/month and search. New event (+) lives in
// the floating dock.
// No "today" button (ADR-007): getting back to today is the date strip /
// title picker.

import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { CalendarView } from '../../state/ui-store';
import {
  IconChevronDown,
  IconSearch,
  IconViewDay,
  IconViewMonth,
  IconViewWeek,
  type IconProps,
} from '../icons';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';
import { makeStyles, useTheme } from '../appearance';

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
}: Props): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const tint = holiday ? { color: theme.t.sunday } : null;
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
          <IconChevronDown size={16} color={theme.t.inkSub} />
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
              <Icon size={20} color={active ? theme.t.ink : enabled ? theme.t.inkSub : theme.t.ink30} />
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
        <IconSearch size={20} color={theme.t.ink} />
      </Pressable>
    </View>
  );
}

export const CalendarTopBar = memo(CalendarTopBarImpl);

const useStyles = makeStyles((th) => ({
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
  title: { ...TYPE.titleL, fontFamily: TYPE.titleM.fontFamily, color: th.t.ink },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
  caption: { ...TYPE.body, color: th.t.inkSub },
  segment: {
    flexDirection: 'row',
    padding: 2,
    gap: 2,
    borderRadius: RADIUS.full,
    backgroundColor: th.t.ink04,
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
    backgroundColor: th.t.surface,
    borderColor: th.t.hair,
  },
  iconButton: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
