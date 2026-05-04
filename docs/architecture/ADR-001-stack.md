# ADR-001 — Tech stack lock for schedul-app

- **Date**: 2026-05-04
- **Status**: Accepted
- **Authors**: ralplan v2 consensus (Planner + Architect APPROVE + Critic APPROVE)
- **Source**: `.omc/plans/ralplan-schedul-app-v2.md` § ADR FINAL

## Decision

We will build schedul-app on:

- **App framework**: Expo SDK ~52 (React Native + TypeScript) with Expo Router
- **UI primitives**: bare React Native + `react-native-gesture-handler` + `react-native-reanimated` + `@gorhom/bottom-sheet`
- **State management**: Zustand (per-slice stores, shallow-equal selectors)
- **Local DB**: `expo-sqlite` next-gen async API + raw SQL + hand-written numbered migration runner
- **Notifications**: `expo-notifications` (local only, no FCM/APNS)
- **Test**: jest-expo + `@testing-library/react-native`
- **Lint/format**: ESLint (typescript-eslint, expo config) + Prettier
- **TS config**: `strict: true`, `noUncheckedIndexedAccess: true`. `exactOptionalPropertyTypes` is **off** (incompat with expo-router generated types).

## Decision drivers

1. **Single codebase for iOS + Android** — solo developer can't maintain two native trees.
2. **Local-first, no server** — all sync constraints come from SQLite + OS backup. Stack must work fully offline.
3. **Performance for the daily grid** — 4 children × 35 rows × 7-day swipe must hit 55+ FPS.
4. **Low Expo-upgrade friction** — every dep should still work after `expo upgrade` without hand-patching native code.

## Alternatives considered

### UI library
- **Tamagui** — rejected: heavy compile-time codegen, frequent Expo-upgrade breakage, fights bespoke 4×35 grid layout.
- **React Native Paper** — rejected: Material-only, no grid primitive, theme customization isn't worth the bundle.
- **bare RN + gesture-handler/reanimated** — chosen. Driver D1 (Expo compat) and D3 (grid perf) both favor this.

### State management
- **React Context + useReducer** — rejected: Context updates re-render every consumer. With a 35-row grid it would tank FPS (D3).
- **Redux Toolkit** — rejected: boilerplate-heavy for a 4-screen app.
- **Zustand** — chosen. Per-slice stores + shallow selectors keep grid re-renders surgical.

### SQLite access
- **Drizzle ORM** — rejected: adds dev tooling that breaks on Expo SDK upgrades; no benefit for bitmask predicates and a 4-table schema.
- **Kysely** — rejected: same upgrade friction; query-builder ergonomics not worth the cost here.
- **Raw SQL via expo-sqlite + numbered migrations** — chosen. Direct, debuggable, zero upgrade-coupling. PRAGMA user_version sits inside the migration transaction (Architect S2).

### Recurrence
- **iCal RRULE** — rejected by spec (Round 3): unnecessary complexity for the 90% case (week-day repeat).
- **daysOfWeek bitmask + ScheduleException** — chosen.

### Notification cleanup strategy
- **AsyncStorage map as source of truth** — rejected (Architect S3): a delete-sweep crash leaks orphan OS triggers forever.
- **`cancelAllScheduledNotificationsAsync()` first, then rebuild from DB** — chosen. sessionMap demoted to in-memory cache only.

## Consequences

### Positive
- Stack is fully Expo-managed; no eject required for MVP.
- All hot paths (grid render, gesture, notification scheduling) have native-thread fast paths.
- `tsc --noEmit` exit 0 on a fresh project (Phase 0 smoke gate gates this).

### Negative
- `exactOptionalPropertyTypes: false` loses some type soundness around optional Schedule fields (location, notes, notifyMinutesBefore, validUntil). Tradeoff for keeping expo-router happy.
- Raw SQL means we hand-roll typings for query results. Mitigated by per-table repository wrappers.
- No remote sync — explicitly accepted. Mitigations: OS automatic backup + manual JSON export button in Settings.
- Boot-time `cancelAll → reschedule` creates a sub-second window with zero pending triggers. Acceptable because cold start is rare.

## Follow-ups (open-questions.md tracks these)
- iOS 64-pending-notification cap: rolling re-schedule on foreground is deferred to Phase 5+.
- Migrating off raw SQL if the schema grows past ~8 tables.
- Adding Drizzle later only if a real query-complexity case forces it.
