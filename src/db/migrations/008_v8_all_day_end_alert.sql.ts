// v8 — ADR-007 §8: all-day events + "before end" alerts.
//
// SAFETY MODEL: **atomicity-gated** (same as v6/v7).
//   - The version-gated runner applies this at most once per device.
//   - Both ALTERs + `PRAGMA user_version = 8` share one BEGIN IMMEDIATE…COMMIT
//     (withTransactionAsync fallback). A crash mid-way rolls everything back,
//     leaving user_version at 7 and neither column present.
//   - `ADD COLUMN` has no IF NOT EXISTS in SQLite; the version gate is what
//     guarantees single application.
//
// ADDITIVE ONLY — no destructive ALTER, no DROP, no backfill needed:
//   1. schedules.all_day INTEGER NOT NULL DEFAULT 0
//        1 = all-day event. Stored with the canonical range start_minutes = 0,
//        end_minutes = 1440 (both columns stay NOT NULL). Existing rows → 0.
//   2. schedules.notify_end_minutes_before INTEGER (NULL = no alert)
//        Minutes before the END of each occurrence. The existing
//        notify_minutes_before stays the "before start" alert. Existing rows → NULL.

export const migration008 = `
ALTER TABLE schedules ADD COLUMN all_day INTEGER NOT NULL DEFAULT 0;

ALTER TABLE schedules ADD COLUMN notify_end_minutes_before INTEGER;
`;
