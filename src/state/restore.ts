// "백업 파일에서 가져오기" flow — ADR-012.
//
//   pick → parse/validate → confirm (native alert) → safety copy of the
//   current data → importDb (one exclusive transaction) → reload stores →
//   reschedule notifications.
//
// The flow is written against injected steps (RestoreSteps) so it can be
// tested without the picker, alerts or a device; `defaultRestoreSteps()`
// wires the real ones. Callers handle navigation from the outcome.

import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDb } from '../db/client';
import { rescheduleAll } from '../notifications/scheduler';
import { exportDb } from '../utils/db-export';
import { importDb, parseBackup, type BackupData, type BackupSummary } from '../utils/db-import';
import { pickJsonFile, type PickJsonResult } from '../utils/pick-json';
import { useChecklistCompletionStore } from './checklist-completion-store';
import { useChecklistStore } from './checklist-store';
import { useChildrenStore } from './children-store';
import { useDisplayStore } from './display-store';
import { useGuardianStore } from './guardian-store';
import { useNotifSettingsStore } from './notif-settings-store';
import { usePickupLogStore } from './pickup-log-store';
import { useSchedulesStore } from './schedules-store';
import { useTodosStore } from './todos-store';
import { useUiStore } from './ui-store';

/** Where the flow was started — changes the confirm copy and the safety copy. */
export type RestoreEntry = 'settings' | 'welcome';

export type RestoreProblem =
  | 'unavailable'
  | 'unreadable'
  | 'invalid'
  | 'tooOld'
  | 'newer'
  | 'empty'
  | 'failed';

export type RestoreOutcome = 'restored' | 'cancelled' | 'rejected' | 'failed';

export interface RestoreSteps {
  pick(): Promise<PickJsonResult>;
  confirm(entry: RestoreEntry, summary: BackupSummary): Promise<boolean>;
  report(problem: RestoreProblem): void;
  /** Save the current data before it is replaced (settings entry only). */
  keepCurrent(): Promise<void>;
  apply(data: BackupData): Promise<void>;
  /** Reload stores + reschedule, after a successful apply. */
  reload(): Promise<void>;
}

export async function restoreFromBackup(entry: RestoreEntry, steps: RestoreSteps): Promise<RestoreOutcome> {
  const picked = await steps.pick();
  if (picked.kind === 'cancelled') return 'cancelled';
  if (picked.kind !== 'picked') {
    steps.report(picked.kind);
    return 'rejected';
  }
  const parsed = parseBackup(picked.text);
  if (parsed.kind !== 'ok') {
    steps.report(parsed.kind);
    return 'rejected';
  }
  if (!(await steps.confirm(entry, parsed.summary))) return 'cancelled';
  try {
    if (entry === 'settings') await steps.keepCurrent();
    await steps.apply(parsed.data);
  } catch (e) {
    console.warn('[restore] import failed:', e);
    steps.report('failed');
    return 'failed';
  }
  try {
    await steps.reload();
  } catch (e) {
    // The data is in; a reload hiccup fixes itself on the next launch.
    console.warn('[restore] reload failed:', e);
  }
  return 'restored';
}

// ─── Copy ──────────────────────────────────────────────────────────────────

/** "11월 10일 오후 10:15" in local time; "날짜 모름" when unreadable. */
export function backupDateLabel(d: Date | null): string {
  if (d === null) return '날짜 모름';
  const h = d.getHours();
  const ap = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${ap} ${h12}:${mm}`;
}

export function summaryLine(s: BackupSummary): string {
  return `자녀 ${s.kids}명 · 일정 ${s.schedules}건 · 준비물 ${s.checklist}건 · 할일 ${s.todos}건`;
}

const PROBLEM_COPY: Record<RestoreProblem, [string, string]> = {
  unavailable: ['업데이트가 필요해요', '지금 설치된 앱에는 파일 가져오기 기능이 없어요. 앱을 최신 버전으로 업데이트해 주세요.'],
  unreadable: ['가져올 수 없는 파일이에요', 'WeMoa에서 내보낸 백업 파일(.json)을 골라 주세요.'],
  invalid: ['가져올 수 없는 파일이에요', 'WeMoa에서 내보낸 백업 파일(.json)을 골라 주세요.'],
  tooOld: ['가져올 수 없는 백업이에요', '너무 오래된 형식의 파일이에요.'],
  newer: ['앱 업데이트가 필요해요', '더 새로운 버전의 WeMoa에서 만든 파일이에요. 앱을 업데이트한 뒤 다시 시도해 주세요.'],
  empty: ['아이 정보가 없는 파일이에요', '아이가 한 명 이상 있는 백업 파일을 골라 주세요.'],
  failed: ['가져오지 못했어요', '지금 데이터는 그대로예요. 잠시 후 다시 시도해 주세요.'],
};

// ─── Real steps ────────────────────────────────────────────────────────────

const SAFETY_FILENAME = 'wemoa-before-restore.json';

async function reloadAll(db: SQLiteDatabase): Promise<void> {
  // rescheduleAll reads the notif store → settings first, data next, then reschedule.
  await useNotifSettingsStore.getState().load(db);
  await useDisplayStore.getState().load(db);
  await Promise.all([
    useChildrenStore.getState().load(db),
    useSchedulesStore.getState().load(db),
    useChecklistStore.getState().load(db),
    useTodosStore.getState().load(db),
    usePickupLogStore.getState().load(db),
    useChecklistCompletionStore.getState().load(db),
  ]);
  // Calendar choices are this device's and were kept; just refetch.
  useGuardianStore.getState().invalidate();
  // Filters / open sheets may point at ids from the replaced data.
  useUiStore.setState({
    inactivePeople: [],
    editSheetState: { mode: 'closed' },
    eventDetailState: { mode: 'closed' },
  });
  await rescheduleAll(db);
}

export function defaultRestoreSteps(): RestoreSteps {
  return {
    pick: pickJsonFile,
    confirm: (entry, summary) =>
      new Promise<boolean>((resolve) => {
        const body = `${backupDateLabel(summary.exportedAt)} 백업\n${summaryLine(summary)}`;
        Alert.alert(
          entry === 'settings' ? '이 백업으로 바꿀까요?' : '이 백업으로 시작할까요?',
          entry === 'settings' ? `${body}\n\n지금 앱에 있는 데이터는 모두 지워져요.` : body,
          [
            { text: '취소', style: 'cancel', onPress: () => resolve(false) },
            {
              text: '가져오기',
              style: entry === 'settings' ? 'destructive' : 'default',
              onPress: () => resolve(true),
            },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        );
      }),
    report: (problem) => {
      const [title, message] = PROBLEM_COPY[problem];
      Alert.alert(title, message, [{ text: '확인' }]);
    },
    keepCurrent: async () => {
      if (useChildrenStore.getState().children.length === 0) return;
      const db = await getDb();
      const { json } = await exportDb(db);
      const dir = FileSystem.Paths.document.uri;
      const file = new FileSystem.File(`${dir.endsWith('/') ? dir : `${dir}/`}${SAFETY_FILENAME}`);
      if (file.exists) file.delete();
      file.create();
      file.write(json);
    },
    apply: async (data) => {
      const db = await getDb();
      await importDb(db, data);
    },
    reload: async () => reloadAll(await getDb()),
  };
}
