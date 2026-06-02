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
interface UiState {
  currentDate: ISODate;
  setCurrentDate: (date: ISODate) => void;
  selectedChildId: number | null;
  setSelectedChildId: (id: number | null) => void;

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

  // Batch D — calendar + search drawers (worker-drawers)
  calendarDrawerOpen: boolean;
  openCalendar: () => void;
  closeCalendar: () => void;
  searchDrawerOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  currentDate: todayIso(),
  setCurrentDate: (date) => set({ currentDate: date }),

  selectedChildId: null,
  setSelectedChildId: (id) => set({ selectedChildId: id }),

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

  calendarDrawerOpen: false,
  openCalendar: () => set({ calendarDrawerOpen: true }),
  closeCalendar: () => set({ calendarDrawerOpen: false }),
  searchDrawerOpen: false,
  openSearch: () => set({ searchDrawerOpen: true }),
  closeSearch: () => set({ searchDrawerOpen: false }),
}));
