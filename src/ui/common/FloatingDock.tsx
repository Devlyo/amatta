// Floating bottom dock = the tab bar (ADR-007 §6).
//
// White pill with a soft shadow (same shape as the old BottomDock), three
// icon-only tabs — 홈 · 캘린더 · 설정. No visible labels; each button keeps an
// accessibility label. Active tab = primary orange, others = inkSub.
// Rendered by expo-router <Tabs tabBar={...}> so it appears on every tab and
// floats over the screen (screens add bottom clearance themselves).

import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { ELEVATION } from '../elevation';
import { IconGear, IconHome } from '../icons';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';

const ICON = 26;

const TABS: Record<string, { label: string; render: (color: string) => React.ReactElement }> = {
  index: { label: '홈', render: (color) => <IconHome size={ICON} color={color} /> },
  calendar: { label: '캘린더', render: (color) => <Ionicons name="calendar" size={ICON - 2} color={color} /> },
  settings: { label: '설정', render: (color) => <IconGear size={ICON} color={color} /> },
};

function FloatingDockImpl({ state, navigation }: BottomTabBarProps): React.ReactElement {
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
    </View>
  );
}

export const FloatingDock = memo(FloatingDockImpl);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 40,
    right: 40,
    bottom: 22,
  },
  bar: {
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
  tab: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
