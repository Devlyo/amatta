import { Stack } from 'expo-router';
import 'react-native-reanimated';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="child/[id]" options={{ title: '자녀 주간' }} />
      <Stack.Screen name="schedule/edit" options={{ title: '일정 편집', presentation: 'modal' }} />
    </Stack>
  );
}
