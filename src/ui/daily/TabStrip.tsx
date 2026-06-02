// 1:1 port of the tab strip in docs/design/amatta-v1/app-daily-b.jsx:64–101.
//
// Container: paddingHorizontal 14, borderBottom 1px hair.
// Each tab: padding '12px 16px 14px', fontSize 14, fontWeight 600 (active)/400,
// color active=ink/inactive=inkSub, letterSpacing -0.3, gap 6 with the count
// badge.
// Count badge (준비물&할일 only): radius 99, minWidth 18, fontSize 10, padding 2.
//   - active: bg=primary, color=#fff
//   - inactive: bg=ink04, color=inkSub
// Active underline: absolute bottom -1, height 3, primary, radius 2.
//
// The JSX has a `width: '1px'` value on the badge — appears to be a CSS bug
// (overridden by minWidth: 18). We honor minWidth: 18 only.

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT_FAMILIES } from '../fonts';
import { TOKENS } from '../palette';

export type DailyTabKey = 'schedule' | 'todo';

interface Props {
  active: DailyTabKey;
  onChange: (key: DailyTabKey) => void;
  todoCount: number;
}

function TabStripImpl({ active, onChange, todoCount }: Props): React.ReactElement {
  return (
    <View style={styles.strip}>
      <TabButton
        label="일정"
        isActive={active === 'schedule'}
        onPress={() => onChange('schedule')}
      />
      <TabButton
        label="준비물 & 할일"
        isActive={active === 'todo'}
        onPress={() => onChange('todo')}
        count={todoCount}
      />
    </View>
  );
}

interface TabBtnProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
  count?: number;
}

function TabButton({ label, isActive, onPress, count }: TabBtnProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={label}
      style={styles.btn}
    >
      <Text
        style={[
          styles.label,
          {
            fontFamily: isActive
              ? FONT_FAMILIES.pretendardSemiBold
              : FONT_FAMILIES.pretendard,
            color: isActive ? TOKENS.ink : TOKENS.inkSub,
          },
        ]}
      >
        {label}
      </Text>
      {count != null ? (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: isActive ? TOKENS.primary : TOKENS.ink04,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeLabel,
              { color: isActive ? TOKENS.surface : TOKENS.inkSub },
            ]}
          >
            {count}
          </Text>
        </View>
      ) : null}
      {isActive ? <View style={styles.underline} /> : null}
    </Pressable>
  );
}

export const TabStrip = memo(TabStripImpl);

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: TOKENS.hair,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    paddingRight: 16,
    paddingBottom: 14,
    paddingLeft: 16,
    position: 'relative',
  },
  label: {
    fontSize: 14,
    letterSpacing: -0.3,
    lineHeight: 16, // approximate the prototype's 1.0–1.2 line height
  },
  badge: {
    minWidth: 18,
    paddingHorizontal: 2,
    paddingVertical: 2,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    fontFamily: FONT_FAMILIES.pretendard, // 400
    fontSize: 10,
    lineHeight: 12,
  },
  underline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
    height: 3,
    backgroundColor: TOKENS.primary,
    borderRadius: 2,
  },
});
