// v7 — PREP-RECUR (ADR-006b): explicit `recurring` flag + anchored membership.
//
// SAFETY MODEL: **atomicity-gated**, NOT statement-idempotency.
//   - The version-gated runner (migrations/index.ts:38) only applies a migration
//     when its version > current user_version, so this file runs at most once per
//     device in normal operation.
//   - All statements + the `PRAGMA user_version = 7` bump share a single
//     BEGIN IMMEDIATE…COMMIT (index.ts:51-55), with a withTransactionAsync
//     fallback (index.ts:67-70). A crash mid-migration ROLLs back everything,
//     leaving user_version at 6 and zero v7 artifacts.
//   - This is why `ALTER TABLE … ADD COLUMN` is safe here even though SQLite has
//     NO `ADD COLUMN IF NOT EXISTS`: the runner guarantees single-application via
//     the version gate, not via per-statement idempotency.
//
// ADDITIVE ONLY — no destructive ALTER, no DROP.
//
// WHAT THIS DOES (ADR-006b):
//   `checklist_items.occurrence_date` becomes the ANCHOR date and the new
//   `recurring` flag distinguishes 매번 (recurring) from 이번만 (day-specific).
//   Membership of an item on an occurrence whose date is O (yyyymmdd int):
//     occurrence_date IS NULL          → always visible (legacy / unbounded).
//     else recurring = 1 (매번)        → visible iff O >= occurrence_date.
//     else recurring = 0 (이번만)      → visible iff O === occurrence_date.
//
//   1. ADD COLUMN recurring INTEGER NOT NULL DEFAULT 1.
//      New default 1 = 매번 (matches the EditSheet new-item default).
//   2. Backfill: existing day-specific rows (occurrence_date IS NOT NULL) are
//      flipped to recurring = 0 so they keep their EXACT prior semantics
//      (occurrence_date set → O === anchor → that date only). Existing recurring
//      rows kept occurrence_date NULL under v6, so they stay recurring = 1 /
//      unbounded (always visible) — full backward compatibility, zero row loss.
//
// FROZEN (NOT dropped): checklist_items.is_done / done_at remain in the schema
// (FROZEN since v6). They are not written and never read for completion. Do not
// remove them here.

export const migration007 = `
ALTER TABLE checklist_items ADD COLUMN recurring INTEGER NOT NULL DEFAULT 1;

UPDATE checklist_items SET recurring = 0 WHERE occurrence_date IS NOT NULL;
`;
