# Critic Review v2 — ralplan-schedul-app-v2

**Reviewer:** Critic (ralplan consensus round 2)
**Spec:** `.omc/specs/deep-interview-schedul-app.md` (ambiguity 5.0%, PASSED)
**Plan:** `.omc/plans/ralplan-schedul-app-v2.md`
**Architect v2 verdict:** APPROVE (with N1 boot-latency note)
**Mode:** THOROUGH (no escalation triggered — see Verdict Justification)
**Date:** 2026-05-04

---

## Must-fix verification (5 items)

### 1. S1 — Hooks slowness fix — **LANDED**
- **Confidence:** HIGH
- **Evidence:** Phase 0 §5 (`ralplan-schedul-app-v2.md:163–203`) installs three hooks: `PostToolUse Edit|Write` runs `eslint --fix` only (file-scoped, `<500ms` warm); `Stop` hook runs `tsc --noEmit --incremental`; `SessionStart` runs `expo-doctor`. Per-edit `tsc` is **gone**. The change-table row 1 (`ralplan-schedul-app-v2.md:16`) and Risk #6 (`690–714`) document the rationale and budget.
- **Latency budget honored:** `eslint --fix` cited at `<500ms warm`, `tsc --incremental` on Stop cited at `<500ms warm` after first build. ADR Consequences explicitly state `"Per-edit hook is fast (<500ms warm); no developer-experience tax on the agent loop."`
- **One residual nit (not blocking):** the per-edit hook uses `grep -qE '\\.tsx?$'` with single quotes inside a JSON string — the regex literal looks correct but the change-table doesn't note that `.eslintignore` would prevent `node_modules` files matched by the matcher from being linted. Existing OMC patterns handle this. Not a structural problem.

### 2. S2 — Migration atomicity fix — **LANDED**
- **Confidence:** HIGH
- **Evidence:** Phase 1 §2 (`ralplan-schedul-app-v2.md:314–376`) shows `applyMigrationAtomic()` with `BEGIN IMMEDIATE` … `execAsync(m.sql)` … `PRAGMA user_version = ${m.version}` … `COMMIT`, with explicit `ROLLBACK` on the inner catch. The PRAGMA is the **last statement before COMMIT, inside the transaction**. The documented fallback to `db.withTransactionAsync` is wrapped in a try/catch that detects the `cannot.*DDL|not allowed.*transaction` error class.
- **Crash-recovery test added:** Phase 1 acceptance (`394–397`) requires "mocked PRAGMA failure leaves DB at `user_version=0` with no DDL artifacts" plus a `.omc/logs/phase1-tx-mode.txt` log of which path was used. Risk #1 (`692–694`) and ADR (`723`) both reflect the change.
- **Minor concern, not blocking:** the regex `/cannot.*DDL|not allowed.*transaction/i` may not match the actual SDK error text. If it doesn't, the rethrow happens and the fallback never runs — but the crash-recovery test would surface this in Phase 1 (acceptance #3). Acceptable risk gate.

### 3. S3 — Notification cleanup safety fix — **LANDED**
- **Confidence:** HIGH
- **Evidence:** Phase 5 §2 (`ralplan-schedul-app-v2.md:507–584`) makes `rescheduleAll()` start with `await Notifications.cancelAllScheduledNotificationsAsync()` followed by `sessionMap.clear()`. The header comment block on `sessionMap` (`512–514`) explicitly states `"PER-SESSION CACHE ONLY. Cleared on cold start. NEVER source of truth."` and the invariants block (`581–584`) repeats this three times.
- **Tests added:** Phase 5 acceptance (`596–598`) requires (a) force-quit-mid-delete → reopen → `getAllScheduledNotificationsAsync()` matches DB; (b) unit test asserting `rescheduleAll`'s **first** call is `cancelAllScheduledNotificationsAsync` (call-order assertion via mock); (c) grep test asserting no `AsyncStorage.setItem` referencing the notification map. Test Strategy §Unit (`677`) repeats these three.
- **One minor concern, not blocking:** `cancelForOccurrence()` (`547–557`) is now a near-no-op when `sessionMap` is cold — the comment delegates to `rescheduleAll()` as the source of truth. This is correct under the new invariant, but the function being a no-op when called post-restart is subtle; acceptable because it's documented inline.

### 4. C-NEW-1 — Non-interactive Phase 0 smoke gate — **LANDED**
- **Confidence:** HIGH
- **Evidence:** Phase 0 §6 (`ralplan-schedul-app-v2.md:211–242`) replaces `npx expo start` with five non-interactive commands: `expo-doctor`, `timeout 60s npx expo export --platform all --dump-assetmap`, `tsc --noEmit`, `eslint .`, `jest --passWithNoTests`. Each has clean exit-code semantics. The script writes to `.omc/logs/phase0-smoke.log` via `tee`. `set -e` at top fails-fast.
- **Fallback documented:** if `--platform=all` is unsupported on the pinned SDK, fall back to `--platform web` (`ralplan-schedul-app-v2.md:240`). Sensible.
- **`timeout 60s` on `expo export`:** belt-and-braces against any hang. Phase 0 acceptance (`246–255`) explicitly requires all five exit 0. ADR Alternatives section (`740`) records that v1 `npx expo start --no-dev --offline` was rejected because "interactive long-running process with no exit-code semantic."

### 5. C-NEW-2 — `exactOptionalPropertyTypes` removed — **LANDED**
- **Confidence:** HIGH
- **Evidence:** Phase 0 §3 (`ralplan-schedul-app-v2.md:108–127`) removes `exactOptionalPropertyTypes` and adds an inline rationale: `"expo-router generated types (string | undefined for params) are incompatible with exactOptionalPropertyTypes on SDK ~52.x. Smoke-gate tsc --noEmit must return 0 on a fresh project — keeping this flag would fail before any product code is written. Re-evaluate if expo-router types stabilize in a future SDK."` Phase 0 acceptance (`251`) explicitly checks `tsconfig.json` does **NOT** contain the flag.
- **ADR honesty:** Consequences section (`756`) acknowledges `"Dropping exactOptionalPropertyTypes means { foo?: T } accepts { foo: undefined } — a small soundness loss tolerated to avoid fighting expo-router."` This is exactly the honest tradeoff statement that v1's ADR placeholder dodged.

---

## What's-missing verification (7 items)

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Expo SDK pinned | **LANDED** | Phase 0 §1 (`100`): `"expo": "~52.0.0"` with re-verify clause if `create-expo-app@latest` produces a newer SDK; Phase 0 acceptance (`248`); ADR (`729`). |
| 2 | `EXPO_NO_TELEMETRY=1` | **LANDED** | Phase 0 §4 (`157–161`): `.env` with `EXPO_NO_TELEMETRY=1`; hooks also export it inline (`176, 186, 196`); smoke gate exports it (`219`); Phase 0 acceptance (`249`). |
| 3 | Empty-state CTA | **LANDED** | Phase 3 §1 (`424–431`): if `children.length === 0`, render `<EmptyChildrenState>` with friendly message and CTA to settings. New file in scaffold (`306`). Phase 3 acceptance (`443`) verifies. |
| 4 | 5th-child hard-stop | **LANDED** | Phase 4 §3 (`469–473`): "Add child" button disabled+grayed when `children.length >= 4`; inline message "최대 4명까지 등록할 수 있습니다."; defense-in-depth check in `repositories/children.ts.create()` rejecting `(SELECT COUNT(*) FROM children) >= 4` with a typed error. Phase 4 acceptance (`491`) verifies both UI and repo. |
| 5 | Keyboard-aware sheet | **LANDED** | Phase 4 §2 (`460–464`): `BottomSheetModal` with `keyboardBehavior="interactive"` + `keyboardBlurBehavior="restore"`; `BottomSheetTextInput` for `title`/`location`/`notes`; Android `softwareKeyboardLayoutMode = "resize"`. Phase 4 acceptance (`492`) verifies on iPhone SE. |
| 6 | iCloud entitlements | **LANDED** | Phase 0 §4 (`136–156`): full `app.json` block with `usesIcloudStorage`, `com.apple.developer.icloud-container-identifiers`, `com.apple.developer.icloud-services: ["CloudDocuments"]`, `com.apple.developer.ubiquity-container-identifiers`, and `NSUbiquitousContainers` infoPlist key. Phase 0 acceptance (`250`) verifies the keys. |
| 7 | DB export button | **LANDED** | Phase 4 §3 (`477–481`): JSON export to `${FileSystem.documentDirectory}schedulapp-export-…json`, `Sharing.shareAsync(uri)`, with explicit "no import in MVP" decision. Phase 4 acceptance (`493`) and Phase 6 §3 (`612`) reference it. ADR follow-ups (`769`) tracks v3 import. |

**Score: 7/7 addressed.** Bar required ≥6/7.

---

## Independent judgment

### Are acceptance criteria all testable?

Mostly **yes, with two soft spots that survived from v1**:

- **Pass:** Phase 0 acceptance is fully mechanical (`exit 0` on five commands, file existence, tsconfig key absence). Phase 1 has the new "crash-recovery test" and "tx-mode logged" criteria — both are mechanical. Phase 2 coverage gate (`≥80%`) is mechanical. Phase 4 has UI checks ("button disabled when 4 children", "submit button remains tappable on iPhone SE", "valid JSON file with all four tables"). Phase 5 has the strong invariant tests — `cancelAll` first-call ordering via mock, `sessionMap` not persisted via grep test. These are excellent.
- **Soft (carryover from v1):** Phase 3 acceptance (`448`) "scroll FPS does not drop below 55 with 20 schedules" still has no measurement method specified — Critic minor #5 from v1 was deferred to open-questions (`open-questions.md:15`). Acceptable as a deferred Phase 6 polish item.
- **Soft (carryover from v1):** Phase 6 acceptance (`622`) `visual-verdict pass committed` references "an agreed reference screenshot" (`608`) but no producer is named. Critic minor #6 from v1 was deferred (`open-questions.md:16`). Acceptable.

Both soft spots are explicitly tracked in `open-questions.md`, so they are not stealth gaps — they are owned. **Verdict: pass.**

### Is the ADR honest about tradeoffs (no whitewashing)?

**Yes.** The ADR Consequences section (`746–757`) lists 5 negatives explicitly:
- `(-)` 40 LoC of hand-written row→domain mappers; `"Mismatches between schema and TS types surface as runtime errors, not compile errors."`
- `(-)` ~600 LoC of bare-RN form chrome; `"Accessibility (TalkBack/VoiceOver labels, focus order, font scaling) is per-component on us. Dark mode requires a token system we don't have yet."`
- `(-)` Zustand has no devtools UI like Redux.
- `(-)` Dropping `exactOptionalPropertyTypes` means soundness loss; explicitly named.
- `(-)` `rescheduleAll()` wiping the entire OS queue creates a sub-second window of zero pending triggers. **This is the most important honesty point** because it's a self-disclosed defect of the chosen design.

The Alternatives section (`734–741`) explicitly logs **why v1's hooks and v1's smoke gate were rejected** in v2 — i.e., the planner is honest that the v1 versions were broken, not just suboptimal. This is the kind of blameless retrospective that v1's ADR-placeholder dodged. Architect S9 closed.

### Does the Architect's N1 risk (boot-time reschedule jank from 200+ serial calls) need to gate APPROVE or can it be a Phase 5 follow-up?

**Phase 5 / post-MVP follow-up — does NOT gate APPROVE.** Reasoning:

- **It's a performance issue, not a correctness issue.** Cold start runs `cancelAllScheduledNotificationsAsync()` once + 200+ `scheduleNotificationAsync()` calls. The semantic outcome is correct (DB-derived projection); the wall-clock cost is the concern.
- **The plan's existing acceptance covers detection.** Phase 5 acceptance (`594`) checks `getAllScheduledNotificationsAsync()` returns expected count for 14-day horizon — if cold-start serial scheduling exceeds an acceptable budget, integration test runs would slow visibly.
- **Realistic worst case:** 1–3s cold-start delay on first app launch each session. User-visible but bounded. Mitigation paths (parallel `Promise.all` over `scheduleForSchedule`, or batching within `scheduleForSchedule`) are local refactors that don't affect the architecture.
- **Open-questions item already exists for the related concern.** Critic #7 debounce tuning (`open-questions.md:13`) covers the AppState-active path; cold-start cadence is naturally adjacent and can be tracked in the same item.
- **No structural plan problem.** No phase contract changes; no schema changes; no public API changes; no test rework. It's a Phase 5 implementation polish.

**Recommendation:** Add the Architect's N1 to `open-questions.md` as a tracked Phase 5 polish item (e.g., "parallelize/batch `rescheduleAll()` cold-start scheduling if measured wall-clock > 1.5s on a P50 device"). Do NOT block v2 approval on it.

### New structural problems introduced in v2?

**None found.** I verified:
- Hook redesign doesn't break Phase 0 acceptance — three hooks, file-scoped, plus a separate `Stop` hook for project-wide tsc.
- Migration runner pseudocode compiles in my head against the documented `expo-sqlite` next-gen async API; the documented fallback path uses `withTransactionAsync` which is in the SDK.
- `rescheduleAll()` with `cancelAll-first` is straightforward; `cancelForOccurrence()` no-op-when-cold is documented and correct.
- Smoke gate's five commands are all idempotent and have stable exit codes.
- Empty-state, 5th-child guard, keyboard-aware sheet, iCloud entitlements, DB export — none introduce new dependencies or new schema requirements beyond what was already in v1's deps list.
- ADR Consequences are honest and don't quietly walk back v1 commitments.

### Multi-perspective spot-check

- **Executor:** Phase 0 §6 is now mechanically executable (was the v1 stuck-point). Phase 1 §2 migration runner pseudocode is ~50 lines I can implement directly. Phase 5 §2 invariants block (`581–584`) tells me exactly what the invariants are; I won't drift from them. Phase 4 §3 children cap has both UI and repo enforcement spelled out so I won't miss either side.
- **Stakeholder:** The plan now ships honest non-goals (no DB import, no DST hardening, no colorblind palette in MVP, no exception upsert, no iOS 64-cap mitigation) **and** explicit follow-ups for each (`open-questions.md`). Stakeholder gets a working MVP with a written debt ledger.
- **Skeptic:** The ADR Consequences section (`746–757`) is the strongest part of v2 — five concrete negatives stated against the chosen options. The "we rejected v1's hooks because they violated their own latency budget" clause is the kind of self-blameless retrospective rare in greenfield plans.

---

## Verdict: APPROVE

**Justification:**
- All 5 must-fix items concretely landed with clear file/line evidence in v2 (not hand-wavy commentary).
- 7/7 "what's missing" items addressed (bar required ≥6/7).
- Architect v2 returned APPROVE.
- No new structural problems introduced; the only new note (boot-time reschedule jank) is a Phase 5 implementation polish, not a structural plan problem — recommend appending to `open-questions.md`.
- ADR is honest about tradeoffs; carryover soft spots (FPS measurement method, visual-verdict reference producer) are tracked in `open-questions.md` rather than hidden.
- Test Strategy §Unit (`670–678`) explicitly enumerates the three S2/S3 invariant tests that v1 never had — the v2 plan is *more verifiable*, not just *more correct*.

**Mode:** THOROUGH. Did not escalate to ADVERSARIAL because (a) zero CRITICAL findings emerged, (b) zero MAJOR findings emerged, (c) all five v1 must-fixes have evidence-backed closures, (d) Architect already approved.

**Realist Check applied:** No CRITICAL/MAJOR findings to pressure-test. The Architect's N1 was tested against the four Realist questions — realistic worst case (1–3s cold-start delay) is a Phase 5 polish concern with clear mitigation paths and natural detection during integration testing. Confirmed not structural.

**Single recommended (non-blocking) follow-up before kickoff:**
- Append Architect's N1 (boot-time reschedule jank) to `.omc/plans/open-questions.md` with phrasing like: *"Parallelize/batch `rescheduleAll()` cold-start scheduling if measured wall-clock > 1.5s on a P50 device. Default sequential implementation acceptable for MVP."*

---

## Ralplan summary row

| Gate | Pass/Fail | Reason |
|---|---|---|
| Principle/Option Consistency | **Pass** | A1/B1/C1/D1 unchanged from v1 and still trace cleanly to Principles 1–4. Principle 5 (Phase 0 gate) now mechanically executable. |
| Alternatives Depth | **Pass** | ADR Alternatives section now also records why v1's hooks and v1's smoke gate were rejected — honest planner-self-revision. |
| Risk/Verification Rigor | **Pass** | All three Architect blockers closed with both code-level pseudocode and acceptance-level invariant tests. The S3 cancel-order mock test and grep test for `sessionMap` non-persistence are exemplary. |
| Deliberate Additions | **N/A** | SHORT mode; deliberate-mode requirements not in scope. |

**Critic verdict: APPROVE**
