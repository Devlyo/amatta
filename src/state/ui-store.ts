import { create } from 'zustand';

import type { ISODate } from '../domain/types';
import { todayIso } from '../ui/utils/date';

export type EditSheetMode = 'closed' | 'create' | 'editAll' | 'editOccurrence';

export interface EditSheetPreFill {
  childId?: number;
  date?: ISODate;
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
// ADR-007 §1–2: calendar view and kid focus mode.
export type CalendarView = 'day' | 'week' | 'month';
/** A kid id, or the guardian (iPhone Calendar) column. */
export type FocusKey = number | 'guardian';

interface UiState {
  currentDate: ISODate;
  setCurrentDate: (date: ISODate) => void;

  calendarView: CalendarView;
  setCalendarView: (view: CalendarView) => void;
  /** Focused kid/guardian — others are faded. null = no focus. */
  focusKey: FocusKey | null;
  /** Tap a filter pill: focus it, or clear when it is already focused. */
  toggleFocus: (key: FocusKey) => void;

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
  focusKey: null,
  toggleFocus: (key) => set((s) => ({ focusKey: s.focusKey === key ? null : key })),

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
