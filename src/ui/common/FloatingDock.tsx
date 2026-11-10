// Floating bottom dock = the tab bar (ADR-007 §6, + moved here 2026-11-10).
//
//   ( 홈 · 캘린더 · 설정 )  (+)
//
// White pill with a soft shadow (same shape as the old BottomDock), three
// icon-only tabs; no visible labels, each button keeps an accessibility label.
// Active tab = primary orange, others = inkSub. The round "+" next to the pill
// opens a new event — for the calendar's selected date when the calendar tab is
// showing, otherwise for today.
// Rendered by expo-router <Tabs tabBar={...}> so it appears on every tab and
// floats over the screen (screens add bottom clearance themselves).

import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';

import { useUiStore } from '../../state/ui-store';
import { ELEVATION } from '../elevation';
import { IconGear, IconHome, IconPlus } from '../icons';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { todayIso } from '../utils/date';

const ICON = 26;

const TABS: Record<string, { label: string; render: (color: string) => React.ReactElement }> = {
  index: { label: '홈', render: (color) => <IconHome size={ICON} color={color} /> },
  calendar: { label: '캘린더', render: (color) => <Ionicons name="calendar" size={ICON - 2} color={color} /> },
  settings: { label: '설정', render: (color) => <IconGear size={ICON} color={color} /> },
};

function FloatingDockImpl({ state, navigation }: BottomTabBarProps): React.ReactElement {
  const router = useRouter();
  const onAdd = (): void => {
    const onCalendar = state.routes[state.index]?.name === 'calendar';
    const date = onCalendar ? useUiStore.getState().currentDate : todayIso();
    router.push({ pathname: '/schedule/edit', params: { mode: 'create', date } });
  };
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (tab === undefined) return null;
          const focused = state.index === index;
          const onPress = (): void => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: focused }}
              testID={`dock-${route.name}`}
              style={styles.tab}
            >
              {tab.render(focused ? TOKENS.primary : TOKENS.inkSub)}
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="일정 추가"
        testID="dock-add"
        style={styles.add}
      >
        <IconPlus size={26} color={TOKENS.surface} />
      </Pressable>
    </View>
  );
}

export const FloatingDock = memo(FloatingDockImpl);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.surface,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: TOKENS.ink04,
    ...ELEVATION.dock,
  },
  add: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: TOKENS.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...ELEVATION.dock,
  },
  tab: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
