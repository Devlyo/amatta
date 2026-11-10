// NOW tick — ADR-003 §B (behaviour kept by ADR-007).
//
// Returns minutes-from-midnight for "now", advancing on every minute boundary
// without user input: align to the next minute, then setInterval(60s). Coming
// back to the foreground (AppState 'active') re-syncs immediately and restarts
// the alignment, since many minutes may have passed in the background.

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function currentMinutes(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function useNowMinutes(): number {
  const [nowMinutes, setNowMinutes] = useState<number>(() => currentMinutes());

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tick = (): void => setNowMinutes(currentMinutes());

    const start = (): void => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (intervalId !== null) clearInterval(intervalId);
      const now = new Date();
      const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      timeoutId = setTimeout(() => {
        tick();
        intervalId = setInterval(tick, 60_000);
      }, msUntilNextMinute);
    };

    start();

    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        tick();
        start();
      }
    });

    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (intervalId !== null) clearInterval(intervalId);
      sub.remove();
    };
  }, []);

  return nowMinutes;
}
