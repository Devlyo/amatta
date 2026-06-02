import { create } from 'zustand';

import type { ISODate } from '../domain/types';

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

function todayISO(): ISODate {
  return new Date().toISOString().slice(0, 10) as ISODate;
}

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
}

export const useUiStore = create<UiState>()((set) => ({
  currentDate: todayISO(),
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
}));
