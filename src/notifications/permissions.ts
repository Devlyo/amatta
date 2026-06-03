// Notification permission flow.
//
// Per spec: request once on the first save attempt that has a non-null
// notifyMinutesBefore. Persist that we asked (an AsyncStorage flag) so
// a denial doesn't trigger nagging prompts on every subsequent save.
//
// Single rule of thumb: callers should always call ensurePermission()
// before any scheduling work; this module is the single source of truth
// for whether we should prompt or skip.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const ASKED_FLAG_KEY = 'amatta.notif.asked.v1';

export type PermissionState =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'unavailable';

export interface EnsurePermissionResult {
  state: PermissionState;
  /** True iff scheduling work should proceed. */
  canSchedule: boolean;
}

async function readAskedFlag(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(ASKED_FLAG_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

async function writeAskedFlag(): Promise<void> {
  try {
    await AsyncStorage.setItem(ASKED_FLAG_KEY, '1');
  } catch {
    /* ignore — the worst that happens is we ask one more time next launch */
  }
}

function statusToState(
  status: Notifications.PermissionStatus | string,
): PermissionState {
  switch (status) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'undetermined':
      return 'undetermined';
    default:
      return 'unavailable';
  }
}

/**
 * Ensure we have notification permission to schedule local pushes.
 *
 * - If already granted: returns granted/canSchedule=true.
 * - If undetermined AND we haven't asked yet: prompts the OS, persists
 *   the asked-flag, returns the resulting state.
 * - If denied OR we've already asked once: returns the current state
 *   with canSchedule = false, no prompt. The user can re-enable in OS
 *   settings.
 */
export async function ensurePermission(): Promise<EnsurePermissionResult> {
  const current = await Notifications.getPermissionsAsync();
  const currentState = statusToState(current.status);
  if (currentState === 'granted') {
    return { state: currentState, canSchedule: true };
  }

  const asked = await readAskedFlag();
  if (asked) {
    // We've prompted before and weren't granted. Don't nag — user can
    // re-enable from OS settings.
    return { state: currentState, canSchedule: false };
  }

  // First time — prompt.
  const next = await Notifications.requestPermissionsAsync();
  const nextState = statusToState(next.status);
  await writeAskedFlag();
  return { state: nextState, canSchedule: nextState === 'granted' };
}
