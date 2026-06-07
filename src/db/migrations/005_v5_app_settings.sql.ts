// v5 — add a generic key-value `app_settings` table for app-global settings
// that must survive relaunch (App Store v1 launch blocker: NOTIF-PERSIST).
//
// The immediate consumer is the global notification settings currently held
// only in an in-memory Zustand store (src/state/notif-settings-store.ts):
//   - systemEnabled        (bool  → stored as '0' | '1')
//   - defaultMinutesBefore (int   → stored as the decimal string)
// Both reset on every relaunch today. A key-value table lets the store
// serialize these (and any future app-global keys) without further schema
// churn — new settings are new rows, never new columns/migrations.
//
// Intentionally NOT seeded: the store writes its own defaults at runtime,
// so the table starts empty. A fresh install therefore creates an empty
// app_settings and lands at user_version = 5.
//
// IF NOT EXISTS keeps this re-run safe, matching 001/002.
export const migration005 = `
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;
