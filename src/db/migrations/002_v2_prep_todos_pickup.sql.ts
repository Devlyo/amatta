export const migration002 = `
ALTER TABLE schedules ADD COLUMN needs_pickup INTEGER NOT NULL DEFAULT 0;

CREATE TABLE checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (length(label) <= 60),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_done INTEGER NOT NULL DEFAULT 0,
  done_at INTEGER
);
CREATE INDEX idx_checklist_schedule ON checklist_items(schedule_id);

CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER REFERENCES children(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(title) <= 120),
  due_at INTEGER NOT NULL,
  notify_minutes_before INTEGER,
  is_done INTEGER NOT NULL DEFAULT 0,
  done_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_todos_due ON todos(due_at) WHERE is_done = 0;

CREATE TABLE schedule_pickup_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  occurrence_date INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  UNIQUE(schedule_id, occurrence_date)
);
CREATE INDEX idx_pickup_schedule_date ON schedule_pickup_log(schedule_id, occurrence_date);
`;
