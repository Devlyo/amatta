// 1:1 port of the top-bar block in docs/design/amatta-v1/app-daily-b.jsx:32–58.
//
// LEFT: a single Pressable carrying "오늘" 22/600/-0.4 + "5월 5일 · 화" caption
//       13/400/inkSub with a 16px chevron-down at the end of the caption.
//       Tapping is wired by the caller (TODO: opens a CalendarDrawer in R3).
//
// RIGHT: <ViewToggle/> segmented pill + a 32×32 search button (Pressable
//        wrapping IconSearch 20). Search is a no-op in R2 (TODO: SearchDrawer
//        in R3).
//
// Container padding: '8px 14px 4px' → top 8, right 14, bottom 4, left 14, gap 10.

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ViewToggle } from '../common/ViewToggle';
import { FONT_FAMILIES } from '../fonts';
import { IconChevronDown, IconSearch } from '../icons';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';

interface Props {
  caption: string; // "5월 5일 · 화"
  isToday: boolean;
  /** Whether the currently viewed date is a Korean public holiday — the
   *  title + caption render in TOKENS.danger when true (matches the
   *  calendar drawer + week-strip convention). */
  isHoliday?: boolean;
  onPressDate?: () => void; // opens CalendarDrawer (TODO R3)
  onPressSearch?: () => void; // opens SearchDrawer (TODO R3)
  onPressWeek?: () => void; // navigates to first kid's weekly view
}

function TopBarImpl({
  caption,
  isToday,
  isHoliday = false,
  onPressDate,
  onPressSearch,
  onPressWeek,
}: Props): React.ReactElement {
  const holidayTint = isHoliday ? { color: TOKENS.danger } : null;
  return (
    <View style={styles.bar}>
      {/* LEFT — title pressable */}
      <Pressable
        onPress={onPressDate}
        accessibilityRole="button"
        accessibilityLabel={isToday ? '오늘 — 날짜 선택' : `${caption} — 날짜 선택`}
        style={styles.leftBtn}
      >
        {/*
         * Two display modes for the same caption ("6월 3일 · 수"):
         *  · isToday=true  → title "오늘", caption shows the full short date.
         *  · isToday=false → title shows "M월 D일" (left of the dot), caption
         *    shows only the weekday so the day-portion isn't duplicated.
         */}
        <Text style={[styles.title, holidayTint]}>
          {isToday ? '오늘' : (caption.split(' · ')[0] ?? caption)}
        </Text>
        <View style={styles.captionWrap}>
          <Text style={[styles.caption, holidayTint]}>
            {isToday ? caption : (caption.split(' · ')[1] ?? caption)}
          </Text>
          <IconChevronDown size={16} color={TOKENS.inkSub} />
        </View>
      </Pressable>

      {/* RIGHT — toggle + search */}
      <View style={styles.rightCluster}>
        <ViewToggle active="day" onPressWeek={onPressWeek} />
        <Pressable
          onPress={onPressSearch}
          accessibilityRole="button"
          accessibilityLabel="검색"
          hitSlop={8}
          style={styles.searchBtn}
        >
          <IconSearch size={20} color={TOKENS.ink} />
        </Pressable>
      </View>
    </View>
  );
}

export const TopBar = memo(TopBarImpl);

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    paddingRight: 14,
    paddingBottom: SPACING.xs,
    paddingLeft: 14,
    gap: 10,
  },
  leftBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline', // matches JSX
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  title: {
    fontSize: 24,
    fontFamily: FONT_FAMILIES.pretendardSemiBold, // 600
    color: TOKENS.ink,
    letterSpacing: -0.4,
  },
  captionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
  },
  caption: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard, // 400
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    // background transparent — matches topBtnB helper in the prototype.
  },
});
