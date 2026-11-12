import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Text, View, Image, useColorScheme } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
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
import { useChecklistCompletionStore } from '../src/state/checklist-completion-store';
import { useNotifSettingsStore } from '../src/state/notif-settings-store';
import { useGuardianStore } from '../src/state/guardian-store';
import { useDisplayStore } from '../src/state/display-store';
import { AppThemeProvider, DARK_THEME, LIGHT_THEME, makeStyles, useTheme } from '../src/ui/appearance';
import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavDefaultTheme,
  ThemeProvider as NavThemeProvider,
} from '@react-navigation/native';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Module-scope so it runs once on app load (before any boot effect).
// Without this, expo-notifications silently suppresses notifications
// while the app is in the foreground.
// ADR-009: no light lock any more. The saved 화면 모드 (system / light / dark)
// is applied by useDisplayStore.load() during boot, before the splash hides.

// Keep the native splash visible until boot is READY (migrations + stores +
// notif reconcile). Without this, expo-router would tear down the splash as
// soon as the JS mounts, flashing a bare loading screen before the app is
// usable. Hidden in the boot effect's success path via SplashScreen.hideAsync().
void SplashScreen.preventAutoHideAsync();

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
  const styles = useStyles();
  const scheme = useColorScheme();
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
          useChecklistCompletionStore.getState().load(db),
          useGuardianStore.getState().load(db),
          useDisplayStore.getState().load(db),
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
              lightColor: LIGHT_THEME.t.primary, // brand orange LED, same in both schemes
            });
          }
          // First run (no kids yet): the onboarding finish step asks, with
          // context. Afterwards only while 알림 is on in 설정.
          if (
            useChildrenStore.getState().children.length > 0 &&
            useNotifSettingsStore.getState().systemEnabled
          ) {
            await ensurePermission();
          }
          await rescheduleAll(db);
        } catch (notifErr) {
          console.warn('[boot] notification reconcile failed:', notifErr);
        }

        setBootState('ready');
        // NOTE: do NOT hideAsync here — that fires before the 'ready' content
        // paints, so the native splash drops to the (smaller) JS view for a frame
        // = the "wordmark huge then shrinks" glitch. Hide it from a useEffect on
        // bootState==='ready' instead, which runs AFTER the content mounts, so the
        // native splash hands straight off to real content.
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e ?? 'Unknown error');
        setBootError(msg);
        setBootState('error');
        // Reveal the error screen instead of leaving the splash stuck.
        void SplashScreen.hideAsync();
      }
    }

    void boot();
  }, [fontsLoaded]);

  // Hide the native splash only AFTER the 'ready' content has mounted (this
  // effect runs post-commit), so the native splash hands directly off to real
  // content with no intermediate JS-splash frame (no wordmark size jump).
  useEffect(() => {
    if (bootState === 'ready') void SplashScreen.hideAsync();
  }, [bootState]);

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
    // Replicate the splash (orange WeMoa wordmark on white / dark) so the hand-off from the
    // native splash to JS is seamless — no white flash, and the wordmark doesn't
    // blink out. The native splash is held via preventAutoHideAsync until 'ready'.
    return (
      <View
        style={[
          styles.splashFill,
          // Same pair as app.json expo-splash-screen (light / dark).
          { backgroundColor: scheme === 'dark' ? DARK_THEME.t.groupedBg : LIGHT_THEME.t.surface },
        ]}
      >
        <Image
          source={require('../assets/images/splash-icon.png')}
          style={styles.splashWordmark}
          resizeMode="contain"
        />
      </View>
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
     <AppThemeProvider>
      {/* Status-bar glyphs follow the scheme (dark glyphs on light, light on dark). */}
      <StatusBar style="auto" />
      <AppStack />
     </AppThemeProvider>
    </GestureHandlerRootView>
  );
}

const useStyles = makeStyles((th) => ({
  flex: { flex: 1 },
  splashFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashWordmark: { width: 200, height: 44 }, // match native splash imageWidth (200), image 1200×263
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // eslint-disable-next-line no-restricted-syntax
  errorText: { fontSize: 16, color: '#c00', marginBottom: 8 },
  // eslint-disable-next-line no-restricted-syntax
  errorDetail: { fontSize: 12, color: '#666', textAlign: 'center', paddingHorizontal: 24 },
}));

/**
 * The route stack, rendered INSIDE AppThemeProvider so the screens' native
 * backgrounds (contentStyle) and React Navigation's own chrome follow the
 * theme (ADR-009).
 */
function AppStack(): React.ReactElement {
  const theme = useTheme();
  const base = theme.scheme === 'dark' ? NavDarkTheme : NavDefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.t.primary,
      background: theme.t.groupedBg,
      card: theme.t.surface,
      text: theme.t.ink,
      border: theme.t.separator,
      notification: theme.t.danger,
    },
  };
  return (
    <NavThemeProvider value={navTheme}>
  <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* New/Edit schedule — FULL modal (dev-gallery style), per user. */}
      <Stack.Screen
        name="schedule/edit"
        options={{
          headerShown: false,
          presentation: 'modal',
          contentStyle: { backgroundColor: theme.t.groupedBg },
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
      <Stack.Screen
        name="onboarding/finish"
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen name="settings/kids" options={{ headerShown: false }} />
      <Stack.Screen name="settings/kid-edit" options={{ headerShown: false }} />
      <Stack.Screen name="settings/data" options={{ headerShown: false }} />
      <Stack.Screen name="settings/calendars" options={{ headerShown: false }} />
      <Stack.Screen name="settings/display" options={{ headerShown: false }} />
      <Stack.Screen name="settings/legal" options={{ headerShown: false }} />
      {/* Calendar share link (ADR-016) — full modal like the event screens. */}
      <Stack.Screen
        name="share"
        options={{
          headerShown: false,
          presentation: 'modal',
          contentStyle: { backgroundColor: theme.t.groupedBg },
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
        name="date-picker"
        options={{
          headerShown: false,
          presentation: 'formSheet',
          sheetAllowedDetents: [0.5],
          sheetGrabberVisible: true,
          sheetCornerRadius: 20,
          contentStyle: { backgroundColor: theme.t.surface },
        }}
      />
      {/* Event detail — FULL modal (dev-gallery style). */}
      <Stack.Screen
        name="event/detail"
        options={{
          headerShown: false,
          presentation: 'modal',
          contentStyle: { backgroundColor: theme.t.groupedBg },
        }}
      />
      <Stack.Screen
        name="event/guardian"
        options={{
          headerShown: false,
          presentation: 'modal',
          contentStyle: { backgroundColor: theme.t.groupedBg },
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
          contentStyle: { backgroundColor: theme.t.groupedBg },
        }}
      />
    </Stack>
    </NavThemeProvider>
  );
}
