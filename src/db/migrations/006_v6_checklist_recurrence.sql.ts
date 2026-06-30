// v6 — PREP-RECUR: per-occurrence checklist completion + recurrence membership.
//
// SAFETY MODEL: **atomicity-gated**, NOT statement-idempotency.
//   - The version-gated runner (migrations/index.ts:38) only applies a migration
//     when its version > current user_version, so this file runs at most once per
//     device in normal operation.
//   - All statements + the `PRAGMA user_version = 6` bump share a single
//     BEGIN IMMEDIATE…COMMIT (index.ts:49-53), with a withTransactionAsync
//     fallback (index.ts:65-68). A crash mid-migration ROLLs back everything,
//     leaving user_version at 5 and zero v6 artifacts.
//   - This is why `ALTER TABLE … ADD COLUMN` is safe here even though SQLite has
//     NO `ADD COLUMN IF NOT EXISTS`: the runner guarantees single-application via
//     the version gate, not via per-statement idempotency.
//
// ADDITIVE ONLY — no destructive ALTER, no DROP.
//
// WHAT THIS DOES (ralplan-ios-launch-v2 Phase 3, LOCKED rows 259-265):
//   1. checklist_completion — single source of truth for ALL completion
//      (recurring, day-specific, non-recurring). Mirrors schedule_pickup_log's
//      shape/constraints verbatim: occurrence_date is `yyyymmdd INTEGER`
//      (e.g. 20260630), NOT TEXT; UNIQUE(checklist_item_id, occurrence_date)
//      makes markComplete an idempotent INSERT OR IGNORE.
//   2. checklist_items.occurrence_date (nullable, DEFAULT NULL):
//        NULL = recurring (every occurrence);  set = day-specific (that date only).
//   3. M1 backfill: existing rows stay occurrence_date = NULL (preserve current
//      recurring behavior); each existing is_done = 1 row gets exactly one
//      completion row at `occurrence_date = today` (completed-for-today only).
//
// FROZEN (NOT dropped): checklist_items.is_done / done_at remain in the schema.
// They are no longer written and never read for completion as of v6; a later v7
// will drop them after a data-export step. Do not remove them here.
//
// The "today" (yyyymmdd int) and "now" (epoch ms) used by the backfill are
// injected as parameters so the migration is a pure function of its inputs and
// tests can pin a fixed date deterministically. The registered production value
// computes them from the local clock below (no UI-layer import — the migration
// layer must not depend on src/ui).

/**
 * Builds the v6 migration SQL. `today` is a `yyyymmdd` integer (e.g. 20260630)
 * and `nowMs` is an epoch-millisecond timestamp. Both feed only the M1 backfill;
 * the DDL is identical regardless of input.
 */
export function buildMigration006(today: number, nowMs: number): string {
  return `
CREATE TABLE IF NOT EXISTS checklist_completion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checklist_item_id INTEGER NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  occurrence_date INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  UNIQUE(checklist_item_id, occurrence_date)
);
CREATE INDEX IF NOT EXISTS idx_checklist_completion_item_date
  ON checklist_completion(checklist_item_id, occurrence_date);

ALTER TABLE checklist_items ADD COLUMN occurrence_date INTEGER;

INSERT INTO checklist_completion (checklist_item_id, occurrence_date, completed_at)
SELECT id, ${today}, ${nowMs} FROM checklist_items WHERE is_done = 1;
`;
}

/**
 * Local-clock "today" as a `yyyymmdd` integer, computed in local time to match
 * the app's `todayIso()` convention (src/ui/utils/date.ts) without importing the
 * UI layer into the db layer.
 */
function localTodayYyyymmdd(now: Date): number {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  return y * 10000 + m * 100 + d;
}

// Production value: backfill stamps completion at the local "today" the device
// first runs v6. The factory is invoked once at module load.
const productionNow = new Date();
export const migration006 = buildMigration006(
  localTodayYyyymmdd(productionNow),
  productionNow.getTime(),
);
