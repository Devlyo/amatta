# Architect Review — ralplan-schedul-app-v1

**Reviewer:** Architect (ralplan consensus round 1)
**Spec:** `.omc/specs/deep-interview-schedul-app.md` (ambiguity 5.0%, PASSED)
**Plan:** `.omc/plans/ralplan-schedul-app-v1.md`
**Mode:** SHORT
**Date:** 2026-05-04

---

## Steelman Antithesis (per decision)

The Planner's choices are defensible, but each one has a credible adversary. Below I argue the strongest case for the road not taken — not as preference, but as the version a thoughtful architect on a different day would write.

### A — UI library: a real architect could pick Tamagui (or Paper) over bare RN

**Steelman for Tamagui (A2):**
The plan rejects Tamagui on D1 (Expo SDK upgrade lag) and D3 (opinionated styling vs custom grid). Both objections are weaker than they look:
1. Tamagui's `expo-blank-typescript` integration has been stable since SDK 50, and its compiler *removes* runtime overhead — for a 4-screen app the bundle delta vs bare RN is negligible after tree-shaking. The SDK-lag risk applies equally to *any* third-party with native peers (`@gorhom/bottom-sheet`, `react-native-reanimated`), and the plan happily adopts those.
2. The grid is a 4×35 absolutely-positioned layout — Tamagui's `View`/`Stack` primitives don't fight that. What Tamagui buys is the *non-grid* surface: bottom sheets, settings forms, color pickers, child management, validation toasts. The plan now owes the user hand-crafted typography, button states, focus rings, dark mode tokens, and a11y semantics across ~5 forms. Each one is a small bug farm.
3. The sole-developer constraint cuts the *other* direction: a single dev benefits more from a design system than a team that can divide visual polish work.

**Steelman for react-native-paper (A3):**
The plan dismisses Paper as "Material aesthetic clashes with bespoke grid." But Paper *only needs to render the non-grid chrome* — sheets, text inputs, time pickers, switches, snackbars. Material is the *default* on Android and Material 3 is acceptable on iOS for a utility app. Paper's `TextInput`, `SegmentedButtons`, `TimePickerModal` (via `react-native-paper-dates`) replace ~600 LoC of bespoke form code with battle-tested components, and accessibility (TalkBack/VoiceOver labels, focus handling) is essentially free.

**Why the plan's verdict is still defensible:** The grid is the dominant screen and it's hostile to design-system theming. If the grid is 80% of the visual budget, owning every pixel is the right call. But the plan has *not* quantified the cost of hand-rolling sheets/forms. That cost is real and deferred.

### B — State: Context+useReducer is not as bad as the plan claims

**Steelman for Context+useReducer (B2):**
The plan rejects Context with "re-renders every consumer." This is the canonical *misreading* of Context. The actual fix — *split contexts* (one per slice) and put memoized selectors at the consumer — gives identical render granularity to Zustand for ~30 LoC of provider boilerplate and zero extra dependency. For a 4-screen app, "tiny extra dep" is a tax the plan pays for *style*, not for measured perf. The plan even admits the grid render argument is "without aggressive memoization" — but in either world we *will* aggressively memoize grid cells; that's not a Zustand benefit, that's a `React.memo` benefit.

**Steelman for Redux Toolkit (B3):**
RTK's "boilerplate-to-feature ratio is hostile" argument is dated. RTK Query + `createSlice` is ~5 lines per slice, gives time-travel devtools (genuinely useful when debugging notification/exception edge cases), and provides a serializable state model that *trivially* supports the future migration to a sync layer if the user ever changes their mind on local-only. The plan paints RTK as 2017-era boilerplate; modern RTK is closer to Zustand-with-devtools.

**Why the plan's verdict is still defensible:** Zustand wins on ergonomic surface area for *this app size*. Concession noted.

### C — SQLite: Drizzle has a real claim

**Steelman for Drizzle (C2):**
The plan's anti-Drizzle argument has two parts and both are softer than they read:
1. *"`drizzle-kit` requires native bindings on dev machine"* — It uses `better-sqlite3` (or now `bun:sqlite`) for *codegen only*, on the dev's laptop, not on the device. This is the same risk profile as `jest`. Calling it a "thing to break on SDK upgrade" conflates dev-time codegen with runtime native modules.
2. *"Bitmask predicates fight the type system"* — `drizzle-orm` exposes raw SQL escape hatches (`sql\`days_of_week & ${mask}\``) and bitmask is exactly *one* query in the entire app. Trading 100% type-safe queries for one untyped escape hatch is a clear win for D2 (test surface) — Drizzle gives you compile-time guarantees that `row.color_index` is `number` and `row.notes` is `string | null`, eliminating the entire `row-mappers.ts` file the plan introduces.

The plan's own `row-mappers.ts` is a code smell admitted: 4 entities × ~10 lines = 40 lines of hand-written `row → domain` mapping that Drizzle generates for free, and that hand-written code is exactly where a `null` vs `undefined` mismatch with `exactOptionalPropertyTypes` will silently bite.

**Steelman for Kysely (C3):**
Kysely's expo-sqlite dialect is community, but it's *thin*. Kysely is a query builder, not an ORM — there's no migration tool to upgrade, no schema codegen. It buys typed `select`/`where`/`join` over raw strings, costs almost nothing on bundle, and the bitmask predicate is a one-line `sql<number>\`days_of_week & ${mask}\``. It's strictly better than raw SQL on D2 with no D1 cost.

**Why the plan's verdict is still defensible:** "Boring" is a real principle. Raw SQL has zero cognitive overhead for a TS-fluent dev who already knows SQL. But the plan is paying with type safety for principle, and it should *say so* in the ADR consequences instead of claiming it's a wash.

### D — Occurrence expansion: materialized has a niche

**Steelman for materialization (D2):**
The plan dismisses materialization as "overkill for the data volume." That's correct *for queries*. But materialization solves a problem the plan does not yet acknowledge: **notification scheduling.** Phase 5 calls `expandOccurrences([s], exceptions, { from: today, to: today + 14 })` per schedule on every cold start *and* on every AppState foreground transition (Risk #5). For 4 children × 8 schedules each × 14 days, that's 32 expansions on every foreground — cheap, but stateful. A `schedule_instances` table with a `(schedule_id, date) UNIQUE` constraint and a single `INSERT OR IGNORE … WHERE date BETWEEN ? AND ?` would let the notification scheduler do a single `SELECT date, start_minutes FROM schedule_instances WHERE notify_at >= now() AND notify_at < ? ORDER BY notify_at` and stop maintaining its own AsyncStorage-backed id map (Risk #3 mitigation).

In other words: materialization is overkill for **rendering**, but the plan is using occurrence expansion as a **scheduling source of truth** too, and that's where a table earns its keep.

**Why the plan's verdict is still defensible:** The volume genuinely is small, and on-demand keeps cache invalidation out of the architecture. But the trade is *not* between "simple D1" and "complex D2"; it's between "one source of truth (D1)" and "two pieces of state to keep consistent — the in-memory `schedulesByDate` map and the AsyncStorage notification id map (D1+map)."

### Grid rendering strategy

**Steelman for an alternative:**
The plan picks a single `ScrollView` with absolutely-positioned blocks because "35 rows is small." This is fine for the *daily* grid (35 rows) but wrong for the *weekly* drilldown (also 35 rows × 7 cols, with potentially 20+ blocks). A `<FlashList>` (Shopify) or even a virtualized horizontal `FlatList` of day-columns would handle weekly view at the same cost — and re-uses one component. A reasonable architect would push for a *single* virtualized component and parameterize columns instead of forking `DailyGrid` from `WeeklyGrid`.

**Counterpoint:** The plan does say WeeklyGrid "reuses `layoutWeek()` (per-day `layoutDay` over a 7-day range)" so the math is shared. But the *render path* duplicates. With absolute positioning + memoized cells, that's manageable. Acceptable.

---

## Tradeoff Tensions

The following tensions in the plan are real, unresolved, and not merely stylistic.

### T1 — Phase 0 hooks vs developer feedback latency (THE BIG ONE)

The plan installs a `PostToolUse` hook that runs `npx tsc --noEmit && npx eslint --fix` on every TS file edit. The user's framing demands this exact concern be interrogated.

**The tension:** In a fresh Expo project, `tsc --noEmit` cold-start is **5–10 seconds** *per invocation*, and warm runs are still 2–4s for an MVP-size project. The plan claims hooks "must NOT block on long-running ops — keep each under ~5s." The plan is asking the hook to do the very thing it forbids. On a flow-state day where Claude makes 30 edits in 10 minutes, this is *5 minutes* of dead time at minimum, *5 minutes of agent context burned waiting on hooks*, with the user staring at a stalled cursor.

Worse: `eslint --fix` writes back to the file, which can re-trigger the hook depending on hook semantics, creating an infinite loop or at least a noisy double-pass. The plan does not address this.

**This tension is unresolved in the plan.** The plan asserts the rule and violates it in the same step.

### T2 — Raw SQL flexibility vs schema migration safety

Raw SQL gives total control over the migration string, including bitmask predicates and SQLite-specific PRAGMAs. But it concedes:
- No compile-time check that `row.color_index` matches `colorIndex: number` in `row-mappers.ts`.
- No compile-time check that migration 002 is consistent with the queries written against migration 001's schema.
- No automated rollback path; the plan says "single transaction" but SQLite does *not* support DDL inside `BEGIN…COMMIT` for many statements (`ALTER TABLE` partial-failure mid-`INSERT INTO new_table SELECT FROM old_table` is famously hairy on app crash).

A typed builder (Drizzle/Kysely) collapses (1) and (2) to compile-time errors. The plan trades two compile-time guarantees for one principle ("zero ORM coupling"). That's a defensible trade only if the team is small and SQL-fluent — *which it is* — but the plan doesn't cost it.

### T3 — On-demand expansion vs notification consistency

`expandOccurrences` is pure and trivially correct in isolation. But Phase 5 layers a *stateful*, AsyncStorage-backed `Map<scheduleId, notificationIds[]>` on top, and the source of truth for "what should be scheduled" is recomputed each foreground via the pure function. This is two different views of the same data, kept in sync only by the discipline of always calling `cancelForSchedule` before `scheduleForSchedule` (Risk #3).

If `cancelForSchedule` succeeds and `scheduleForSchedule` crashes (OOM, OS denial mid-loop, app suspended by iOS), we leak: the AsyncStorage map says "no triggers for s12" but `expo-notifications` may have a partial set queued. There's no reconciliation step.

**Tension:** the plan markets D1 as "simpler than D2 (materialized)" but Phase 5 reintroduces materialization in the *worst* place — outside SQLite, in AsyncStorage, without transactions.

### T4 — 30-min grid granularity vs reality

Spec locks 30-min slots. Reality (and the spec's own "30분 미만 짜투리는 30분 슬롯 안에 시각적으로 보존" rule) admits schedules don't align. A 17:00–18:30 piano lesson is fine. A 17:15–18:30 dropoff is *not* — it starts mid-slot. The plan's `topSlot = floor((startMinutes - 360) / 30)` floors a 17:15 start to the 17:00 slot. The block visually says 17:00 even though `startMinutes=1035`. The block `title` text would still read "17:15" but a parent glancing at the grid alignment would mis-read pickup time by 15 minutes.

The plan does not say whether `start_minutes` is *constrained* to 30-min steps in the schema (no `CHECK(start_minutes % 30 = 0)`) or allows arbitrary minutes. The spec says the *grid* is 30-min; the spec does not say *schedule input* is 30-min. The Phase 4 sheet uses a "24h picker, 30-min step", which silently locks input. That's a UX decision smuggled into a UI plan.

### T5 — iOS/Android `expo-notifications` divergence

The plan treats `expo-notifications` as platform-uniform. It is not:
- iOS: limit of **64 pending local notifications**. 4 children × 8 schedules × 14 days = up to 448 — silently truncated by iOS.
- Android: no hard cap, but Doze mode batches deliveries; `setExactAndAllowWhileIdle` requires `SCHEDULE_EXACT_ALARM` permission on Android 13+ which `expo-notifications` does not auto-request.
- iOS: the 14-day horizon is *too long*; the plan should rotate near-term triggers and let further-out ones be scheduled on next foreground. Android: 14 days is fine but exact-time delivery is best-effort under Doze.

The plan acknowledges horizon refresh on AppState=active but does not mention the 64-cap or `SCHEDULE_EXACT_ALARM`. This is an unresolved tension between "ship it simple" and "actually deliver notifications on real devices."

---

## Specific Concerns

I am required to interrogate specific items. I'll be tough.

### C1 — DST handling and "Korea only" implicit assumption

**Status: PARTIAL.** The plan correctly notes Korea has no DST and uses local-time `new Date(year, monthIdx, day)`. But the spec does *not* say "Korea only" — it says Korean locale (한국어 단일 로케일). A Korean expat in Berlin (CET, with DST) installs the app. The plan's `dayOfWeekIndex(d)` is local-TZ based and *will* shift correctly across a DST boundary because `new Date(2026, 9, 25)` resolves to whatever local Sunday is. But notification triggers via `Notifications.scheduleNotificationAsync({ trigger: { date } })` send a JS `Date` (absolute instant). If the user creates a 9:00 Berlin schedule before DST and the trigger fires after DST, the absolute instant is correct but the user expects "9:00 local" and gets "9:00 absolute." The plan is silent.

**Required:** Explicit "Korea/no-DST assumption" statement OR a unit test that schedules across a DST boundary in `Europe/Berlin` and asserts the trigger fires at local 9:00 on each side.

### C2 — `cancel` vs `modify` exception kinds and double-write race

**Status: WEAK.** The plan's Phase 4 save flow handles the happy path. The race it does NOT handle:

1. User taps a block, opens edit sheet in `editOccurrence` mode.
2. Sets `kind=modify`, hits Save.
3. The schema has `UNIQUE(schedule_id, date)`. If a `kind=cancel` exception already exists for that date, the `INSERT INTO schedule_exceptions` fails with `SQLITE_CONSTRAINT`.
4. Plan does not specify `INSERT OR REPLACE`, `ON CONFLICT DO UPDATE`, or `UPDATE existing first then INSERT`.

The Phase 5 notification flow has a parallel race: `editOccurrence` cancels the trigger for that date, then schedules a new one. If `kind` was `cancel` and the user re-edits to `modify`, the cancel-side cleanup already removed the trigger — fine. But if `cancelForOccurrence` succeeds and the new `scheduleForOccurrence` errors, the trigger is gone with no audit trail.

**Required:** Specify `ON CONFLICT(schedule_id, date) DO UPDATE` semantics; specify whether `editOccurrence → modify` upserts or rejects on existing `cancel`.

### C3 — Migration partial failure mid-transaction across app crash

**Status: HOPE-BASED.** The plan says "Every migration runs in a single `BEGIN…COMMIT`; runner wraps in try/catch and logs to AsyncStorage; if migration fails twice in a row, surface in-app …"

Reality:
- SQLite's transactional DDL works for `CREATE TABLE`, `CREATE INDEX`, `INSERT`. It does NOT cleanly roll back `ALTER TABLE` on all engines, and `expo-sqlite` (next-gen) wraps SQLite 3.45.x where most DDL is transactional — but a mid-statement app kill (iOS suspends) leaves the WAL in a state that `expo-sqlite` recovers via the journal *next time it opens the DB*. The plan trusts this implicitly.
- `PRAGMA user_version = N` is NOT in the same transaction in the plan's pseudocode (`run inside a transaction, then PRAGMA user_version = N`). If the migration commits but `PRAGMA user_version = N` fails or the app dies between, the next boot re-runs migration N and **double-applies** it. Schema 001 with `IF NOT EXISTS` is idempotent, so 001 is safe. Schema 002 might not be.

**Required:** `PRAGMA user_version = N` MUST be inside the same transaction as the DDL. That's the only safe pattern. The plan's wording suggests it isn't.

### C4 — Daily grid gesture conflict with bottom sheet

**Status: ADEQUATE for daily, NOT for sheet.** The plan's `Gesture.Race(Pan().activeOffsetX([-12, 12]), tap)` handles daily-grid horizontal-swipe vs vertical-scroll vs tap. Good. But the `@gorhom/bottom-sheet` is opened by the same tap. Once open, the sheet has its own pan gesture (vertical, for dismiss). If the sheet contains form scroll content with `<ScrollView>`, the vertical scroll inside the sheet *fights* the sheet's dismiss-pan unless the sheet is configured with a `useScrollableInternal` ref — which Gorhom requires explicit wiring with `BottomSheetScrollView`. The plan does not mention this.

**Required:** Phase 4 task list must call out `BottomSheetScrollView`/`BottomSheetFlatList` for any scrollable content inside the edit sheet.

### C5 — Notifications when permission denied → later enabled

**Status: NOT HANDLED.** The plan handles the first-prompt case ("Persist that we asked … so we don't nag on denial") but does NOT handle the re-grant case. Sequence:
1. User saves schedule with `notifyMinutesBefore=15`. Permission prompt → DENIED. AsyncStorage flag set.
2. User saves 5 more schedules. No re-prompt (correct).
3. Two weeks later, user enables notifications in iOS Settings → app.
4. Nothing happens until the user *next* edits a schedule. The 6 existing schedules have no triggers because at create time permission was denied — `scheduleNotificationAsync` likely succeeded silently (it does, on iOS, with no permission) but the OS will not display them.

Actually worse: on iOS, `scheduleNotificationAsync` *does* schedule even without permission, but `present` is silently dropped at fire time. So the triggers ARE in the OS queue but won't display. When permission is granted later, they should display. So this *might* work by accident on iOS. On Android 13+, `POST_NOTIFICATIONS` permission gates the display similarly.

**Required:** On `AppState=active`, check current permission status; if it transitioned `denied → granted`, force `rescheduleAll()`. The plan only does `rescheduleAll()` on every active transition unconditionally — which actually covers this case for free. **Concern downgraded: NOT HANDLED → HANDLED BY ACCIDENT.** Document that it's load-bearing.

### C6 — 6-color palette × 4 children → contrast / a11y

**Status: WEAK.** Spec says 6-color palette, max 4 children. With 4 children, two colors will go unused. The architectural concern is *adjacency contrast* — if the palette has two similar greens (lots of palettes do, e.g., emerald + teal), and both end up used because the user's first 3 picks were red/blue/yellow, the 4th is emerald or teal — visually ambiguous on a small block with type-icon overlay.

The plan does not specify the palette colors. The spec just says "6 colors." This is **deferred contrast risk**: the visual designer / Phase 3 implementer picks the palette and may not test 4-child contrast pairs.

Additionally: the spec says "block uses child color." The plan says blocks have `color from child palette`. But colorblind users (8% of males) need a non-color disambiguator. The plan has `TypeIcon` for `school|academy|activity|other` — that's 4 types, not 4 children. **There is no per-child non-color disambiguator** — colorblind parents cannot tell whose block is whose without reading text.

**Required:** Add per-child secondary marker (initial letter, monogram, or distinct icon) to ScheduleBlock. Specify palette with WCAG AA contrast pairs documented.

### C7 — Schedule deletion → notification cleanup mid-iteration crash

**Status: NOT HANDLED.** Plan: `cancelForSchedule(scheduleId)` cancels each id and drops from map. Worst case: app crashes after canceling 3 of 7 OS triggers, before persisting the updated map to AsyncStorage. Next boot:
- DB: schedule deleted (cascade exceptions deleted).
- AsyncStorage map: still says `s12 → [n1,n2,n3,n4,n5,n6,n7]` for a deleted schedule.
- OS: still has `n4..n7` queued. They will fire with stale title/time.
- `rescheduleAll()` on next start iterates schedules in DB. Schedule is deleted → not iterated → orphan triggers persist.

**Required:** `rescheduleAll()` MUST start with `Notifications.cancelAllScheduledNotificationsAsync()` then re-schedule from current DB. Don't trust the AsyncStorage map across boots — treat it as a per-session cache. The plan's design relies on the map being authoritative, which it isn't.

### C8 — `tsc --noEmit` PostToolUse hook cost (the Phase 0 hook concern)

**Status: BROKEN AS WRITTEN.** Already covered in Tension T1. To restate:
- Cold `tsc --noEmit` on Expo template: 5–10s.
- Warm: 2–4s (worse with `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`).
- Plan budget: <5s per hook.
- Hook fires per Edit/Write — Claude makes ~30 edits per dense work session.
- Total cost per session: ~2–5 minutes of stalled agent context.

This is the highest-impact issue in the plan because it directly degrades the agent's iteration loop *for the entire project lifetime*.

**Required mitigation paths:**
1. Replace `tsc --noEmit` with `tsc --noEmit --incremental` and a persistent `.tsbuildinfo` (cuts warm to <500ms after first run).
2. Move `eslint --fix` to file-scoped (`eslint --fix "$CLAUDE_TOOL_FILE_PATH"`) — already is. But `tsc` cannot be file-scoped meaningfully.
3. Better: `tsc --noEmit --incremental` debounced; or moved to a `Stop` hook (runs once when Claude stops, not per edit).
4. Best: ditch the hook for project-wide tsc, keep `eslint --fix` per-file (cheap), put project-wide tsc on a `Stop` hook or pre-commit only.

---

## Proposed Synthesis / Required Revisions

Rank-ordered by impact.

### S1 — Phase 0 hook redesign (REQUIRED, blocks Phase 1)

Replace the current PostToolUse hook with:

```json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": [
        { "type": "command", "command": "if echo \"$CLAUDE_TOOL_FILE_PATH\" | grep -qE '\\.tsx?$'; then npx eslint --fix \"$CLAUDE_TOOL_FILE_PATH\" 2>&1 | tail -n 5; fi" }
      ]}
    ],
    "Stop": [
      { "hooks": [
        { "type": "command", "command": "npx tsc --noEmit --incremental 2>&1 | tail -n 20 || true" }
      ]}
    ],
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "npx expo-doctor 2>&1 | tail -n 1 || true" } ] }
    ]
  }
}
```

Rationale: per-file ESLint is fast (<500ms warm); whole-project tsc moves to `Stop` so it runs once per agent turn ending, not per edit. Add `--incremental` and `.tsbuildinfo` to `.gitignore`.

### S2 — Migration runner: `PRAGMA user_version` MUST be in-transaction

Pseudocode revision:

```ts
db.execAsync('BEGIN IMMEDIATE');
try {
  for (const stmt of migration.sqlStatements) await db.execAsync(stmt);
  await db.execAsync(`PRAGMA user_version = ${migration.version}`);
  await db.execAsync('COMMIT');
} catch (e) {
  await db.execAsync('ROLLBACK').catch(() => {});
  throw e;
}
```

**Verify** `expo-sqlite`'s next-gen async API supports DDL inside an explicit `BEGIN IMMEDIATE` — if it doesn't, fall back to `withTransactionAsync`. Document the verification in Phase 1 acceptance.

### S3 — Notification source-of-truth reconciliation

`rescheduleAll()` MUST begin with `await Notifications.cancelAllScheduledNotificationsAsync()` and then rebuild from DB. Drop reliance on the AsyncStorage id map across cold starts. Keep the map only as a per-session optimization for `cancelForSchedule(scheduleId)` to avoid scanning all triggers.

Add Phase 5 acceptance:
- [ ] Force-quit during a delete sweep, reopen, confirm no orphan triggers.
- [ ] iOS pending count never exceeds 64 (cap-aware horizon).

### S4 — Exception upsert semantics

Phase 4 save flow MUST specify:
```sql
INSERT INTO schedule_exceptions (schedule_id, date, kind, override_start_minutes, ...)
VALUES (?, ?, ?, ?, ...)
ON CONFLICT(schedule_id, date) DO UPDATE SET
  kind = excluded.kind,
  override_start_minutes = excluded.override_start_minutes,
  override_end_minutes = excluded.override_end_minutes,
  override_title = excluded.override_title;
```

Document: editing an existing `cancel` exception by changing it to `modify` overwrites in place. No double-row possible.

### S5 — Colorblind / a11y disambiguator

Add to `ScheduleBlock` a per-child secondary marker (suggested: child name initial in monospace, top-right corner, contrast-paired with block color via WCAG AA). Specify the 6-color palette explicitly in `src/domain/constants.ts` with documented contrast pairs. Phase 3 acceptance gains:
- [ ] All 6 palette colors pair with white text at WCAG AA (4.5:1).
- [ ] Any 4-color subset is distinguishable in a colorblind sim (deuteranopia + protanopia).

### S6 — TZ + DST assumption explicit

`src/domain/occurrences.ts` header comment:
```
// ASSUMPTION: device-local timezone, no DST handling beyond JS Date semantics.
// The app stores YYYY-MM-DD (no TZ) and HH:MM as minutes-since-midnight.
// Schedules are interpreted in whatever local TZ the device is in at fire time.
// A user crossing TZ mid-week sees their schedules shift to local "same wall-clock time"
// — this is INTENTIONAL for KST users and TOLERATED for travelers.
```

Add a unit test that mocks `process.env.TZ='Europe/Berlin'` and asserts `dayOfWeekIndex` is stable across the late-October DST boundary.

### S7 — Sheet scroll wiring

Phase 4 task list must explicitly use `BottomSheetScrollView` for any scrollable form content inside `ScheduleEditSheet.tsx`. One sentence in the plan, big practical impact.

### S8 — Grid input granularity decision

Decide and document: are `start_minutes`/`end_minutes` constrained to 30-min steps?

Recommended: **YES, constrain to 30-min steps in the input UI** (matches spec's grid lock); add `CHECK(start_minutes % 30 = 0 AND end_minutes % 30 = 0)` to schema. This sacrifices 17:15 piano lessons but matches spec defaults. If user pushes back, it's a one-line schema relaxation in v2.

### S9 — Quantify rejected options' costs in ADR

The ADR-skeleton "Consequences" section understates the cost of bare-RN UI. Add:
- (-) Bottom sheet form chrome, settings forms, and child-management UI must be hand-built. Estimate: ~600 LoC of form/input components that a design system would provide.
- (-) Accessibility (TalkBack/VoiceOver labels, focus order, font scaling) is on us per-component.
- (-) Dark mode support, if added later, requires a token system we don't have.

Same for raw SQL:
- (-) `row-mappers.ts` is 40 LoC of hand-written mapping that a typed builder would generate. Mismatches between schema and TS types are runtime errors, not compile errors.

This honesty in the ADR is what distinguishes a real ralplan from a sales pitch for the chosen options.

---

## Verdict: ITERATE

The plan is architecturally **sound in shape** — the chosen stack is defensible, the phase decomposition is right-sized, the acceptance criteria are concrete, and the test strategy is honest. But there are **three issues** that genuinely block "approve":

1. **The Phase 0 hook is broken as written** (T1/C8). It will degrade every subsequent loop of the agent for the lifetime of the project. This is the highest-leverage fix.
2. **The migration runner has a partial-failure crack** (C3) that could double-apply schema bumps. This is a footgun for *future* Phase migrations even though Phase 1 is safe.
3. **The notification subsystem has no reconciliation** (C7/S3). Crash-during-delete leaks orphan triggers. The fix is one-liner (`cancelAllScheduledNotificationsAsync` at top of `rescheduleAll`) but it needs to be specified.

The other concerns (C1/C2/C4/C5/C6, T2/T3/T4/T5) are real but defer-able — most can be resolved by 1–3 sentence revisions to the plan.

**Architect verdict: ITERATE.** Critic round, please address S1, S2, S3 minimum; S4–S9 strongly recommended.

## If ITERATE: required revisions for next loop

**Must-fix (gates approval):**
1. **S1** — Replace per-edit `tsc --noEmit` with per-edit `eslint --fix` + per-Stop incremental tsc. Update Phase 0 §5 hook block and Phase 0 §6 smoke gate.
2. **S2** — Move `PRAGMA user_version = N` inside the migration transaction. Update Phase 1 §2.
3. **S3** — `rescheduleAll()` starts with `cancelAllScheduledNotificationsAsync()`. Update Phase 5 §2 and acceptance.

**Should-fix (strongly recommended):**
4. **S4** — Specify `ON CONFLICT … DO UPDATE` semantics for `schedule_exceptions` writes.
5. **S5** — Per-child non-color disambiguator + explicit palette with documented contrast.
6. **S6** — TZ/DST assumption documented + tested.
7. **S7** — `BottomSheetScrollView` for scroll content.
8. **S8** — Decide and document 30-min input granularity.
9. **S9** — Honest "Consequences" in the ADR section.

**May-fix (architectural posture):**
- Reconsider Drizzle/Kysely if any reviewer feels the ADR consequences are too costly. Default: stay raw SQL.
- iOS 64-trigger cap: add to Risks & Mitigations even if the fix is deferred.
