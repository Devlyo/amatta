// "모든 데이터 초기화" — wipe the DB and bring every store back to defaults.
// Confirmed with the native alert in 설정 (same as the other destructive
// confirms); the caller routes to `/`, which redirects to onboarding.

import { getDb } from '../db/client';
import { wipeAllData } from '../db/wipe';
import { rescheduleAll } from '../notifications/scheduler';
import { useChecklistCompletionStore } from './checklist-completion-store';
import { useChecklistStore } from './checklist-store';
import { useChildrenStore } from './children-store';
import { useUiStore } from './ui-store';
import { useDisplayStore } from './display-store';
import { useCoachStore } from './coach-store';
import { useGuardianStore } from './guardian-store';
import { useNotifSettingsStore } from './notif-settings-store';
import { usePickupLogStore } from './pickup-log-store';
import { useSchedulesStore } from './schedules-store';
import { useTodosStore } from './todos-store';

export async function resetAllData(): Promise<void> {
  const db = await getDb();
  await wipeAllData(db);
  // wipeAllData cleared the persisted app_settings rows; mirror that in
  // memory so the stores don't keep stale values until the next relaunch.
  // (Guardian: only our choices are reset — the device calendar is untouched.)
  useNotifSettingsStore.getState().resetToDefaults();
  useGuardianStore.getState().resetToDefaults();
  useDisplayStore.getState().resetToDefaults();
  useCoachStore.getState().reset();
  // A fresh start: the next kids decide the calendar's opening view.
  useUiStore.setState({ kidCountMode: null, weekInactive: null });
  await Promise.all([
    useChildrenStore.getState().load(db),
    useSchedulesStore.getState().load(db),
    useChecklistStore.getState().load(db),
    useTodosStore.getState().load(db),
    usePickupLogStore.getState().load(db),
    useChecklistCompletionStore.getState().load(db),
  ]);
  // Reconcile the OS queue against the now-empty DB — cancelAll-first
  // clears every pending push left over from the wiped schedules/todos.
  await rescheduleAll(db);
}
