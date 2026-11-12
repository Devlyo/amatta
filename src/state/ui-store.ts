import { create } from 'zustand';

import { setActive, soloActive, tapPerson, toggleActive, type PersonKey } from '../domain/people-filter';
import { WEEK_SPAN_DEFAULT, type WeekSpan } from '../ui/calendar/calendar-layout';
import type { ISODate } from '../domain/types';
import { todayIso } from '../ui/utils/date';

/** editGuardian = a device-calendar (보호자) event, ADR-008. */
export type EditSheetMode = 'closed' | 'create' | 'editAll' | 'editOccurrence' | 'editGuardian';

export interface EditSheetPreFill {
  childId?: number;
  date?: ISODate;
  /** Start time (minutes from midnight) — set when created from a grid long press. */
  startMinutes?: number;
  /** 보호자 pre-selected (guardian column long press, ADR-008). */
  guardian?: boolean;
}

export interface EditSheetState {
  mode: EditSheetMode;
  scheduleId?: number;
  occurrenceDate?: ISODate;
  preFill?: EditSheetPreFill;
  /** editGuardian: the device-calendar event and the instance's start (ISO). */
  guardianEventId?: string;
  guardianInstance?: string;
}

// Batch D additive slice — surfaces a read-only event detail drawer
// (app-event-detail.jsx port). EditAll/etc routes through EditSheetState.
export interface EventDetailState {
  mode: 'closed' | 'open';
  scheduleId?: number;
  occurrenceDate?: ISODate;
}

// NOTE: do NOT use `new Date().toISOString().slice(0,10)` here — that returns
// the date in UTC, which between 00:00 and 09:00 KST resolves to the previous
// local day and breaks isToday() comparisons. The canonical helper in
// src/ui/utils/date.ts uses local-time getters and is the only source of
// truth for "today" across the app.
// ADR-007 §1–2: calendar view and the people filter.
export type CalendarView = 'day' | 'week' | 'month';
export type { PersonKey };

interface UiState {
  currentDate: ISODate;
  setCurrentDate: (date: ISODate) => void;

  calendarView: CalendarView;
  setCalendarView: (view: CalendarView) => void;
  /** Week view days on screen (pinch): 7 / 4 / 3 / 2. Session only. */
  weekSpan: WeekSpan;
  setWeekSpan: (span: WeekSpan) => void;
  /**
   * Owner 2026-11-12: the calendar's opening view follows the number of kids —
   * one kid → week, all 7 days; two or more → day view (week opens at 3.2 days).
   * Applied when the count first loads and whenever it crosses 1 ↔ 2+; in
   * between, the user's own view / pinch choices stand.
   */
  applyKidCountDefaults: (kidCount: number) => void;
  kidCountMode: 'one' | 'many' | null;
  /** Month view pinch zoom (2-line chips). Session only. */
  /** Month view week-row height (pinch zoom, MONTH_ROW_MIN…MAX). */
  monthRowH: number;
  setMonthRowH: (h: number) => void;
  /** People switched off in the filter (faded). Empty = everyone active. */
  inactivePeople: PersonKey[];
  /**
   * The week view's own filter (owner 2026-11-12): it opens showing one person
   * — the first kid — so each kid's week reads as titled blocks. `null` = not
   * set yet this session (then: everyone but the first is off).
   */
  weekInactive: PersonKey[] | null;
  toggleWeekPerson: (key: PersonKey, everyone: readonly PersonKey[]) => void;
  soloWeekPerson: (key: PersonKey, everyone: readonly PersonKey[]) => void;
  /** Tap on a pill: one person at a time (see tapPerson). */
  tapPersonPill: (key: PersonKey, everyone: readonly PersonKey[]) => void;
  tapWeekPersonPill: (key: PersonKey, everyone: readonly PersonKey[]) => void;
  /** Slide-select: set one person on/off (day/month filter). */
  setPersonActive: (key: PersonKey, on: boolean) => void;
  /** Slide-select in the week's own filter. */
  setWeekPersonActive: (key: PersonKey, on: boolean, everyone: readonly PersonKey[]) => void;
  /** Short tap on a filter pill. */
  togglePerson: (key: PersonKey) => void;
  /** Long press on a filter pill: only that person (again → everyone). */
  soloPerson: (key: PersonKey, everyone: readonly PersonKey[]) => void;

  editSheetState: EditSheetState;
  openEditSheet: (
    mode: Exclude<EditSheetMode, 'closed'>,
    options?: {
      scheduleId?: number;
      occurrenceDate?: ISODate;
      preFill?: EditSheetPreFill;
      guardianEventId?: string;
      guardianInstance?: string;
    },
  ) => void;
  closeEditSheet: () => void;

  // Batch D — event-detail drawer (worker-event)
  eventDetailState: EventDetailState;
  openEventDetail: (input: { scheduleId: number; occurrenceDate: ISODate }) => void;
  closeEventDetail: () => void;

}

/** The week's opening filter: only the first person (first kid) is on. */
export function weekDefault(everyone: readonly PersonKey[]): PersonKey[] {
  return everyone.slice(1);
}

export const useUiStore = create<UiState>()((set) => ({
  currentDate: todayIso(),
  setCurrentDate: (date) => set({ currentDate: date }),

  calendarView: 'day',
  setCalendarView: (view) => set({ calendarView: view }),
  weekSpan: WEEK_SPAN_DEFAULT,
  setWeekSpan: (span) => set({ weekSpan: span }),
  kidCountMode: null,
  applyKidCountDefaults: (kidCount) =>
    set((s) => {
      if (kidCount === 0) return {};
      const mode = kidCount === 1 ? 'one' : 'many';
      if (s.kidCountMode === mode) return {};
      return mode === 'one'
        ? { kidCountMode: mode, calendarView: 'week', weekSpan: 7 }
        : { kidCountMode: mode, calendarView: 'day', weekSpan: WEEK_SPAN_DEFAULT };
    }),
  monthRowH: 104,
  setMonthRowH: (h) => set({ monthRowH: h }),
  inactivePeople: [],
  weekInactive: null,
  toggleWeekPerson: (key, everyone) =>
    set((s) => ({ weekInactive: toggleActive(s.weekInactive ?? weekDefault(everyone), key) })),
  soloWeekPerson: (key, everyone) =>
    set((s) => ({ weekInactive: soloActive(s.weekInactive ?? weekDefault(everyone), key, everyone) })),
  tapPersonPill: (key, everyone) => set((s) => ({ inactivePeople: tapPerson(s.inactivePeople, key, everyone) })),
  tapWeekPersonPill: (key, everyone) =>
    set((s) => ({ weekInactive: tapPerson(s.weekInactive ?? weekDefault(everyone), key, everyone) })),
  setPersonActive: (key, on) => set((s) => ({ inactivePeople: setActive(s.inactivePeople, key, on) })),
  setWeekPersonActive: (key, on, everyone) =>
    set((s) => ({ weekInactive: setActive(s.weekInactive ?? weekDefault(everyone), key, on) })),
  togglePerson: (key) => set((s) => ({ inactivePeople: toggleActive(s.inactivePeople, key) })),
  soloPerson: (key, everyone) =>
    set((s) => ({ inactivePeople: soloActive(s.inactivePeople, key, everyone) })),

  editSheetState: { mode: 'closed' },

  openEditSheet: (mode, options) =>
    set({
      editSheetState: {
        mode,
        scheduleId: options?.scheduleId,
        occurrenceDate: options?.occurrenceDate,
        preFill: options?.preFill,
        guardianEventId: options?.guardianEventId,
        guardianInstance: options?.guardianInstance,
      },
    }),

  closeEditSheet: () => set({ editSheetState: { mode: 'closed' } }),

  eventDetailState: { mode: 'closed' },
  openEventDetail: ({ scheduleId, occurrenceDate }) =>
    set({ eventDetailState: { mode: 'open', scheduleId, occurrenceDate } }),
  closeEventDetail: () => set({ eventDetailState: { mode: 'closed' } }),

}));
