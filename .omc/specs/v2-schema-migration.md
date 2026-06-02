# Spec — v2 schema migration (ADR-002 entities + needs_pickup)

> **Goal**: bring the data layer to ADR-002 spec — add `ChecklistItem`,
> `Todo`, `SchedulePickupLog` tables + `schedules.needs_pickup` column —
> without touching any rendered screen. UI for the new entities (pickup
> carousel, prep/todo tab content, pickup dot, schedule-block icon) ships
> in a later batch (C). This spec exists because the prior "spawn-and-pray"
> workflow lost fidelity twice; everything below is the contract workers
> consume verbatim.
>
> **Status**: ready for team execution
> **Author**: team-lead (orchestrator), 2026-06-02
> **Source**: `docs/architecture/ADR-002-prep-todos-pickup.md` (DDL), `docs/architecture/ADR-003-*.md` (pickup carousel — for UI later), `CLAUDE.md` Locked Decisions

---

## 1. Scope

### In scope (B batch)
- `src/db/migrations/002_v2_prep_todos_pickup.sql.ts` (DDL string)
- Update `src/db/migrations/index.ts` `MIGRATIONS` array to add v2 entry
- Domain types: `ChecklistItem`, `Todo`, `SchedulePickupLog`, extend `Schedule` with `needsPickup`
- Row mappers: `rowToChecklistItem`, `rowToTodo`, `rowToSchedulePickupLog`, extend `rowToSchedule`
- Repositories: `checklist-items.ts`, `todos.ts`, `schedule-pickup-log.ts`; update `schedules.ts` for `needsPickup`
- Zustand stores: `checklist-store.ts`, `todos-store.ts`, `pickup-log-store.ts` OR merge into existing stores (see §7)
- Boot sequence: `app/_layout.tsx` hydrates the new stores after migrations
- Seed-dev v2 extension: `src/db/seed-dev.ts` adds pickup flags + checklist items + todos
- Tests:
  - `tests/db/migrations.test.ts` extended (v2 path)
  - `tests/db/repositories/checklist-items.test.ts`, `todos.test.ts`, `schedule-pickup-log.test.ts`
  - `tests/db/repositories/schedules.test.ts` extended (`needsPickup` round-trip)
  - `tests/state/checklist-store.test.ts`, `todos-store.test.ts`, `pickup-log-store.test.ts`
  - `tests/db/seed-dev.test.ts` extended

### Out of scope (later batches)
- **UI**: pickup carousel banner, prep/todo tab content, pickup dot on schedule blocks, pickup conflict carousel cards (all in batch C)
- **Notifications**: ChecklistItem prepend to schedule push body, Todo dueAt push (batch E / Phase 5)
- **Drawers**: Calendar / Search / NewEvent / EventDetail (batch D)
- **Weekly view / Settings / Onboarding** rebuilds (batch D)

---

## 2. Migration 002 — full DDL

File: `src/db/migrations/002_v2_prep_todos_pickup.sql.ts`

```ts
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
```

**Notes:**
- `occurrence_date` stored as **integer `yyyymmdd`** (e.g. `20260602`) per ADR-002. Different from schedule_exceptions.date which stays `TEXT YYYY-MM-DD`. Domain `SchedulePickupLog.occurrenceDate` exposes both an integer view (for storage parity) and a derived helper to `ISODate` string (for cross-entity joins).
- `idx_todos_due` is partial — only undone rows. Reduces index size and matches the typical "due soon and not done" query.
- All `done_at` / `created_at` are epoch ms integers. `notify_minutes_before` is nullable (todos without notifications).
- Migration runner already supports multi-version `MIGRATIONS` array iteration (Phase 1). Just append the entry.

**Migration runner update** in `src/db/migrations/index.ts`:

```ts
import { migration001 } from './001_init.sql';
import { migration002 } from './002_v2_prep_todos_pickup.sql';

export const MIGRATIONS: ReadonlyArray<Migration> = [
  { version: 1, sql: migration001 },
  { version: 2, sql: migration002 },
];
```

Same `applyMigrationAtomic` semantics. Each migration applied in its own
`BEGIN IMMEDIATE … COMMIT` with `PRAGMA user_version = N` inside.

---

## 3. Domain types — additions/extensions

File: `src/domain/types.ts`

```ts
// Existing Schedule type — ADD this field:
export interface Schedule {
  // ... existing fields unchanged ...
  needsPickup: boolean;  // ← NEW (v2)
}

// NEW types:

export interface ChecklistItem {
  id: number;
  scheduleId: number;
  label: string;        // max 60 chars (db CHECK)
  sortOrder: number;
  isDone: boolean;
  doneAt: number | null;  // epoch ms; null when not done
}

export interface Todo {
  id: number;
  childId: number | null;  // FK SET NULL — parent-level todos have null
  title: string;        // max 120 chars (db CHECK)
  dueAt: number;        // epoch ms
  notifyMinutesBefore: number | null;
  isDone: boolean;
  doneAt: number | null;
  createdAt: number;    // epoch ms
}

export interface SchedulePickupLog {
  id: number;
  scheduleId: number;
  occurrenceDate: number;  // yyyymmdd as int — 20260602
  completedAt: number;     // epoch ms
}
```

Export all 3 new types from `src/domain/types.ts`. Update `src/domain/index.ts` barrel if it re-exports types.

---

## 4. Row mappers

File: `src/db/row-mappers.ts`

```ts
// Extend ScheduleRow:
export interface ScheduleRow {
  // ... existing fields ...
  needs_pickup: number;  // 0 | 1
}

// Extend rowToSchedule:
export function rowToSchedule(row: ScheduleRow): Schedule {
  return {
    // ... existing mappings ...
    needsPickup: row.needs_pickup === 1,
  };
}

// NEW row interfaces:
export interface ChecklistItemRow {
  id: number;
  schedule_id: number;
  label: string;
  sort_order: number;
  is_done: number;       // 0 | 1
  done_at: number | null;
}

export interface TodoRow {
  id: number;
  child_id: number | null;
  title: string;
  due_at: number;
  notify_minutes_before: number | null;
  is_done: number;       // 0 | 1
  done_at: number | null;
  created_at: number;
}

export interface SchedulePickupLogRow {
  id: number;
  schedule_id: number;
  occurrence_date: number;  // yyyymmdd int
  completed_at: number;
}

// NEW mapper functions:
export function rowToChecklistItem(row: ChecklistItemRow): ChecklistItem { ... }
export function rowToTodo(row: TodoRow): Todo { ... }
export function rowToSchedulePickupLog(row: SchedulePickupLogRow): SchedulePickupLog { ... }
```

Same conversion conventions: `0|1 → boolean` for `is_done`. `null → null` for done_at/notify_minutes_before/child_id passthrough.

---

## 5. Repositories

### 5.1 `src/db/repositories/checklist-items.ts`

```ts
export async function getById(db: SQLiteDatabase, id: number): Promise<ChecklistItem | null>;
export async function listBySchedule(db: SQLiteDatabase, scheduleId: number): Promise<ChecklistItem[]>;  // ORDER BY sort_order ASC, id ASC
export async function create(db, input: {
  scheduleId: number;
  label: string;
  sortOrder?: number;  // default 0
}): Promise<ChecklistItem>;
export async function update(db, id: number, patch: Partial<Omit<ChecklistItem, 'id' | 'scheduleId'>>): Promise<ChecklistItem>;
export async function remove(db, id: number): Promise<void>;
export async function toggleDone(db, id: number, doneAt: number): Promise<ChecklistItem>;
// reorder: bulk update sort_order for a schedule
export async function reorder(db, scheduleId: number, orderedIds: number[]): Promise<void>;
```

Cascade: deleting a schedule cascades to its checklist_items via FK ON DELETE CASCADE.

### 5.2 `src/db/repositories/todos.ts`

```ts
export async function getById(db, id: number): Promise<Todo | null>;
export async function list(db): Promise<Todo[]>;  // all, ORDER BY due_at ASC
export async function listByChild(db, childId: number | null): Promise<Todo[]>;  // null = parent-level only
export async function listUndone(db): Promise<Todo[]>;  // is_done=0, due_at ASC
export async function create(db, input: {
  childId: number | null;
  title: string;
  dueAt: number;
  notifyMinutesBefore?: number | null;
}): Promise<Todo>;
export async function update(db, id: number, patch: Partial<Omit<Todo, 'id' | 'createdAt'>>): Promise<Todo>;
export async function remove(db, id: number): Promise<void>;
export async function toggleDone(db, id: number, doneAt: number): Promise<Todo>;
```

Cascade: deleting a child sets `todos.child_id = NULL` (FK SET NULL) — orphans the todo to parent-level rather than deleting it. ADR-002 §schema rationale.

### 5.3 `src/db/repositories/schedule-pickup-log.ts`

```ts
// Mark a specific occurrence as picked up. Idempotent — UNIQUE(schedule_id, occurrence_date)
// makes a duplicate INSERT a no-op via INSERT OR IGNORE pattern.
export async function markComplete(db, input: {
  scheduleId: number;
  occurrenceDate: number;  // yyyymmdd int
  completedAt: number;     // epoch ms
}): Promise<SchedulePickupLog>;

// Clear the "picked up" status for an occurrence.
export async function clearComplete(db, scheduleId: number, occurrenceDate: number): Promise<void>;

// Check if a specific (schedule, occurrence_date) is marked complete.
export async function isComplete(db, scheduleId: number, occurrenceDate: number): Promise<boolean>;

// All completion rows for a schedule.
export async function listForSchedule(db, scheduleId: number): Promise<SchedulePickupLog[]>;

// All completion rows for a specific date (across all schedules).
export async function listForDate(db, occurrenceDate: number): Promise<SchedulePickupLog[]>;
```

Cascade: deleting a schedule cascades to its pickup log rows via FK ON DELETE CASCADE.

### 5.4 `src/db/repositories/schedules.ts` — extend

Existing CRUD stays. **Add `needsPickup` handling**:
- `create` accepts `needsPickup` in input, defaults to false. Persist as 0/1.
- `update` allows `needsPickup` in the patch.
- `rowToSchedule` returns the boolean (already covered in §4).

### 5.5 Barrel

Update `src/db/repositories/index.ts`:

```ts
export * as childrenRepo from './children';
export * as schedulesRepo from './schedules';
export * as exceptionsRepo from './schedule-exceptions';
export * as notificationSettingsRepo from './notification-settings';
export * as checklistItemsRepo from './checklist-items';  // NEW
export * as todosRepo from './todos';                     // NEW
export * as schedulePickupLogRepo from './schedule-pickup-log';  // NEW
```

---

## 6. Zustand stores

Per existing pattern: each entity gets its own slice store. **3 new stores**.

### 6.1 `src/state/checklist-store.ts`

```ts
interface ChecklistState {
  itemsByScheduleId: Map<number, ChecklistItem[]>;  // sorted by sortOrder ASC
  isLoaded: boolean;
  load: (db: SQLiteDatabase) => Promise<void>;       // hydrate all
  loadForSchedule: (db, scheduleId: number) => Promise<void>;  // hydrate one
  add: (db, input: { scheduleId; label; sortOrder?: number }) => Promise<ChecklistItem>;
  updateOne: (db, id: number, patch: Partial<Omit<ChecklistItem, 'id' | 'scheduleId'>>) => Promise<void>;
  removeOne: (db, id: number) => Promise<void>;
  toggleDone: (db, id: number) => Promise<void>;  // computes doneAt internally
  reorder: (db, scheduleId: number, orderedIds: number[]) => Promise<void>;
}
```

After every mutation, re-read `listBySchedule(db, scheduleId)` and update the
Map entry for that schedule. Selectors stay reference-stable across reads
without mutation. Use `Map` not plain object so `set()` returns the same
reference key when no change.

### 6.2 `src/state/todos-store.ts`

```ts
interface TodosState {
  todos: Todo[];     // ORDER BY due_at ASC
  isLoaded: boolean;
  load: (db) => Promise<void>;
  add: (db, input: { childId; title; dueAt; notifyMinutesBefore? }) => Promise<Todo>;
  updateOne: (db, id, patch) => Promise<void>;
  removeOne: (db, id) => Promise<void>;
  toggleDone: (db, id) => Promise<void>;
}
```

### 6.3 `src/state/pickup-log-store.ts`

```ts
interface PickupLogState {
  // Compact representation: key = `${scheduleId}|${occurrenceDate}`, value = completedAt
  completionMap: Map<string, number>;
  isLoaded: boolean;
  load: (db) => Promise<void>;          // hydrate all
  markComplete: (db, scheduleId, occurrenceDate) => Promise<void>;     // computes completedAt = Date.now()
  clearComplete: (db, scheduleId, occurrenceDate) => Promise<void>;
}

// Helper selectors:
export const selectIsComplete = (scheduleId: number, occurrenceDate: number) =>
  (s: PickupLogState) => s.completionMap.has(`${scheduleId}|${occurrenceDate}`);
```

### 6.4 Barrel

Update `src/state/index.ts` to re-export the 3 new stores.

### 6.5 Existing schedules-store update

`useSchedulesStore` already exposes schedules. The `add`/`update` actions
flow input via the existing repo functions. Repo signature now accepts
`needsPickup` — store actions need to pass it through. **One-line addition
per action.**

---

## 7. Boot sequence

`app/_layout.tsx` — after fonts load + migrations + seed:

```ts
// existing 2 store loads:
await useChildrenStore.getState().load(db);
await useSchedulesStore.getState().load(db);

// add 3 new:
await useChecklistStore.getState().load(db);
await useTodosStore.getState().load(db);
await usePickupLogStore.getState().load(db);
```

Parallelize if safe (all read-only loads). Defensive: catch any single
store's failure and surface to bootError without halting the others.

---

## 8. Seed-dev v2 extension

`src/db/seed-dev.ts` — extend the existing fixture WITHOUT changing v1
behavior. The function still short-circuits when `children.count > 0`.

After the existing INSERT chain (3 children + 8 schedules + 1 exception +
3 notification settings), add:

```ts
// Mark needs_pickup on schedules where pickup is part of the daily flow.
// Picks: 민준 수영(id=3, Sat), 서연 미술학원(id=6, Sat), 도윤 발레(id=8, Wed).
// (Schedule ids are 1..8 in insertion order per the existing seed.)
await db.runAsync('UPDATE schedules SET needs_pickup = 1 WHERE id IN (?, ?, ?)', [3, 6, 8]);

// ChecklistItems — preparation items per pickup-marked schedule.
// 민준 수영:
await db.runAsync(`INSERT INTO checklist_items (schedule_id, label, sort_order) VALUES (?, ?, ?)`, [3, '수영가방', 0]);
await db.runAsync(`INSERT INTO checklist_items (schedule_id, label, sort_order) VALUES (?, ?, ?)`, [3, '수건', 1]);
await db.runAsync(`INSERT INTO checklist_items (schedule_id, label, sort_order) VALUES (?, ?, ?)`, [3, '간식', 2]);
// 서연 미술학원:
await db.runAsync(`INSERT INTO checklist_items (schedule_id, label, sort_order) VALUES (?, ?, ?)`, [6, '미술도구', 0]);
await db.runAsync(`INSERT INTO checklist_items (schedule_id, label, sort_order) VALUES (?, ?, ?)`, [6, '앞치마', 1]);
// 도윤 발레:
await db.runAsync(`INSERT INTO checklist_items (schedule_id, label, sort_order) VALUES (?, ?, ?)`, [8, '발레복', 0]);
await db.runAsync(`INSERT INTO checklist_items (schedule_id, label, sort_order) VALUES (?, ?, ?)`, [8, '발레슈즈', 1]);

// Todos — mix of parent-level (child_id=NULL) + per-child.
const NOW_MS = 1717286400000; // 2026-06-02 00:00 KST (deterministic for tests)
const DAY = 86_400_000;
await db.runAsync(
  `INSERT INTO todos (child_id, title, due_at, notify_minutes_before, created_at) VALUES (?, ?, ?, ?, ?)`,
  [null, '영어학원 등록비 입금', NOW_MS + 3 * DAY, 60, NOW_MS],
);
await db.runAsync(
  `INSERT INTO todos (child_id, title, due_at, notify_minutes_before, created_at) VALUES (?, ?, ?, ?, ?)`,
  [null, '병원 예약', NOW_MS + 7 * DAY, null, NOW_MS],
);
await db.runAsync(
  `INSERT INTO todos (child_id, title, due_at, notify_minutes_before, created_at) VALUES (?, ?, ?, ?, ?)`,
  [1, '민준 학교 알림장 확인', NOW_MS + DAY, 30, NOW_MS],
);
await db.runAsync(
  `INSERT INTO todos (child_id, title, due_at, notify_minutes_before, created_at) VALUES (?, ?, ?, ?, ?)`,
  [2, '서연 미술 준비물 (붓)', NOW_MS + 4 * DAY, 30, NOW_MS],
);

// Pickup log starts empty. User toggles a pickup card in the UI to mark
// occurrence complete, which inserts a row.
```

**Wrap the whole new section in the existing `withTransactionAsync` block**
so v1 + v2 seed share one transaction.

---

## 9. Tests

### 9.1 Migration test extension (`tests/db/migrations.test.ts`)

Add cases:
- **Test E**: fresh DB → runMigrations → `user_version = 2`, all 7 tables exist (existing 4 + checklist_items + todos + schedule_pickup_log). Verify `idx_checklist_schedule`, `idx_todos_due`, `idx_pickup_schedule_date` via `PRAGMA index_list`.
- **Test F**: v1-applied DB (manually set `user_version = 1` after migration001) → runMigrations → applies v2 only, ends at `user_version = 2`.
- **Test G**: schedules table has `needs_pickup` column after v2, defaults to 0 on existing rows.
- **Test H** (crash-recovery v2 path): mock execAsync throw on `PRAGMA user_version = 2`. Re-open DB. `user_version = 1`, new 3 tables do NOT exist, `needs_pickup` column does NOT exist on schedules.

### 9.2 Repository tests — 3 new files

- `tests/db/repositories/checklist-items.test.ts`: CRUD round-trip, listBySchedule order, cascade-on-schedule-delete, label length CHECK violation, toggleDone updates done_at, reorder.
- `tests/db/repositories/todos.test.ts`: CRUD round-trip, listByChild (null = parent-level), listUndone filter, cascade-on-child-delete (child_id → NULL), title length CHECK violation, toggleDone.
- `tests/db/repositories/schedule-pickup-log.test.ts`: markComplete inserts, double-markComplete is no-op (UNIQUE), clearComplete removes row, isComplete query, listForSchedule, listForDate, cascade-on-schedule-delete.

### 9.3 schedules repo test extension

Existing `tests/db/repositories/schedules.test.ts` — add `needsPickup` round-trip case (create with true, list returns true; update toggles).

### 9.4 Store tests — 3 new files

Lighter than repos. Focus on:
- load() hydrates correctly
- one mutation → re-read → selector reflects change
- selector reference stability across unchanged reads

### 9.5 Seed-dev test extension

`tests/db/seed-dev.test.ts` — assert post-seed counts:
- `SELECT COUNT(*) FROM schedules WHERE needs_pickup = 1` returns 3.
- `SELECT COUNT(*) FROM checklist_items` returns 7.
- `SELECT COUNT(*) FROM todos` returns 4.
- `SELECT COUNT(*) FROM schedule_pickup_log` returns 0.

### 9.6 Test infrastructure

Existing `wrap()` shim in test files already supports the `runAsync` /
`getFirstAsync` / `getAllAsync` / `withTransactionAsync` / `execAsync`
surface that new repos use. **No new shim methods needed.**

---

## 10. Team execution plan

5 workers, 2 stages:

### Stage 1 — parallel (no inter-worker dependencies)

- **worker-migration** (`expo-sqlite-migrator` agent):
  - Files: `src/db/migrations/002_v2_prep_todos_pickup.sql.ts` (new),
    `src/db/migrations/index.ts` (extend MIGRATIONS array).
  - Tests: extend `tests/db/migrations.test.ts` with Test E/F/G/H.
  - No domain/types dependency (DDL is self-contained).

- **worker-domain** (`schedule-domain-expert` agent):
  - Files: `src/domain/types.ts` (extend Schedule + 3 new types),
    `src/db/row-mappers.ts` (extend rowToSchedule + 3 new mappers),
    `src/domain/index.ts` (barrel).
  - No tests — domain types compile through tsc.

### Stage 2 — depends on Stage 1 — parallel within Stage 2

- **worker-repos** (`oh-my-claudecode:executor` opus):
  - Files: `src/db/repositories/{checklist-items,todos,schedule-pickup-log}.ts` (new), `src/db/repositories/schedules.ts` (needsPickup hookup), `src/db/repositories/index.ts` (barrel).
  - Tests: 3 new repo test files + extend schedules.test.ts (needsPickup).

- **worker-stores** (`oh-my-claudecode:executor` opus):
  - Files: `src/state/{checklist-store,todos-store,pickup-log-store}.ts` (new), `src/state/schedules-store.ts` (needsPickup passthrough), `src/state/index.ts` (barrel), `app/_layout.tsx` (boot hydrate 3 new stores), `src/db/seed-dev.ts` (extend per §8).
  - Tests: 3 new store test files + extend seed-dev.test.ts.

### Stage 3 — verify (orchestrator runs, no agent)

```bash
export EXPO_NO_TELEMETRY=1
npx tsc --noEmit
npx eslint .
npx jest
```

All green. Then orchestrator commits B.

---

## 11. Acceptance gate

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx eslint .` → 0 new errors/warnings (2 pre-existing OK)
- [ ] `npx jest` → all green; expect baseline 263 + ~40 new tests (≈ 300+)
- [ ] After app boot in dev: 7 tables visible in dev SQLite, `user_version = 2`. (Inspect via Metro logs if needed — store load counts should match seed: 3 children, 8 schedules with 3 needsPickup=true, 1 exception, 7 checklist items, 4 todos, 0 pickup log.)
- [ ] Visible UI: **unchanged** (B is data-layer only). Hot-reload should not break the current daily-view render.

---

## 12. Things explicitly NOT in this spec (so workers don't drift)

- No PickupCarousel UI (banner). batch C.
- No 준비물 / 할일 tab content. batch C.
- No pickup dot on schedule blocks. batch C.
- No sub-bar conflict pill. **POLICY: never add this — ADR-003 §A retires it.**
- No notification body prepend logic. batch E (Phase 5).
- No Todo dueAt push scheduling. batch E.
- No new schemas beyond ADR-002 / 003.
