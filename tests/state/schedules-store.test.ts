// State store tests for useSchedulesStore.

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../src/db/migrations';
import * as childrenRepo from '../../src/db/repositories/children';
import { useSchedulesStore } from '../../src/state/schedules-store';
import type { ISODate } from '../../src/domain/types';

// ---------------------------------------------------------------------------
// MinimalDb shim
// ---------------------------------------------------------------------------
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
  return resolve(dir, `schedules-store-${randomUUID()}.db`);
}

const VALID_FROM = '2026-01-01' as ISODate;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('useSchedulesStore', () => {
  let dbPath: string;
  let real: DatabaseSync;
  let db: MinimalDb;
  let childId: number;

  beforeEach(async () => {
    dbPath = tmpDbPath();
    real = new DatabaseSync(dbPath);
    db = wrap(real);
    await runMigrations(db as never);
    real.exec('PRAGMA foreign_keys = ON');

    const child = await childrenRepo.create(db as never, { name: '테스트자녀', colorIndex: 0 });
    childId = child.id;

    // Reset store state between tests
    useSchedulesStore.setState({ schedules: [], exceptions: [], isLoaded: false });
  });

  afterEach(() => {
    try { real.close(); } catch { /* already closed */ }
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  });

  test('initial state: schedules=[], exceptions=[], isLoaded=false', () => {
    const state = useSchedulesStore.getState();
    expect(state.schedules).toEqual([]);
    expect(state.exceptions).toEqual([]);
    expect(state.isLoaded).toBe(false);
  });

  test('load() fetches schedules and exceptions, sets isLoaded=true', async () => {
    await useSchedulesStore.getState().load(db as never);

    const state = useSchedulesStore.getState();
    expect(state.isLoaded).toBe(true);
    expect(state.schedules).toEqual([]);
    expect(state.exceptions).toEqual([]);
  });

  test('addSchedule() inserts schedule and updates store', async () => {
    await useSchedulesStore.getState().load(db as never);
    const schedule = await useSchedulesStore.getState().addSchedule(db as never, {
      childId,
      title: '학교',
      type: 'school',
      location: null,
      notes: null,
      daysOfWeek: 0b11111,
      startMinutes: 540,
      endMinutes: 870,
      validFrom: VALID_FROM,
      validUntil: null,
      notifyMinutesBefore: null,
    });

    expect(schedule.id).toBeGreaterThan(0);
    expect(schedule.title).toBe('학교');

    const state = useSchedulesStore.getState();
    expect(state.schedules).toHaveLength(1);
    expect(state.schedules[0]?.id).toBe(schedule.id);
  });

  test('updateSchedule() mutates schedule in store', async () => {
    await useSchedulesStore.getState().load(db as never);
    const schedule = await useSchedulesStore.getState().addSchedule(db as never, {
      childId, title: 'original', type: 'other', location: null, notes: null,
      daysOfWeek: 1, startMinutes: 540, endMinutes: 600, validFrom: VALID_FROM,
      validUntil: null, notifyMinutesBefore: null,
    });

    await useSchedulesStore.getState().updateSchedule(db as never, schedule.id, { title: 'updated' });

    const state = useSchedulesStore.getState();
    const found = state.schedules.find((s) => s.id === schedule.id);
    expect(found?.title).toBe('updated');
  });

  test('removeSchedule() removes from store', async () => {
    await useSchedulesStore.getState().load(db as never);
    const schedule = await useSchedulesStore.getState().addSchedule(db as never, {
      childId, title: '삭제될 일정', type: 'other', location: null, notes: null,
      daysOfWeek: 1, startMinutes: 540, endMinutes: 600, validFrom: VALID_FROM,
      validUntil: null, notifyMinutesBefore: null,
    });

    expect(useSchedulesStore.getState().schedules).toHaveLength(1);

    await useSchedulesStore.getState().removeSchedule(db as never, schedule.id);

    expect(useSchedulesStore.getState().schedules).toHaveLength(0);
  });

  test('addException() inserts exception and updates store', async () => {
    await useSchedulesStore.getState().load(db as never);
    const schedule = await useSchedulesStore.getState().addSchedule(db as never, {
      childId, title: '피아노', type: 'activity', location: null, notes: null,
      daysOfWeek: 0b01010, startMinutes: 1020, endMinutes: 1080, validFrom: VALID_FROM,
      validUntil: null, notifyMinutesBefore: null,
    });

    const ex = await useSchedulesStore.getState().addException(db as never, {
      scheduleId: schedule.id,
      date: '2026-06-04' as ISODate,
      kind: 'cancel',
      overrideStartMinutes: null,
      overrideEndMinutes: null,
      overrideTitle: null,
    });

    expect(ex.scheduleId).toBe(schedule.id);

    const state = useSchedulesStore.getState();
    expect(state.exceptions).toHaveLength(1);
    expect(state.exceptions[0]?.date).toBe('2026-06-04');
  });

  test('updateException() mutates exception in store', async () => {
    await useSchedulesStore.getState().load(db as never);
    const schedule = await useSchedulesStore.getState().addSchedule(db as never, {
      childId, title: '피아노', type: 'activity', location: null, notes: null,
      daysOfWeek: 0b01010, startMinutes: 1020, endMinutes: 1080, validFrom: VALID_FROM,
      validUntil: null, notifyMinutesBefore: null,
    });

    const ex = await useSchedulesStore.getState().addException(db as never, {
      scheduleId: schedule.id,
      date: '2026-06-04' as ISODate,
      kind: 'cancel',
      overrideStartMinutes: null, overrideEndMinutes: null, overrideTitle: null,
    });

    await useSchedulesStore.getState().updateException(db as never, ex.id, {
      kind: 'modify',
      overrideTitle: '변경됨',
    });

    const state = useSchedulesStore.getState();
    const found = state.exceptions.find((e) => e.id === ex.id);
    expect(found?.kind).toBe('modify');
    expect(found?.overrideTitle).toBe('변경됨');
  });

  test('removeException() removes from store', async () => {
    await useSchedulesStore.getState().load(db as never);
    const schedule = await useSchedulesStore.getState().addSchedule(db as never, {
      childId, title: '피아노', type: 'activity', location: null, notes: null,
      daysOfWeek: 0b01010, startMinutes: 1020, endMinutes: 1080, validFrom: VALID_FROM,
      validUntil: null, notifyMinutesBefore: null,
    });

    const ex = await useSchedulesStore.getState().addException(db as never, {
      scheduleId: schedule.id,
      date: '2026-06-04' as ISODate,
      kind: 'cancel',
      overrideStartMinutes: null, overrideEndMinutes: null, overrideTitle: null,
    });

    await useSchedulesStore.getState().removeException(db as never, ex.id);

    expect(useSchedulesStore.getState().exceptions).toHaveLength(0);
  });

  test('selector reference stability: no mutation keeps same reference', async () => {
    await useSchedulesStore.getState().load(db as never);

    const schedules1 = useSchedulesStore.getState().schedules;
    const schedules2 = useSchedulesStore.getState().schedules;
    expect(schedules1).toBe(schedules2);

    const exceptions1 = useSchedulesStore.getState().exceptions;
    const exceptions2 = useSchedulesStore.getState().exceptions;
    expect(exceptions1).toBe(exceptions2);
  });

  test('selector reference changes after mutation', async () => {
    await useSchedulesStore.getState().load(db as never);
    const beforeSchedules = useSchedulesStore.getState().schedules;

    await useSchedulesStore.getState().addSchedule(db as never, {
      childId, title: '새 일정', type: 'other', location: null, notes: null,
      daysOfWeek: 1, startMinutes: 540, endMinutes: 600, validFrom: VALID_FROM,
      validUntil: null, notifyMinutesBefore: null,
    });

    const afterSchedules = useSchedulesStore.getState().schedules;
    expect(afterSchedules).not.toBe(beforeSchedules);
  });
});
