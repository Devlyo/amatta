import { Tabs } from 'expo-router';

import { FloatingDock } from '../../src/ui/common/FloatingDock';

// ADR-007 §6: three tabs — 홈 · 캘린더 · 설정 — shown through the floating,
// icon-only dock (custom tab bar). `index` stays the home screen so the root
// route `/` (onboarding / reset `router.replace('/')`) keeps resolving here.
export default function TabLayout(): React.ReactElement {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingDock {...props} />}>
      <Tabs.Screen name="index" options={{ title: '홈' }} />
      <Tabs.Screen name="calendar" options={{ title: '캘린더' }} />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
    </Tabs>
  );
}
