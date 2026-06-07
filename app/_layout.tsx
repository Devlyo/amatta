import { useEffect, useRef, useState } from 'react';
import { Appearance, AppState, Platform, Text, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
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
import { ensurePermission } from '../src/notifications/permissions';
import { rescheduleAll } from '../src/notifications/scheduler';
import { useChildrenStore } from '../src/state/children-store';
import { useSchedulesStore } from '../src/state/schedules-store';
import { useChecklistStore } from '../src/state/checklist-store';
import { useTodosStore } from '../src/state/todos-store';
import { usePickupLogStore } from '../src/state/pickup-log-store';
import { useNotifSettingsStore } from '../src/state/notif-settings-store';
import { TOKENS } from '../src/ui/palette';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Module-scope so it runs once on app load (before any boot effect).
// Without this, expo-notifications silently suppresses notifications
// while the app is in the foreground.
// Lock the app to light appearance at RUNTIME. app.json's
// userInterfaceStyle:'light' only applies in a native build (not Expo Go), so
// this forces light there too — otherwise native chrome (the formSheet sheet
// container, date picker) renders with the device's dark-mode system colors.
Appearance.setColorScheme('light');

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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

        // Hydrate persisted notification settings BEFORE rescheduleAll so
        // scheduling sees the persisted systemEnabled (P3.1/P3.4). Falls
        // back to defaults when app_settings has no rows yet.
        await useNotifSettingsStore.getState().load(db);

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

        // Notification permission + initial reconciliation. The
        // ensurePermission() call only prompts the OS once (asked-flag
        // persisted via AsyncStorage); rescheduleAll() ALWAYS runs so
        // the OS queue stays a derived projection of SQLite even if
        // permission was denied (the scheduling calls will no-op).
        try {
          // Android requires a registered channel before any local push
          // can fire on API 26+. Channel must exist before scheduling.
          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
              name: 'default',
              importance: Notifications.AndroidImportance.DEFAULT,
              sound: 'default',
              vibrationPattern: [0, 250, 250, 250],
              lightColor: TOKENS.primary,
            });
          }
          await ensurePermission();
          await rescheduleAll(db);
        } catch (notifErr) {
          console.warn('[boot] notification reconcile failed:', notifErr);
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

  // AppState 'active' → debounced re-reconcile (≥ 60 min since last run).
  // Catches: device clock drift, push to a new timezone, edits made in a
  // background sibling session, the user toggling notification permission
  // in OS settings.
  const lastReconcileAtRef = useRef<number>(0);
  useEffect(() => {
    if (bootState !== 'ready') return;
    const DEBOUNCE_MS = 60 * 60 * 1000;
    const sub = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      const now = Date.now();
      if (now - lastReconcileAtRef.current < DEBOUNCE_MS) return;
      lastReconcileAtRef.current = now;
      void (async () => {
        try {
          const db = await getDb();
          await rescheduleAll(db);
        } catch (e) {
          console.warn('[appstate] notification reconcile failed:', e);
        }
      })();
    });
    return () => sub.remove();
  }, [bootState]);

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
        {/* New/Edit schedule — FULL modal (dev-gallery style), per user. */}
        <Stack.Screen
          name="schedule/edit"
          options={{
            headerShown: false,
            presentation: 'modal',
            contentStyle: { backgroundColor: TOKENS.surface },
          }}
        />
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
        {/* Reset-all-data confirm — native formSheet route (app/settings/reset-confirm.tsx). */}
        <Stack.Screen
          name="settings/reset-confirm"
          options={{
            headerShown: false,
            presentation: 'formSheet',
            sheetAllowedDetents: 'fitToContents',
            sheetGrabberVisible: true,
            sheetCornerRadius: 22,
            contentStyle: { backgroundColor: TOKENS.surface },
          }}
        />
        {/* Dev-only design-system gallery. Entry point in Settings is __DEV__-gated. */}
        <Stack.Screen name="dev-gallery" options={{ title: 'DS Gallery', presentation: 'modal' }} />
        {/* Calendar — native SHORT sheet (formSheet + detents). NO gorhom
            (gorhom's backdrop/gesture ate the first tap after dismiss; native
            react-native-screens sheets — like dev-gallery's modal — don't).
            The earlier formSheet "dark margins / white-on-touch" were dark-mode
            artifacts, now fixed by the runtime Appearance.setColorScheme('light')
            + contentStyle white. */}
        <Stack.Screen
          name="calendar/index"
          options={{
            headerShown: false,
            presentation: 'formSheet',
            sheetAllowedDetents: [0.5],
            sheetGrabberVisible: true,
            sheetCornerRadius: 20,
            contentStyle: { backgroundColor: TOKENS.surface },
          }}
        />
        {/* Event detail — FULL modal (dev-gallery style). */}
        <Stack.Screen
          name="event/detail"
          options={{
            headerShown: false,
            presentation: 'modal',
            contentStyle: { backgroundColor: TOKENS.surface },
          }}
        />
        {/* Search — native formSheet route (see app/search/index.tsx). */}
        <Stack.Screen
          name="search/index"
          options={{
            headerShown: false,
            presentation: 'formSheet',
            sheetAllowedDetents: [0.5, 0.92],
            sheetGrabberVisible: true,
            sheetCornerRadius: 20,
            contentStyle: { backgroundColor: TOKENS.surface },
          }}
        />
        {/* 자녀 선택 — native formSheet route (see app/kid-switch.tsx). */}
        <Stack.Screen
          name="kid-switch"
          options={{
            headerShown: false,
            presentation: 'formSheet',
            sheetAllowedDetents: 'fitToContents',
            sheetGrabberVisible: true,
            sheetCornerRadius: 20,
            contentStyle: { backgroundColor: TOKENS.surface },
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // eslint-disable-next-line no-restricted-syntax
  text: { fontSize: 16, color: '#333' },
  // eslint-disable-next-line no-restricted-syntax
  errorText: { fontSize: 16, color: '#c00', marginBottom: 8 },
  // eslint-disable-next-line no-restricted-syntax
  errorDetail: { fontSize: 12, color: '#666', textAlign: 'center', paddingHorizontal: 24 },
});
