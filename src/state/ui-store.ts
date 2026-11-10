import { create } from 'zustand';

import { soloActive, toggleActive, type PersonKey } from '../domain/people-filter';
import type { ISODate } from '../domain/types';
import { todayIso } from '../ui/utils/date';

export type EditSheetMode = 'closed' | 'create' | 'editAll' | 'editOccurrence';

export interface EditSheetPreFill {
  childId?: number;
  date?: ISODate;
  /** Start time (minutes from midnight) — set when created from a grid long press. */
  startMinutes?: number;
}

export interface EditSheetState {
  mode: EditSheetMode;
  scheduleId?: number;
  occurrenceDate?: ISODate;
  preFill?: EditSheetPreFill;
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
  /** People switched off in the filter (faded). Empty = everyone active. */
  inactivePeople: PersonKey[];
  /** Short tap on a filter pill. */
  togglePerson: (key: PersonKey) => void;
  /** Long press on a filter pill: only that person (again → everyone). */
  soloPerson: (key: PersonKey, everyone: readonly PersonKey[]) => void;

  editSheetState: EditSheetState;
  openEditSheet: (
    mode: Exclude<EditSheetMode, 'closed'>,
    options?: { scheduleId?: number; occurrenceDate?: ISODate; preFill?: EditSheetPreFill },
  ) => void;
  closeEditSheet: () => void;

  // Batch D — event-detail drawer (worker-event)
  eventDetailState: EventDetailState;
  openEventDetail: (input: { scheduleId: number; occurrenceDate: ISODate }) => void;
  closeEventDetail: () => void;

}

export const useUiStore = create<UiState>()((set) => ({
  currentDate: todayIso(),
  setCurrentDate: (date) => set({ currentDate: date }),

  calendarView: 'day',
  setCalendarView: (view) => set({ calendarView: view }),
  inactivePeople: [],
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
      },
    }),

  closeEditSheet: () => set({ editSheetState: { mode: 'closed' } }),

  eventDetailState: { mode: 'closed' },
  openEventDetail: ({ scheduleId, occurrenceDate }) =>
    set({ eventDetailState: { mode: 'open', scheduleId, occurrenceDate } }),
  closeEventDetail: () => set({ eventDetailState: { mode: 'closed' } }),

}));
