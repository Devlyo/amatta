// JSON backup → DB, replacing everything — ADR-012 (data import, v1.1).
//
// Two steps, both pure with respect to the UI:
//   parseBackup(text)  — parse + validate + normalise an export envelope
//                        (schemaVersion 3–5) WITHOUT touching the DB.
//   importDb(db, data) — one EXCLUSIVE transaction: delete the user tables
//                        leaf-first, insert the file's rows with their ids,
//                        verify with PRAGMA foreign_key_check. Any failure
//                        rolls back, so the current data survives untouched.
//
// Version history the normaliser relies on (see db-export.ts, and the v1.0.0
// tag which shipped schemaVersion 3):
//   v3: no `appSettings`; checklist items lack `occurrenceDate`/`recurring`
//       (their exported `recurring` is a mapper default, NOT data); schedules
//       lack `allDay`/`notifyEndMinutesBefore`.
//   v4: + appSettings, + checklist membership. Schedules still lack v8 fields.
//   v5: + schedules.allDay / notifyEndMinutesBefore (current).
//   v1–v2: older than any shipped build → 'tooOld'.  ≥ 6: 'newer'.
//
// The exclusive transaction runs on its own connection, where
// PRAGMA foreign_keys is off and cannot be switched on inside BEGIN — so
// references are checked here before writing, deletes are explicit (no
// CASCADE needed) and PRAGMA foreign_key_check runs before COMMIT.

import { avatarKeyForColorIndex, colorIndexForAvatarKey, isAvatarKey, type AvatarKey } from '../domain/avatar';
import { MAX_CHILDREN } from '../domain/constants';
import type {
  ChecklistCompletion,
  ChecklistItem,
  Child,
  ISODate,
  NotificationSetting,
  Schedule,
  ScheduleException,
  SchedulePickupLog,
  Todo,
} from '../domain/types';
import { EXPORT_SCHEMA_VERSION } from './db-export';

/** Oldest envelope a shipped build ever wrote (v1.0.0). */
export const MIN_IMPORT_SCHEMA_VERSION = 3;

export interface BackupData {
  children: Child[];
  schedules: Schedule[];
  exceptions: ScheduleException[];
  notificationSettings: NotificationSetting[];
  checklistItems: ChecklistItem[];
  todos: Todo[];
  pickupLog: SchedulePickupLog[];
  checklistCompletion: ChecklistCompletion[];
  /** Never contains `guardian_*` keys (device-specific). */
  appSettings: { key: string; value: string }[];
}

export interface BackupSummary {
  /** When the file was exported; null if the file's timestamp is unreadable. */
  exportedAt: Date | null;
  schemaVersion: number;
  kids: number;
  schedules: number;
  checklist: number;
  todos: number;
}

export type ParseResult =
  | { kind: 'ok'; data: BackupData; summary: BackupSummary }
  /** Not a WeMoa backup (bad JSON, wrong shape, broken references, rules). */
  | { kind: 'invalid'; reason: string }
  /** schemaVersion 1–2 — from before any shipped build. */
  | { kind: 'tooOld' }
  /** schemaVersion above what this build understands — update the app. */
  | { kind: 'newer' }
  /** A valid backup with no kids — restoring it would leave an empty app. */
  | { kind: 'empty' };

const GUARDIAN_PREFIX = 'guardian_';
const SCHEDULE_TYPES = ['school', 'academy', 'activity', 'other'] as const;
const LABEL_MAX = 60;
const TODO_TITLE_MAX = 120;

class Invalid extends Error {}
const fail = (reason: string): never => {
  throw new Invalid(reason);
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (o: Obj, k: string, where: string): number => {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isInteger(v)) fail(`${where}.${k}: not an integer`);
  return v as number;
};
const intOrNull = (o: Obj, k: string, where: string): number | null =>
  o[k] === null || o[k] === undefined ? null : int(o, k, where);
const str = (o: Obj, k: string, where: string): string => {
  const v = o[k];
  if (typeof v !== 'string') fail(`${where}.${k}: not a string`);
  return v as string;
};
const strOrNull = (o: Obj, k: string, where: string): string | null =>
  o[k] === null || o[k] === undefined ? null : str(o, k, where);
const bool = (o: Obj, k: string, where: string, fallback?: boolean): boolean => {
  const v = o[k];
  if (v === undefined && fallback !== undefined) return fallback;
  if (typeof v !== 'boolean') fail(`${where}.${k}: not a boolean`);
  return v as boolean;
};
const minutes = (o: Obj, k: string, where: string): number => {
  const v = int(o, k, where);
  if (v < 0 || v > 1440) fail(`${where}.${k}: out of range`);
  return v;
};
const yyyymmdd = (o: Obj, k: string, where: string): number => {
  const v = int(o, k, where);
  if (v < 19000101 || v > 29991231) fail(`${where}.${k}: not a yyyymmdd date`);
  return v;
};
const isoDate = (o: Obj, k: string, where: string): ISODate => {
  const v = str(o, k, where);
  if (!/^\d{4}-\d{2}-\d{2}/.test(v)) fail(`${where}.${k}: not a date`);
  return v as ISODate;
};

function rows(env: Obj, key: string, required: boolean): Obj[] {
  const v = env[key];
  if (v === undefined && !required) return [];
  if (!Array.isArray(v)) fail(`${key}: missing or not an array`);
  const arr = v as unknown[];
  arr.forEach((r, i) => {
    if (!isObj(r)) fail(`${key}[${i}]: not an object`);
  });
  return arr as Obj[];
}

function uniqueIds<T extends { id: number }>(list: T[], where: string): Set<number> {
  const ids = new Set<number>();
  for (const r of list) {
    if (r.id <= 0 || ids.has(r.id)) fail(`${where}: duplicate or bad id ${r.id}`);
    ids.add(r.id);
  }
  return ids;
}

function uniquePairs(list: { a: number; b: number | string }[], where: string): void {
  const seen = new Set<string>();
  for (const { a, b } of list) {
    const k = `${a}|${b}`;
    if (seen.has(k)) fail(`${where}: duplicate (${k})`);
    seen.add(k);
  }
}

/** Parse + validate a backup file's text. Never touches the DB. */
export function parseBackup(text: string): ParseResult {
  let env: unknown;
  try {
    env = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return { kind: 'invalid', reason: 'not JSON' };
  }
  if (!isObj(env)) return { kind: 'invalid', reason: 'not an object' };
  const version = env.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return { kind: 'invalid', reason: 'no schemaVersion' };
  }
  if (version > EXPORT_SCHEMA_VERSION) return { kind: 'newer' };
  if (version < MIN_IMPORT_SCHEMA_VERSION) return version >= 1 ? { kind: 'tooOld' } : { kind: 'invalid', reason: 'bad schemaVersion' };

  try {
    const data = normalise(env, version);
    if (data.children.length === 0) return { kind: 'empty' };
    const ts = typeof env.exportedAt === 'string' ? new Date(env.exportedAt) : null;
    return {
      kind: 'ok',
      data,
      summary: {
        exportedAt: ts !== null && !Number.isNaN(ts.getTime()) ? ts : null,
        schemaVersion: version,
        kids: data.children.length,
        schedules: data.schedules.length,
        checklist: data.checklistItems.length,
        todos: data.todos.length,
      },
    };
  } catch (e) {
    if (e instanceof Invalid) return { kind: 'invalid', reason: e.message };
    throw e;
  }
}

function normalise(env: Obj, version: number): BackupData {
  // ── children: ≤ 4; colour follows the avatar (migration 004 rule) ──
  // Avatars may repeat: migration 003 gave every existing kid 'face-wink', and
  // the app runs fine with that — only the pickers avoid new duplicates.
  // An unknown avatar falls back to the one paired with the stored colour.
  const children: Child[] = rows(env, 'children', true).map((r, i) => {
    const w = `children[${i}]`;
    const rawAvatar = str(r, 'avatar', w);
    const ci = int(r, 'colorIndex', w);
    if (ci < 0 || ci > 5) fail(`${w}.colorIndex: out of range`);
    const avatar: AvatarKey = isAvatarKey(rawAvatar)
      ? rawAvatar
      : avatarKeyForColorIndex(ci as Child['colorIndex']);
    const name = str(r, 'name', w).trim();
    if (name.length === 0) fail(`${w}.name: empty`);
    return {
      id: int(r, 'id', w),
      name,
      avatar,
      colorIndex: colorIndexForAvatarKey(avatar),
      createdAt: str(r, 'createdAt', w) as ISODate,
    };
  });
  if (children.length > MAX_CHILDREN) fail(`children: more than ${MAX_CHILDREN}`);
  const kidIds = uniqueIds(children, 'children');

  // ── schedules ──
  const schedules: Schedule[] = rows(env, 'schedules', true).map((r, i) => {
    const w = `schedules[${i}]`;
    const type = str(r, 'type', w);
    if (!(SCHEDULE_TYPES as readonly string[]).includes(type)) fail(`${w}.type: unknown`);
    const childId = int(r, 'childId', w);
    if (!kidIds.has(childId)) fail(`${w}.childId: no such child`);
    const days = int(r, 'daysOfWeek', w);
    if (days < 0 || days > 127) fail(`${w}.daysOfWeek: out of range`);
    const hasV8 = version >= 5;
    // ADR-013 (v6): every kid member. Older files → the one kid.
    let memberIds = [childId];
    if (version >= 6) {
      const raw = r.memberIds;
      if (!Array.isArray(raw) || raw.length === 0) fail(`${w}.memberIds: missing`);
      const ids = (raw as unknown[]).map((v) => {
        if (typeof v !== 'number' || !Number.isInteger(v) || !kidIds.has(v)) fail(`${w}.memberIds: no such child`);
        return v as number;
      });
      if (new Set(ids).size !== ids.length) fail(`${w}.memberIds: duplicate`);
      if (!ids.includes(childId)) fail(`${w}.memberIds: main kid missing`);
      memberIds = [childId, ...ids.filter((id) => id !== childId).sort((a, b) => a - b)];
    }
    return {
      id: int(r, 'id', w),
      childId,
      memberIds,
      withGuardian: version >= 6 ? bool(r, 'withGuardian', w, false) : false,
      title: str(r, 'title', w),
      type: type as Schedule['type'],
      location: strOrNull(r, 'location', w),
      notes: strOrNull(r, 'notes', w),
      daysOfWeek: days,
      startMinutes: minutes(r, 'startMinutes', w),
      endMinutes: minutes(r, 'endMinutes', w),
      validFrom: isoDate(r, 'validFrom', w),
      validUntil: r.validUntil === null || r.validUntil === undefined ? null : isoDate(r, 'validUntil', w),
      notifyMinutesBefore: intOrNull(r, 'notifyMinutesBefore', w),
      needsPickup: bool(r, 'needsPickup', w, false),
      allDay: hasV8 ? bool(r, 'allDay', w, false) : false,
      notifyEndMinutesBefore: hasV8 ? intOrNull(r, 'notifyEndMinutesBefore', w) : null,
    };
  });
  const scheduleIds = uniqueIds(schedules, 'schedules');
  const ofSchedule = (r: Obj, w: string): number => {
    const id = int(r, 'scheduleId', w);
    if (!scheduleIds.has(id)) fail(`${w}.scheduleId: no such schedule`);
    return id;
  };

  // ── schedule exceptions ──
  const exceptions: ScheduleException[] = rows(env, 'exceptions', true).map((r, i) => {
    const w = `exceptions[${i}]`;
    const kind = str(r, 'kind', w);
    if (kind !== 'cancel' && kind !== 'modify') fail(`${w}.kind: unknown`);
    return {
      id: int(r, 'id', w),
      scheduleId: ofSchedule(r, w),
      date: isoDate(r, 'date', w),
      kind: kind as ScheduleException['kind'],
      overrideStartMinutes: intOrNull(r, 'overrideStartMinutes', w),
      overrideEndMinutes: intOrNull(r, 'overrideEndMinutes', w),
      overrideTitle: strOrNull(r, 'overrideTitle', w),
    };
  });
  uniqueIds(exceptions, 'exceptions');
  uniquePairs(exceptions.map((e) => ({ a: e.scheduleId, b: e.date })), 'exceptions');

  // ── per-kid notification settings (child_id is the key) ──
  const notificationSettings: NotificationSetting[] = rows(env, 'notificationSettings', true).map((r, i) => {
    const w = `notificationSettings[${i}]`;
    const childId = int(r, 'childId', w);
    if (!kidIds.has(childId)) fail(`${w}.childId: no such child`);
    return {
      childId,
      defaultMinutesBefore: int(r, 'defaultMinutesBefore', w),
      sound: bool(r, 'sound', w),
      enabled: bool(r, 'enabled', w),
    };
  });
  if (new Set(notificationSettings.map((n) => n.childId)).size !== notificationSettings.length) {
    fail('notificationSettings: duplicate childId');
  }

  // ── checklist items (v3: membership unknown → NULL anchor, 매번) ──
  const hasMembership = version >= 4;
  const checklistItems: ChecklistItem[] = rows(env, 'checklistItems', true).map((r, i) => {
    const w = `checklistItems[${i}]`;
    const label = str(r, 'label', w);
    if (label.length > LABEL_MAX) fail(`${w}.label: too long`);
    return {
      id: int(r, 'id', w),
      scheduleId: ofSchedule(r, w),
      label,
      sortOrder: int(r, 'sortOrder', w),
      // FROZEN legacy fields — written back verbatim so a round trip is exact;
      // checklist_completion stays the source of truth (ADR-006).
      isDone: bool(r, 'isDone', w, false),
      doneAt: intOrNull(r, 'doneAt', w),
      occurrenceDate: hasMembership && r.occurrenceDate !== null && r.occurrenceDate !== undefined
        ? yyyymmdd(r, 'occurrenceDate', w)
        : null,
      recurring: hasMembership ? bool(r, 'recurring', w, true) : true,
    };
  });
  const itemIds = uniqueIds(checklistItems, 'checklistItems');

  // ── todos (live is_done / done_at) ──
  const todos: Todo[] = rows(env, 'todos', true).map((r, i) => {
    const w = `todos[${i}]`;
    const title = str(r, 'title', w);
    if (title.length > TODO_TITLE_MAX) fail(`${w}.title: too long`);
    const childId = intOrNull(r, 'childId', w);
    if (childId !== null && !kidIds.has(childId)) fail(`${w}.childId: no such child`);
    return {
      id: int(r, 'id', w),
      childId,
      title,
      dueAt: int(r, 'dueAt', w),
      notifyMinutesBefore: intOrNull(r, 'notifyMinutesBefore', w),
      isDone: bool(r, 'isDone', w),
      doneAt: intOrNull(r, 'doneAt', w),
      createdAt: int(r, 'createdAt', w),
    };
  });
  uniqueIds(todos, 'todos');

  // ── per-occurrence logs ──
  const pickupLog: SchedulePickupLog[] = rows(env, 'pickupLog', true).map((r, i) => {
    const w = `pickupLog[${i}]`;
    return {
      id: int(r, 'id', w),
      scheduleId: ofSchedule(r, w),
      occurrenceDate: yyyymmdd(r, 'occurrenceDate', w),
      completedAt: int(r, 'completedAt', w),
    };
  });
  uniqueIds(pickupLog, 'pickupLog');
  uniquePairs(pickupLog.map((p) => ({ a: p.scheduleId, b: p.occurrenceDate })), 'pickupLog');

  const checklistCompletion: ChecklistCompletion[] = rows(env, 'checklistCompletion', true).map((r, i) => {
    const w = `checklistCompletion[${i}]`;
    const itemId = int(r, 'checklistItemId', w);
    if (!itemIds.has(itemId)) fail(`${w}.checklistItemId: no such item`);
    return {
      id: int(r, 'id', w),
      checklistItemId: itemId,
      occurrenceDate: yyyymmdd(r, 'occurrenceDate', w),
      completedAt: int(r, 'completedAt', w),
    };
  });
  uniqueIds(checklistCompletion, 'checklistCompletion');
  uniquePairs(
    checklistCompletion.map((c) => ({ a: c.checklistItemId, b: c.occurrenceDate })),
    'checklistCompletion',
  );

  // ── app settings (v4+). Device-specific guardian_* keys never come in. ──
  const appSettings = rows(env, 'appSettings', version >= 4)
    .map((r, i) => ({ key: str(r, 'key', `appSettings[${i}]`), value: str(r, 'value', `appSettings[${i}]`) }))
    .filter((s) => !s.key.startsWith(GUARDIAN_PREFIX));
  if (new Set(appSettings.map((s) => s.key)).size !== appSettings.length) fail('appSettings: duplicate key');

  return {
    children,
    schedules,
    exceptions,
    notificationSettings,
    checklistItems,
    todos,
    pickupLog,
    checklistCompletion,
    appSettings,
  };
}

// ─── Writing ────────────────────────────────────────────────────────────────

type Bind = string | number | null;

/** The slice of an expo-sqlite connection the import needs (testable). */
export interface ImportTxn {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: Bind[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params: Bind[]): Promise<T[]>;
}
export interface ImportDb {
  withExclusiveTransactionAsync(task: (txn: ImportTxn) => Promise<void>): Promise<void>;
}

const LEAF_FIRST = [
  'schedule_pickup_log',
  'checklist_completion',
  'checklist_items',
  'schedule_exceptions',
  'todos',
  'notification_settings',
  'schedule_children',
  'schedules',
  'children',
] as const;

const b = (v: boolean): number => (v ? 1 : 0);

/**
 * Replace every user table with `data`, ids preserved. All-or-nothing: any
 * error (including a failed foreign_key_check) rolls the whole thing back.
 * This device's `guardian_*` settings are kept.
 */
export async function importDb(db: ImportDb, data: BackupData): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const t of LEAF_FIRST) await txn.execAsync(`DELETE FROM ${t}`);
    await txn.runAsync("DELETE FROM app_settings WHERE key NOT LIKE ? ESCAPE '\\'", ['guardian\\_%']);

    for (const c of data.children) {
      await txn.runAsync(
        'INSERT INTO children (id, name, color_index, avatar, created_at) VALUES (?, ?, ?, ?, ?)',
        [c.id, c.name, c.colorIndex, c.avatar, c.createdAt],
      );
    }
    for (const s of data.schedules) {
      await txn.runAsync(
        `INSERT INTO schedules (id, child_id, title, type, location, notes, days_of_week,
           start_minutes, end_minutes, valid_from, valid_until, notify_minutes_before,
           needs_pickup, all_day, notify_end_minutes_before, with_guardian)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id, s.childId, s.title, s.type, s.location, s.notes, s.daysOfWeek,
          s.startMinutes, s.endMinutes, s.validFrom, s.validUntil, s.notifyMinutesBefore,
          b(s.needsPickup), b(s.allDay), s.notifyEndMinutesBefore, b(s.withGuardian),
        ],
      );
      // The v9 trigger already added the main kid; OR IGNORE keeps it idempotent.
      for (const childId of s.memberIds) {
        await txn.runAsync('INSERT OR IGNORE INTO schedule_children (schedule_id, child_id) VALUES (?, ?)', [s.id, childId]);
      }
    }
    for (const e of data.exceptions) {
      await txn.runAsync(
        `INSERT INTO schedule_exceptions (id, schedule_id, date, kind,
           override_start_minutes, override_end_minutes, override_title)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [e.id, e.scheduleId, e.date, e.kind, e.overrideStartMinutes, e.overrideEndMinutes, e.overrideTitle],
      );
    }
    for (const n of data.notificationSettings) {
      await txn.runAsync(
        'INSERT INTO notification_settings (child_id, default_minutes_before, sound, enabled) VALUES (?, ?, ?, ?)',
        [n.childId, n.defaultMinutesBefore, b(n.sound), b(n.enabled)],
      );
    }
    for (const c of data.checklistItems) {
      await txn.runAsync(
        `INSERT INTO checklist_items (id, schedule_id, label, sort_order, is_done, done_at,
           occurrence_date, recurring)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.scheduleId, c.label, c.sortOrder, b(c.isDone), c.doneAt, c.occurrenceDate, b(c.recurring)],
      );
    }
    for (const t of data.todos) {
      await txn.runAsync(
        `INSERT INTO todos (id, child_id, title, due_at, notify_minutes_before, is_done, done_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.id, t.childId, t.title, t.dueAt, t.notifyMinutesBefore, b(t.isDone), t.doneAt, t.createdAt],
      );
    }
    for (const p of data.pickupLog) {
      await txn.runAsync(
        'INSERT INTO schedule_pickup_log (id, schedule_id, occurrence_date, completed_at) VALUES (?, ?, ?, ?)',
        [p.id, p.scheduleId, p.occurrenceDate, p.completedAt],
      );
    }
    for (const c of data.checklistCompletion) {
      await txn.runAsync(
        'INSERT INTO checklist_completion (id, checklist_item_id, occurrence_date, completed_at) VALUES (?, ?, ?, ?)',
        [c.id, c.checklistItemId, c.occurrenceDate, c.completedAt],
      );
    }
    for (const s of data.appSettings) {
      await txn.runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?)', [s.key, s.value]);
    }

    // FK enforcement is off on this connection — verify before COMMIT.
    const broken = await txn.getAllAsync<unknown>('PRAGMA foreign_key_check', []);
    if (broken.length > 0) throw new Error('import: broken references');
  });
}
