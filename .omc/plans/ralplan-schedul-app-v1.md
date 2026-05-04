# Ralplan v1 — schedul-app

> **Source spec:** `.omc/specs/deep-interview-schedul-app.md` (ambiguity 5.0%, PASSED)
> **Target stack (locked by deep-interview):** Expo SDK + React Native + TypeScript + expo-sqlite + expo-notifications + expo-router
> **Mode:** SHORT (default ralplan). DELIBERATE upgrade reserved for Critic round if pre-mortem flags blockers.

---

## RALPLAN-DR Summary

### Principles (5)

1. **Local-first, zero-server.** No accounts, no sync, no telemetry. OS backup is the only durability story. Every dependency that implies a server is rejected.
2. **Pure functions own correctness; UI owns layout only.** Occurrence calculation, recurrence expansion, and exception application live in `src/domain/**` as deterministic, DB-free TypeScript so they can be unit-tested to ≥80%.
3. **Boring, well-supported, Expo-blessed.** Pick libraries that survive `expo prebuild` and Expo SDK upgrades. Reject anything requiring custom native modules unless no alternative exists.
4. **Static defaults are the spec, not config.** 4 children / 30-min slots / 06–23h / 6 colors / 4 types are constants in code, not user settings. Build cheaper UI on top of locked defaults.
5. **Phase 0 is a gate, not a phase.** No `app/` code, no schema work, no agents spawned for features until tooling, hooks, and a green smoke build exist on this machine.

### Decision Drivers (top 3)

1. **D1 — Expo compatibility & maintainability.** Library must work with Expo Managed workflow and survive the next two SDK bumps without custom native code. (Weight: highest — we are a single dev, no native ops.)
2. **D2 — Test surface for occurrence/exception logic.** Whatever DB & state choice we make, the recurrence-expansion algorithm must remain a pure function that consumes plain rows; no ORM magic in the hot path.
3. **D3 — Grid render performance on the daily spread.** 4 columns × 35 slots = 140 cells, redrawing on swipe/edit. Must hit 60fps on mid-range Android. State updates must be granular (don't re-render the whole grid on a single block edit).

### Viable Options

#### Axis A — UI Library

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **(A1) Bare RN primitives + react-native-gesture-handler + react-native-reanimated** | Zero adoption risk; Expo officially supports both; full control over the 4×35 grid; no theme system to fight; smallest bundle. | Have to handcraft typography/buttons/sheets; design consistency is on us. | **CHOSEN** |
| (A2) tamagui | Rich design system, themable, fast. | Heavy build-time codegen, Expo SDK upgrades sometimes lag, opinionated styling collides with custom grid. | Reject — D1 risk too high for a 4-screen app. |
| (A3) react-native-paper | Stable Material library, easy forms. | Material aesthetic clashes with the dense bespoke grid; not designed for column×row time layouts. | Reject — D3: paper components inside the grid would over-render. |

We will pull in `@gorhom/bottom-sheet` for the schedule edit sheet (only) — it is Expo-friendly and avoids reimplementing the modal+pan-gesture stack ourselves.

#### Axis B — State Management

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **(B1) Zustand + per-slice stores (children, schedules-by-date, ui)** | Tiny (~1KB), no provider tree, selector-based subscriptions kill grid re-renders, plays well with async DB hydration. | No built-in persistence (don't need it — SQLite is the source of truth). | **CHOSEN** |
| (B2) React Context + useReducer | Zero deps, idiomatic. | Context updates re-render every consumer — kills D3 (grid perf) without aggressive memoization. | Reject. |
| (B3) Redux Toolkit | Mature, devtools. | Boilerplate-to-feature ratio is hostile for a 4-screen app. | Reject. |

#### Axis C — SQLite Access Pattern

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **(C1) Raw SQL via `expo-sqlite` (next-gen async API) + hand-written repositories + a tiny migration runner** | Zero ORM coupling; migrations are just numbered `.sql` strings; recurrence query stays a hand-tuned `SELECT … WHERE valid_from <= ? AND (valid_until IS NULL OR valid_until >= ?) AND (days_of_week & ?) != 0`; trivial to mock in jest. | We write our own type guards from rows → domain types. (Mitigated with one shared `rowToSchedule()` mapper per entity.) | **CHOSEN** |
| (C2) Drizzle ORM | Typed query builder, schema-as-code. | Drizzle's expo-sqlite adapter requires `drizzle-kit` with native bindings on dev machine; one more thing to break on SDK upgrade; bitmask predicates fight the type system. | Reject — D1 + D2 both worse. |
| (C3) Kysely + expo-sqlite dialect | Lightweight typed builder. | Community dialect, less battle-tested on Expo than Drizzle; same D1 risk for less D2 payoff. | Reject. |

#### Axis D — Occurrence Calculation Strategy

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **(D1) On-demand expansion: `expandOccurrences(schedules, exceptions, dateRange)` pure function called per visible day** | No materialization, no cache invalidation; trivial to reason about; correctness == one unit-tested function. | Recomputes every swipe — but range is at most 7 days × 4 children × ~10 schedules = trivial. | **CHOSEN** |
| (D2) Materialize a `ScheduleInstance` table on every schedule write | O(1) reads. | Cache invalidation on every schedule edit / exception / date crossing midnight; 3× the surface area for bugs. | Reject — overkill for the data volume. |

> **Single-option axes:** None are sole survivors here — every axis has a real runner-up.

---

## Phase 0 — Dev Environment Setup (GATED — must pass before any phase ≥1)

> **The user explicitly required this phase before any code.** Autopilot/ralph **must** halt if the smoke gate fails.

### Tasks

1. **Bootstrap repo.**
   - `git init` (already in working dir; if not, run it).
   - `npx create-expo-app@latest . --template blank-typescript` (use `.` to populate current dir; abort if non-empty unexpected files).
   - Add `.gitignore` standard Expo entries (`.expo/`, `node_modules/`, `dist/`, `*.log`, `ios/`, `android/`).
2. **Install runtime deps.**
   - `npx expo install expo-router expo-sqlite expo-notifications expo-haptics expo-linking react-native-gesture-handler react-native-reanimated react-native-safe-area-context react-native-screens @react-native-async-storage/async-storage`
   - `npx expo install zustand @gorhom/bottom-sheet`
   - `babel.config.js` → add `react-native-reanimated/plugin` last in plugins.
3. **Install dev deps.**
   - `npm i -D typescript @types/react eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-config-expo prettier eslint-config-prettier eslint-plugin-prettier jest jest-expo @testing-library/react-native @testing-library/jest-native @types/jest`
   - `tsconfig.json` → `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`.
   - `.eslintrc.js`, `.prettierrc`, `jest.config.js` (preset `jest-expo`, setup file with RN gesture-handler mock).
4. **Configure expo-router.**
   - `package.json` `"main": "expo-router/entry"`.
   - `app.json` add `"scheme": "schedulapp"`, plugins `["expo-router", "expo-notifications", "expo-sqlite"]`.
5. **Install OMC hooks (`.claude/settings.json`).** Create or merge:
   ```json
   {
     "hooks": {
       "PostToolUse": [
         { "matcher": "Edit|Write", "hooks": [
           { "type": "command", "command": "if echo \"$CLAUDE_TOOL_FILE_PATH\" | grep -qE '\\.tsx?$'; then npx tsc --noEmit && npx eslint --fix \"$CLAUDE_TOOL_FILE_PATH\"; fi" }
         ]}
       ],
       "SessionStart": [
         { "hooks": [ { "type": "command", "command": "npx expo-doctor 2>&1 | tail -n 1 || true" } ] }
       ]
     }
   }
   ```
   (Hooks must NOT block on long-running ops — keep each under ~5s. Heavier checks belong in CI/ralph.)
6. **Smoke gate (the gate itself).** All four must pass on this machine, with output captured to `.omc/logs/phase0-smoke.log`:
   - `npx expo start --no-dev --offline` boots Metro with no red error.
   - `npx tsc --noEmit` — exit 0.
   - `npx eslint .` — exit 0.
   - `npx jest --passWithNoTests` — exit 0.
7. **First commit.** `chore: bootstrap expo + tooling (phase 0)`.

### Acceptance (Phase 0 gate)

- [ ] `.claude/settings.json` exists with the three hooks above.
- [ ] All four smoke commands exit 0.
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
   tests/
     domain/occurrences.test.ts
     domain/grid.test.ts
     domain/days-of-week.test.ts
     db/migrations.test.ts
   ```
2. **Migration runner (`src/db/migrations/index.ts`).**
   - Reads `PRAGMA user_version`. For each migration with index > current, run inside a transaction, then `PRAGMA user_version = N`. Idempotent on cold + warm starts.
   - Migration 001 schema:
     - `children(id INTEGER PK, name TEXT NOT NULL, color_index INTEGER NOT NULL CHECK(color_index BETWEEN 0 AND 5), created_at TEXT NOT NULL)`
     - `schedules(id INTEGER PK, child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE, title TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('school','academy','activity','other')), location TEXT, notes TEXT, days_of_week INTEGER NOT NULL, start_minutes INTEGER NOT NULL, end_minutes INTEGER NOT NULL, valid_from TEXT NOT NULL, valid_until TEXT, notify_minutes_before INTEGER)`
     - `schedule_exceptions(id INTEGER PK, schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE, date TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('cancel','modify')), override_start_minutes INTEGER, override_end_minutes INTEGER, override_title TEXT, UNIQUE(schedule_id, date))`
     - `notification_settings(child_id INTEGER PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE, default_minutes_before INTEGER NOT NULL DEFAULT 15, sound INTEGER NOT NULL DEFAULT 1, enabled INTEGER NOT NULL DEFAULT 1)`
     - Indexes: `idx_schedules_child(child_id)`, `idx_exceptions_schedule_date(schedule_id, date)`.
3. **Domain types & constants.** Plain TS interfaces matching row shapes (no class hierarchy, no Zod yet — add only if a real boundary needs it).
4. **`occurrences.ts` algorithm — the hardest pure-logic piece.**

   ```ts
   // Inputs:
   //   schedules:  Schedule[]              (already filtered to non-deleted)
   //   exceptions: ScheduleException[]     (for those schedules)
   //   range:      { from: ISODate; to: ISODate }   // inclusive, both YYYY-MM-DD
   // Output:
   //   ScheduleOccurrence[]  — one per (schedule, date) that survives
   //
   // Steps:
   //  1) Build exceptionsByScheduleId: Map<scheduleId, Map<ISODate, ScheduleException>>.
   //  2) For each schedule s:
   //       const dayStart = max(range.from, s.validFrom)
   //       const dayEnd   = min(range.to,   s.validUntil ?? range.to)
   //       if (dayStart > dayEnd) continue
   //       For each date d in [dayStart..dayEnd]:
   //         const dow = dayOfWeekIndex(d)              // Mon=0..Sun=6, fixed in TZ-of-device
   //         if ((s.daysOfWeek & (1 << dow)) === 0) continue
   //         const ex = exceptionsByScheduleId.get(s.id)?.get(d)
   //         if (ex?.kind === 'cancel') continue
   //         const startMin = ex?.overrideStartMinutes ?? s.startMinutes
   //         const endMin   = ex?.overrideEndMinutes   ?? s.endMinutes
   //         const title    = ex?.overrideTitle        ?? s.title
   //         push({ scheduleId: s.id, childId: s.childId, date: d, startMinutes: startMin,
   //                endMinutes: endMin, title, type: s.type, color: paletteIndexFor(s.childId),
   //                exceptionId: ex?.id ?? null })
   //  3) Return sorted by (date, startMinutes, scheduleId).
   ```

   Properties unit tests must lock:
   - cancel exception removes only that date.
   - modify exception with overrideStartMinutes shifts only that date.
   - validUntil exclusive boundary: schedule with `validUntil = '2026-05-31'` does NOT generate occurrences on `2026-06-01`.
   - daysOfWeek bitmask = 0 → no occurrences ever.
   - Date arithmetic uses **local device timezone** (the device clock is the user's clock; we explicitly do not store TZ).
5. **Grid layout (`grid.ts`).**

   ```ts
   // layoutDay(occurrences, childIds) returns BlockLayout[]
   // Each occurrence becomes one block:
   //   column = childIds.indexOf(o.childId)              // 0..3
   //   topSlot = floor((o.startMinutes - 360) / 30)      // 06:00 == minute 360
   //   heightSlots = max(1, ceil((o.endMinutes - o.startMinutes) / 30))
   //   // 30분 미만 짜투리는 heightSlots=1 으로 보존 (acceptance: 잘림 X)
   // Overlap policy (same child, overlapping minutes):
   //   - Sort overlapping group by startMinutes asc, id asc.
   //   - Split column into N sub-columns (N = group size); each block gets sub-col index.
   //   - Render with width = 1/N of column, x-offset = subCol * (1/N).
   // Deterministic output for snapshot tests.
   ```

### Acceptance (Phase 1)

- [ ] `npx expo start` still green; tsc/eslint/jest still green.
- [ ] App boots, runs migrations once, second boot does not re-run them.
- [ ] `tests/domain/occurrences.test.ts` passes ≥ 15 cases (incl. all properties listed above).
- [ ] No UI yet — scaffold renders an empty placeholder screen; that's fine.

---

## Phase 2 — Domain & Data

### Tasks

1. **Repositories** — one file per entity in `src/db/repositories/`. Each exports: `getById`, `list`, `create`, `update`, `delete`. All return domain types via `row-mappers.ts`. All take `db` as first arg (testable; `client.ts` is the only place that constructs the singleton).
2. **State stores (Zustand).**
   - `children-store`: `children: Child[]`, `loadChildren()`, `upsertChild()`, `removeChild()`.
   - `schedules-store`: `schedulesByDate: Map<ISODate, ScheduleOccurrence[]>`, `loadDate(date)` (pulls schedules valid on that date + exceptions in ±1 day, calls `expandOccurrences`).
   - `ui-store`: current selected date, current weekly child id, edit-sheet state.
   - **Critical for D3:** every Zustand selector returns a stable reference; grid components subscribe with shallow-equal selectors so editing one block re-renders only that block + its column.
3. **Tests.**
   - DB tests run against in-memory `expo-sqlite` (`openDatabaseSync(':memory:')`).
   - Repository round-trip tests (insert → select → mapped type matches).
   - Coverage gate: `jest --coverage` reports ≥80% on `src/domain/**` and `src/db/**` (excluding `client.ts` singleton).

### Acceptance (Phase 2)

- [ ] All repositories CRUD round-trip.
- [ ] Coverage ≥80% on db + domain.
- [ ] `tsc --noEmit` clean with `noUncheckedIndexedAccess` on.

---

## Phase 3 — UI: Daily Spread

### Tasks

1. **`app/(tabs)/index.tsx` — DailyView.**
   - Header: date label, prev/next buttons, "오늘로" reset.
   - Children header row: 4 columns, each with name + color dot. Tapping name → router.push(`/child/${id}`).
   - Body: scrollable 35-row grid (one row per 30-min slot from 06:00 to 23:00).
   - Renders `DailyGrid` with `occurrences = useSchedulesForDate(date)`.
2. **`src/ui/grid/DailyGrid.tsx`.**
   - Fixed-size FlatList disabled — use a single `ScrollView` because 35 rows is small and we need absolutely-positioned blocks across rows.
   - Background: 35 `SlotCell` rows × 4 columns drawn once (memoized; never re-renders unless children change).
   - Foreground: `BlockLayout[]` from `layoutDay()`, each rendered as an absolutely-positioned `ScheduleBlock` (color from child palette, type icon top-left, label).
   - Tap on empty cell → opens edit sheet pre-filled with that (childId, time).
   - Tap on block → opens edit sheet in edit mode.
3. **Swipe gesture.**
   - `react-native-gesture-handler` Pan gesture on the grid wrapper, threshold 30% of width or velocity > 0.5.
   - On commit → `useUiStore.setDate(prev|next)`, `react-native-reanimated` slides the grid out and the new one in.
4. **30-min-미만 보존.** `heightSlots = max(1, …)` in `grid.ts` covers the spec rule "30분 미만 짜투리는 30분 슬롯 안에 시각적으로 보존".

### Acceptance (Phase 3)

- [ ] Grid renders 4 columns × 35 rows on iOS sim and Android emu.
- [ ] Inserting a fake schedule via SQL → block appears at correct slot/column/color.
- [ ] Swipe left/right moves to next/prev day with animation.
- [ ] Tapping empty slot opens (a stub) edit sheet with pre-filled (child, startTime).
- [ ] On Android emu (API 33), scroll FPS does not drop below 55 with 20 schedules across the grid.

---

## Phase 4 — UI: Weekly Drilldown + CRUD

### Tasks

1. **`app/child/[id].tsx` — WeeklyView.**
   - Header: child name + color dot, week navigator (prev/this/next).
   - Body: 7 columns (Mon–Sun) × 35 rows; reuses `layoutWeek()` (per-day `layoutDay` over a 7-day range).
   - Tap empty cell / block → same edit sheet as DailyView.
2. **`src/ui/sheets/ScheduleEditSheet.tsx` (`@gorhom/bottom-sheet`).**
   - Modes: `create` | `editAll` | `editOccurrence`.
   - Fields: child picker (4 chips), title, type (4 chips with icon), location, notes, daysOfWeek (7 toggles), startTime (24h picker, 30-min step), endTime (24h picker, 30-min step), validFrom/validUntil (date pickers), notifyMinutesBefore (number input or none).
   - Validation: `endMinutes > startMinutes`; `daysOfWeek !== 0` unless single-day; `validUntil ?? null >= validFrom`.
   - Save flow:
     - `create` → `schedules.create()` then `notifications.scheduler.scheduleForSchedule(s)`.
     - `editAll` → `schedules.update()`; cancel all triggers for this schedule then re-schedule N days.
     - `editOccurrence` (only available on a tapped block) → upsert `ScheduleException` for that date with overrides; cancel the single trigger for that date; if `kind === cancel`, just cancel its trigger.
   - Delete sheet: prompt "이 회차만 / 전체". `이 회차만` → exception with `kind='cancel'`. `전체` → `schedules.delete()` (cascade exceptions).
3. **Wire stores.** All mutations route through repository → invalidate `schedulesByDate` for the affected date range → store re-emits → grid columns re-render selectively.

### Acceptance (Phase 4)

- [ ] Full CRUD path on iOS sim and Android emu.
- [ ] "이 회차만 삭제" creates an exception row; original schedule unchanged.
- [ ] "전체 삭제" deletes schedule + cascades exceptions.
- [ ] Editing a single occurrence's time shifts only that date's block on both DailyView and WeeklyView.

---

## Phase 5 — Notifications

### Tasks

1. **`src/notifications/permissions.ts`.** Request on first save attempt that has `notifyMinutesBefore`. Persist that we asked (AsyncStorage flag) so we don't nag on denial.
2. **`src/notifications/scheduler.ts`.**
   - `scheduleForSchedule(s, exceptions, horizonDays = 14)`:
     - Use `expandOccurrences([s], exceptions, { from: today, to: today + horizonDays })` to enumerate next 14 days of triggers.
     - For each occurrence whose `(occurrenceStart - notifyMinutesBefore)` is in the future: `Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: { date } })`. Save returned id mapped to `(scheduleId, date)` in an in-memory map persisted to AsyncStorage.
   - `cancelForSchedule(scheduleId)`: look up all ids for scheduleId, `cancelScheduledNotificationAsync` each, drop from the map.
   - `cancelForOccurrence(scheduleId, date)`: cancel the single id.
   - `rescheduleAll()`: called on app start (the horizon shifts daily).
3. **App lifecycle hook.**
   - `app/_layout.tsx` calls `rescheduleAll()` once after migrations + initial data load.
   - Schedule a daily background refresh? **No** — Expo background tasks are flaky on iOS; instead we call `rescheduleAll()` on every cold start and on app foreground (`AppState` listener). Documented as a known limitation.

### Acceptance (Phase 5)

- [ ] Permission prompt fires once on first save with notification.
- [ ] After saving a recurring schedule, `expo-notifications` `getAllScheduledNotificationsAsync()` returns the expected count for the next 14 days.
- [ ] Deleting a schedule clears all of its scheduled triggers.
- [ ] Single-occurrence cancel removes exactly one trigger.
- [ ] **Manual:** kill the app on iOS sim, advance system clock, trigger fires.

---

## Phase 6 — Polish & QA

### Tasks

1. **Manual run-through of every Acceptance Criterion in the spec** on iOS 16+ sim and Android API 33+ emu.
2. **`/oh-my-claudecode:visual-verdict` pass on the daily grid** vs. an agreed reference screenshot (block alignment, color consistency, 30-min sliver preservation).
3. **Backup/restore smoke test.** iOS: enable iCloud Documents, force-quit, delete app, reinstall, confirm DB restored. Android: equivalent via `adb backup` / Auto Backup harness. Document outcome.
4. **Performance check.** 4 children × 8 schedules each × 14 days of triggers; daily-view scroll FPS ≥ 55.
5. **Final lint/type/test sweep + coverage report.**
6. **README.md** (project root) with run-book, troubleshooting, and the three guardrails (no servers, no rrule, fixed defaults).

### Acceptance (Phase 6)

- [ ] Every checkbox in spec §Acceptance Criteria is ticked.
- [ ] Coverage report ≥ 80% on db + domain committed under `.omc/research/coverage-final.txt`.
- [ ] visual-verdict pass committed under `.omc/research/visual-verdict-grid.md`.

---

## File-level breakdown

### Phase 0
- `package.json`, `tsconfig.json`, `babel.config.js`, `.eslintrc.js`, `.prettierrc`, `jest.config.js`, `app.json` — tooling configs.
- `.claude/settings.json` — OMC hooks.
- `.gitignore` — Expo standard.

### Phase 1
- `app/_layout.tsx` — Stack root.
- `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/settings.tsx` — placeholders.
- `app/child/[id].tsx`, `app/schedule/edit.tsx` — placeholders.
- `src/db/client.ts` — `expo-sqlite` singleton.
- `src/db/migrations/001_init.sql.ts` — schema v1.
- `src/db/migrations/index.ts` — runner.
- `src/db/row-mappers.ts` — row → domain mappers.
- `src/domain/types.ts`, `src/domain/constants.ts`, `src/domain/days-of-week.ts`, `src/domain/occurrences.ts`, `src/domain/grid.ts`.
- `tests/domain/occurrences.test.ts`, `tests/domain/grid.test.ts`, `tests/domain/days-of-week.test.ts`, `tests/db/migrations.test.ts`.

### Phase 2
- `src/db/repositories/{children,schedules,schedule-exceptions,notification-settings}.ts`.
- `src/state/{children-store,schedules-store,ui-store}.ts`.
- `tests/db/repositories/*.test.ts`, `tests/state/*.test.ts`.

### Phase 3
- `src/ui/grid/{DailyGrid,ScheduleBlock,SlotCell}.tsx`.
- `src/ui/common/{ColorDot,TypeIcon}.tsx`.
- `app/(tabs)/index.tsx` — full implementation.

### Phase 4
- `src/ui/weekly/WeeklyGrid.tsx`.
- `src/ui/sheets/ScheduleEditSheet.tsx`.
- `app/child/[id].tsx`, `app/schedule/edit.tsx` — full implementation.
- `app/(tabs)/settings.tsx` — child management + per-child default notification minutes.

### Phase 5
- `src/notifications/{permissions,scheduler}.ts`.
- App-lifecycle hook in `app/_layout.tsx`.
- `tests/notifications/scheduler.test.ts` (mocking `expo-notifications`).

### Phase 6
- `README.md`, `.omc/research/coverage-final.txt`, `.omc/research/visual-verdict-grid.md`.

---

## Test Strategy

### Unit (jest + jest-expo)
- `domain/occurrences.test.ts` — the centerpiece. ≥ 15 cases:
  - all 7 daysOfWeek variants
  - validFrom/validUntil edge dates (inclusive both ends? **Decision: validFrom inclusive, validUntil inclusive** — encode in test names)
  - cancel/modify exceptions (with and without overrides)
  - DST not applicable (Korea has no DST) — but TZ change drill: simulate Date with mocked locale TZ and confirm dayOfWeek index is stable for `Asia/Seoul`.
- `domain/grid.test.ts` — overlap policy, 30-min sliver preservation, top-slot math.
- `domain/days-of-week.test.ts` — bitmask round-trips.
- `db/migrations.test.ts` — fresh DB → user_version = 1; second run → no-op.
- `db/repositories/*.test.ts` — round-trip + cascade behavior.
- `state/*.test.ts` — selector identity / shallow-equal.

### Integration
- `notifications/scheduler.test.ts` — mock `expo-notifications`, assert correct count and metadata for a recurring schedule with one exception in the horizon.

### Manual (matrix)
- iOS sim 16+ AND Android emu API 33+. Each acceptance checkbox ticked once per platform.
- Killed-app notification firing (Phase 5 acceptance).
- Backup/restore (Phase 6 acceptance).

---

## Risks & Mitigations

1. **expo-sqlite migrations on app upgrade.**
   *Risk:* Schema v2 ships, user has v1 DB; migration crashes mid-transaction; user is locked out.
   *Mitigation:* Every migration runs in a single `BEGIN…COMMIT`; runner wraps in try/catch and logs to AsyncStorage; if migration fails twice in a row, surface in-app "DB upgrade failed" dialog with export-to-text option (deferred until first real schema bump). Add one defensive `PRAGMA foreign_keys = ON` per session.
2. **Timezone correctness for daysOfWeek.**
   *Risk:* User flies abroad; `dayOfWeek` derived from UTC vs local would silently shift schedules.
   *Mitigation:* Always derive day-of-week from device-local time using `new Date(year, monthIdx, day)` constructor (local), never from `Date.UTC`. Store dates as `YYYY-MM-DD` strings (no TZ suffix). Unit-test by faking TZ with `process.env.TZ` in jest setup.
3. **Notification race conditions on rapid edits.**
   *Risk:* Edit twice in 1 second → first scheduler call still in flight, ids inconsistent.
   *Mitigation:* `cancelForSchedule` always runs before `scheduleForSchedule` inside an `async` mutex keyed by `scheduleId` (a tiny `p-queue`-like Map<scheduleId, Promise<void>>). Tests cover concurrent edits.
4. **RN gesture conflicts on the grid.**
   *Risk:* Vertical scroll vs horizontal swipe vs tap — gesture handler chooses wrong intent.
   *Mitigation:* Use `gesture-handler` `Gesture.Race(Pan().activeOffsetX([-12, 12]), tap)`; horizontal Pan only activates after >12px X displacement, leaving short taps and vertical scrolls untouched. Manual verification in Phase 3 acceptance.
5. **(Bonus) iOS background refresh of notification horizon.**
   *Risk:* User doesn't open the app for 14+ days; horizon expires; nothing fires.
   *Mitigation:* `rescheduleAll()` on every cold start AND on `AppState` `active` transition. Documented limitation; out-of-scope for MVP background tasks.

---

## ADR (placeholder — to be finalized after Critic approval)

> **Note to Architect/Critic:** Fill in this section after the consensus round. Below is the structural skeleton with the chosen options pre-populated.

### Decision
- UI: **Bare RN + react-native-gesture-handler + react-native-reanimated + @gorhom/bottom-sheet**.
- State: **Zustand**.
- SQLite: **Raw SQL via expo-sqlite (next-gen async API) with hand-written migration runner & repositories**.
- Occurrences: **On-demand pure-function expansion** (`expandOccurrences`).

### Decision Drivers
D1 Expo compatibility & maintainability; D2 Test surface for occurrence/exception logic; D3 Grid render performance.

### Alternatives considered
A2 tamagui, A3 react-native-paper; B2 Context+useReducer, B3 Redux Toolkit; C2 Drizzle, C3 Kysely; D2 materialized instances. See "Viable Options" tables for bounded pros/cons.

### Why chosen
Each chosen option dominated its alternatives on at least 2 of 3 drivers and tied on the third — see per-axis verdicts above.

### Consequences
- (+) Zero ORM lock-in; recurrence query stays a hand-tuned SELECT.
- (+) Tiny bundle; Expo SDK upgrades safer.
- (-) We hand-write row→domain mappers (4 entities × ~10 lines = manageable).
- (-) Zustand has no devtools UI like Redux; we accept this for the size of the app.

### Follow-ups
- Revisit Drizzle if/when schema crosses ~10 tables or relationships get hairy.
- Revisit a materialized-instance cache only if profiling shows `expandOccurrences` exceeds 5ms on a P50 device.
- Background notification refresh only after MVP ships and real users complain.
