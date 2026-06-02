import { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import 'react-native-reanimated';

import { getDb } from '../src/db/client';
import { runMigrations } from '../src/db/migrations';
import { seedDevData } from '../src/db/seed-dev';
import { useChildrenStore } from '../src/state/children-store';
import { useSchedulesStore } from '../src/state/schedules-store';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

type BootState = 'booting' | 'ready' | 'error';

export default function RootLayout() {
  const [bootState, setBootState] = useState<BootState>('booting');
  const [bootError, setBootError] = useState<string | null>(null);
  const hasBooted = useRef(false);

  useEffect(() => {
    // Guard against double-invocation in strict mode / app resume
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
  }, []);

  if (bootState === 'booting') {
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
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="child/[id]" options={{ title: '자녀 주간' }} />
        <Stack.Screen name="schedule/edit" options={{ title: '일정 편집', presentation: 'modal' }} />
      </Stack>
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
