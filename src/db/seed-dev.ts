import type { SQLiteDatabase } from 'expo-sqlite';

import type { ScheduleType } from '../domain/types';

/**
 * Inserts a fixed demo dataset (3 children + 8 schedules + 1 exception + per-child
 * notification settings) so the daily/weekly grids have something visible during
 * development. Idempotent: skips entirely if the children table is non-empty,
 * so a developer's own test data is never overwritten.
 *
 * NEVER call this in production. The single caller in app/_layout.tsx must guard
 * with `if (__DEV__)` so the function is dead-code-eliminated from release bundles.
 */
export async function seedDevData(db: SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM children',
  );
  if ((existing?.c ?? 0) > 0) return;

  await db.withTransactionAsync(async () => {
    const minjun = await insertChild(db, '민준', 0);
    const seoyeon = await insertChild(db, '서연', 2);
    const doyoon = await insertChild(db, '도윤', 4);

    await insertSchedule(db, minjun, '학교', 'school', MON_FRI, 540, 870, null);
    await insertSchedule(db, minjun, '영어학원', 'academy', MWF, 960, 1050, 30);
    await insertSchedule(db, minjun, '수영', 'activity', SAT, 600, 660, 30);

    await insertSchedule(db, seoyeon, '학교', 'school', MON_FRI, 540, 780, null);
    const seoyeonPiano = await insertSchedule(
      db,
      seoyeon,
      '피아노',
      'activity',
      TUE_THU,
      1020,
      1080,
      30,
    );
    await insertSchedule(db, seoyeon, '미술학원', 'academy', SAT, 840, 930, 30);

    await insertSchedule(db, doyoon, '어린이집', 'school', MON_FRI, 540, 960, null);
    await insertSchedule(db, doyoon, '발레', 'activity', WED, 1020, 1080, 30);

    // One cancellation to seed the exception path: 서연 피아노 on Thursday 2026-06-04.
    await db.runAsync(
      `INSERT INTO schedule_exceptions (schedule_id, date, kind) VALUES (?, ?, ?)`,
      [seoyeonPiano, '2026-06-04', 'cancel'],
    );

    for (const childId of [minjun, seoyeon, doyoon]) {
      await db.runAsync(
        `INSERT INTO notification_settings (child_id, default_minutes_before, sound, enabled)
         VALUES (?, ?, ?, ?)`,
        [childId, 15, 1, 1],
      );
    }
  });
}

// Day-of-week bitmask helpers — kept local to this file so the seed reads top-to-bottom.
// Mon=1<<0, Tue=1<<1, Wed=1<<2, Thu=1<<3, Fri=1<<4, Sat=1<<5, Sun=1<<6.
const MON_FRI = 1 | 2 | 4 | 8 | 16;
const MWF = 1 | 4 | 16;
const TUE_THU = 2 | 8;
const SAT = 32;
const WED = 4;

const VALID_FROM = '2026-05-01';
const CREATED_AT = '2026-05-01';

async function insertChild(
  db: SQLiteDatabase,
  name: string,
  colorIndex: number,
): Promise<number> {
  const r = await db.runAsync(
    `INSERT INTO children (name, color_index, created_at) VALUES (?, ?, ?)`,
    [name, colorIndex, CREATED_AT],
  );
  return r.lastInsertRowId;
}

async function insertSchedule(
  db: SQLiteDatabase,
  childId: number,
  title: string,
  type: ScheduleType,
  daysOfWeek: number,
  startMinutes: number,
  endMinutes: number,
  notifyMinutesBefore: number | null,
): Promise<number> {
  const r = await db.runAsync(
    `INSERT INTO schedules
       (child_id, title, type, days_of_week, start_minutes, end_minutes, valid_from, notify_minutes_before)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      childId,
      title,
      type,
      daysOfWeek,
      startMinutes,
      endMinutes,
      VALID_FROM,
      notifyMinutesBefore,
    ],
  );
  return r.lastInsertRowId;
}
