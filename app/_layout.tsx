import { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono';
import 'react-native-reanimated';

import { getDb } from '../src/db/client';
import { runMigrations } from '../src/db/migrations';
import { seedDevData } from '../src/db/seed-dev';
import { useChildrenStore } from '../src/state/children-store';
import { useSchedulesStore } from '../src/state/schedules-store';
import { ScheduleEditSheet } from '../src/ui/sheets/ScheduleEditSheet';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

type BootState = 'booting' | 'ready' | 'error';

export default function RootLayout() {
  // Hooks must be declared at the top — above any conditional return — so
  // the call order is stable across renders. expo-font's `useFonts` returns
  // [loaded, error]; we block boot until `fontsLoaded` is true.
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.ttf'),
    'Pretendard-Medium': require('../assets/fonts/Pretendard-Medium.ttf'),
    'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.ttf'),
    'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.ttf'),
    GeistMono_400Regular,
  });

  // Surface font loader errors instead of silently falling back to system font.
  // expo-font emits an error here if a .ttf file is missing or invalid.
  useEffect(() => {
    if (fontError) {
      console.warn('[fonts] expo-font load error:', fontError);
    }
  }, [fontError]);

  const [bootState, setBootState] = useState<BootState>('booting');
  const [bootError, setBootError] = useState<string | null>(null);
  const hasBooted = useRef(false);

  useEffect(() => {
    // Wait for fonts before kicking off DB migrations + store hydration.
    // The useRef guard ensures a single boot even if fontsLoaded flips
    // false→true→false during fast-refresh.
    if (!fontsLoaded) return;
    if (hasBooted.current) return;
    hasBooted.current = true;

    async function boot() {
      try {
        const db = await getDb();
        await runMigrations(db, { logTxModeTo: () => { /* no-op in prod */ } });

        if (__DEV__) {
          await seedDevData(db);
        }

        await useChildrenStore.getState().load(db);
        await useSchedulesStore.getState().load(db);

        setBootState('ready');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e ?? 'Unknown error');
        setBootError(msg);
        setBootState('error');
      }
    }

    void boot();
  }, [fontsLoaded]);

  if (!fontsLoaded || bootState === 'booting') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.text}>준비 중...</Text>
      </SafeAreaView>
    );
  }

  if (bootState === 'error') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>앱을 시작하지 못했습니다.</Text>
        <Text style={styles.errorDetail}>{bootError}</Text>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <BottomSheetModalProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="child/[id]" options={{ title: '자녀 주간' }} />
          <Stack.Screen name="schedule/edit" options={{ title: '일정 편집', presentation: 'modal' }} />
        </Stack>
        {/* Sheet mounted once at the layout level so daily/weekly views can
            open it via ui-store without route navigation. */}
        <ScheduleEditSheet />
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 16, color: '#333' },
  errorText: { fontSize: 16, color: '#c00', marginBottom: 8 },
  errorDetail: { fontSize: 12, color: '#666', textAlign: 'center', paddingHorizontal: 24 },
});
