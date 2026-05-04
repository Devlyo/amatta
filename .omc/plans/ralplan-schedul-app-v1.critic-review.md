# Critic Review — ralplan-schedul-app-v1

**Reviewer:** Critic (ralplan consensus round 1)
**Spec:** `.omc/specs/deep-interview-schedul-app.md` (ambiguity 5.0%, PASSED)
**Plan:** `.omc/plans/ralplan-schedul-app-v1.md`
**Architect Review:** `.omc/plans/ralplan-schedul-app-v1.architect-review.md`
**Mode:** SHORT → escalated to ADVERSARIAL after confirming Architect's three blockers + finding two additional gaps
**Date:** 2026-05-04

---

## Pre-commitment Predictions

Before reading the plan in detail, I predicted these likely failure modes for a greenfield Expo + local-SQLite + local-notifications app:

1. PostToolUse hooks running heavy compilers per edit (latency death) — **CONFIRMED** (Architect C8/T1).
2. Notification scheduling drift between in-memory state and OS queue — **CONFIRMED** (Architect C7/T3).
3. Migration partial-failure / `user_version` ordering — **CONFIRMED** (Architect C3).
4. iOS 64-trigger cap unhandled — **CONFIRMED** (Architect T5).
5. Timezone/DST blind spot under "Korean only" framing — **CONFIRMED** (Architect C1).
6. (Mine, not Architect's) — Phase 0 smoke gate uses `npx expo start` interactively — **CONFIRMED, NEW** (see C-NEW-1).
7. (Mine, not Architect's) — `INSERT INTO new_table SELECT FROM old_table` reasoning conflicts with `expo-sqlite` next-gen API contract — **CONFIRMED, NEW** (see C-NEW-2).

The Architect found 3 blockers + 6 secondary issues. I confirm all of them and add 2 more issues that the Architect missed.

---

## Per-criterion scoring (1-5)

| # | Criterion | Score | One-line evidence |
|---|---|---|---|
| 1 | Principle-Option consistency | **4/5** | Each chosen option (A1/B1/C1/D1) cleanly maps to Principles 1–4; Principle 5 (Phase 0 gate) is structurally honored but its hook implementation contradicts the principle's spirit (see C8/T1). |
| 2 | Fair alternatives | **3/5** | Tables exist with pros/cons, but Architect's steelmanning shows the rejection rationales are softer than written (Drizzle C2 dismissed on conflated "native bindings"; Context+useReducer B2 dismissed on the canonical misreading of Context perf). |
| 3 | Risk mitigation clarity | **2/5** | Risks 1–5 are named but mitigations are partial: Risk #1 says "single transaction" but `PRAGMA user_version` is documented OUTSIDE the transaction; Risk #3 mutex protects same-process but not crash-recovery; Risk #5 ignores iOS 64-cap entirely. |
| 4 | Testable acceptance criteria | **4/5** | Most ACs are pass/fail (`exit 0`, ≥80% coverage, `getAllScheduledNotificationsAsync()` count). Two soft ones: Phase 3 "scroll FPS not below 55" lacks measurement method; Phase 6 visual-verdict has no agreed reference screenshot yet. |
| 5 | Concrete verification steps | **4/5** | Phase 0 §6 smoke gate is exemplary; Phase 5 has good integration test plan; Phase 6 manual matrix is concrete. Gap: no verification that `expo-sqlite` next-gen API actually supports DDL inside explicit `BEGIN IMMEDIATE` (Architect S2 verification step). |
| 6 | No dead-end phases | **5/5** | Each phase output flows into the next: Phase 0 unblocks tooling → Phase 1 produces domain primitives → Phase 2 wires DB+state → Phases 3–4 consume domain → Phase 5 consumes occurrences → Phase 6 verifies all. No orphan deliverables. |
| 7 | User's Phase 0 demand honored | **3/5** | Phase 0 IS marked as a hard gate ("must halt if smoke gate fails", "do NOT proceed to Phase 1") — good. BUT the hook payload it installs (per-edit `tsc --noEmit`) is itself broken as written, meaning the user's "skills/hooks/agents *before* code" demand ships a defective hook on day one. The gate exists; what passes through it is contaminated. |
| 8 | Architect issues addressed (or fairly disputed) | **1/5** | This is v1 — the Architect's blockers are not yet addressed because v1 was the input to the Architect review. Critic does not approve a v1 with three known unaddressed blockers. The score reflects "addressed in v1 plan as written," not the planner's intent to fix in v2. |

**Decision rule check:** APPROVE requires all 8 ≥ 4/5 AND no Architect blocker remains. Criteria 2, 3, 7, 8 fall below the bar. Verdict: ITERATE.

---

## Architect-issue checklist

### Architect's three blockers (must-fix to approve)

| Architect ID | Topic | Addressed in v1? | Required in v2? |
|---|---|---|---|
| **S1 / T1 / C8** | Phase 0 PostToolUse hook runs full-project `tsc --noEmit` per edit (5–10s cold, 2–4s warm) — violates plan's own "<5s" budget | **NO** — v1 ships the broken hook | **YES, blocking** |
| **S2 / C3** | `PRAGMA user_version = N` documented outside the migration transaction → double-apply risk on crash between COMMIT and PRAGMA | **NO** — Phase 1 §2 explicitly says "run inside a transaction, then `PRAGMA user_version = N`" (sequential, not atomic) | **YES, blocking** |
| **S3 / C7** | `rescheduleAll()` does not start with `cancelAllScheduledNotificationsAsync()` → orphan triggers on crash mid-delete | **NO** — Phase 5 §2 only describes per-schedule cancel + reschedule; no whole-queue reset | **YES, blocking** |

### Architect's six secondary issues (should-fix)

| Architect ID | Topic | Addressed? | Severity |
|---|---|---|---|
| S4 / C2 | `ON CONFLICT(schedule_id, date) DO UPDATE` for exception upsert | NO | MAJOR — race on cancel→modify edit |
| S5 / C6 | Colorblind disambiguator + explicit WCAG-paired palette | NO | MAJOR — a11y |
| S6 / C1 | Explicit DST/TZ assumption + Berlin-DST unit test | PARTIAL — Risk #2 names it; no test or comment header specified | MAJOR — silent shift for travelers |
| S7 / C4 | `BottomSheetScrollView` wiring for scroll content | NO | MINOR — fixable in Phase 4 |
| S8 / T4 | Decide & document 30-min input granularity (`CHECK(start_minutes % 30 = 0)`?) | PARTIAL — Phase 4 sheet "30-min step" smuggles the decision; schema in Phase 1 §2 has no CHECK constraint, contradicting | MAJOR — schema/UX contract mismatch |
| S9 | Honest ADR Consequences (quantify cost of rejected options) | NO — ADR placeholder defers to "after Critic approval" | MINOR — affects future-Critic, not future-Executor |

### Critic-found additional issues (NOT in Architect review)

| Critic ID | Topic | Severity |
|---|---|---|
| **C-NEW-1** | Phase 0 §6 smoke gate runs `npx expo start --no-dev --offline` — this is an **interactive long-running process**, not a one-shot exit-code command. There is no described mechanism to detect "Metro booted with no red error" non-interactively. The other three smoke checks (`tsc`, `eslint`, `jest`) exit cleanly; `expo start` does not. As written, this gate either hangs forever or never executes. | CRITICAL |
| **C-NEW-2** | The plan in Phase 0 §2 lists `react-native-reanimated/plugin` as the LAST babel plugin — correct. But Phase 0 also declares `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` as `tsconfig` settings AND adopts `expo-router`. `expo-router`'s generated types (`expo-router/types`) historically use `string | undefined` rather than `string | null` and have known incompatibilities with `exactOptionalPropertyTypes` strictness. Plan does not flag this; smoke-gate `tsc --noEmit` will likely **fail on a fresh install** with these strict flags before any user code is written. | MAJOR |
| **C-NEW-3** | Plan Phase 5 §3 says `rescheduleAll()` runs on "every cold start AND on AppState `active` transition". `AppState=active` fires on EVERY return from background — including a 2-second tab-out to read a text. With ~50–100 stored triggers, calling `cancelAllScheduledNotificationsAsync()` + re-scheduling on every `active` transition is wasteful and creates a window where ZERO triggers exist. If the user's phone fires a trigger DURING that window (small but nonzero), it is silently lost. | MAJOR |
| **C-NEW-4** | Phase 1 §1 directory scaffold places `app/schedule/edit.tsx` as a route. Plan Phase 4 §2 describes `ScheduleEditSheet` as a `@gorhom/bottom-sheet` overlay — sheets in Gorhom are NOT route-based; they are imperative modals rendered inside a parent view. The route file `app/schedule/edit.tsx` is therefore dead — never navigated to (because sheet is opened by tap inside DailyView/WeeklyView). Plan describes both patterns as if they coexist; only one will actually work. | MINOR — likely just a stale scaffold entry |

---

## Critical Findings (blocks v1 approval)

### 1. Phase 0 hook contradicts its own latency budget (Architect S1/C8/T1)
- **Confidence:** HIGH
- **Evidence:** Plan Phase 0 §5 — hook command `if echo \"$CLAUDE_TOOL_FILE_PATH\" | grep -qE '\\.tsx?$'; then npx tsc --noEmit && npx eslint --fix \"$CLAUDE_TOOL_FILE_PATH\"; fi`. Plan Phase 0 §5 immediately after — `"Hooks must NOT block on long-running ops — keep each under ~5s."` Cold `tsc --noEmit` on a strict-mode Expo project is ~5–10s; warm with `noUncheckedIndexedAccess` is 2–4s. The hook breaks its own contract on every edit.
- **Why this matters:** This is the user's "hooks before code" demand actively producing harm. Every Edit/Write during the entire project lifetime stalls the agent for seconds. Compounds into minutes per dense session.
- **Fix:** Adopt Architect's S1 verbatim — split: per-edit `eslint --fix` only, plus `Stop` hook with `npx tsc --noEmit --incremental`. Add `*.tsbuildinfo` to `.gitignore`.

### 2. Migration `PRAGMA user_version` ordering (Architect S2/C3)
- **Confidence:** HIGH
- **Evidence:** Plan Phase 1 §2 — `"run inside a transaction, then PRAGMA user_version = N. Idempotent on cold + warm starts."` The "then" sequences the PRAGMA after the transaction commits. SQLite executes `PRAGMA user_version` outside any open transaction by default; the wording explicitly puts it after the COMMIT. If the app is killed (iOS suspend, OOM) between COMMIT and PRAGMA, next boot re-runs the migration N. Migration 001 is idempotent (`CREATE TABLE IF NOT EXISTS` if used), but no future migration is guaranteed idempotent.
- **Why this matters:** Future schema bump (002, 003) data corruption — silent until users upgrade.
- **Fix:** Architect's S2 — include `PRAGMA user_version = N` as the final statement *inside* the same `BEGIN IMMEDIATE … COMMIT` block. Verify `expo-sqlite` next-gen API supports this; if not, use `withTransactionAsync`. Add Phase 1 acceptance: "kill app between DDL and PRAGMA, reboot, confirm migration not re-run."

### 3. Notification reconciliation absent (Architect S3/C7/T3)
- **Confidence:** HIGH
- **Evidence:** Plan Phase 5 §2 — `"cancelForSchedule(scheduleId): look up all ids for scheduleId, cancelScheduledNotificationAsync each, drop from the map."` and `"rescheduleAll(): called on app start (the horizon shifts daily)."` Neither path includes `cancelAllScheduledNotificationsAsync()`. AsyncStorage map is the only authoritative cancel-set; if the map and OS queue diverge (crash mid-delete), there is no reconciliation.
- **Why this matters:** Orphan notifications fire with stale title/time after delete. User-visible incorrectness.
- **Fix:** Architect's S3 — `rescheduleAll()` MUST start with `cancelAllScheduledNotificationsAsync()`. AsyncStorage map demoted to per-session cache only.

### 4. Phase 0 smoke gate `npx expo start` is interactive (Critic-found)
- **Confidence:** HIGH
- **Evidence:** Plan Phase 0 §6 — `"npx expo start --no-dev --offline boots Metro with no red error."` `expo start` is a long-running interactive Metro server. There is no exit-code semantic for "boots without error" — it just keeps running until Ctrl+C. The plan does not specify a timeout, a log-grep, or a follow-up curl to `http://localhost:8081/status`.
- **Why this matters:** As written, the smoke gate either (a) the agent hangs forever waiting for `expo start` to exit, or (b) the agent skips it and Phase 0 acceptance is silently false. Either way the gate fails in execution.
- **Fix:** Replace with one of: (a) `npx expo-doctor` (one-shot, exits 0/1) — already used in SessionStart hook; (b) `npx expo export --platform web --output-dir /tmp/__smoke && rm -rf /tmp/__smoke` (forces bundler to compile entry, exits cleanly); (c) `timeout 30s npx expo start --no-dev --offline 2>&1 | tee /tmp/metro.log && grep -qE '(error|Error)' /tmp/metro.log && exit 1 || exit 0`. Pick one and document.

---

## Major Findings

### 5. Phase 4 schema/UX contract mismatch on minute granularity (Architect S8/T4)
- **Confidence:** HIGH
- **Evidence:** Plan Phase 4 §2 sheet uses `"24h picker, 30-min step"` but Phase 1 §2 schema is `start_minutes INTEGER NOT NULL` with **no** `CHECK(start_minutes % 30 = 0)`. Future code paths (CSV import, manual SQL fix-up, schema v2) can insert `start_minutes=1035` (17:15); `grid.ts` then floors it to slot 17:00 silently.
- **Fix:** Either add `CHECK(start_minutes % 30 = 0 AND end_minutes % 30 = 0)` to schema (recommended — matches spec grid lock), OR document that sub-30-minute starts are deliberately allowed and grid floors them (and add the title-stamp text rule).

### 6. `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` will fail on stock expo-router types (Critic-found)
- **Confidence:** MEDIUM (untested in this exact SDK + expo-router version, but historically a recurring pattern)
- **Evidence:** Plan Phase 0 §3 — `"tsconfig.json → \"strict\": true, \"noUncheckedIndexedAccess\": true, \"exactOptionalPropertyTypes\": true."` Phase 0 §6 — `"npx tsc --noEmit — exit 0."` `expo-router`'s `app.d.ts` and route-typed-link types historically use `string | undefined` for params and have collisions with `exactOptionalPropertyTypes`.
- **Why this matters:** Phase 0 smoke gate may fail on first run before any product code exists, blocking the project at the gate.
- **Fix:** Either (a) drop `exactOptionalPropertyTypes` and document why (most common path), (b) keep it and explicitly add typed-routes opt-out / `// @ts-expect-error` shims with documentation, or (c) verify against the locked Expo SDK version cited in Phase 0 and document the verification.

### 7. `rescheduleAll()` on every `AppState=active` creates a no-trigger window (Critic-found)
- **Confidence:** MEDIUM
- **Evidence:** Plan Phase 5 §3 — `"on every cold start AND on app foreground (AppState listener)."` Architect S3 hardens this to start with `cancelAllScheduledNotificationsAsync()` + rebuild. Combined: every foreground transition wipes ~50 triggers and rebuilds them.
- **Why this matters:** (a) wasted work on trivial backgrounding (alt-tab, notification panel pull-down); (b) brief window of zero triggers during which a near-fire trigger could be dropped; (c) on iOS, `cancelAllScheduledNotificationsAsync` followed by a burst of `scheduleNotificationAsync` calls can hit OS rate limits.
- **Fix:** Debounce `rescheduleAll()` with last-run timestamp (skip if last run < N minutes ago, e.g., 60min). Cold start always runs; foreground only runs if 60min elapsed.

### 8. iOS 64-pending-trigger cap unmentioned (Architect T5)
- **Confidence:** HIGH
- **Evidence:** Plan Phase 5 §2 — `"horizonDays = 14"` and Phase 5 acceptance — `"getAllScheduledNotificationsAsync() returns the expected count for the next 14 days."` 4 children × ~8 schedules × ~10 occurrence-days within 14 days ≈ 320 triggers, well over iOS's hard 64-cap. iOS silently drops 64+. Acceptance check would assert "expected count" — but expected vs actually-queued diverges.
- **Fix:** Add Risk #6 with mitigation: on iOS, sort upcoming triggers by `notify_at` ascending and queue at most 60 (leave 4 headroom for race conditions); rely on `rescheduleAll()` on foreground to top-up the next batch. Add Phase 5 acceptance: "iOS pending count never exceeds 64."

### 9. Colorblind / a11y disambiguator missing (Architect S5/C6)
- **Confidence:** HIGH
- **Evidence:** Plan never specifies actual palette colors, no per-child non-color marker on `ScheduleBlock`. `TypeIcon` disambiguates type, not child.
- **Fix:** Architect's S5 — explicit palette in `src/domain/constants.ts`, per-child initial overlay on block, WCAG AA contrast pairs documented, colorblind-sim Phase 3 acceptance.

### 10. DST/TZ assumption not documented or tested (Architect S6/C1)
- **Confidence:** HIGH
- **Evidence:** Plan Risk #2 names the issue but proposes only a `process.env.TZ` mock for jest. No assumption header in `occurrences.ts`. Notification trigger uses absolute `Date` which silently drifts for travelers crossing DST.
- **Fix:** Architect's S6 — header comment on `occurrences.ts` documenting the Korea/no-DST design decision, plus a Berlin-DST unit test that asserts wall-clock 9:00 trigger fires at local 9:00 on both sides of the DST boundary.

### 11. Exception upsert race on cancel→modify (Architect S4/C2)
- **Confidence:** HIGH
- **Evidence:** Plan schema has `UNIQUE(schedule_id, date)`. Phase 4 save flow does not specify `ON CONFLICT … DO UPDATE`. If a `cancel` exception exists and user re-edits to `modify`, raw `INSERT` fails with `SQLITE_CONSTRAINT`.
- **Fix:** Architect's S4 verbatim.

---

## Minor Findings

1. **`@react-native-async-storage/async-storage` listed in deps** but Phase 5 says AsyncStorage is "demoted to per-session cache" (per the S3 fix). If we accept Architect S3, we may not need AsyncStorage at all — drop the dep, reduce bundle.
2. **`expo-haptics`, `expo-linking` listed** in Phase 0 §2 deps but never used in the rest of the plan. Either add them to a phase or drop them.
3. **`ADR placeholder` in v1 defers to "after Critic approval"** but Critic cannot approve without seeing the consequences honestly stated (Architect S9). Chicken-and-egg — the ADR Consequences should be filled BEFORE the Critic round, not after.
4. **`app/schedule/edit.tsx` route file vs `ScheduleEditSheet` modal** (Critic C-NEW-4) — likely just a stale scaffold entry; either turn it into a fallback deep-link route or delete it from the scaffold.
5. **Phase 3 acceptance "scroll FPS does not drop below 55 with 20 schedules"** — no measurement method specified. Add: `npx react-native-performance` or Flipper FPS overlay screenshot, or Reanimated `useFrameCallback` logging.
6. **Phase 6 visual-verdict pass** references "an agreed reference screenshot" — no reference image exists yet, no producer named. Either commit a Figma export or have Phase 3 produce the reference, then Phase 6 compares.

---

## What's Missing (gaps not flagged elsewhere)

- **No data-export / "rescue me" path.** Spec relies on OS backup; if backup fails, the user has no in-app DB export. Not in spec ACs but a 1-screen Settings → "Export to JSON" would make the local-first stance survivable. Add to deferred list explicitly.
- **No analytics/telemetry kill switch in Phase 0.** Plan says zero telemetry, but Expo SDK ships with anonymous metrics by default (`EXPO_NO_TELEMETRY=1`). Plan should pin this in `.env` or `app.json` to honor Principle 1 ("no telemetry").
- **No empty-state design.** Day 1 has zero children and zero schedules. Plan never describes what `(tabs)/index.tsx` renders when `children.length === 0`. Phase 3 starts with rendering 4 columns × 35 rows — but `MAX_CHILDREN=4` is the cap, not the requirement.
- **No "what happens if user adds a 5th child" UX rule.** Spec says max 4. Plan inserts no schema CHECK, no UI block. Need either `CHECK((SELECT COUNT(*) FROM children) <= 4)` (SQLite supports via trigger only) OR app-level guard with explicit error message.
- **No keyboard-aware sheet behavior.** Phase 4 schedule edit sheet has text inputs (title, location, notes). On Android, the keyboard pushes the sheet; needs `KeyboardAwareScrollView` or `BottomSheetTextInput`.
- **No Expo SDK version pinned.** Plan says "Expo SDK" but never names a number. Architect's analyses (e.g., expo-sqlite next-gen API, `BottomSheetScrollView`, expo-router types) all depend on the version. Lock to `expo@~52.x` (or whatever is current at execution time) and document.
- **No commit cadence or branching strategy.** Phase 0 "First commit" is named, but Phases 1–6 don't say "commit after each acceptance gate." Loose discipline = unreviewable history.
- **No `git init` / branch protection / `main` policy.** Phase 0 §1 says `git init` only if not already; doesn't say which branch. Combined with "First commit is on `main`" in acceptance — but `git init` defaults to `main` only on git ≥ 2.28 with `init.defaultBranch=main`. Lock the branch name explicitly.

---

## Ambiguity Risks

- `"Bare RN primitives + react-native-gesture-handler + react-native-reanimated"` — does this mean **no** UI library at all, or "use `View`/`Text`/`StyleSheet` only"? Phase 4 forms (chips, pickers, toggles) require many primitives. Interpretation A: hand-roll all chrome (high LoC, Architect S9 cost). Interpretation B: pull in lightweight focused packages (`react-native-segmented-control`, `@react-native-community/datetimepicker`) as needed. Risk: Executor picks A and burns days on form chrome.
- `"On-demand expansion called per visible day"` — does Phase 5 also call this on-demand at notification scheduling time, or does Phase 5 maintain its own representation? Plan Phase 5 §2 says it does call `expandOccurrences` — but Architect T3 notes this creates two views. Interpretation A: occurrences are the source of truth, AsyncStorage map is throwaway cache. Interpretation B: AsyncStorage map is durable. Risk: Executor picks B and Architect C7 fails.
- `"Drilldown is the same edit sheet as DailyView"` — Phase 4 §1 says WeeklyView "Tap empty cell / block → same edit sheet." Sheet pre-fills (childId, time). On WeeklyView, `childId` is the locked drilldown child — does the sheet hide the child picker? Interpretation A: yes, locked. Interpretation B: shown but pre-selected. Risk: minor UX confusion.
- `"OS backup-only durability"` — does the plan exercise / verify OS backup at all? Phase 6 §3 says "iCloud Documents" and `adb backup`. But `expo-sqlite` writes to `FileSystem.documentDirectory` by default, which IS iCloud-eligible on iOS only with `NSUbiquitousContainers` configuration. Plan does not configure. Interpretation A: default works (it doesn't on iOS without `app.json` ios.entitlements wiring). Interpretation B: explicit configuration required.

---

## Multi-Perspective Notes

- **Executor:** Phase 0 §6 smoke gate is the immediate stuck-point — `expo start` doesn't exit. Phase 1 §4 occurrence pseudocode is exemplary; I can implement it. Phase 4 §2 fields list is unambiguous. Phase 5 lacks a "what to schedule when permission state changed since last run" code path — I'd ask.
- **Stakeholder:** The plan as written gets the user a working app — minus Architect's three blockers, which would each cause a real-world bug parents would notice (orphan notifications, double-applied migrations, stalled dev loop). The plan is honest about what it includes and excludes.
- **Skeptic:** The plan rejected three viable alternatives (Tamagui, Drizzle, Context+useReducer) using arguments the Architect successfully steelmanned against. The rejections aren't *wrong*, but the rationale is not as airtight as the plan presents. The ADR Consequences section is a placeholder, which conveniently dodges quantifying these costs. v2 must fill ADR consequences honestly.

---

## Ranked list of revisions required for v2

### Must-fix (blocks approval — REJECT v2 if missing)

1. **Architect S1 — Phase 0 hooks redesign.** Replace per-edit `tsc --noEmit` with: per-edit `eslint --fix` only; `Stop` hook with `npx tsc --noEmit --incremental`. Update Phase 0 §5 hook block. (Architect blocker.)
2. **Architect S2 — Migration `PRAGMA user_version` inside transaction.** Update Phase 1 §2 pseudocode; add Phase 1 acceptance for crash-between-DDL-and-PRAGMA. Verify `expo-sqlite` next-gen supports DDL inside `BEGIN IMMEDIATE`; if not, fall back to `withTransactionAsync`. (Architect blocker.)
3. **Architect S3 — `rescheduleAll()` starts with `cancelAllScheduledNotificationsAsync()`.** AsyncStorage map demoted to per-session cache. Update Phase 5 §2 and acceptance ("force-quit during delete sweep, reopen, no orphans"). (Architect blocker.)
4. **Critic C-NEW-1 — Replace `npx expo start` smoke check with a non-interactive equivalent.** `expo-doctor`, `expo export`, or `timeout` + log grep. Update Phase 0 §6.
5. **Critic C-NEW-2 — Verify or relax strict tsconfig.** Either drop `exactOptionalPropertyTypes` (most likely) or document expo-router compatibility for the locked SDK version. Phase 0 §3.

### Should-fix (strongly recommended)

6. **Architect S4 — `ON CONFLICT(schedule_id, date) DO UPDATE` for exception writes.** Phase 4 §2.
7. **Architect S5 — Per-child non-color disambiguator + explicit palette + WCAG AA.** `src/domain/constants.ts`, `ScheduleBlock`, Phase 3 acceptance.
8. **Architect S6 — TZ/DST assumption header + Berlin-DST unit test.** `src/domain/occurrences.ts`, `tests/domain/occurrences.test.ts`.
9. **Architect S8 — Decide & document 30-min granularity.** Add schema CHECK or document floor-and-stamp behavior. Phase 1 §2 + Phase 4 §2.
10. **Architect T5 / Critic #8 — iOS 64-trigger cap.** Add Risk #6, cap horizon to 60 pending, add Phase 5 acceptance.
11. **Architect S9 — Honest ADR Consequences.** Fill in BEFORE Critic round, not after. Add bare-RN form-chrome cost (~600 LoC), `row-mappers.ts` 40 LoC, no-devtools accepted.
12. **Critic #7 — Debounce `rescheduleAll()` on `AppState=active`** with last-run timestamp (skip if <60min). Phase 5 §3.
13. **Architect S7 — `BottomSheetScrollView` for sheet content.** Phase 4 §2.

### May-fix (architectural posture / hygiene)

14. **Critic gap — Pin Expo SDK version.** Phase 0 §1.
15. **Critic gap — Set `EXPO_NO_TELEMETRY=1`.** Phase 0 §4 (or `app.json`).
16. **Critic gap — Empty-state design + 5th-child guard.** Phase 3 §1, Phase 4 settings tab.
17. **Critic gap — Keyboard-aware sheet behavior on Android.** Phase 4 §2.
18. **Critic gap — Branching/commit cadence policy.** Phase 0 §7 + each phase acceptance.
19. **Critic gap — iCloud Documents `NSUbiquitousContainers` configuration** for spec's "OS backup is the durability story." `app.json` ios entitlements. Phase 0 §4 or Phase 6 §3.
20. **Critic gap — In-app DB export-to-JSON** as an explicit deferred item (not in spec, but consistent with Principle 1 + risk-management).
21. **Critic minor #4 — Resolve `app/schedule/edit.tsx` vs `ScheduleEditSheet` modal contradiction.** Either delete the route or define when it's used.
22. **Critic minor #5 — Specify FPS measurement method for Phase 3 acceptance.**
23. **Critic minor #6 — Define producer of the visual-verdict reference screenshot.**

---

## Realist Check

- **Finding 1 (hooks):** Worst case is real and continuous (every dev loop), not theoretical. Detection is immediate but pain compounds. **Severity holds at CRITICAL.**
- **Finding 2 (PRAGMA):** Phase 1 migration 001 is idempotent — the bug is dormant until migration 002 ships. Realistic worst case: silent data corruption on first schema bump in production. Mitigated only by users rarely getting OS-killed mid-COMMIT. **Severity holds at CRITICAL** — earns it because data loss is in scope.
- **Finding 3 (orphan notifications):** Realistic worst case: a deleted academy schedule still pings the parent next Tuesday. User will notice. Easy rollback if caught (just reinstall). **Severity holds at CRITICAL** — user trust loss.
- **Finding 4 (`expo start` interactive):** Realistic worst case: Phase 0 gate hangs on first run; agent or user manually Ctrl+C and skip; Phase 0 acceptance silently false. Detected immediately by the agent in execution. **Severity holds at CRITICAL** — a gate that doesn't gate is structurally dishonest, and the user explicitly asked for Phase 0 to be hard.
- **Finding 6 (strict tsconfig):** Realistic worst case is detection-immediate (smoke gate fails on first run). Easy fix (drop one flag). **Downgrade from CRITICAL to MAJOR — Mitigated by:** detection happens within 30 seconds of the smoke gate, no propagation cost.
- **Finding 7 (rescheduleAll thrash):** Realistic worst case is wasted CPU + a tiny window where a near-fire trigger could be dropped — likelihood low (sub-second window in foreground transition). **Severity holds at MAJOR** — not CRITICAL because the loss is bounded and the fix is a debounce.
- **Finding 8 (iOS 64-cap):** Realistic worst case: silent truncation. Plan acceptance check ("expected count") would catch it on the first integration test — so it's a Phase 5 detection, not a production-only surprise. **Severity holds at MAJOR.**

No CRITICAL was upgraded; one MAJOR (`#6`) was previously labeled by me as CRITICAL in draft and downgraded after Realist Check. The remaining four CRITICALs survive.

---

## Verdict: ITERATE

The plan is structurally sound and the Architect identified the right blockers. v1 cannot be approved with three known-unaddressed Architect blockers plus two additional Critic-found gaps (C-NEW-1 interactive smoke gate, C-NEW-2 strict tsconfig vs expo-router). The plan does not need a rewrite — it needs surgical revisions in five must-fix sites and eight should-fix sites.

I escalated to ADVERSARIAL mode after confirming the Architect's three blockers and finding two additional issues; in that mode I expanded scope to phase-zero tooling minutiae (Expo SDK pin, telemetry, `EXPO_NO_TELEMETRY`, branch policy) and uncovered the gaps in "What's Missing." None of those rise to CRITICAL on their own; they are book-keeping debt that v2 should clear before execution.

**Decision rule application:** Of 8 criteria, 4 score below 4/5 (criteria 2, 3, 7, 8). At least one Architect blocker remains in v1 (in fact, all three do). Therefore APPROVE is mathematically prohibited. REJECT is too harsh — the plan is not structurally broken, just under-revised. **ITERATE.**

---

## Open Questions (unscored)

1. Does `expo-sqlite` next-gen async API support DDL inside an explicit `BEGIN IMMEDIATE` transaction, or must the migration runner use `withTransactionAsync`? (Architect S2 verification step — Critic could not confirm without running code.)
2. Is the locked Expo SDK version compatible with `exactOptionalPropertyTypes` for `expo-router`'s generated types? (Critic C-NEW-2 — version-dependent; needs smoke test.)
3. The plan's Phase 0 §2 lists `react-native-reanimated` and `react-native-gesture-handler` as `npx expo install` targets. Both ship as Expo-managed peer modules in current SDKs. Is there a known incompatibility between Reanimated's Babel plugin order and `jest-expo` test runs? (Possible — would manifest as "cannot find module" in unit tests; defer until Phase 1 testing.)
4. Should Phase 0 also install `@types/react-native` explicitly, or does the Expo template pull it transitively? (Hygiene; defer.)
5. Architect's option-rejection rationales for Drizzle (C2) and Context+useReducer (B2) are softer than written — should v2 strengthen the rejection text or actually re-open the choice? (Recommend: strengthen text in ADR §Consequences per Architect S9; do not re-open the choice. Costs of switching mid-stream exceed the marginal benefit.)

---

## Ralplan summary row

| Gate | Pass/Fail | Reason |
|---|---|---|
| Principle/Option Consistency | **Pass** | Each option traces to Principles 1–4; Principle 5 (Phase 0) is structurally honored even though its hook payload is broken. |
| Alternatives Depth | **Marginal** | Real alternatives are listed with pros/cons but the rejection rationales are softer than the Architect steelmans show. v2 must strengthen ADR Consequences. |
| Risk/Verification Rigor | **Fail** | Three Architect blockers (S1, S2, S3) identify mitigations that look concrete but are partial or absent in execution. Two Critic-found gaps add to this. |
| Deliberate Additions (if required) | **N/A** | Plan is in SHORT mode. Critic does not require escalation to DELIBERATE — the issues are localized, not foundational. v2 can stay SHORT after the must-fix revisions land. |

