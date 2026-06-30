// State store tests for useChecklistStore.

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../src/db/migrations';
import * as childrenRepo from '../../src/db/repositories/children';
import * as schedulesRepo from '../../src/db/repositories/schedules';
import { useChecklistStore } from '../../src/state/checklist-store';
import { useChecklistCompletionStore } from '../../src/state/checklist-completion-store';
import type { ISODate } from '../../src/domain/types';

interface MinimalDb {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  runAsync(sql: string, params?: unknown[]): Promise<{ lastInsertRowId: number; changes: number }>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}

function wrap(real: DatabaseSync): MinimalDb {
  return {
    async execAsync(sql) { real.exec(sql); },
    async getFirstAsync<T>(sql: string, params: unknown[] = []) {
      const row = real.prepare(sql).get(...(params as never[])) as unknown;
      return (row as T) ?? null;
    },
    async getAllAsync<T>(sql: string, params: unknown[] = []) {
      return real.prepare(sql).all(...(params as never[])) as T[];
    },
    async runAsync(sql, params = []) {
      const result = real.prepare(sql).run(...(params as never[]));
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async withTransactionAsync(fn) {
      real.exec('BEGIN');
      try { await fn(); real.exec('COMMIT'); }
      catch (e) { real.exec('ROLLBACK'); throw e; }
    },
    async closeAsync() { real.close(); },
  };
}

function tmpDbPath(): string {
  const dir = resolve(tmpdir(), 'schedulapp-tests');
  mkdirSync(dir, { recursive: true });
  return resolve(dir, `checklist-store-${randomUUID()}.db`);
}

const VALID_FROM = '2026-01-01' as ISODate;

async function makeSchedule(db: MinimalDb, childId: number): Promise<number> {
  const s = await schedulesRepo.create(db as never, {
    childId,
    title: '수영',
    type: 'activity',
    location: null,
    notes: null,
    daysOfWeek: 0b00100000,
    startMinutes: 600,
    endMinutes: 660,
    validFrom: VALID_FROM,
    validUntil: null,
    notifyMinutesBefore: null,
  });
  return s.id;
}

describe('useChecklistStore', () => {
  let dbPath: string;
  let real: DatabaseSync;
  let db: MinimalDb;
  let scheduleA: number;
  let scheduleB: number;

  beforeEach(async () => {
    dbPath = tmpDbPath();
    real = new DatabaseSync(dbPath);
    db = wrap(real);
    await runMigrations(db as never);
    real.exec('PRAGMA foreign_keys = ON');

    const child = await childrenRepo.create(db as never, { name: '민준', colorIndex: 0 });
    scheduleA = await makeSchedule(db, child.id);
    scheduleB = await makeSchedule(db, child.id);

    useChecklistStore.setState({ itemsByScheduleId: new Map(), isLoaded: false });
    useChecklistCompletionStore.setState({ completionMap: new Map(), isLoaded: false });
  });

  afterEach(() => {
    try { real.close(); } catch { /* already closed */ }
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  });

  test('initial state: empty map, isLoaded=false', () => {
    const state = useChecklistStore.getState();
    expect(state.itemsByScheduleId.size).toBe(0);
    expect(state.isLoaded).toBe(false);
  });

  test('load() hydrates from DB and sets isLoaded=true', async () => {
    real.prepare(
      'INSERT INTO checklist_items (schedule_id, label, sort_order) VALUES (?, ?, ?)',
    ).run(scheduleA, '수영가방', 0);
    real.prepare(
      'INSERT INTO checklist_items (schedule_id, label, sort_order) VALUES (?, ?, ?)',
    ).run(scheduleA, '수건', 1);

    await useChecklistStore.getState().load(db as never);

    const state = useChecklistStore.getState();
    expect(state.isLoaded).toBe(true);
    const items = state.itemsByScheduleId.get(scheduleA);
    expect(items).toHaveLength(2);
    expect(items?.[0]?.label).toBe('수영가방');
    expect(items?.[1]?.label).toBe('수건');
  });

  test('add() inserts and updates Map entry for schedule', async () => {
    await useChecklistStore.getState().load(db as never);
    const item = await useChecklistStore.getState().add(db as never, {
      scheduleId: scheduleA,
      label: '간식',
    });

    expect(item.id).toBeGreaterThan(0);
    const items = useChecklistStore.getState().itemsByScheduleId.get(scheduleA);
    expect(items).toHaveLength(1);
    expect(items?.[0]?.label).toBe('간식');
  });

  test('add() defaults to recurring (occurrenceDate null) when omitted', async () => {
    await useChecklistStore.getState().load(db as never);
    const item = await useChecklistStore.getState().add(db as never, {
      scheduleId: scheduleA,
      label: '반복준비물',
    });
    expect(item.occurrenceDate).toBeNull();
    const stored = useChecklistStore.getState().itemsByScheduleId.get(scheduleA)?.[0];
    expect(stored?.occurrenceDate).toBeNull();
  });

  test('add() binds to a date when occurrenceDate is supplied (day-specific)', async () => {
    await useChecklistStore.getState().load(db as never);
    const item = await useChecklistStore.getState().add(db as never, {
      scheduleId: scheduleA,
      label: '당일준비물',
      occurrenceDate: 20260602,
    });
    expect(item.occurrenceDate).toBe(20260602);
    const stored = useChecklistStore.getState().itemsByScheduleId.get(scheduleA)?.[0];
    expect(stored?.occurrenceDate).toBe(20260602);
  });

  test('updateOne() can flip membership via occurrenceDate', async () => {
    await useChecklistStore.getState().load(db as never);
    const item = await useChecklistStore.getState().add(db as never, {
      scheduleId: scheduleA,
      label: '플립',
      occurrenceDate: 20260602,
    });
    await useChecklistStore.getState().updateOne(db as never, item.id, {
      occurrenceDate: null,
    });
    const stored = useChecklistStore.getState().itemsByScheduleId.get(scheduleA)?.[0];
    expect(stored?.occurrenceDate).toBeNull();
  });

  test('updateOne() mutates label in store', async () => {
    await useChecklistStore.getState().load(db as never);
    const item = await useChecklistStore.getState().add(db as never, {
      scheduleId: scheduleA,
      label: '원본',
    });

    await useChecklistStore.getState().updateOne(db as never, item.id, { label: '수정됨' });

    const items = useChecklistStore.getState().itemsByScheduleId.get(scheduleA);
    expect(items?.[0]?.label).toBe('수정됨');
  });

  test('removeOne() removes item from store', async () => {
    await useChecklistStore.getState().load(db as never);
    const item = await useChecklistStore.getState().add(db as never, {
      scheduleId: scheduleA,
      label: '제거대상',
    });

    expect(useChecklistStore.getState().itemsByScheduleId.get(scheduleA)).toHaveLength(1);

    await useChecklistStore.getState().removeOne(db as never, item.id);
    expect(useChecklistStore.getState().itemsByScheduleId.get(scheduleA)).toHaveLength(0);
  });

  test('toggleDone() writes per-occurrence completion (v6), NOT is_done', async () => {
    await useChecklistStore.getState().load(db as never);
    await useChecklistCompletionStore.getState().load(db as never);
    const item = await useChecklistStore.getState().add(db as never, {
      scheduleId: scheduleA,
      label: '토글',
    });

    const D = 20260602;
    const key = `${item.id}|${D}`;

    // Check on day D → completion row exists for (item, D).
    await useChecklistStore.getState().toggleDone(db as never, item.id, D);
    expect(useChecklistCompletionStore.getState().completionMap.has(key)).toBe(true);
    const rowsAfterCheck = real
      .prepare('SELECT * FROM checklist_completion WHERE checklist_item_id = ? AND occurrence_date = ?')
      .all(item.id, D);
    expect(rowsAfterCheck).toHaveLength(1);

    // is_done is FROZEN — never written by toggleDone.
    const tmpl = real
      .prepare('SELECT is_done, done_at FROM checklist_items WHERE id = ?')
      .get(item.id) as { is_done: number; done_at: number | null };
    expect(tmpl.is_done).toBe(0);
    expect(tmpl.done_at).toBeNull();

    // Toggle again on D → completion row removed.
    await useChecklistStore.getState().toggleDone(db as never, item.id, D);
    expect(useChecklistCompletionStore.getState().completionMap.has(key)).toBe(false);
  });

  test('toggleDone() is per-occurrence: checking day D leaves day D+1 unchecked', async () => {
    await useChecklistStore.getState().load(db as never);
    await useChecklistCompletionStore.getState().load(db as never);
    const item = await useChecklistStore.getState().add(db as never, {
      scheduleId: scheduleA,
      label: '준비물',
    });

    const D = 20260602;
    const D1 = 20260603;
    await useChecklistStore.getState().toggleDone(db as never, item.id, D);

    const map = useChecklistCompletionStore.getState().completionMap;
    expect(map.has(`${item.id}|${D}`)).toBe(true);
    expect(map.has(`${item.id}|${D1}`)).toBe(false);
  });

  test('reorder() applies new sort order', async () => {
    await useChecklistStore.getState().load(db as never);
    const a = await useChecklistStore.getState().add(db as never, { scheduleId: scheduleA, label: 'A' });
    const b = await useChecklistStore.getState().add(db as never, { scheduleId: scheduleA, label: 'B' });
    const c = await useChecklistStore.getState().add(db as never, { scheduleId: scheduleA, label: 'C' });

    await useChecklistStore.getState().reorder(db as never, scheduleA, [c.id, a.id, b.id]);

    const items = useChecklistStore.getState().itemsByScheduleId.get(scheduleA);
    expect(items?.map((i) => i.label)).toEqual(['C', 'A', 'B']);
  });

  test('selector reference stability across unmutated reads', async () => {
    await useChecklistStore.getState().load(db as never);
    await useChecklistStore.getState().add(db as never, { scheduleId: scheduleA, label: 'x' });

    const map1 = useChecklistStore.getState().itemsByScheduleId;
    const map2 = useChecklistStore.getState().itemsByScheduleId;
    expect(map1).toBe(map2);

    await useChecklistStore.getState().add(db as never, { scheduleId: scheduleB, label: 'y' });
    const map3 = useChecklistStore.getState().itemsByScheduleId;
    expect(map3).not.toBe(map1);
  });
});
