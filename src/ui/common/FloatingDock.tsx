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
import { requireOptionalNativeModule } from 'expo';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';

import { nextHourStart } from '../calendar/time-axis';
import { useUiStore } from '../../state/ui-store';
import { useDisplayStore } from '../../state/display-store';
import { elevationFor } from '../elevation';
import { IconGear, IconHome, IconPlus } from '../icons';
import { RADIUS } from '../radius';
import { todayIso } from '../utils/date';
import { makeStyles, useTheme } from '../appearance';

const ICON = 26;

// ADR-014: frosted dock (iOS material). expo-blur is a native module — an
// older build without it gets the solid white pill instead of crashing.
const HAS_BLUR = requireOptionalNativeModule('ExpoBlurView') !== null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BlurView = HAS_BLUR ? (require('expo-blur') as typeof import('expo-blur')).BlurView : null;

const TABS: Record<string, { label: string; render: (color: string) => React.ReactElement }> = {
  index: { label: '홈', render: (color) => <IconHome size={ICON} color={color} /> },
  calendar: { label: '캘린더', render: (color) => <Ionicons name="calendar" size={ICON - 2} color={color} /> },
  settings: { label: '설정', render: (color) => <IconGear size={ICON} color={color} /> },
};

function FloatingDockImpl({ state, navigation }: BottomTabBarProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  // 설정 > 화면: "+" on the left for left-handed use (ADR-009).
  const addLeft = useDisplayStore((s) => s.addButtonSide) === 'left';
  const onAdd = (): void => {
    const onCalendar = state.routes[state.index]?.name === 'calendar';
    const date = onCalendar ? useUiStore.getState().currentDate : todayIso();
    // Starts at the next full hour from now (7:06 → 8:00), one hour long.
    const now = new Date();
    const start = nextHourStart(now.getHours() * 60 + now.getMinutes());
    router.push({ pathname: '/schedule/edit', params: { mode: 'create', date, start: String(start) } });
  };
  return (
    <View pointerEvents="box-none" style={[styles.wrap, addLeft ? styles.wrapAddLeft : null]} testID="dock">
      <View style={[styles.bar, BlurView !== null ? styles.barFrosted : null]}>
        {BlurView !== null ? (
          <BlurView
            intensity={60}
            tint={theme.scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
            style={styles.blur}
            testID="dock-blur"
          />
        ) : null}
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
              {tab.render(focused ? theme.t.primary : theme.t.inkSub)}
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
        <IconPlus size={26} color={theme.t.surface} />
      </Pressable>
    </View>
  );
}

export const FloatingDock = memo(FloatingDockImpl);

const useStyles = makeStyles((th) => ({
  wrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wrapAddLeft: { flexDirection: 'row-reverse' },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: th.t.surface,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: th.t.ink04,
    ...elevationFor(th).dock,
  },
  add: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: th.t.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevationFor(th).dock,
  },
  barFrosted: { backgroundColor: th.t.dockTint },
  blur: { ...StyleSheet.absoluteFillObject, borderRadius: RADIUS.full, overflow: 'hidden' },
  tab: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
