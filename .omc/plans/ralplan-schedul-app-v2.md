# Ralplan v2 — schedul-app

> **Source spec:** `.omc/specs/deep-interview-schedul-app.md` (ambiguity 5.0%, PASSED)
> **Target stack (locked by deep-interview):** Expo SDK + React Native + TypeScript + expo-sqlite + expo-notifications + expo-router
> **Mode:** SHORT (default ralplan).
> **Iteration:** v2 — closes the must-fix list from Architect/Critic v1 reviews.

---

## Changes since v1

This iteration is purely about closing the must-fix list. No architectural decisions are revisited; the four ADR axes (UI=A1, State=B1, SQLite=C1, Occurrences=D1) remain locked.

| Change | Fix maps to | Section touched |
|---|---|---|
| 1. Hooks redesign — per-edit `eslint --fix` only; `tsc --noEmit` moved to `Stop` hook | Architect S1 / C8 / T1 | Phase 0 §5 |
| 2. Migration runner — `PRAGMA user_version = N` is now the **last statement inside** the `BEGIN IMMEDIATE … COMMIT` transaction; documented fallback to `withTransactionAsync` if the next-gen async API rejects DDL inside `BEGIN IMMEDIATE` | Architect S2 / C3 | Phase 1 §2 |
| 3. Notifications — `rescheduleAll()` and any boot path **must** start with `Notifications.cancelAllScheduledNotificationsAsync()` before re-scheduling from DB; AsyncStorage id-map demoted to **per-session cache only** (never source of truth) | Architect S3 / C7 | Phase 5 §1–§3 |
| 4. Phase 0 smoke gate — replaced interactive `npx expo start` with non-interactive checks: `npx expo-doctor`, `npx expo export --platform=all --dump-assetmap` (inside `timeout 60s`), `tsc --noEmit`, `eslint .`, `jest --passWithNoTests` | Critic C-NEW-1 | Phase 0 §6 |
| 5. TS strict — drop `exactOptionalPropertyTypes` (keep `strict` and `noUncheckedIndexedAccess`) so smoke gate's `tsc --noEmit` returns 0 on a fresh expo-router project | Critic C-NEW-2 | Phase 0 §3 |
| 6. Pin Expo SDK explicitly in `package.json` and the plan | Critic gap | Phase 0 §1, §2 |
| 7. `EXPO_NO_TELEMETRY=1` in `.env` and CI/hook env | Critic gap | Phase 0 §4 |
| 8. Empty-state design for daily grid (no children → onboarding CTA) | Critic gap | Phase 3 §1 |
| 9. Hard-stop UI when adding a 5th child | Critic gap | Phase 4 §3 (settings) |
| 10. Keyboard-aware schedule edit sheet on small screens | Critic gap | Phase 4 §2 |
| 11. iCloud entitlement plist key documented (`iCloud.<bundle-id>.documents`, `NSUbiquitousContainers`) | Critic gap | Phase 0 §4 |
| 12. Minimal "DB → JSON" export button in Settings (one-button escape hatch for 기기변경) | Critic gap (Round 4 carryover) | Phase 4 §3 (settings), Phase 6 §3 |
| 13. ADR Consequences finalized with locked decisions | Architect S9 | ADR section |

Items deliberately **not** addressed in v2 (deferred to v3 or post-MVP, per "no new tradeoffs" instruction): Architect S4 (exception upsert `ON CONFLICT`), S5 (colorblind disambiguator), S6 (DST/TZ test), S7 (`BottomSheetScrollView` wiring), S8 (30-min granularity CHECK), T5/iOS 64-cap. These are tracked in `.omc/plans/open-questions.md`.

---

## RALPLAN-DR Summary

### Principles (5)

1. **Local-first, zero-server.** No accounts, no sync, no telemetry. OS backup is the only durability story. Every dependency that implies a server is rejected. `EXPO_NO_TELEMETRY=1` is set explicitly to honor this principle against Expo defaults.
2. **Pure functions own correctness; UI owns layout only.** Occurrence calculation, recurrence expansion, and exception application live in `src/domain/**` as deterministic, DB-free TypeScript so they can be unit-tested to ≥80%.
3. **Boring, well-supported, Expo-blessed.** Pick libraries that survive `expo prebuild` and Expo SDK upgrades. Reject anything requiring custom native modules unless no alternative exists.
4. **Static defaults are the spec, not config.** 4 children / 30-min slots / 06–23h / 6 colors / 4 types are constants in code, not user settings. Build cheaper UI on top of locked defaults.
5. **Phase 0 is a gate, not a phase.** No `app/` code, no schema work, no agents spawned for features until tooling, hooks, and a green **non-interactive** smoke build exist on this machine.

### Decision Drivers (top 3)

1. **D1 — Expo compatibility & maintainability.** Library must work with Expo Managed workflow and survive the next two SDK bumps without custom native code.
2. **D2 — Test surface for occurrence/exception logic.** Whatever DB & state choice we make, the recurrence-expansion algorithm must remain a pure function that consumes plain rows; no ORM magic in the hot path.
3. **D3 — Grid render performance on the daily spread.** 4 columns × 35 slots = 140 cells, redrawing on swipe/edit. Must hit 60fps on mid-range Android.

### Viable Options

(Unchanged from v1 — A1/B1/C1/D1 chosen, real runners-up listed.)

#### Axis A — UI Library

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **(A1) Bare RN primitives + react-native-gesture-handler + react-native-reanimated** | Zero adoption risk; Expo officially supports both; full control over the 4×35 grid; smallest bundle. | Hand-craft typography/buttons/sheets; design consistency on us. | **CHOSEN** |
| (A2) tamagui | Rich design system, themable. | Heavy build-time codegen, SDK upgrade lag risk, opinionated styling. | Reject — D1 risk too high. |
| (A3) react-native-paper | Stable Material library, easy forms. | Material aesthetic clashes with the dense bespoke grid. | Reject — D3 over-render risk in grid. |

We pull in `@gorhom/bottom-sheet` for the schedule edit sheet (only).

#### Axis B — State

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **(B1) Zustand** | Tiny, no provider tree, selector-based subscriptions. | No built-in persistence (don't need it). | **CHOSEN** |
| (B2) React Context + useReducer | Zero deps. | Context updates re-render every consumer without aggressive memoization. | Reject. |
| (B3) Redux Toolkit | Mature, devtools. | Boilerplate-to-feature ratio hostile for 4-screen app. | Reject. |

#### Axis C — SQLite

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **(C1) Raw SQL via `expo-sqlite` (next-gen async API)** | Zero ORM coupling; migrations are numbered SQL strings; trivial to mock. | Hand-written row→domain mappers (4 entities × ~10 lines). | **CHOSEN** |
| (C2) Drizzle ORM | Typed query builder. | drizzle-kit native bindings; bitmask predicates need raw SQL escape. | Reject — D1 risk. |
| (C3) Kysely + expo-sqlite dialect | Lightweight typed builder. | Community dialect, less battle-tested. | Reject. |

#### Axis D — Occurrence calc

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **(D1) On-demand `expandOccurrences(schedules, exceptions, range)`** | No materialization; one unit-tested pure function. | Recomputes per swipe (trivial cost). | **CHOSEN** |
| (D2) Materialize `ScheduleInstance` table | O(1) reads. | Cache invalidation on every edit; 3× surface area. | Reject. |

> **Single-option axes:** None — every axis has a real runner-up.

---

## Phase 0 — Dev Environment Setup (GATED — must pass before any phase ≥1)

> **The user explicitly required this phase before any code.** Autopilot/ralph **must** halt if the smoke gate fails.

### Tasks

1. **Bootstrap repo.**
   - `git init -b main` (force `main` as initial branch, regardless of git default).
   - `npx create-expo-app@latest . --template blank-typescript` (use `.` to populate current dir; abort if non-empty unexpected files).
   - **Pin Expo SDK in `package.json`:** `"expo": "~52.0.0"` (or current LTS as of 2026-05; if `create-expo-app@latest` produces a newer SDK, update this pin and document the SDK number in this section before continuing). All SDK-sensitive analysis below assumes `~52.x`. If a different SDK is used, re-verify (a) `expo-sqlite` next-gen async API DDL-in-transaction support, (b) `expo-router` typed-routes compatibility with `noUncheckedIndexedAccess`, (c) `@gorhom/bottom-sheet` peer deps.
   - Add `.gitignore` standard Expo entries (`.expo/`, `node_modules/`, `dist/`, `*.log`, `ios/`, `android/`, `*.tsbuildinfo`, `.env.local`).

2. **Install runtime deps (pinned SDK).**
   - `npx expo install expo-router expo-sqlite expo-notifications expo-haptics expo-linking react-native-gesture-handler react-native-reanimated react-native-safe-area-context react-native-screens @react-native-async-storage/async-storage`
   - `npx expo install zustand @gorhom/bottom-sheet`
   - `babel.config.js` → add `react-native-reanimated/plugin` last in plugins.

3. **Install dev deps + `tsconfig.json`.**
   - `npm i -D typescript @types/react eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-config-expo prettier eslint-config-prettier eslint-plugin-prettier jest jest-expo @testing-library/react-native @testing-library/jest-native @types/jest`
   - `tsconfig.json`:
     ```jsonc
     {
       "extends": "expo/tsconfig.base",
       "compilerOptions": {
         "strict": true,
         "noUncheckedIndexedAccess": true,
         // exactOptionalPropertyTypes intentionally OMITTED.
         // Reason: expo-router generated types (string | undefined for params)
         //   are incompatible with exactOptionalPropertyTypes on SDK ~52.x.
         //   Smoke-gate `tsc --noEmit` must return 0 on a fresh project — keeping
         //   this flag would fail before any product code is written.
         //   Re-evaluate if expo-router types stabilize in a future SDK.
         "incremental": true,
         "tsBuildInfoFile": "./.tsbuildinfo"
       }
     }
     ```
   - `.eslintrc.js` (`extends: ['expo', 'prettier']`), `.prettierrc`, `jest.config.js` (preset `jest-expo`, setup file with RN gesture-handler mock).

4. **Configure expo-router + telemetry kill + iCloud entitlement.**
   - `package.json` `"main": "expo-router/entry"`.
   - `app.json` add:
     - `"scheme": "schedulapp"`
     - `"plugins": ["expo-router", "expo-notifications", "expo-sqlite"]`
     - `"ios.bundleIdentifier": "io.starzip.schedulapp"` (replace with final bundle id)
     - **iCloud Documents entitlement** so the spec's "OS backup is the durability story" actually works on iOS:
       ```json
       "ios": {
         "bundleIdentifier": "io.starzip.schedulapp",
         "usesIcloudStorage": true,
         "entitlements": {
           "com.apple.developer.icloud-container-identifiers": ["iCloud.io.starzip.schedulapp.documents"],
           "com.apple.developer.icloud-services": ["CloudDocuments"],
           "com.apple.developer.ubiquity-container-identifiers": ["iCloud.io.starzip.schedulapp.documents"]
         },
         "infoPlist": {
           "NSUbiquitousContainers": {
             "iCloud.io.starzip.schedulapp.documents": {
               "NSUbiquitousContainerIsDocumentScopePublic": true,
               "NSUbiquitousContainerSupportedFolderLevels": "Any",
               "NSUbiquitousContainerName": "schedulapp"
             }
           }
         }
       }
       ```
   - **Telemetry kill switch.** Create `.env`:
     ```
     EXPO_NO_TELEMETRY=1
     ```
     Add `dotenv -e .env --` (or shell `export`) wrapper to `package.json` scripts. Hooks (below) also export `EXPO_NO_TELEMETRY=1` inline so the value is set whether or not the user's shell loaded `.env`.

5. **Install OMC hooks (`.claude/settings.json`).**

   **Design constraint:** per-edit hook budget is ~1s. `tsc --noEmit` (cold 5–10s, warm 2–4s on strict project) is moved to a `Stop` hook so it runs once per agent turn ending. `eslint --fix` is per-file (warm <500ms).

   ```json
   {
     "hooks": {
       "PostToolUse": [
         {
           "matcher": "Edit|Write",
           "hooks": [
             {
               "type": "command",
               "command": "if echo \"$CLAUDE_TOOL_FILE_PATH\" | grep -qE '\\.tsx?$'; then EXPO_NO_TELEMETRY=1 npx eslint --fix \"$CLAUDE_TOOL_FILE_PATH\" 2>&1 | tail -n 5; fi"
             }
           ]
         }
       ],
       "Stop": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "EXPO_NO_TELEMETRY=1 npx tsc --noEmit --incremental 2>&1 | tail -n 20 || true"
             }
           ]
         }
       ],
       "SessionStart": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "EXPO_NO_TELEMETRY=1 npx expo-doctor 2>&1 | tail -n 1 || true"
             }
           ]
         }
       ]
     }
   }
   ```

   **Why the change:**
   - Per-edit `tsc --noEmit` violated v1's own "<5s budget" (Architect S1/C8). Cold tsc is 5–10s, warm 2–4s. Multiplied across ~30 edits per session = minutes of stalled context. This is the single highest-leverage fix in v2.
   - Per-edit `eslint --fix` is fast (<500ms warm), file-scoped, and deterministic.
   - `Stop` hook runs project-wide tsc once per agent turn — a cheap aggregation. `--incremental` with `.tsbuildinfo` cuts warm runs to <500ms.
   - `eslint --fix` writes back to file. Hook is `PostToolUse` not `PreToolUse`, so no infinite loop, but we still rely on Claude's hook engine to not re-fire on the agent's own write.

6. **Smoke gate (the gate itself) — NON-INTERACTIVE.**

   All five must pass on this machine, with output captured to `.omc/logs/phase0-smoke.log`. Each MUST exit 0. **No long-running interactive processes.**

   ```bash
   set -e
   mkdir -p .omc/logs
   exec > >(tee -a .omc/logs/phase0-smoke.log) 2>&1
   export EXPO_NO_TELEMETRY=1

   echo "=== [1/5] expo-doctor ==="
   npx expo-doctor

   echo "=== [2/5] expo export (bundler smoke) ==="
   timeout 60s npx expo export --platform all --dump-assetmap --output-dir /tmp/__schedulapp_smoke
   rm -rf /tmp/__schedulapp_smoke

   echo "=== [3/5] tsc --noEmit ==="
   npx tsc --noEmit

   echo "=== [4/5] eslint . ==="
   npx eslint .

   echo "=== [5/5] jest --passWithNoTests ==="
   npx jest --passWithNoTests
   ```

   Notes:
   - `expo-doctor` is a one-shot exit-code command; it replaces the v1 "Metro booted with no red error" aspiration with a real machine-checkable signal.
   - `expo export --platform all --dump-assetmap` forces the bundler to compile the entry across all platforms and exits cleanly. `timeout 60s` is belt-and-braces; on a fresh project this completes in ~20–40s. If `--platform=all` is unsupported on the pinned SDK, fall back to `npx expo export --platform web` which is the cheapest bundle path.
   - `tsc --noEmit` (without `--incremental` here — gate runs once, we want a clean check) must return 0. With `exactOptionalPropertyTypes` dropped (per §3), this is achievable on a fresh expo-router project.
   - `eslint .` and `jest --passWithNoTests` are unchanged.

7. **First commit.** `chore: bootstrap expo + tooling (phase 0)` on `main`.

### Acceptance (Phase 0 gate)

- [ ] `package.json` pins Expo SDK explicitly (e.g., `"expo": "~52.0.0"`).
- [ ] `.env` contains `EXPO_NO_TELEMETRY=1`.
- [ ] `app.json` declares iCloud entitlement keys for `iCloud.<bundle-id>.documents`.
- [ ] `tsconfig.json` has `strict: true` + `noUncheckedIndexedAccess: true` and **does NOT** have `exactOptionalPropertyTypes`.
- [ ] `.claude/settings.json` exists with the three hooks above (per-edit `eslint --fix`, `Stop` `tsc --noEmit --incremental`, SessionStart `expo-doctor`).
- [ ] All five smoke commands in §6 exit 0; `.omc/logs/phase0-smoke.log` captures them.
- [ ] First git commit is on `main`.
- [ ] **If any check fails, stop and surface to user — do NOT proceed to Phase 1.**

---

## Phase 1 — Foundation

### Tasks

1. **Directory scaffold (matches spec).**
   ```
   app/
     _layout.tsx                  # Stack root, expo-router
     (tabs)/
       _layout.tsx
       index.tsx                  # daily spread (Phase 3)
       settings.tsx               # children + notification settings (Phase 4)
     child/[id].tsx               # weekly drilldown (Phase 4)
     schedule/edit.tsx            # bottom sheet host (Phase 4)
   src/
     db/
       client.ts                  # singleton expo-sqlite handle
       migrations/
         001_init.sql.ts          # schema v1 string
         index.ts                 # migration runner
       repositories/
         children.ts
         schedules.ts
         schedule-exceptions.ts
         notification-settings.ts
       row-mappers.ts
     domain/
       types.ts                   # Child, Schedule, ScheduleException, ...
       constants.ts               # PALETTE, SLOT_MIN=30, GRID_START=6, GRID_END=23, MAX_CHILDREN=4
       days-of-week.ts            # bitmask helpers (Mon=1<<0 ... Sun=1<<6)
       occurrences.ts             # expandOccurrences() — the hot path
       grid.ts                    # layoutDay(occurrences) → BlockLayout[]
     state/
       children-store.ts
       schedules-store.ts
       ui-store.ts
     notifications/
       scheduler.ts               # plan/cancel triggers (Phase 5)
       permissions.ts
     ui/
       grid/DailyGrid.tsx
       grid/ScheduleBlock.tsx
       grid/SlotCell.tsx
       weekly/WeeklyGrid.tsx
       sheets/ScheduleEditSheet.tsx
       common/ColorDot.tsx
       common/TypeIcon.tsx
       common/EmptyChildrenState.tsx   # NEW (Phase 3 onboarding CTA)
   tests/
     domain/occurrences.test.ts
     domain/grid.test.ts
     domain/days-of-week.test.ts
     db/migrations.test.ts
   ```

2. **Migration runner (`src/db/migrations/index.ts`) — `PRAGMA user_version` IS IN-TRANSACTION.**

   **Architect S2 / Critic C3 fix.** v1 sequenced `PRAGMA user_version = N` *after* `COMMIT`. v2 makes it the **last statement inside the same `BEGIN IMMEDIATE … COMMIT` block.** If the app dies between DDL and PRAGMA, the entire transaction rolls back — no double-apply on next boot.

   ```ts
   // src/db/migrations/index.ts
   import type { SQLiteDatabase } from 'expo-sqlite';
   import { migration001 } from './001_init.sql';

   const MIGRATIONS = [
     { version: 1, sql: migration001 }, // multi-statement string
   ] as const;

   export async function runMigrations(db: SQLiteDatabase): Promise<void> {
     // Always-on hardening
     await db.execAsync('PRAGMA foreign_keys = ON');
     await db.execAsync('PRAGMA journal_mode = WAL');

     const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
     const currentVersion = row?.user_version ?? 0;

     for (const m of MIGRATIONS) {
       if (m.version <= currentVersion) continue;
       await applyMigrationAtomic(db, m);
     }
   }

   async function applyMigrationAtomic(
     db: SQLiteDatabase,
     m: { version: number; sql: string },
   ): Promise<void> {
     // PREFERRED PATH: explicit BEGIN IMMEDIATE … COMMIT with PRAGMA inside.
     // If next-gen expo-sqlite rejects DDL inside an explicit BEGIN, fall back
     // to db.withTransactionAsync (which wraps DDL in a savepoint on this SDK).
     try {
       await db.execAsync('BEGIN IMMEDIATE');
       try {
         await db.execAsync(m.sql); // DDL multi-statement
         await db.execAsync(`PRAGMA user_version = ${m.version}`); // INSIDE the same tx
         await db.execAsync('COMMIT');
       } catch (e) {
         await db.execAsync('ROLLBACK').catch(() => undefined);
         throw e;
       }
     } catch (e) {
       const msg = String(e ?? '');
       const isDdlInTxRejected = /cannot.*DDL|not allowed.*transaction/i.test(msg);
       if (!isDdlInTxRejected) throw e;

       // Documented fallback: withTransactionAsync wraps in a savepoint.
       // PRAGMA user_version inside the callback still commits atomically with
       // the DDL because withTransactionAsync rolls back on throw.
       await db.withTransactionAsync(async () => {
         await db.execAsync(m.sql);
         await db.execAsync(`PRAGMA user_version = ${m.version}`);
       });
     }
   }
   ```

   **Verification step (added to Phase 1 acceptance):**
   - On the pinned Expo SDK, write a test that runs migration 001 inside `BEGIN IMMEDIATE` against an in-memory `expo-sqlite` and asserts no rejection. If rejected, the fallback path is exercised; that result is also acceptable but must be logged in `.omc/logs/phase1-tx-mode.txt`.
   - Crash-recovery test: simulate a thrown error after the DDL runs but before the PRAGMA write (mock `execAsync` to throw on the PRAGMA); assert that re-opening the DB shows `user_version = 0` and that the table created by DDL does **not** exist (i.e., the rollback worked).

   Migration 001 schema (unchanged from v1):
   - `children(id INTEGER PK, name TEXT NOT NULL, color_index INTEGER NOT NULL CHECK(color_index BETWEEN 0 AND 5), created_at TEXT NOT NULL)`
   - `schedules(id INTEGER PK, child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE, title TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('school','academy','activity','other')), location TEXT, notes TEXT, days_of_week INTEGER NOT NULL, start_minutes INTEGER NOT NULL, end_minutes INTEGER NOT NULL, valid_from TEXT NOT NULL, valid_until TEXT, notify_minutes_before INTEGER)`
   - `schedule_exceptions(id INTEGER PK, schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE, date TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('cancel','modify')), override_start_minutes INTEGER, override_end_minutes INTEGER, override_title TEXT, UNIQUE(schedule_id, date))`
   - `notification_settings(child_id INTEGER PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE, default_minutes_before INTEGER NOT NULL DEFAULT 15, sound INTEGER NOT NULL DEFAULT 1, enabled INTEGER NOT NULL DEFAULT 1)`
   - Indexes: `idx_schedules_child(child_id)`, `idx_exceptions_schedule_date(schedule_id, date)`.

3. **Domain types & constants.** Plain TS interfaces matching row shapes.

4. **`occurrences.ts` algorithm** — unchanged from v1 (pure function, on-demand expansion).

5. **Grid layout (`grid.ts`)** — unchanged from v1.

### Acceptance (Phase 1)

- [ ] Smoke gate (Phase 0 §6) still green.
- [ ] App boots, runs migrations once, second boot does not re-run them.
- [ ] **Crash-recovery test passes:** mocked PRAGMA failure leaves DB at `user_version=0` with no DDL artifacts.
- [ ] **Tx-mode logged:** `.omc/logs/phase1-tx-mode.txt` records whether explicit `BEGIN IMMEDIATE` or `withTransactionAsync` fallback path was used.
- [ ] `tests/domain/occurrences.test.ts` passes ≥ 15 cases.
- [ ] No UI yet — scaffold renders an empty placeholder screen.

---

## Phase 2 — Domain & Data

(Unchanged from v1.)

### Tasks

1. **Repositories** — one file per entity in `src/db/repositories/`. Each exports: `getById`, `list`, `create`, `update`, `delete`. All return domain types via `row-mappers.ts`. All take `db` as first arg.
2. **State stores (Zustand).** `children-store`, `schedules-store`, `ui-store`. Selectors return stable references; grid components subscribe with shallow-equal selectors.
3. **Tests.** In-memory `expo-sqlite` (`openDatabaseSync(':memory:')`). Repository round-trip tests. Coverage gate: `jest --coverage` ≥80% on `src/domain/**` and `src/db/**`.

### Acceptance (Phase 2)

- [ ] All repositories CRUD round-trip.
- [ ] Coverage ≥80% on db + domain.
- [ ] `tsc --noEmit` clean with `noUncheckedIndexedAccess` on.

---

## Phase 3 — UI: Daily Spread

### Tasks

1. **`app/(tabs)/index.tsx` — DailyView with empty-state.**
   - Header: date label, prev/next buttons, "오늘로" reset.
   - **Empty-state branch (Critic gap):** if `useChildrenStore().children.length === 0`, render `<EmptyChildrenState>` instead of the grid:
     - Friendly message "자녀를 등록해 일정을 시작하세요."
     - CTA button → router.push(`/(tabs)/settings`) (or directly opens the Add Child sheet).
     - No grid, no header columns. The grid only mounts when ≥1 child exists.
   - When `children.length >= 1`: children header row (up to 4 columns, each with name + color dot). Tapping name → `router.push('/child/${id}')`.
   - Body: scrollable 35-row grid (one row per 30-min slot from 06:00 to 23:00).
   - Renders `DailyGrid` with `occurrences = useSchedulesForDate(date)`.

2. **`src/ui/grid/DailyGrid.tsx`.** (Unchanged from v1.) Single `ScrollView` with absolutely-positioned blocks. Memoized SlotCell rows.

3. **Swipe gesture.** (Unchanged.) `Gesture.Race(Pan().activeOffsetX([-12, 12]), tap)`.

4. **30-min-미만 보존.** `heightSlots = max(1, …)` in `grid.ts`.

### Acceptance (Phase 3)

- [ ] Grid renders 4 columns × 35 rows on iOS sim and Android emu.
- [ ] **With zero children, EmptyChildrenState renders with a working CTA to settings.**
- [ ] Inserting a fake schedule via SQL → block appears at correct slot/column/color.
- [ ] Swipe left/right moves to next/prev day with animation.
- [ ] Tapping empty slot opens (a stub) edit sheet with pre-filled (child, startTime).
- [ ] On Android emu (API 33), scroll FPS does not drop below 55 with 20 schedules across the grid.

---

## Phase 4 — UI: Weekly Drilldown + CRUD

### Tasks

1. **`app/child/[id].tsx` — WeeklyView.** (Unchanged.) 7 cols × 35 rows; reuses `layoutWeek()`.

2. **`src/ui/sheets/ScheduleEditSheet.tsx` (`@gorhom/bottom-sheet`) — keyboard-aware.**
   - Modes: `create` | `editAll` | `editOccurrence`.
   - Fields: child picker (chips), title, type (4 chips with icon), location, notes, daysOfWeek (7 toggles), startTime (24h picker, 30-min step), endTime (24h picker, 30-min step), validFrom/validUntil (date pickers), notifyMinutesBefore.
   - **Keyboard-aware behavior (Critic gap):**
     - Use `BottomSheetModal` from `@gorhom/bottom-sheet` with `keyboardBehavior="interactive"` and `keyboardBlurBehavior="restore"`.
     - Wrap text inputs (`title`, `location`, `notes`) in `BottomSheetTextInput` so the sheet adjusts above the keyboard on both iOS and Android.
     - On Android specifically: `android:windowSoftInputMode="adjustResize"` in the manifest (Expo: `expo.android.softwareKeyboardLayoutMode = "resize"` in `app.json`).
     - Verify: open sheet on iPhone SE (small screen) emulator, focus the `notes` field, confirm sheet rises and submit button remains visible.
   - Validation: `endMinutes > startMinutes`; `daysOfWeek !== 0` unless single-day; `validUntil ?? null >= validFrom`.
   - Save flow: `create` / `editAll` / `editOccurrence` (per v1).

3. **`app/(tabs)/settings.tsx` — children management with hard 5th-child guard + DB export.**
   - **Children list with cap (Critic gap):**
     - Render existing children with name + color dot + edit/delete actions.
     - "Add child" button is **disabled and visually grayed** when `children.length >= 4` (spec MAX_CHILDREN=4).
     - Tapping the disabled button shows an inline message "최대 4명까지 등록할 수 있습니다." — no modal, no error.
     - Server-side belt: `repositories/children.ts.create()` rejects with a typed error if `(SELECT COUNT(*) FROM children) >= 4`. UI never relies on this; it's a defense-in-depth check.
   - **Per-child default notification minutes** (unchanged).
   - **DB → JSON export button (Critic gap, "기기변경" carryover from spec Round 4):**
     - "데이터 내보내기 (JSON)" button. Tapping it:
       - Reads all rows from `children`, `schedules`, `schedule_exceptions`, `notification_settings`.
       - Serializes to a single JSON object: `{ exportedAt, schemaVersion, children, schedules, exceptions, notificationSettings }`.
       - Writes to `${FileSystem.documentDirectory}schedulapp-export-${YYYYMMDD-HHMM}.json`.
       - Invokes `Sharing.shareAsync(uri)` so the user can AirDrop / save to Files / send to themselves.
     - **No import button in MVP.** Export-only is the explicit one-button escape hatch. Import is a v3 concern.

4. **Wire stores.** (Unchanged.) Mutations route through repository → invalidate `schedulesByDate` → store re-emits.

### Acceptance (Phase 4)

- [ ] Full CRUD path on iOS sim and Android emu.
- [ ] "이 회차만 삭제" creates an exception row; original schedule unchanged.
- [ ] "전체 삭제" deletes schedule + cascades exceptions.
- [ ] Editing a single occurrence's time shifts only that date's block on both DailyView and WeeklyView.
- [ ] **Add-child button is disabled with the cap message when 4 children exist.** Repository-level `create()` also rejects.
- [ ] **Edit sheet on iPhone SE: focusing `notes` raises the sheet above the keyboard; submit button remains tappable.**
- [ ] **Settings → "데이터 내보내기 (JSON)" produces a valid JSON file** with all four entity tables and triggers the share sheet.

---

## Phase 5 — Notifications

### Tasks

1. **`src/notifications/permissions.ts`.** Request on first save attempt that has `notifyMinutesBefore`. Persist that we asked (AsyncStorage flag) so we don't nag on denial.

2. **`src/notifications/scheduler.ts` — reconciliation-first model.**

   **Architect S3 / Critic C7 fix.** v1 treated the AsyncStorage `Map<scheduleId, notificationIds[]>` as authoritative; a crash mid-delete leaked orphan triggers. v2: the OS scheduled-notifications queue is treated as a derived projection of the SQLite DB. AsyncStorage is a per-session cache only.

   ```ts
   // src/notifications/scheduler.ts
   import * as Notifications from 'expo-notifications';

   // PER-SESSION CACHE ONLY. Cleared on cold start. NEVER source of truth.
   // Used to accelerate cancelForSchedule(scheduleId) within a single session;
   // we never persist this map across cold starts.
   const sessionMap = new Map<number, string[]>(); // scheduleId -> notification ids

   export async function scheduleForSchedule(
     s: Schedule,
     exceptions: ScheduleException[],
     horizonDays = 14,
   ): Promise<void> {
     const occurrences = expandOccurrences([s], exceptions, {
       from: today(),
       to: addDays(today(), horizonDays),
     });
     const ids: string[] = [];
     for (const o of occurrences) {
       if (s.notifyMinutesBefore == null) continue;
       const fireAt = subtractMinutes(localDateTime(o.date, o.startMinutes), s.notifyMinutesBefore);
       if (fireAt <= new Date()) continue;
       const id = await Notifications.scheduleNotificationAsync({
         content: { title: s.title, body: formatBody(o) },
         trigger: { date: fireAt },
       });
       ids.push(id);
     }
     sessionMap.set(s.id, ids);
   }

   export async function cancelForSchedule(scheduleId: number): Promise<void> {
     const ids = sessionMap.get(scheduleId) ?? [];
     for (const id of ids) {
       await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
     }
     sessionMap.delete(scheduleId);
   }

   export async function cancelForOccurrence(scheduleId: number, date: ISODate): Promise<void> {
     // Fine-grained cancel uses the session map when available; if cache is cold
     // (post-restart), defer to rescheduleAll() which is the reconciliation path.
     // Acceptable because cancelForOccurrence is only called from in-session UI
     // edits (the user just opened the sheet).
     const ids = sessionMap.get(scheduleId);
     if (!ids) return;
     // Caller (Phase 4 save flow) is responsible for narrowing to the right id;
     // simplest impl: re-derive by deterministic ordering. For MVP: no-op here
     // and let rescheduleAll() be the source of truth via cancelAll + rebuild.
   }

   /**
    * SOURCE-OF-TRUTH RECONCILIATION.
    * Always wipe the OS queue, then rebuild from DB. Never trusts sessionMap.
    * Called on:
    *   1) cold start (always)
    *   2) AppState transition to active (debounced — see §3)
    *   3) after any DB mutation that affects scheduling
    */
   export async function rescheduleAll(): Promise<void> {
     // CRITICAL: wipe first. This eliminates orphan triggers from any prior
     // crash mid-delete, prior version's bugs, or AsyncStorage drift.
     await Notifications.cancelAllScheduledNotificationsAsync();
     sessionMap.clear();

     const schedules = await schedulesRepo.list();
     for (const s of schedules) {
       const exceptions = await exceptionsRepo.listForSchedule(s.id);
       await scheduleForSchedule(s, exceptions);
     }
   }
   ```

   **Key invariants documented in the file header:**
   - **The OS scheduled-notifications queue is a derived projection of `schedules` + `schedule_exceptions` + `notification_settings`.**
   - **`sessionMap` is an in-memory cache only.** It is never read from AsyncStorage. It is never written to AsyncStorage. It is rebuilt every cold start by `rescheduleAll()`.
   - **`rescheduleAll()` is the only path that guarantees consistency.** Per-schedule `cancelForSchedule` / `cancelForOccurrence` are session-local optimizations.

3. **App lifecycle hook.**
   - `app/_layout.tsx` calls `rescheduleAll()` once after migrations + initial data load.
   - `AppState` listener: on transition to `active`, call `rescheduleAll()` (debounced — only run if last run was >60 min ago; cold start always runs). Documented as a known limitation that traveling across timezones doesn't immediately re-aim near-term triggers.
   - Background tasks deliberately not used (Expo background tasks are flaky on iOS).

### Acceptance (Phase 5)

- [ ] Permission prompt fires once on first save with notification.
- [ ] After saving a recurring schedule, `expo-notifications` `getAllScheduledNotificationsAsync()` returns the expected count for the next 14 days.
- [ ] Deleting a schedule clears all of its scheduled triggers.
- [ ] **Force-quit during a delete sweep, reopen, confirm `getAllScheduledNotificationsAsync()` returns ONLY triggers that match current DB rows (no orphans).** This is the Architect S3 acceptance.
- [ ] **`rescheduleAll()` always begins with `cancelAllScheduledNotificationsAsync()` — assert in unit test by mocking `expo-notifications` and checking call order.**
- [ ] **`sessionMap` is never persisted to AsyncStorage** — grep test in `tests/notifications/scheduler.test.ts` asserts no `AsyncStorage.setItem` referencing the notification map.
- [ ] **Manual:** kill the app on iOS sim, advance system clock, trigger fires.

---

## Phase 6 — Polish & QA

### Tasks

1. **Manual run-through of every Acceptance Criterion in the spec** on iOS 16+ sim and Android API 33+ emu.
2. **`/oh-my-claudecode:visual-verdict` pass on the daily grid** vs. an agreed reference screenshot.
3. **Backup/restore smoke test.**
   - iOS: enable iCloud Documents (entitlement was wired in Phase 0 §4), force-quit, delete app, reinstall, confirm DB restored.
   - Android: equivalent via `adb backup` / Auto Backup harness.
   - **Cross-check the JSON export escape hatch:** export from device A, fresh-install on device B (no iCloud), confirm the user *could* manually re-enter (we don't ship an importer, but we ship the export — that's the contract).
   - Document outcomes in `.omc/research/backup-restore.md`.
4. **Performance check.** 4 children × 8 schedules each × 14 days of triggers; daily-view scroll FPS ≥ 55.
5. **Final lint/type/test sweep + coverage report.**
6. **README.md** with run-book, troubleshooting, and the three guardrails (no servers, no rrule, fixed defaults).

### Acceptance (Phase 6)

- [ ] Every checkbox in spec §Acceptance Criteria is ticked.
- [ ] Coverage report ≥ 80% on db + domain committed under `.omc/research/coverage-final.txt`.
- [ ] visual-verdict pass committed under `.omc/research/visual-verdict-grid.md`.
- [ ] Backup/restore outcome documented under `.omc/research/backup-restore.md`.

---

## File-level breakdown

### Phase 0
- `package.json` (Expo SDK pinned), `tsconfig.json` (no `exactOptionalPropertyTypes`), `babel.config.js`, `.eslintrc.js`, `.prettierrc`, `jest.config.js`, `app.json` (iCloud entitlements), `.env` (`EXPO_NO_TELEMETRY=1`).
- `.claude/settings.json` — three OMC hooks (per-edit `eslint --fix`, `Stop` `tsc --noEmit --incremental`, SessionStart `expo-doctor`).
- `.gitignore` — Expo standard + `*.tsbuildinfo` + `.env.local`.
- `.omc/logs/phase0-smoke.log` — smoke gate output.

### Phase 1
- `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/settings.tsx`, `app/child/[id].tsx`, `app/schedule/edit.tsx` — placeholders.
- `src/db/client.ts`, `src/db/migrations/001_init.sql.ts`, `src/db/migrations/index.ts` (in-tx PRAGMA), `src/db/row-mappers.ts`.
- `src/domain/{types,constants,days-of-week,occurrences,grid}.ts`.
- `tests/domain/{occurrences,grid,days-of-week}.test.ts`, `tests/db/migrations.test.ts` (incl. crash-recovery test).
- `.omc/logs/phase1-tx-mode.txt` — records which tx path was used.

### Phase 2
- `src/db/repositories/{children,schedules,schedule-exceptions,notification-settings}.ts`.
- `src/state/{children-store,schedules-store,ui-store}.ts`.
- `tests/db/repositories/*.test.ts`, `tests/state/*.test.ts`.

### Phase 3
- `src/ui/grid/{DailyGrid,ScheduleBlock,SlotCell}.tsx`.
- `src/ui/common/{ColorDot,TypeIcon,EmptyChildrenState}.tsx`.
- `app/(tabs)/index.tsx` — full implementation with empty-state branch.

### Phase 4
- `src/ui/weekly/WeeklyGrid.tsx`.
- `src/ui/sheets/ScheduleEditSheet.tsx` (keyboard-aware).
- `app/child/[id].tsx`, `app/schedule/edit.tsx` — full implementation.
- `app/(tabs)/settings.tsx` — child management with 5th-child guard + DB-export button.

### Phase 5
- `src/notifications/{permissions,scheduler}.ts` (reconciliation-first).
- App-lifecycle hook in `app/_layout.tsx`.
- `tests/notifications/scheduler.test.ts` — incl. "rescheduleAll begins with cancelAll" + "sessionMap never persisted" assertions.

### Phase 6
- `README.md`, `.omc/research/coverage-final.txt`, `.omc/research/visual-verdict-grid.md`, `.omc/research/backup-restore.md`.

---

## Test Strategy

### Unit (jest + jest-expo)
- `domain/occurrences.test.ts` — ≥ 15 cases (unchanged from v1).
- `domain/grid.test.ts` — overlap policy, 30-min sliver preservation.
- `domain/days-of-week.test.ts` — bitmask round-trips.
- `db/migrations.test.ts` — fresh DB → `user_version = 1`; second run → no-op; **crash-recovery: PRAGMA throw → rollback leaves user_version=0 with no DDL artifacts**.
- `db/repositories/*.test.ts` — round-trip + cascade.
- `state/*.test.ts` — selector identity.
- `notifications/scheduler.test.ts` — mock `expo-notifications`; assert: (a) `rescheduleAll()` first call is `cancelAllScheduledNotificationsAsync`; (b) per-schedule scheduling produces correct horizon count; (c) `sessionMap` is in-memory only (no AsyncStorage writes referencing the map).

### Integration
- `notifications/scheduler.test.ts` — recurring schedule with one exception in horizon, correct count + metadata.

### Manual
- iOS sim 16+ AND Android emu API 33+. Each acceptance checkbox per platform.
- Killed-app notification firing.
- Backup/restore.
- Force-quit-during-delete → reopen → `getAllScheduledNotificationsAsync()` matches DB.

---

## Risks & Mitigations

1. **expo-sqlite migrations on app upgrade.**
   *Risk:* Schema v2 ships, user has v1 DB; migration crashes; user is locked out.
   *Mitigation:* Migration runs in a single `BEGIN IMMEDIATE…COMMIT` with `PRAGMA user_version = N` **inside** the transaction. Fallback to `withTransactionAsync` if the SDK rejects DDL inside an explicit BEGIN. Crash-recovery test covers PRAGMA failure path. (Architect S2 closed.)

2. **Timezone correctness for daysOfWeek.**
   *Risk:* User flies abroad; `dayOfWeek` derived from UTC vs local would silently shift schedules.
   *Mitigation:* Always derive day-of-week from device-local time using `new Date(year, monthIdx, day)`. Store dates as `YYYY-MM-DD` strings. Unit-test by faking TZ with `process.env.TZ` in jest setup. (Deeper Berlin-DST test deferred to v3 — tracked in open-questions.)

3. **Notification race conditions on rapid edits.**
   *Risk:* Edit twice in 1 second → first scheduler call still in flight.
   *Mitigation:* `cancelForSchedule` always runs before `scheduleForSchedule` inside an `async` mutex keyed by `scheduleId`. **Plus:** `rescheduleAll()` always wipes the OS queue first via `cancelAllScheduledNotificationsAsync()`, so cross-cold-start drift is impossible. (Architect S3 closed.)

4. **RN gesture conflicts on the grid.**
   *Risk:* Vertical scroll vs horizontal swipe vs tap.
   *Mitigation:* `Gesture.Race(Pan().activeOffsetX([-12, 12]), tap)`.

5. **iOS background refresh of notification horizon.**
   *Risk:* User doesn't open the app for 14+ days; horizon expires.
   *Mitigation:* `rescheduleAll()` on every cold start AND on `AppState=active` (debounced to >60min between runs). Documented limitation.

6. **Hook latency (NEW in v2).**
   *Risk:* Per-edit `tsc --noEmit` adds 2–10s × 30 edits = minutes of stall.
   *Mitigation:* Per-edit hook is `eslint --fix` only (~500ms warm, file-scoped). `tsc --noEmit --incremental` runs on `Stop` (once per agent turn end). (Architect S1 closed.)

---

## ADR (FINAL)

### Decision
- **UI:** Bare RN + react-native-gesture-handler + react-native-reanimated + @gorhom/bottom-sheet.
- **State:** Zustand.
- **SQLite:** Raw SQL via expo-sqlite (next-gen async API) with hand-written migration runner & repositories. **`PRAGMA user_version = N` is inside the same `BEGIN IMMEDIATE … COMMIT` transaction as the DDL.**
- **Occurrences:** On-demand pure-function expansion (`expandOccurrences`).
- **Notifications:** OS scheduled-notifications queue is treated as a **derived projection** of SQLite. AsyncStorage notification id-map is a **per-session in-memory cache only** — never source of truth. `rescheduleAll()` always begins with `cancelAllScheduledNotificationsAsync()`.
- **Hooks:** Per-edit hook is `eslint --fix` only. `tsc --noEmit --incremental` is on `Stop` hook.
- **Phase 0 smoke gate:** Non-interactive — `expo-doctor`, `expo export --platform=all` (timeout 60s), `tsc --noEmit`, `eslint .`, `jest --passWithNoTests`. No `npx expo start` interactive process in the gate.
- **TS strict:** `strict: true` + `noUncheckedIndexedAccess: true`. **`exactOptionalPropertyTypes` is OMITTED** because expo-router generated types collide with it on the pinned SDK.
- **Expo SDK:** Pinned in `package.json` (`~52.x` or current LTS at execution time).

### Decision Drivers
D1 Expo compatibility & maintainability; D2 Test surface for occurrence/exception logic; D3 Grid render performance.

### Alternatives considered
- A2 tamagui, A3 react-native-paper.
- B2 Context+useReducer, B3 Redux Toolkit.
- C2 Drizzle, C3 Kysely.
- D2 materialized instances.
- (Hooks) v1 per-edit `tsc --noEmit` — rejected due to ~5–10s cold latency violating the <1s per-edit budget.
- (Smoke gate) v1 `npx expo start --no-dev --offline` — rejected because it is an interactive long-running process with no exit-code semantic.
- (TS) `exactOptionalPropertyTypes` — rejected because it produces fresh-project errors against expo-router types on the pinned SDK before any product code exists.

### Why chosen
Each chosen option dominates its alternatives on at least 2 of 3 drivers. The hooks/gate/TS revisions in v2 are mandated by the realities of the toolchain rather than a preference shift.

### Consequences
**(+)** Zero ORM lock-in; recurrence query stays a hand-tuned SELECT.
**(+)** Tiny bundle; Expo SDK upgrades safer.
**(+)** Per-edit hook is fast (<500ms warm); no developer-experience tax on the agent loop.
**(+)** Migration writes are atomic — no double-apply risk on schema bumps.
**(+)** Notification queue cannot leak orphans across crashes — always reconciled from DB on cold start.
**(+)** Smoke gate is mechanically checkable in a single shell script (CI-ready).
**(-)** We hand-write row→domain mappers (~40 LoC across 4 entities). Mismatches between schema and TS types surface as runtime errors, not compile errors. Acceptable given the 4-entity scope and the SQL-fluency of the team.
**(-)** Bare-RN UI means hand-built form chrome for the edit sheet and settings (~600 LoC of inputs/chips/pickers/toggles a design system would provide). Accessibility (TalkBack/VoiceOver labels, focus order, font scaling) is per-component on us. Dark mode requires a token system we don't have yet.
**(-)** Zustand has no devtools UI like Redux; debugging state changes leans on `console.log` + Reactotron at most.
**(-)** Dropping `exactOptionalPropertyTypes` means `{ foo?: T }` accepts `{ foo: undefined }` — a small soundness loss tolerated to avoid fighting expo-router.
**(-)** `rescheduleAll()` wiping the entire OS queue on cold start is correct but creates a sub-second window of zero pending triggers. Tolerated because cold start is rare and the rebuild is synchronous.

### Follow-ups (deferred to v3 / post-MVP)
- Architect S4 — `ON CONFLICT(schedule_id, date) DO UPDATE` for `schedule_exceptions` writes.
- Architect S5 — Per-child non-color disambiguator + explicit WCAG-paired palette.
- Architect S6 — Berlin-DST unit test + TZ assumption header in `occurrences.ts`.
- Architect S7 — `BottomSheetScrollView` wiring inside the edit sheet.
- Architect S8 — Decide & document 30-min granularity (`CHECK(start_minutes % 30 = 0)`) at schema level.
- Architect T5 / iOS 64-trigger cap — horizon cap with reschedule-on-foreground top-up.
- Critic #7 — Debounce window tuning beyond the 60-min default.
- Revisit Drizzle if/when schema crosses ~10 tables.
- Revisit a materialized-instance cache only if profiling shows `expandOccurrences` exceeds 5ms on a P50 device.
- DB-import (paired with the v2 export button) for full device-migration story.
