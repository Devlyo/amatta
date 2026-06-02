import { Tabs } from 'expo-router';

// R2 port: the amatta-v1 daily prototype renders its own floating BottomDock
// (see src/ui/common/BottomDock.tsx). We keep the expo-router Tabs structure
// so the settings route still resolves at /(tabs)/settings, but hide the
// native tab bar — the gear button inside BottomDock navigates explicitly.
export default function TabLayout(): React.ReactElement {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '일정' }} />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
    </Tabs>
  );
}
