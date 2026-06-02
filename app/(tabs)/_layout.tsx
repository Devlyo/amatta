import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONT_FAMILIES } from '../../src/ui/fonts';
import { IconGear, IconGrid } from '../../src/ui/icons';
import { TOKENS } from '../../src/ui/palette';

export default function TabLayout(): React.ReactElement {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TOKENS.primary,
        tabBarInactiveTintColor: TOKENS.ink50,
        tabBarLabelStyle: {
          fontFamily: FONT_FAMILIES.pretendardSemiBold,
          fontSize: 11,
        },
        tabBarStyle: {
          backgroundColor: TOKENS.surface,
          borderTopColor: TOKENS.hair,
          borderTopWidth: StyleSheet.hairlineWidth,
          // Respect bottom safe-area inset so the home indicator on iOS
          // doesn't overlap our touch targets.
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 6),
          height: 52 + Math.max(insets.bottom, 6),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '일정',
          tabBarIcon: ({ color }) => <IconGrid size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarIcon: ({ color }) => <IconGear size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
