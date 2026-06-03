import { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono';
import 'react-native-reanimated';

import { getDb } from '../src/db/client';
import { runMigrations } from '../src/db/migrations';
import { seedDevData } from '../src/db/seed-dev';
import { useChildrenStore } from '../src/state/children-store';
import { useSchedulesStore } from '../src/state/schedules-store';
import { useChecklistStore } from '../src/state/checklist-store';
import { useTodosStore } from '../src/state/todos-store';
import { usePickupLogStore } from '../src/state/pickup-log-store';
import { CalendarDrawer } from '../src/ui/drawers/CalendarDrawer';
import { SearchDrawer } from '../src/ui/drawers/SearchDrawer';
import { EventDetailDrawer } from '../src/ui/drawers/EventDetailDrawer';
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
    PretendardKR_Regular: require('../assets/fonts/PretendardStd-Regular.otf'),
    PretendardKR_Medium: require('../assets/fonts/PretendardStd-Medium.otf'),
    PretendardKR_SemiBold: require('../assets/fonts/PretendardStd-SemiBold.otf'),
    PretendardKR_Bold: require('../assets/fonts/PretendardStd-Bold.otf'),
    GeistMono_400Regular,
  });

  // Surface font loader errors instead of silently falling back to system font.
  // expo-font emits an error here if a .otf file is missing or invalid.
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

        // v2 stores: load in parallel; one failure should not block the others.
        const v2Results = await Promise.allSettled([
          useChecklistStore.getState().load(db),
          useTodosStore.getState().load(db),
          usePickupLogStore.getState().load(db),
        ]);
        for (const r of v2Results) {
          if (r.status === 'rejected') {
            console.warn('[boot] v2 store load failed:', r.reason);
          }
        }

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
      {/* Force dark status-bar glyphs (battery, clock, etc.) — every screen
          in the app uses a light surface so the default white glyphs would
          be invisible. style='dark' makes the icons render in #000-ish. */}
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="child/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="multi"
          options={{
            headerShown: false,
            // Day↔Week is conceptually a tab toggle, not a navigation push,
            // so suppress the slide-in/out and the fade. Push and pop both
            // resolve to instant cuts.
            animation: 'none',
          }}
        />
        <Stack.Screen name="schedule/edit" options={{ title: '일정 편집', presentation: 'modal' }} />
        <Stack.Screen
          name="onboarding/welcome"
          options={{ headerShown: false, animation: 'none' }}
        />
        <Stack.Screen
          name="onboarding/add-kid"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="settings/kids" options={{ headerShown: false }} />
        <Stack.Screen name="settings/kid-edit" options={{ headerShown: false }} />
        <Stack.Screen name="settings/data" options={{ headerShown: false }} />
        <Stack.Screen name="settings/legal" options={{ headerShown: false }} />
      </Stack>
      {/* Sheets + drawers mounted once at the layout level so daily/weekly
          views can open them via ui-store without route navigation. */}
      <ScheduleEditSheet />
      <CalendarDrawer />
      <SearchDrawer />
      <EventDetailDrawer />
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
