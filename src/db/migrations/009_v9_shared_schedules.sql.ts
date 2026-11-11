// v9 — ADR-013: one schedule shared by several kids (+ the guardian).
//
// SAFETY MODEL: **atomicity-gated** (same as v6–v8). Everything below plus
// `PRAGMA user_version = 9` runs in one BEGIN IMMEDIATE…COMMIT; a crash rolls
// it all back.
//
// ADDITIVE ONLY:
//   1. schedule_children(schedule_id, child_id) — every kid member, the main
//      kid (`schedules.child_id`) included. Both FKs cascade.
//   2. Backfill one row per schedule, JOINed on children so a stray orphan row
//      can't fail the FK check and wedge the migration on every launch.
//   3. Triggers keep "the main kid is a member" true for any INSERT / child_id
//      UPDATE, including ones that bypass the repository (seed, import, tests).
//   4. schedules.with_guardian INTEGER NOT NULL DEFAULT 0.
//   `schedules.child_id` stays (NOT NULL, the main kid) — dropping it would
//   mean rebuilding the table.

export const migration009 = `
CREATE TABLE IF NOT EXISTS schedule_children (
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  PRIMARY KEY (schedule_id, child_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_children_child ON schedule_children(child_id);

INSERT OR IGNORE INTO schedule_children (schedule_id, child_id)
  SELECT s.id, s.child_id FROM schedules s JOIN children c ON c.id = s.child_id;

CREATE TRIGGER IF NOT EXISTS trg_schedules_main_member_insert
AFTER INSERT ON schedules
BEGIN
  INSERT OR IGNORE INTO schedule_children (schedule_id, child_id) VALUES (NEW.id, NEW.child_id);
END;

CREATE TRIGGER IF NOT EXISTS trg_schedules_main_member_update
AFTER UPDATE OF child_id ON schedules
BEGIN
  INSERT OR IGNORE INTO schedule_children (schedule_id, child_id) VALUES (NEW.id, NEW.child_id);
END;

ALTER TABLE schedules ADD COLUMN with_guardian INTEGER NOT NULL DEFAULT 0;
`;
