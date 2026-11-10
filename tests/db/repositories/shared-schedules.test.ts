// ADR-013 shared schedules — members, main kid, kid removal (real SQLite).

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../../src/db/migrations';
import * as childrenRepo from '../../../src/db/repositories/children';
import * as schedulesRepo from '../../../src/db/repositories/schedules';
import type { ISODate } from '../../../src/domain/types';

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
  return resolve(dir, `shared-repo-${randomUUID()}.db`);
}

const VALID_FROM = '2026-01-01' as ISODate;

async function setup() {
  const path = tmpDbPath();
  const real = new DatabaseSync(path);
  const db = wrap(real);
  await runMigrations(db as never);
  const a = await childrenRepo.create(db as never, { name: '민준', colorIndex: 0, avatar: 'face-wink' } as never);
  const b = await childrenRepo.create(db as never, { name: '서연', colorIndex: 1, avatar: 'face-dizzy' } as never);
  const c = await childrenRepo.create(db as never, { name: '도윤', colorIndex: 2, avatar: 'face-cool' } as never);
  const cleanup = () => {
    real.close();
    for (const s of ['', '-wal', '-shm', '-journal']) if (existsSync(path + s)) rmSync(path + s);
  };
  return { db, real, a: a.id, b: b.id, c: c.id, cleanup };
}

const base = {
  title: '가족 모임',
  type: 'other' as const,
  location: null,
  notes: null,
  daysOfWeek: 64,
  startMinutes: 18 * 60 + 30,
  endMinutes: 20 * 60 + 30,
  validFrom: VALID_FROM,
  validUntil: null,
  notifyMinutesBefore: null,
};

describe('shared schedules (ADR-013)', () => {
  test('create stores every member (main first, then by id) + withGuardian', async () => {
    const t = await setup();
    try {
      const s = await schedulesRepo.create(t.db as never, { ...base, childId: t.c, memberIds: [t.c, t.a, t.b], withGuardian: true });
      expect(s.memberIds).toEqual([t.c, t.a, t.b]);
      expect(s.childId).toBe(t.c);
      expect(s.withGuardian).toBe(true);
      const [listed] = await schedulesRepo.list(t.db as never);
      expect(listed?.memberIds).toEqual([t.c, t.a, t.b]);
      // A schedule made without memberIds has just its main kid.
      const solo = await schedulesRepo.create(t.db as never, { ...base, childId: t.b });
      expect(solo.memberIds).toEqual([t.b]);
      expect(solo.withGuardian).toBe(false);
      expect((await schedulesRepo.listByChild(t.db as never, t.b)).map((x) => x.id).sort()).toEqual([s.id, solo.id].sort());
    } finally {
      t.cleanup();
    }
  });

  test('update members: unchecking the main kid moves it to the next member', async () => {
    const t = await setup();
    try {
      const s = await schedulesRepo.create(t.db as never, { ...base, childId: t.a, memberIds: [t.a, t.b] });
      const u = await schedulesRepo.update(t.db as never, s.id, { memberIds: [t.b, t.c], withGuardian: true });
      expect(u.childId).toBe(t.b);
      expect(u.memberIds).toEqual([t.b, t.c]);
      expect(u.withGuardian).toBe(true);
      // Main kid still a member → stays main.
      const v = await schedulesRepo.update(t.db as never, s.id, { memberIds: [t.c, t.b, t.a] });
      expect(v.childId).toBe(t.b);
      expect(v.memberIds).toEqual([t.b, t.a, t.c]);
    } finally {
      t.cleanup();
    }
  });

  test('removing a kid keeps the shared schedule (new main kid) and deletes their solo ones', async () => {
    const t = await setup();
    try {
      const shared = await schedulesRepo.create(t.db as never, { ...base, childId: t.a, memberIds: [t.a, t.c] });
      const solo = await schedulesRepo.create(t.db as never, { ...base, title: '수학', childId: t.a });
      const other = await schedulesRepo.create(t.db as never, { ...base, title: '피아노', childId: t.b, memberIds: [t.b, t.a] });
      expect(await childrenRepo.countSchedulesOnlyFor(t.db as never, t.a)).toBe(1);
      await childrenRepo.remove(t.db as never, t.a);
      const left = await schedulesRepo.list(t.db as never);
      expect(left.map((s) => s.id).sort()).toEqual([shared.id, other.id].sort());
      expect(left.find((s) => s.id === shared.id)).toMatchObject({ childId: t.c, memberIds: [t.c] });
      expect(left.find((s) => s.id === other.id)).toMatchObject({ childId: t.b, memberIds: [t.b] });
      expect(left.find((s) => s.id === solo.id)).toBeUndefined();
    } finally {
      t.cleanup();
    }
  });
});
