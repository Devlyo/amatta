export const migration001 = `
CREATE TABLE IF NOT EXISTS children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color_index INTEGER NOT NULL CHECK(color_index BETWEEN 0 AND 5),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('school','academy','activity','other')),
  location TEXT,
  notes TEXT,
  days_of_week INTEGER NOT NULL,
  start_minutes INTEGER NOT NULL,
  end_minutes INTEGER NOT NULL,
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  notify_minutes_before INTEGER
);

CREATE TABLE IF NOT EXISTS schedule_exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('cancel','modify')),
  override_start_minutes INTEGER,
  override_end_minutes INTEGER,
  override_title TEXT,
  UNIQUE(schedule_id, date)
);

CREATE TABLE IF NOT EXISTS notification_settings (
  child_id INTEGER PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE,
  default_minutes_before INTEGER NOT NULL DEFAULT 15,
  sound INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_schedules_child ON schedules(child_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_schedule_date ON schedule_exceptions(schedule_id, date);
`;
