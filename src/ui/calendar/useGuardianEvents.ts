// Guardian events for the visible range — ADR-008.
//
// Re-reads the device calendar when the range, the settings or the store's
// version change, and when the app comes back to the foreground (the user may
// have edited the calendar or the permission in the meantime).

import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getPermission } from '../../calendar/guardian-calendar';
import type { GuardianOccurrence } from '../../domain/guardian';
import type { ISODate } from '../../domain/types';
import { useGuardianStore } from '../../state/guardian-store';

export function useGuardianEvents(from: ISODate, to: ISODate): readonly GuardianOccurrence[] {
  const enabled = useGuardianStore((s) => s.enabled);
  const permission = useGuardianStore((s) => s.permission);
  const calendarIds = useGuardianStore((s) => s.calendarIds);
  const calendars = useGuardianStore((s) => s.calendars);
  const version = useGuardianStore((s) => s.version);
  const events = useGuardianStore((s) => s.events);
  const range = useGuardianStore((s) => s.range);

  useEffect(() => {
    void useGuardianStore.getState().fetchRange(from, to);
  }, [from, to, enabled, permission, calendarIds, calendars, version]);

  useEffect(() => {
    if (!enabled) return undefined;
    const sub = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      void (async () => {
        const permissionNow = await getPermission();
        useGuardianStore.setState({ permission: permissionNow });
        if (permissionNow === 'granted') await useGuardianStore.getState().refreshCalendars();
        useGuardianStore.getState().invalidate();
      })();
    });
    return () => sub.remove();
  }, [enabled]);

  // Only hand out events read for this range (a stale range would misplace them).
  const fresh = range !== null && range.from === from && range.to === to;
  return enabled && fresh ? events : EMPTY;
}

const EMPTY: readonly GuardianOccurrence[] = [];
