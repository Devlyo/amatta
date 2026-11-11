// Real MoveSteps (ADR-015): the iOS action sheet + the stores.

import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { getDb } from '../db/client';
import type { MoveScope, MoveSteps } from './move-occurrence';
import { useChecklistStore } from './checklist-store';
import { useSchedulesStore } from './schedules-store';

function ask(): Promise<MoveScope | null> {
  return new Promise((resolve) => {
    const title = '반복 일정이에요. 어떻게 옮길까요?';
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { message: title, options: ['이 일정만', '모든 일정', '취소'], cancelButtonIndex: 2 },
        (i) => resolve(i === 0 ? 'this' : i === 1 ? 'all' : null),
      );
      return;
    }
    Alert.alert(title, undefined, [
      { text: '취소', style: 'cancel', onPress: () => resolve(null) },
      { text: '이 일정만', onPress: () => resolve('this') },
      { text: '모든 일정', onPress: () => resolve('all') },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}

export function defaultMoveSteps(): MoveSteps {
  return {
    ask,
    updateSchedule: async (id, patch) => useSchedulesStore.getState().updateSchedule(await getDb(), id, patch),
    applyException: async (id, date, o) => useSchedulesStore.getState().applyException(await getDb(), id, date, o),
    addSchedule: async (input) => useSchedulesStore.getState().addSchedule(await getDb(), input),
    addChecklistItem: async (input) => {
      await useChecklistStore.getState().add(await getDb(), input);
    },
  };
}
