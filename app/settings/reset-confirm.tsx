import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { getDb } from '../../src/db/client';
import { wipeAllData } from '../../src/db/wipe';
import { rescheduleAll } from '../../src/notifications/scheduler';
import { useChildrenStore } from '../../src/state/children-store';
import { useChecklistStore } from '../../src/state/checklist-store';
import { useNotifSettingsStore } from '../../src/state/notif-settings-store';
import { usePickupLogStore } from '../../src/state/pickup-log-store';
import { useSchedulesStore } from '../../src/state/schedules-store';
import { useTodosStore } from '../../src/state/todos-store';
import { TOKENS } from '../../src/ui/palette';
import { SPACING } from '../../src/ui/spacing';
import { ResetConfirmBody } from '../../src/ui/settings/ResetConfirmSheet';

// "모든 데이터 초기화" confirm — native formSheet route (no gorhom). Owns the
// destructive wipe (moved from settings.tsx).
export default function ResetConfirmRoute(): React.ReactElement {
  const router = useRouter();

  const handleConfirm = useCallback(async (): Promise<void> => {
    const db = await getDb();
    await wipeAllData(db);
    // wipeAllData cleared the persisted app_settings rows; mirror that in
    // memory so the notif store doesn't keep stale systemEnabled / lead-time
    // values until the next relaunch.
    useNotifSettingsStore.getState().resetToDefaults();
    await Promise.all([
      useChildrenStore.getState().load(db),
      useSchedulesStore.getState().load(db),
      useChecklistStore.getState().load(db),
      useTodosStore.getState().load(db),
      usePickupLogStore.getState().load(db),
    ]);
    // Reconcile the OS queue against the now-empty DB — cancelAll-first
    // clears every pending push left over from the wiped schedules/todos.
    await rescheduleAll(db);
    // replace → leave the sheet and bounce to daily, which redirects to
    // onboarding on the now-empty data.
    router.replace('/');
  }, [router]);

  return (
    <View style={styles.root}>
      <ResetConfirmBody
        onCancel={() => router.back()}
        onConfirm={() => void handleConfirm()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // No flex:1 — the sheet uses fitToContents, so the View hugs the body height.
  // Top padding clears the native sheet grabber.
  root: { paddingTop: SPACING.xl, backgroundColor: TOKENS.surface },
});
