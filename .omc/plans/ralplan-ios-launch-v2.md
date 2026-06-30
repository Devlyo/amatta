# RALPLAN-DR — iOS App Store v1.0.0 Launch (아마따 / schedul-app) — **v2 (follow-up to ADR-005)**

> **Mode:** DELIBERATE consensus (Planner v2 → Architect → Critic). High-risk surfaces present: **SQLite migration v6** (data-model change to live user data) and **App Privacy / required-reason API compliance**.
> **Scope:** Finish the iOS App Store **first** submission of v1.0.0. **PLANNING ONLY — coding is OUT OF SCOPE.** This document defines phases, gates, risks, decisions, and an ADR; it writes no code.
> **Date:** 2026-06-22 · **Author:** Planner · **Status:** REVISED v2 — Revision Loop 1 (Architect APPROVE-WITH-REQUIRED-REVISIONS + Critic ITERATE folded in; founder scope decisions now locked). For Architect→Critic re-review.
> **Final file:** `.omc/plans/ralplan-ios-launch-v2.md` · **Supersedes-in-part:** `.omc/plans/ralplan-ios-launch.md` (the v1 launch plan that carries ADR-005). **ADR-005 is Accepted and unchanged except where this doc's ADR-005-S1 supplement notes a delta.**

---

## Revision Loop 1 — what changed in this revision (Architect + Critic + founder)

Folded in mechanically so the next Architect→Critic pass can APPROVE. Each is traceable to a source line.

| Tag | Source | Change |
|---|---|---|
| **Founder-1** | scope decision | **J1-A locked.** Day-specific checklist membership IS in v1 scope (the scope question was explicitly answered YES). The former J1-B is renamed **J1-C** and kept as a fairly-described considered-and-rejected alternative. 7→8 table consequence + ADR-001 Drizzle-reconsider trip recorded. |
| **Founder-2** | scope decision | **Per-prep-item "반복"(recurring) toggle, default OFF.** Persistence via `checklist_items.occurrence_date`: OFF (new-item default) = day-specific (`occurrence_date = that day, yyyymmdd INT`); ON = recurring (`occurrence_date = NULL`). Entry-point/default-by-context rule pinned in 3.1. Membership query `occurrence_date IS NULL OR occurrence_date == D`. |
| **Founder-3 / sub-(iv)** | scope decision | **Notification body = Option A** (suppress already-completed for that occurrence, keep current UX). Pinned; drives task 3.2f (C2). |
| **C1** | Critic (highest risk) | Removed the false "idempotent via IF NOT EXISTS, matching 001/002/005" framing. v6's safety property is **ATOMICITY-gated, additive-only — NOT statement-idempotency** (runner is version-gated, `index.ts:38`). `ALTER … ADD COLUMN` cannot be IF-NOT-EXISTS. Replaced the "run twice is a no-op" test with **two** tests: version-guard regression + atomicity (both runner paths). Flagged the wrong comment at `005:16`. |
| **C2** | Architect | Added the **notification-body per-occurrence task (3.2f)** — `body.ts:48-52` filters `!c.isDone`, which breaks once `is_done` freezes. Thread `occ.date` through `scheduler.ts:135-152` → join `checklist_completion` → pass a per-occurrence pending set to `body.ts`. Integration test updated to per-occurrence suppression. |
| **M1** | Architect | Backfill default changed from "ignore" to **"completed-for-today only"** (insert a completion row for today's `occurrence_date`; future occurrences start fresh). Migration test asserts exactly that. |
| **M3** | Architect | **Split Phase 4** into P4a (build-dependent, parallel off P1b, NOT v6-gated) and P4b (v6-gated: PREP-RECUR per-day-reset + upgrade-in-place). Only P4b is on the migration spine. |
| **M4** | Architect | Privacy manifest **derived** from the prebuilt `ios/` privacy aggregation (run the privacy report on the EAS artifact), not asserted from "we only use SQLite". May declare UserDefaults (C56D.1) + FileTimestamp (C617.1) if an SDK54 module trips them. Reviewer note adds the affirmative "no authentication / Sign in with Apple N/A". |
| **WM** | What's-Missing | occurrence_date **MUST be `yyyymmdd INTEGER`** (matches `schedule_pickup_log`, NOT the TEXT of `schedules.valid_from`/`exceptions.date`) — executor trap. Export bumps to v3 + adds `checklistCompletion` + addresses stale `is_done/done_at` serialization. Downgrade-tolerance sentence. **Single** completion model (no dual path). |

---

## 0. What changed since the v1 launch plan (code-verified against current `main`)

The prior plan's launch-blocking **P3 bug trio is now LANDED in code.** Re-verifying with file:line so this v2 does not re-plan finished work:

| v1 P3 item | v1 status | **Verified reality on current `main`** | v2 disposition |
|---|---|---|---|
| 64-pending cap → soonest-first ≤60 truncation | planned | **DONE.** `scheduler.ts:63` `MAX_SCHEDULED = 60`; `rescheduleAll` collects all candidates (`:267-282`), `candidates.sort((a,b)=>a.fireAtMs-b.fireAtMs)` (`:284`), `slice(0, MAX_SCHEDULED)` (`:286`), and `setScheduleResult({truncated, scheduledCount})` (`:295`). | **No re-plan. Verify-only on device** (Phase 4). |
| Export covers all 7 tables + consistency | planned | **DONE (export side).** `db-export.ts:38` `EXPORT_SCHEMA_VERSION = 2`; envelope includes `checklistItems`, `todos`, `pickupLog` (`:47-49`); reads all 7 tables (`:68-98`). | **Re-scope to the UI-promise consistency pass only** (Phase 3.3 — `data.tsx` still says restore is "v1.1"). |
| NOTIF-PERSIST: persist global notif store to SQLite | planned | **DONE.** `notif-settings-store.ts` hydrates from `app_settings` via `appSettingsRepo.getBool/getInt` (`:57-58`), write-through on set (`:68,73`); `app_settings` table shipped in **migration v5** (`005_v5_app_settings.sql.ts`). | **Verify-only** (round-trip test already feasible; confirm rehydrate on boot in `app/_layout.tsx`). |
| Q9: `systemEnabled` actually suppresses | planned (a) | **DONE.** `scheduler.ts:227` always `cancelAllScheduledNotificationsAsync()` first, then `:234` early-return scheduling nothing when `!systemEnabled`; store hydrated from `app_settings` before this runs (`:231-232` comment + `_layout` load). | **Verify-only on device** (Phase 4a.4). |
| app.json launch config (name/version/iPad/encryption/iCloud) | planned | **DONE.** `app.json`: `name:"아마따"` (`:3`), `version:"1.0.0"` (`:5`), `supportsTablet:false` (`:17`), `ITSAppUsesNonExemptEncryption:false` (`:20`), **zero iCloud keys** (grep clean). | **Verify-only** (Scenario-2 grep gate retained). |
| eas.json build infra | none | **PARTIALLY DONE.** `eas.json` has `development` + `preview` + `production` profiles and `production.autoIncrement:true` + `appVersionSource:"remote"`. | **No re-author. Use as-is**; remaining work is running the builds + credentials (manual). |

**Net effect:** the v2 critical path is **NOT** the old bug trio. It is now **(A) PREP-RECUR / migration v6** (the one true remaining code defect, and the highest-risk one) plus **(B) the manual Apple-portal + on-device-build + assets/legal ops** that no amount of code closes. This doc is organized around those.

### Still-OPEN code items (verified absent)
| Item | Evidence it's NOT done | Phase |
|---|---|---|
| **PREP-RECUR** (checklist completion is template-level, never per-occurrence) | `checklist_items` schema has `is_done/done_at` at the **schedule(template)** row (`ADR-002` schema delta `:88-95`; repo `checklist-items.ts:94 toggleDone` flips the single template row). `ChecklistSection.tsx:105` derives `done` from `i.isDone`; `:109` calls `toggleDone(db, itemId)`. No `occurrence_date` anywhere in checklist path. → checking once marks **every** occurrence done forever. Also `body.ts:48-52` filters `!c.isDone` (breaks once `is_done` freezes — C2). | **Phase 3.1 (design, J1-A locked) + Phase 3.2 (migration v6, incl. 3.2f body)** |
| **Committed `patch-package` for react-native-svg** | `patches/` dir is **empty**; fix still delivered via `package.json:13` `postinstall` script (`scripts/fix-react-native-svg-manifest.js`). Q7 risk (postinstall may not run under EAS managed `npm ci`) **still live**. | **Phase 1a.2** |
| **`PrivacyInfo.xcprivacy`** | `find -iname '*xcprivacy*'` → **none**. Required-reason API manifest absent. | **Phase 2.1** |
| **`ios.buildNumber`** | `grep buildNumber app.json` → **absent**. (Mitigated by `eas.json production.autoIncrement` + `appVersionSource:"remote"`, but confirm the remote-source path supplies it.) | **Phase 7.1** |
| **`data.tsx` restore-promise consistency** | `app/settings/data.tsx:121` "가져오기(복원)는 v1.1에서 지원돼요" + `:151` "백업한 파일에서 복원" disabled row, while export now serializes all 7 tables. Copy is internally OK ("백업용으로 보관") but must be cross-checked against the final App Store description so 2.3.8 holds. | **Phase 3.3 + 6.4** |

---

## RALPLAN-DR SUMMARY

### Principles (5)
1. **Don't re-plan finished work; verify it.** The v1 bug trio shipped (above). v2 spends its budget on the *actual* remaining gap (PREP-RECUR) and the irreducible manual ops, and converts the "done" items into **device-level verification gates**, not re-implementation.
2. **A live-data migration is the highest blast-radius change in this launch.** Migration v6 touches real user checklist data. Its safety property is **forward-only + additive + ATOMICITY-gated — NOT statement-idempotency.** The runner is **version-gated** (`migrations/index.ts:38` `if (m.version <= currentVersion) continue;`), so a committed migration never re-runs in the happy path; and `PRAGMA user_version` is set INSIDE the txn (`index.ts:49-53` `BEGIN IMMEDIATE` path, `:65-68` `withTransactionAsync` DDL fallback), so a mid-migration failure rolls back wholesale and `user_version` never advances past a partial state. v6 must be additive (no destructive ALTER on `checklist_items`). Note: `ALTER TABLE … ADD COLUMN` **cannot** be `IF NOT EXISTS` (SQLite has no such form); it is atomicity-protected only, exactly like 002/003. `CREATE TABLE IF NOT EXISTS` is used for the new table (cheap/harmless), but the migration's real guarantee is atomicity, not re-runnability. Treat it like the `schedule_pickup_log` table it mirrors.
3. **Local-only is the moat; declare it confidently.** No server/account/remote push is a deliberate stance (ADR-001). "Data Not Collected" is the privacy story — file it affirmatively, and keep the declared surface minimal and symmetric (no leftover capability/key for an absent feature).
4. **Nothing launch-critical is trusted until it runs on a real device on a real native build.** Expo Go is not ground truth (SDK54 drops react-native-svg; local notifications + the SVG Metro patch must be proven on EAS builds). The free dev-client (1a) verifies the highest-uncertainty runtime behaviors **in parallel** with paid enrollment so verification never reorders the account critical path.
5. **Reject-cost dominates effort-cost.** A rejection adds ~24–48h. Pay upfront to eliminate *known* reject classes (privacy manifest, required-reason API, undeclared capability, metadata accuracy, crash-on-launch) before the first submission.

### Decision Drivers (top 3)
1. **Correctness of user data under migration v6** — a bad migration corrupts or strands real checklist data and is unrecoverable for users (local-only, no server rollback). This is now the #1 driver, ahead of speed.
2. **Time-to-first-approval** — minimize review loops; keep external-latency tasks (enrollment, EAS prod build, Apple review) off the blocking path of everything else.
3. **Review-rejection risk** — 5.1.1 privacy/required-reason, 2.1 completeness/undeclared-capability, 2.3.8 metadata accuracy (export ↔ description), crash-on-launch on a real device.

### Viable Options for the biggest judgment calls

#### J1 — PREP-RECUR data model (the central design decision) `[FOUNDER-LOCKED: J1-A. Day-specific membership IS in v1 scope — the scope question was explicitly answered YES.]`
The defect: prep/checklist items live at the **schedule(template)** level with a single `is_done` flag. On a recurring schedule, completion is global and never resets per day. We split **list membership** (which items belong on a given date) from **per-occurrence completion** (was it done *that* day), and add an entry point for **day-specific** items.

- **J1-A — Per-occurrence completion log + nullable `occurrence_date`, mirroring `schedule_pickup_log` (CHOSEN, founder-locked).**
  New table `checklist_completion(checklist_item_id, occurrence_date, completed_at, UNIQUE(checklist_item_id, occurrence_date))` + add nullable `occurrence_date` to `checklist_items`. **Membership:** an item shows on date D iff `occurrence_date IS NULL OR occurrence_date == D` — NULL = recurring (every occurrence), a set value = day-specific (that date only). **Completion is SINGLE-SOURCE:** ALL completion (recurring, day-specific, and one-off non-recurring schedules) goes through `checklist_completion` (mirror of pickup: `INSERT OR IGNORE` / `DELETE` / `COUNT`). `is_done/done_at` are **frozen legacy** columns — no longer written, never read for completion. There is **no dual/per-recurrence branching** in the body beyond the occurrence-date join (this kills the line-56 ambiguity from the prior draft).
  - **Pros:** Reuses a *proven, shipped* pattern (`schedule-pickup-log.ts:18-60` — idempotent UNIQUE, `markComplete/clearComplete/isComplete/listForDate`). Per-occurrence truth is first-class, so "done Monday, open Tuesday" works and history is queryable. Additive migration (new table + nullable column) → low blast radius, no destructive ALTER. Export adds one table the same way `pickupLog` already is.
  - **Cons:** One extra table (**7 → 8**), which trips the ADR-001 follow-up "reconsider Drizzle at ~8 tables" (recorded, **not acted on for v1**). Legacy `is_done/done_at` linger as dead columns until a v7 cleanup.
  - **`occurrence_date` FORMAT TRAP (executor must obey):** `occurrence_date` MUST be **`yyyymmdd INTEGER`** (e.g. `20260622`) to match `schedule_pickup_log.occurrence_date INTEGER` (`schedule-pickup-log.ts:11`, migration `002:29`). It is **NOT** the `YYYY-MM-DD` TEXT format used by `schedules.valid_from` / `schedule_exceptions.date`. The body/scheduler join (`occ.date` → completion lookup) and the membership comparison both depend on this integer form; a TEXT/INT mismatch silently breaks every per-occurrence lookup.

- **The 반복 toggle (FOUNDER-LOCKED, default OFF) and the entry-point/date-binding rule:**
  - Each prep item has a **"반복"(recurring) toggle, default OFF**. OFF (the default for newly added items) ⇒ **day-specific** ⇒ `occurrence_date = the bound day (yyyymmdd INT)`. ON ⇒ **recurring** ⇒ `occurrence_date = NULL`.
  - **Design tension resolved explicitly (was sub-decision iii):** the two add entry points differ in whether they have a concrete date.
    - **(a) `ScheduleEditSheet`** edits the *recurring template* — it has **no single concrete date**. Items added here **default to recurring (occurrence_date = NULL)**, because there is no day to bind to. (User may still toggle OFF, but then must pick which behavior — recommend: in the EditSheet the toggle is forced/visually-defaulted to recurring; day-specific additions are not the EditSheet's job.)
    - **(b) Daily view / schedule-detail drawer** has a **concrete viewed date D**. Items added here **default to day-specific (occurrence_date = D)**; the user can flip 반복 ON to make it `NULL` (recurring from then on).
  - This (a)/(b) rule is pinned in Phase 3.1 — it is not left ambiguous.
  - **Legacy backfill (FOUNDER + M1):** existing `checklist_items` were template-level "always recurring", so the migration sets their `occurrence_date = NULL` (recurring ON) to preserve current membership. **Completion backfill = "completed-for-today only" (M1):** for each existing `is_done = 1` row, insert one `checklist_completion` row at `occurrence_date = today` (preserves the user's current-day packing across a mid-day upgrade; future occurrences start fresh). Only NEW items default to OFF/day-specific.
  - **Membership/count recompute:** `ChecklistSection.tsx:104-105` `total`/`done` must be recomputed from **(membership on D)** × **(completion log for D)**, NOT from `is_done`.

- **J1-C — (considered, rejected) Reuse Todos as the one-off / day-specific mechanism; keep checklist strictly recurring-template.**
  Don't add per-occurrence checklist completion at all. Make `checklist_items` explicitly the *recurring* prep list, and route **day-specific** "today I also need X" through the existing `todos` table (date-scoped, already per-instance, already notif-wired).
  - **Pros (fairly stated):** Zero new table, zero migration risk, ships fastest. Todos are already per-instance and already in export. Smaller v1 surface.
  - **Cons:** Does **not** fix the core complaint — recurring checklist completion still can't reset per day (checking Monday still marks it done forever) unless we also stop persisting `is_done` on recurring items (which then loses "I already packed this today" within the same day). UX split is confusing ("준비물" vs "할 일" for one packing list).
  - **Rejected because** the founder explicitly answered the scope question **YES** (day-specific checklist membership is in v1), and J1-C leaves the original "checked once = done forever" bug unfixed for recurring items — the exact pre-launch must-fix. Retained only as a fairly-described alternative for the record.

#### J2 — react-native-svg fix delivery for production bundles (Q7, still open) `[ADR-005 already chose patch-package; it is NOT yet committed]`
- **J2-A — Commit a `patch-package` file (RECOMMENDED, == ADR-005 decision).** Generate `patches/react-native-svg+<ver>.patch`, ensure `patch-package` runs in EAS (it must be a dependency + the postinstall must invoke it, OR use EAS `prebuildCommand`/`eas-build-post-install` hook). Remove reliance on the bespoke `scripts/fix-react-native-svg-manifest.js` running under managed `npm ci`.
  - **Pros:** Postinstall-independent and reproducible on EAS; this is the ADR-005-accepted path. **Cons:** Must verify the patch actually applies in the EAS build log (don't assume).
- **J2-B — Upgrade react-native-svg past the Metro-manifest bug.** **Pros:** removes the patch entirely. **Cons:** SDK54 compatibility risk; may reintroduce the Expo-Go crash or other regressions; larger blast radius right before launch. **Defer to v1.1.**
- **Recommendation: J2-A** (execute the already-accepted ADR-005 decision; the gap is purely that the committed patch file does not yet exist). Both retain a path; J2-B is the documented fallback.

> J2 and the carried-over D1 (EAS-vs-Xcode) retain ≥2 viable paths. **J1 is now founder-locked to J1-A** (the scope question was answered YES); J1-C is recorded as the fairly-described considered-and-rejected alternative (rationale above). 7→8 tables trips the ADR-001 Drizzle-reconsider follow-up (recorded, not acted on for v1).

---

## DELIBERATE — Pre-Mortem (3 concrete failure scenarios + mitigation)

### Scenario 1 — "Migration v6 strands or double-counts real checklist completion data"
**Failure:** A user upgrades; v6 adds `checklist_completion` + nullable `occurrence_date`. Completion is now single-source (the log), but if the migration leaves existing `is_done=1` rows un-backfilled the user's current-day packing silently resets mid-day; or, worse, a partial migration leaves `user_version` advanced past a half-created table after a mid-migration crash → corrupt schema with no recovery (local-only, no server rollback).
**Root cause:** Underspecified legacy backfill + a migration whose safety is wrongly assumed to be statement-idempotency rather than the runner's **atomicity guarantee**.
**Mitigation:**
- Design (3.1) pins the **single completion source** (the log; `is_done` frozen) and the **backfill rule (M1: completed-for-today only)**, written into the ADR-002 amendment before any code.
- v6 is **additive only** — `CREATE TABLE IF NOT EXISTS checklist_completion` + `ALTER TABLE checklist_items ADD COLUMN occurrence_date` (which **cannot** be IF-NOT-EXISTS; SQLite has no such form — it is atomicity-protected, like 002/003). **No DROP/destructive ALTER** on `checklist_items`.
- The real safety property is **atomicity, not re-runnability**: the runner is version-gated (`migrations/index.ts:38`) so v6 never re-runs once committed, and `PRAGMA user_version = 6` is set INSIDE the txn (`:49-53` `BEGIN IMMEDIATE` path; `:65-68` `withTransactionAsync` DDL fallback) so any mid-migration failure rolls back wholesale and `user_version` stays 5.
**Verification (test plan):** (a) **version-guard regression** test (runner skips v6 when `user_version ≥ 6`); (b) **atomicity** test (force a failure on v6's 2nd statement → assert `user_version` stays 5 AND `checklist_completion` absent AND `occurrence_date` column absent — exercise BOTH the `BEGIN IMMEDIATE` and the `withTransactionAsync` fallback path, since mixed `ADD COLUMN`+`CREATE TABLE` DDL may route either way); (c) **backfill** test (seed `is_done=1` → migrate → exactly one completion row at `occurrence_date = today`, none for other dates, zero `checklist_items` row loss, `user_version=6`); plus on-device upgrade (v5 build with real data → v6 → Monday's check does not mark Tuesday). See Expanded Test Plan.

### Scenario 2 — "Rejected for an incomplete/incorrect Privacy Manifest or a metadata mismatch"
**Failure:** First review bounces (5.1.1) because `PrivacyInfo.xcprivacy` is missing/under-declares a required-reason API (filesystem timestamp/free-space used by export/SQLite), OR the App Store description implies cross-device "복원" while the build's `data.tsx:121` says restore is v1.1 / export is backup-only (2.3.8 metadata-accuracy). +48h loop.
**Root cause:** No `PrivacyInfo.xcprivacy` exists yet; export now serializes 7 tables but the restore promise is deliberately deferred — description and in-app copy must agree.
**Mitigation:** Phase 2.1 authors `PrivacyInfo.xcprivacy` by **deriving** the required-reason set from the prebuilt `ios/` privacy aggregation (M4), not by asserting "SQLite-only ⇒ nothing to declare". Our own persistence is SQLite `app_settings` (not AsyncStorage — `notif-settings-store.ts:19,57-58`), but transitive Expo SDK54 modules may still require **UserDefaults (`C56D.1`)** and/or **FileTimestamp (`C617.1`)** declarations — derive them from the actual artifact. Phase 6.4 makes the description say **export/backup-only, restore in a later update**, matching `data.tsx`. Phase 8 reviewer note states local-only / export-is-backup-only / **no authentication of any kind (Sign in with Apple N/A — no account/third-party login exists)**.
**Verification:** TestFlight processing accepts the binary with no required-reason warning; a config-lint test snapshots `PrivacyInfo.xcprivacy` presence; a copy-consistency check (description ⇄ `data.tsx` ⇄ export envelope).

### Scenario 3 — "Account/EAS/asset latency blows the launch, or the SVG patch silently no-ops in production"
**Failure:** The ASC app record / production credentials / first prod build / Apple review chain eats the buffer; OR `patch-package` isn't actually invoked under EAS managed install → the production bundle ships with react-native-svg unresolved → custom icons/onboarding blob crash or fall back, and it's only caught after upload.
**Root cause:** External-latency tasks started late; Q7 patch-delivery assumed rather than proven in an EAS build log.
**Mitigation:** Start ASC record creation (Apple account already active per ADR-005, activated 2026-06-07) + the **free Phase 1a** dev-client build on day 1, in parallel. In 1a.2, commit the `patch-package` file and **read the EAS build log line** confirming the patch applied; in 1a.4 verify SVG renders on-device; re-confirm in the production build (1b.3) before trusting it.
**Verification:** ASC record exists; one successful EAS **production** build whose log shows the patch applied AND on which SVG renders on-device, before committing to a public launch date.

---

## DELIBERATE — Expanded Test Plan

> Implementation is OOS; this defines strategy + acceptance the executor phase must satisfy. Keep current gates green (tsc 0, eslint 0, jest 372) and add the cases below. Must actually catch: (a) v6 migration data integrity, (b) per-occurrence completion correctness, (c) SVG-patch-removal regression, (d) export ⇄ UI-copy ⇄ description consistency.

### Unit
- **Migration v6 — version-guard regression (C1):** assert the runner SKIPS v6 when `user_version ≥ 6` (`migrations/index.ts:38`). This test exists to prove the version guard works — it must NOT be mistaken for an idempotency test (it passes green even with non-idempotent SQL, which is the false-confidence trap the prior draft fell into).
- **Migration v6 — atomicity (C1, REPLACES the old "run twice is a no-op"):** force a failure on v6's **2nd statement** and assert `user_version` stays **5** AND `checklist_completion` does not exist AND the `occurrence_date` column is absent. Exercise **BOTH** runner paths — the `BEGIN IMMEDIATE` path (`index.ts:49-57`) AND the `withTransactionAsync` DDL fallback (`:65-68`) — because a mixed `ADD COLUMN` + `CREATE TABLE` batch may route either way.
- **Migration v6 — backfill (M1):** seed a v5 fixture with recurring `checklist_items` (some `is_done=1`) → migrate to v6 → assert: zero `checklist_items` row loss; `user_version=6`; `checklist_completion` exists with `UNIQUE(checklist_item_id, occurrence_date)`; `occurrence_date` column present (DEFAULT NULL) and set to NULL on every backfilled (formerly-template) row; **exactly one** completion row per former `is_done=1` item at `occurrence_date = today`, and **none** for any other date.
- **Per-occurrence completion repo (mirror of pickup-log tests):** `markComplete` idempotent under UNIQUE collision (`INSERT OR IGNORE`), `clearComplete` removes only that (item, date), `isComplete`/`listForDate` reflect exactly the log — the same contract `schedule-pickup-log.ts:18-60` already satisfies, applied to checklist.
- **Membership (founder-2):** item shows on date D iff `occurrence_date IS NULL OR occurrence_date == D`. NULL ⇒ every occurrence in-horizon; a set value ⇒ that date only. `occurrence_date` compared as `yyyymmdd INT` (not TEXT).
- **Already-landed regression guards (keep green, do not re-implement):** 64-cap sort-and-truncate (N=60/61/65 boundaries on the `candidates.sort/slice` in `scheduler.ts:284-286`); export envelope contains exactly 8 tables (7 + `checklistCompletion`) and `EXPORT_SCHEMA_VERSION` bumps to 3; NOTIF-PERSIST write→rehydrate round-trip via `app_settings` (`notif-settings-store.ts`); config-lint snapshot of `app.json` (encryption=false, supportsTablet=false, zero iCloud keys) + presence of `PrivacyInfo.xcprivacy`.

### Integration
- **Body per-occurrence suppression (C2, Option A) — UPDATED:** the old "body uses membership" assertion (~`body.test` line 114) is replaced. With completion in the log, assert: an item completed for occurrence **D** is **absent** from D's notification body but **present** for **D+1**. This requires the 3.2f wiring (occurrence date threaded `scheduler.ts:135-152` → join `checklist_completion` for `occ.date` → pass a per-occurrence pending set to `body.ts`, which currently filters `!c.isDone` at `:48-52`).
- **Scheduler ↔ completion:** a `rescheduleAll` after a completion toggle still obeys ≤60; toggling completion changes only that occurrence's body, not membership.
- **Export round-trip:** `exportDb` over an in-memory DB with rows in all 8 tables produces JSON whose categories match `data.tsx` selectors (`checklistCount`/`todoCount` at `data.tsx:47`).
- **Boot rehydrate:** cold start loads notif settings from `app_settings` and arms notifications (`app/_layout.tsx` load path) with `systemEnabled` honored.

### E2E — on-device (physical iPhone; simulator is NOT valid for notifications or SVG-on-native)
- **PREP-RECUR acceptance:** create a recurring schedule with a prep item (반복 ON / `occurrence_date NULL`); check it on day D; confirm day D+1's occurrence shows it **unchecked**; re-check on D+1 independently. Then from the **daily/detail context** add an item with 반복 **OFF** (default) and confirm it appears **only** on the viewed date D; toggle a daily item's 반복 ON and confirm it then appears on every occurrence.
- **Migration upgrade-in-place:** install a v5 build with real recurring prep data + completions, upgrade to the v6 build, confirm no data loss and the new per-day behavior (Scenario 1 device leg).
- Schedule a notification ~2 min out → background → banner fires; foreground handler shows in-app banner.
- **≥65 occurrences across 4 kids → the 60 soonest fire, none beyond** (verify the already-landed truncation indicator surfaces).
- Reboot → notifications re-armed. Permission-denied → no crash, clear in-app state.
- **SVG renders in the production bundle** (onboarding blob + empty-state) — proves J2-A patch survived EAS managed install.
- **SVG-patch-removal negative test:** clean `node_modules` without the patch ⇒ native bundle fails to resolve react-native-svg (proves the patch is load-bearing). Re-apply ⇒ renders.
- Cold install → onboarding → create child → create schedule → grid → no crash. OS backup → restore → SQLite + schedules intact.

### Observability (no SDK)
- v1 = Apple **Xcode Organizer / ASC crash reports** only (zero data collection, zero privacy-label change). NO Sentry/Crashlytics (would add network + a privacy-label entry, contradicting "Data Not Collected"). Manual triage cadence: check Organizer daily for the first 2 weeks post-launch. Revisit a crash SDK only if Organizer proves insufficient (Follow-up).

### What's-Missing notes (executor traps + edge cases — folded from Revision Loop 1)
- **occurrence_date format:** `yyyymmdd INTEGER` only (matches `schedule_pickup_log.occurrence_date INTEGER`, migration `002:29`; NOT the `YYYY-MM-DD` TEXT of `schedules.valid_from`/`schedule_exceptions.date`). The body/scheduler join + the membership comparison both depend on the integer form.
  - **CONVERSION (binding fold-in, Architect+Critic re-review):** `occ.date` / `viewedDate` arrive as `ISODate` (`YYYY-MM-DD` TEXT, `types.ts:5,57`). Use the **existing** `isoToYyyymmdd(iso: ISODate): number` (`src/ui/daily/pickup-data.ts:41`, already used by the pickup path at `:88,109`) at **every** checklist ISODate→int boundary — completion read/write (3.2b/3.2c/3.2f) AND the membership predicate, which binds `D = isoToYyyymmdd(viewedDate)`. **Never compare an ISODate TEXT against a `yyyymmdd INT`.** Prefer promoting `isoToYyyymmdd` to a shared util import rather than reaching into `ui/daily/` (trivial move, not a design change).
- **Export envelope (3.2e):** bump `EXPORT_SCHEMA_VERSION` 2 → 3, add `checklistCompletion`. The now-stale `is_done/done_at` are still serialized at `db-export.ts:87` — **either stop serializing them OR keep them but document "completion log is authoritative"** for the (disabled) v1.1 restore path. This is a **flag, not a v1 blocker** (restore is disabled, `data.tsx:121`).
- **Downgrade tolerance:** a v5 build tolerates the extra `occurrence_date` column + the `checklist_completion` table — every checklist SELECT is column-explicit (`checklist-items.ts:29`), so the new column/table is benign to an older binary that ignores it.
- **Single completion model:** ALL completion (recurring AND day-specific AND non-recurring schedules) goes through `checklist_completion`; `is_done` is frozen legacy. **No per-recurrence branching** in the body beyond the occurrence-date join.

---

## Dependency-Ordered Phases

**Legend — Owner:** `HUMAN` (Apple portal / legal / on-device tap-test) · `CODE` (config/impl in a separate executor session) · `MIXED`. **Effort:** S (<½d) · M (½–2d) · L (>2d, external-latency-gated).
**Parallelism tags:** ‖ = can run in parallel with same-tag phases; → = strictly serial dependency. **Manual-only** = no code, Apple-portal/legal/device.

```
SERIAL SPINE:  P3.1(design) → P3.2(migration v6) → P4b(PREP-RECUR QA) → P7(version) → P8(TestFlight→submit)
PARALLEL ‖ from day 1 (no dependency on the spine):
   P0 (ASC record, manual)          ‖
   P1a (free dev-client verify)     ‖   ← unblocks P1b
   P2 (privacy/compliance, code)    ‖   ← needs a native build (P1a) only to test removal didn't break
   P4a (build-dependent QA)         ‖   ← needs P1b only; NOT v6-gated (M3 split)
   P5 (assets/screenshots)          ‖   ← needs P1a for real on-device screenshots
   P6 (legal hosting + metadata)    ‖   ← 6.4 needs P3.3 outcome
P1a → P1b (prod build, needs P0 paid account already active)
```

---

### PHASE 0 — App Store Connect record `[BLOCKER for submit; manual-only]` ‖
**Goal:** Stand up the ASC app record. Apple individual account is **already Active** (ADR-005, activated 2026-06-07), so this is no longer enrollment-gated.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 0.1 Create ASC app: name **아마따**, primary language Korean, bundleId `io.starzip.schedulapp`, SKU | HUMAN | S | Reserves the name (hard to change post-approval). |
| 0.2 Confirm individual "Seller name" displays acceptable legal name (operator 안새봄) | HUMAN | S | Individual account → personal legal name shown publicly. |

- **Prerequisite:** none (account active).
- **Acceptance:** ASC app record exists with reserved name 아마따 and the correct bundle ID.

---

### PHASE 1a — Free dev-client on-device verification `[BLOCKER for trusting runtime; not account-gated]` ‖
**Goal:** Prove the two Expo-Go-invisible risks (SVG render, local-notification firing) AND land the committed SVG patch, on a free dev-client build.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 1a.1 Build the `development` profile (already in `eas.json`) as a dev-client, install on a physical iPhone (register UDID) | MIXED | M | Dev-client signing does not need anything beyond what's active. |
| 1a.2 **[J2-A] Commit `patches/react-native-svg+<ver>.patch`** (patch-package), ensure it runs under EAS managed install, and **read the EAS build log line confirming it applied**. Keep `scripts/fix-react-native-svg-manifest.js` only as a local-dev convenience, not the EAS delivery mechanism. | CODE | M | `patches/` is currently empty; this is the open Q7 work. Do NOT remove the fix — it addresses a Metro manifest bug affecting native bundles. |
| 1a.3 On-device smoke: SVG renders (onboarding blob + empty-state); schedule a ~2-min-out LOCAL notification, observe it fire (foreground + background) | HUMAN | S | The Expo-Go-invisible risks. |

- **Prerequisite:** none (free track; day 1).
- **Acceptance:** SVG assets render on-device with the patch applied; the EAS build log shows the patch applied; a scheduled LOCAL notification fires (banner foreground AND background, photo evidence); clean cold-launch no crash. **Negative check** captured for the §test-plan regression (no patch ⇒ unresolved).

---

### PHASE 1b — Production build infra `[BLOCKER for TestFlight & submit]` (P1a → P1b)
**Goal:** A real signed **production** iOS build with the patch surviving managed install.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 1b.1 Configure EAS production credentials (distribution cert + provisioning profile, EAS-managed) | MIXED | M | Account already active. |
| 1b.2 First `production`-profile EAS build; **confirm the patch survived** (build log + on-device SVG render) | MIXED | M | `eas.json production` already has `autoIncrement:true`. |
| 1b.3 Install the production build on a physical iPhone (TestFlight internal or ad-hoc) | HUMAN | S | |

- **Prerequisite:** P1a (patch committed + verified). Account active (P0 context).
- **Acceptance:** production build completes on EAS; SVG renders in the production build on-device; cold-launch no crash.

---

### PHASE 2 — Privacy & compliance filing `[BLOCKER for submission; code + manual]` ‖
**Goal:** Eliminate 5.1.1 / privacy-manifest / required-reason reject classes. Local-only must still be declared.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 2.1 Author **`PrivacyInfo.xcprivacy`** by **DERIVING** the required-reason API set from the prebuilt artifact, not by asserting it. Run `expo prebuild` (or inspect the EAS build artifact) and run the iOS privacy-report aggregation over the actual `ios/` Pods/modules. **Expect to possibly declare UserDefaults (`C56D.1`) and FileTimestamp (`C617.1`)** if any Expo SDK54 module trips them transitively — do not assume "we only use SQLite" zeroes them out. Our own persistence is SQLite `app_settings` (`notif-settings-store.ts:19`), but transitive SDK modules can still require declarations. | CODE | M | Currently absent (`find` → none). Required-reason APIs are auto-scanned by Apple; an under-declared manifest = reject. **Derive, don't assert.** |
| 2.2 Confirm `ITSAppUsesNonExemptEncryption:false` is in the built binary's Info.plist (set in `app.json:20` — verify it lands post-build) | MIXED | S | Skips export-compliance docs. |
| 2.3 File App Privacy "nutrition label" in ASC: **Data Not Collected** | HUMAN | S | Must be affirmatively filed though nothing is collected. |
| 2.4 Re-run the iCloud-clean grep gate (Scenario-2 grep) — must return zero | MIXED | S | `app.json` already clean; gate guards against regressions + post-prebuild `ios/`. |
| 2.5 Verify permission usage strings exist, are human-readable Korean, non-placeholder (notifications) | MIXED | S | Empty/placeholder = reject. |

- **Prerequisite:** A native build (P1a/1b) to confirm the manifest ships and removal didn't break the build.
- **Acceptance:** a build with `PrivacyInfo.xcprivacy` passes TestFlight processing (no required-reason flag); ASC privacy label = Data Not Collected; encryption answered in-binary; iCloud grep returns zero; notification permission string is real Korean.
- **Scenario-2 grep gate (managed Expo: no `ios/` until prebuild):**
  ```sh
  PATTERN='usesIcloudStorage|icloud|ubiquit|CloudDocuments|NSUbiquitousContainers'
  grep -rniE "$PATTERN" app.json || echo "app.json: clean"
  [ -d ios ] && { grep -rniE "$PATTERN" ios/ || echo "ios/: clean"; } || echo "ios/: not prebuilt (skipped)"
  ```
  Only acceptable output: `clean` / `not prebuilt (skipped)`. Any match = fail.

---

### PHASE 3 — PREP-RECUR design + migration v6 + backup-promise consistency `[BLOCKER for QA sign-off; the v2 core]` (serial spine)

#### 3.1 — PREP-RECUR design (ADR-002 amendment) — **DESIGN ONLY, no code** `[J1-A founder-locked]`
Produce an ADR-002 amendment (or ADR-006) pinning the now-LOCKED decisions before any migration is written. All rows below are decided, not open:

| Decision | LOCKED value |
|---|---|
| Completion model | **Single source = per-occurrence log** `checklist_completion(checklist_item_id, occurrence_date, completed_at, UNIQUE(checklist_item_id, occurrence_date))`, mirroring `schedule_pickup_log` (`INSERT OR IGNORE`/`DELETE`/`COUNT`). ALL completion (recurring, day-specific, non-recurring) flows here. No dual path. |
| `occurrence_date` format | **`yyyymmdd INTEGER`** (matches `schedule_pickup_log`; NOT TEXT). Executor trap — see What's-Missing. |
| List membership | nullable `checklist_items.occurrence_date`: **NULL = recurring** (every occurrence); **set = day-specific** (that date only). Membership on D: `occurrence_date IS NULL OR occurrence_date == D`. |
| 반복 toggle | Per-item, **default OFF** (= day-specific). ON ⇒ `occurrence_date = NULL`. |
| Entry-point date-binding | **(a) `ScheduleEditSheet`** (no concrete date) ⇒ items default **recurring (NULL)**. **(b) daily/detail context** (viewed date D) ⇒ items default **day-specific (`occurrence_date = D`)**, user may flip 반복 ON. |
| Legacy `is_done/done_at` | **FROZEN.** Kept in v6, no longer written, never read for completion. Dropped in a later v7. |
| Backfill (M1) | Existing rows → `occurrence_date = NULL` (preserve recurring membership). Each existing `is_done=1` → one `checklist_completion` row at **`occurrence_date = today`** (completed-for-today only). |
| Notification body | **Option A** — body prepends **list membership minus items completed for that occurrence** (per-occurrence suppression; keeps current UX). ≤80 chars (ADR-002). No new push surface. Drives task 3.2f. |
| Count recompute | `ChecklistSection.tsx:104-105` `total`/`done` from (membership on D) × (completion log for D), NOT `is_done`. |

- **Owner:** CODE (doc). **Effort:** M. (Founder decisions already locked — no open sub-decisions remain.)
- **Acceptance:** ADR-002 amendment merged reflecting all LOCKED rows; CLAUDE.md Locked Decisions + Entities count updated (**7 → 8 tables**; ADR-001 "8-table Drizzle reconsider" follow-up flagged, not acted on).

#### 3.2 — Migration v6 + repo/store/UI wiring `[depends on 3.1]`
| Task | Owner | Effort | Notes |
|---|---|---|---|
| 3.2a Add `006_v6_checklist_recurrence.sql.ts`: `CREATE TABLE IF NOT EXISTS checklist_completion (...UNIQUE(checklist_item_id, occurrence_date))` (occurrence_date `yyyymmdd INT`) + `ALTER TABLE checklist_items ADD COLUMN occurrence_date INTEGER` (DEFAULT NULL) + the M1 backfill (existing rows `occurrence_date=NULL`; each `is_done=1` → one completion row at today). **Additive only, no destructive ALTER.** Register `{version:6}` in `migrations/index.ts:19-25`. | CODE | M | Safety = **atomicity** via the version-gated runner (`index.ts:38,49-53` + `:65-68` fallback), **NOT** statement-idempotency. `ADD COLUMN` cannot be IF-NOT-EXISTS. (Also correct the wrong "matching 001/002" comment at `005:16` when touching migrations — 002 uses bare `CREATE TABLE`.) |
| 3.2b New `checklist-completion.ts` repo mirroring `schedule-pickup-log.ts` (`markComplete`/`clearComplete`/`isComplete`/`listForDate`), wire into `repositories/index.ts`. | CODE | M | Reuse the pickup-log contract verbatim (incl. `yyyymmdd INT`). |
| 3.2c Update `checklist-store.ts` + `ChecklistSection.tsx` so `toggleDone` writes to `checklist_completion` for the displayed occurrence date (not the template `is_done`); recompute `total`/`done` from (membership on D) × (completion log for D) (`ChecklistSection.tsx:104-105,109`). | CODE | M | The user-visible fix. Compare via `isoToYyyymmdd(viewedDate)` — see What's-Missing CONVERSION. |
| 3.2d Day-specific add path + per-item **반복 toggle** (default OFF), honoring the (a)/(b) entry-point date-binding rule from 3.1 (EditSheet → recurring/NULL; daily/detail → day-specific/D). | CODE | M | |
| 3.2e Extend `db-export.ts` envelope with `checklistCompletion` + bump `EXPORT_SCHEMA_VERSION` 2 → **3**; resolve the stale `is_done/done_at` serialization at `db-export.ts:87` (stop serializing OR document "log is authoritative"). | CODE | S | Same pattern already used for `pickupLog`. Flag, not a v1 blocker (restore disabled). |
| **3.2f Notification body per-occurrence (C2, Option A)** — thread the occurrence date through `scheduler.ts:135-152` `candidatesForSchedule`, join `checklist_completion` for `occ.date`, and pass a **per-occurrence pending set** to `body.ts` (which currently filters `!c.isDone` at `:48-52` — broken once `is_done` freezes). | CODE | M | Without this the body shows already-packed items (or all items) once `is_done` stops being written. |

- **Prerequisite:** 3.1 design.
- **Acceptance:** migration tests green — **version-guard** (runner skips v6 at `user_version≥6`), **atomicity** (forced 2nd-statement failure ⇒ `user_version` stays 5, table+column absent; both runner paths), **backfill** (M1: one completion row at today per former `is_done=1`, NULL `occurrence_date` on legacy rows, zero row loss); per-occurrence repo tests pass (mirror pickup-log); checking an item on day D leaves day D+1 unchecked; **body suppresses items completed for that occurrence (Option A)** — present for D+1; export at schema v3 includes `checklistCompletion`.

#### 3.3 — Backup-promise consistency (export is already 7-table; only the UI/metadata promise remains)
| Task | Owner | Effort | Notes |
|---|---|---|---|
| 3.3 Confirm `data.tsx` copy ("백업용으로 보관 / 가져오기(복원)는 v1.1") matches reality AND the App Store description will not claim cross-device restore. Add the consistency test: exported categories == `data.tsx` displayed counts (`data.tsx:47,115,117`). | CODE | S | Export side is done (`db-export.ts:38-49`); this is the promise-accuracy guard for 2.3.8. |

- **Phase 3 Acceptance:** PREP-RECUR fixed + migration v6 green + export/UI/description promise consistent; jest stays green (372 + new cases).

---

### PHASE 4 — Device QA sweep `[BLOCKER for TestFlight-external/submit; manual-only]` (M3: split into P4a / P4b)

#### PHASE 4a — Build-dependent QA (NOT v6-gated; runs in PARALLEL off the P1b native build) ‖
**Goal:** Behavioral QA that only needs a real native build, not migration v6. Can start the moment P1b is installable, in parallel with the P3 spine.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 4a.1 Schedule CRUD (create/edit/delete/recurrence + single-exception) | HUMAN | M | |
| 4a.2 Date-scoped todos + checklist prepend-to-notification (≤80 chars, ADR-002) | HUMAN | S | |
| 4a.3 4-kid render stress (grid 06:00–~25:00 × 4, 6-color palette, overlap) | HUMAN | M | |
| 4a.4 Notifications: permission-denied + post-reboot reschedule + foreground banner + **≥65-occurrence truncation guard** + `systemEnabled` OFF actually cancels | HUMAN | M | Verify already-landed cap + gating. |
| 4a.5 All modals/sheets (expo-router native formSheet/modal, ADR-004) incl. iOS "close then double-tap" regression | HUMAN | M | |
| 4a.6 OS backup → restore → SQLite data + scheduled notifications survive | HUMAN | M | OS-backup leg (iCloud dropped). |

- **Prerequisite:** P1b (native build). NOT gated on P3.2 / v6.
- **Acceptance:** documented pass/fail, zero P0/P1 open; 65-cap + backup-restore pass.

#### PHASE 4b — PREP-RECUR migration QA (GATED on P3.2 / v6) (spine)
**Goal:** Verify the one high-risk new surface on a real device. This is the only QA leg on the migration spine.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 4b.1 **PREP-RECUR per-day-reset acceptance** — recurring item checked on D shows unchecked on D+1; daily-context item (반복 OFF) appears only on D; toggling 반복 ON makes it recur; body suppresses items completed for that occurrence (Option A) | HUMAN | M | The user-visible fix. |
| 4b.2 **v5→v6 upgrade-in-place** — install a v5 build with real recurring prep + completions, upgrade to v6, confirm zero data loss + M1 backfill (today's packing preserved, future occurrences fresh) | HUMAN | M | The high-blast-radius leg. |

- **Prerequisite:** P3.2 (migration v6).
- **Acceptance:** per-day-reset + day-specific + Option-A body all pass; upgrade-in-place loses no data and backfills exactly today.

---

### PHASE 5 — Assets & store media `[BLOCKER for metadata/submit]` ‖
**Goal:** Replace placeholders; produce required imagery (amatta-v1 fidelity is mandatory — project memory).

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 5.1 1024×1024 App Store icon (no alpha, no baked rounded corners) | HUMAN/design | M | |
| 5.2 In-app icon set + splash + Android adaptive (fg/bg) | MIXED | M | |
| 5.3 **A-ICONS** amatta custom SVG icon set re-introduction — verify on the **EAS dev build** (Expo Go crashes on SVG, SDK54); cross-check 1a.3 | MIXED | M | Only verifiable on native build. |
| 5.4 Onboarding blob + empty-state illustration finalized & rendering on-device | MIXED | M | |
| 5.5 App Store screenshots: **6.9" required + 6.5" required** (iPhone-only — no iPad set, supportsTablet:false) | HUMAN | M | Korean UI; show grid + pickup carousel + a notification. |

- **Prerequisite:** P1a (real on-device captures).
- **Acceptance:** no placeholder assets in binary or listing; 6.9"+6.5" screenshot sets uploaded; SVG icons render on native build.

---

### PHASE 6 — Legal hosting & store metadata `[BLOCKER for submit]` ‖
| Task | Owner | Effort | Notes |
|---|---|---|---|
| 6.1 Finalize privacy-policy text (Korean) — "collects nothing, local-only" (operator 안새봄, contact amatta.help@gmail.com) | HUMAN | M | Drafts already exist. |
| 6.2 **Host the privacy policy at a public https URL**; enter in ASC | HUMAN | S | **Submission blocked without this.** |
| 6.3 Finalize Terms text + in-app links | MIXED | S | |
| 6.4 Store metadata: description, keywords, subtitle, **category Productivity / age 4+ (not Kids)**, support URL. **Description must say export/backup-only, restore later — matching `data.tsx` (3.3).** | HUMAN | M | 2.3.8 consistency with shipped backup behavior. |

- **Prerequisite:** 3.3 outcome (so description matches shipped backup behavior).
- **Acceptance:** privacy URL returns 200 publicly; all required ASC metadata complete; age-rating submitted; no metadata claim contradicts the build.

---

### PHASE 7 — Versioning & final config `[BLOCKER for build-to-submit; code]` (spine, after P3)
| Task | Owner | Effort | Notes |
|---|---|---|---|
| 7.1 Confirm build-number strategy works: `eas.json production.autoIncrement:true` + `appVersionSource:"remote"` supplies `ios.buildNumber` (currently absent from `app.json` — confirm remote source covers it, else add a seed buildNumber) | MIXED | S | Missing buildNumber blocks repeated TestFlight uploads if remote source doesn't supply it. |
| 7.2 Confirm `version:"1.0.0"` + `name:"아마따"` + `supportsTablet:false` in `app.json` (already set — verify in the built binary) | CODE | S | Already in `app.json`. |

- **Acceptance:** production build uploads to TestFlight with no version/build collision; build number increments on rebuild.

---

### PHASE 8 — TestFlight → review → response `[FINAL; manual-only]` (spine)
| Task | Owner | Effort | Notes |
|---|---|---|---|
| 8.1 Upload production build (`eas submit` or Transporter) to TestFlight | MIXED | S | |
| 8.2 Internal TestFlight full pass; optional external testers | HUMAN | M | |
| 8.3 Complete export-compliance / content-rights answers (cross-check 2.2 encryption=false) | HUMAN | S | |
| 8.4 Submit for App Review; attach reviewer notes: local-only, **no authentication of any kind (Sign in with Apple is N/A — no account/third-party login exists)**, export-is-backup-only, how to test notifications + PREP-RECUR. **Run §reject-checklist BEFORE this.** | HUMAN | S | M4 affirmation pre-empts the 4.8/5.1.1(v) auto-question. |
| 8.5 Monitor; respond to any rejection within 24h | HUMAN | M (external) | |

- **Prerequisite:** P1a–P3, P4a, P4b, P5–P7 green.
- **Acceptance:** build reaches "Ready for Sale" / "Pending Developer Release".

---

## App Store REJECT-Risk Pre-Removal Checklist (run before 8.4)

- [ ] **Required-reason API** — `PrivacyInfo.xcprivacy` present, **derived from the prebuilt `ios/` privacy aggregation** (declares whatever the actual modules trip — filesystem/FileTimestamp C617.1, UserDefaults C56D.1 if a transitive SDK module requires it — not assumed away); passes TestFlight processing. *(2.1)* — **NEW this launch; file is currently absent.**
- [ ] **Privacy nutrition label** — Data Not Collected, matches behavior; no undeclared network. *(2.3)*
- [ ] **Broken/missing privacy-policy link** — public https, 200, content matches. *(6.2)*
- [ ] **Undeclared capability** — zero iCloud entitlement / `usesIcloudStorage` for an absent feature; Scenario-2 grep returns zero. *(2.4)* — already clean; guard against regression.
- [ ] **Metadata accuracy (2.3.8)** — description ⇄ in-app "내보낼 정보"/`data.tsx` ⇄ export envelope all agree (export-only, restore is a later update). *(3.3 / 6.4)*
- [ ] **Crash on launch (2.1)** — clean-install cold launch never crashes on a real device. *(1a/1b/4a)*
- [ ] **SVG render in production bundle** — committed patch-package survived EAS managed install; SVGs render. *(1a.2/1b.2)*
- [ ] **Migration safety** — v5→v6 upgrade-in-place loses no checklist data + M1 backfill correct on a real device. *(4b.2)* — **NEW; high blast radius.**
- [ ] **PREP-RECUR correctness** — recurring check resets per day; day-specific items scoped to their date; body suppresses items completed for that occurrence (Option A). *(4b.1)* — **NEW.**
- [ ] **Notification honesty** — soonest-first ≤60 truncation bounded + indicated; `systemEnabled` OFF truly cancels. *(4a.4)*
- [ ] **Permission strings (5.1.1)** — notification usage string is clear, honest, localized; no placeholders. *(2.5)*
- [ ] **Placeholder content (2.3.x)** — no placeholder icon/splash/screenshots/demo text. *(5)*
- [ ] **Minimum functionality (4.2)** — useful on first run (empty states + onboarding render on-device). *(5.4/1a.3)*
- [ ] **Sign-in/account** — confirm NO account UI (local-only); any login UI triggers 5.1.1(v)/4.8; reviewer note affirms Sign in with Apple N/A. *(4a / 8.4)*
- [ ] **Export compliance** — `ITSAppUsesNonExemptEncryption=false`; ASC compliance answered. *(2.2/8.3)*
- [ ] **iPad** — `supportsTablet:false` confirmed in the binary (iPhone-only v1). *(7.2)*

---

## Parallel vs Serial / Manual vs Code map

| Phase | Spine? | Parallelizable ‖ | Owner mix | Type |
|---|---|---|---|---|
| P0 ASC record | no | ‖ from day 1 | HUMAN | Manual-only |
| P1a free dev-client verify | feeds spine | ‖ from day 1 | MIXED | Code + device |
| P1b production build | gates P4a/P4b/P8 | after P1a | MIXED | Code + device |
| P2 privacy/compliance | gates submit | ‖ (needs a native build to test) | CODE+HUMAN | Code + manual |
| **P3.1 design** | **spine head** | serial | CODE+HUMAN | Doc/design (no code) |
| **P3.2 migration v6** | **spine** | serial (after 3.1) | CODE | Code (high-risk) |
| P3.3 promise consistency | spine | with 3.2 | CODE | Code |
| **P4a build-dependent QA** | no | ‖ (needs P1b only; **not v6-gated**) | HUMAN | Manual-only |
| **P4b PREP-RECUR QA** | **spine** | after P3.2 (v6) | HUMAN | Manual-only |
| P5 assets/screenshots | gates submit | ‖ (needs P1a captures) | MIXED | Code + design |
| P6 legal/metadata | gates submit | ‖ (6.4 needs P3.3) | HUMAN | Manual-only (+links) |
| P7 versioning | spine | after P3 + P4b | MIXED | Code |
| P8 TestFlight→submit | spine tail | after P1–P7, P4a, P4b | HUMAN | Manual-only |

**Critical path (external-latency-dominated):** P3.1 design → P3.2 migration v6 → **P4b PREP-RECUR QA (incl. upgrade-in-place)** → P7 → P8 Apple review (1–3d). P1b prod build feeds P4a/P4b/P8 but is reachable off the design spine. **Run in parallel:** P0 ASC record, P1a dev-client verify (+ commit patch-package), **P4a build-dependent QA** (once P1b is installable), P5 asset design, P6.1/6.3 legal drafting, P2.1 manifest authoring.

---

## ADR-005-S1 — v2 supplement to ADR-005 (iOS App Store v1.0.0 launch)

> Supplement, not replacement. **All ADR-005 decisions carry over unchanged** (individual account, store name 아마따, iPhone-only/`supportsTablet:false`, drop iCloud, public https privacy URL, Productivity/4+, react-native-svg via patch-package per Q7, `systemEnabled` wired (a), contact amatta.help@gmail.com, operator 안새봄). This supplement records what *changed in reality* since ADR-005 and the one genuinely new high-risk decision (PREP-RECUR / migration v6).

- **Status:** Proposed (Revision Loop 1 — founder scope decisions LOCKED; pending Architect/Critic re-review).
- **Decision:**
  1. **Carry over ADR-005 in full** — see list above; nothing in ADR-005 is reversed.
  2. **PREP-RECUR = J1-A, founder-locked** — per-occurrence completion log `checklist_completion(checklist_item_id, occurrence_date, completed_at, UNIQUE(...))` + nullable `checklist_items.occurrence_date`, via **additive migration v6**, mirroring the shipped `schedule_pickup_log` pattern. **Day-specific membership IS in v1 scope** (scope question answered YES). `occurrence_date` = **`yyyymmdd INTEGER`**. Per-item **반복 toggle, default OFF**; EditSheet adds default recurring (NULL), daily/detail adds default day-specific (D). **Completion is single-source (the log); `is_done/done_at` frozen.** Backfill = **completed-for-today only (M1)**. **Notification body = Option A** (suppress items completed for that occurrence). Migration safety = **atomicity-gated, additive-only — NOT idempotency** (version-gated runner, `user_version` inside the txn).
  3. **Execute the already-accepted patch-package delivery (J2-A)** — the gap is only that `patches/` is still empty; commit the patch and prove it in an EAS build log.
  4. **Re-scope the old P3 trio to verification-only** — 64-cap, export-7-tables, NOTIF-PERSIST, and `systemEnabled` gating are landed in code; v2 verifies them on-device rather than re-implementing.
  5. **Privacy manifest derived (M4)** — `PrivacyInfo.xcprivacy` derived from the prebuilt `ios/` privacy aggregation (may declare UserDefaults C56D.1 / FileTimestamp C617.1), not asserted from "SQLite-only". Reviewer note affirms no authentication / Sign in with Apple N/A.
  6. **Phase 4 split (M3)** — P4a build-dependent QA runs parallel off P1b (not v6-gated); only P4b (PREP-RECUR + upgrade-in-place) is on the migration spine.
- **Drivers:** (1) correctness of user data under migration v6 (now the #1 driver); (2) time-to-first-approval; (3) review-rejection risk. *(Re-ordered vs ADR-005: data-correctness rises to #1 because the remaining work centers on a live-data migration rather than the now-fixed notification cap.)*
- **Alternatives considered:**
  - **J1-C (Todos as the day-specific/one-off mechanism, checklist stays template-only)** — rejected: the founder answered the scope question YES (day-specific checklist membership is in v1), and J1-C leaves the "checked once = done forever" bug unfixed for recurring items (the exact pre-launch must-fix). Recorded as a fairly-described considered alternative.
  - **Backfill = "ignore" (drop legacy `is_done`)** — rejected in favor of M1 "completed-for-today only": ignoring silently resets the user's current-day packing across a mid-day upgrade.
  - **J2-B (upgrade react-native-svg past the Metro bug)** — deferred to v1.1: SDK54 compatibility + Expo-Go-crash regression risk too close to launch.
  - **Drop/destructive ALTER on `checklist_items` in v6** — rejected: maximizes blast radius on live data; v6 is additive-only, legacy columns retired no earlier than v7.
  - **Asserting the privacy manifest from "SQLite-only"** — rejected (M4): transitive SDK modules can trip required-reason APIs; derive from the artifact.
  - **Re-implement the P3 trio** — rejected: already shipped and tested; re-doing it adds risk for zero value.
- **Why chosen:** smallest, lowest-blast-radius path that (a) fixes the only remaining functional defect (recurring prep completion) with a pattern already proven in this codebase, (b) closes the remaining compliance gap (privacy manifest) and the patch-delivery gap, and (c) converts the rest of the work into device-level verification + irreducible manual Apple-portal ops — keeping external-latency tasks parallel.
- **Consequences:**
  - (+) Recurring prep completion finally behaves per-day; history is queryable; export stays complete.
  - (+) Additive + atomicity-gated migration (version-gated runner, `user_version` inside the txn) → safe upgrade-in-place; M1 backfill preserves today's packing.
  - (+) Compliance surface minimal and declared; "Data Not Collected" intact. Our own persistence is SQLite (not AsyncStorage), but the manifest is derived from the artifact (M4) rather than assumed — any transitive UserDefaults/FileTimestamp reason is declared, not omitted.
  - (−) Table count goes 7 → 8, tripping the ADR-001 "reconsider Drizzle at ~8 tables" follow-up (noted, not acted on for v1).
  - (−) Legacy `is_done/done_at` columns linger until a v7 cleanup (acceptable; safer than dropping under launch pressure).
  - (−) Migration v6 is the single highest-risk change in the launch; mitigated by the test plan (version-guard + atomicity + backfill) + on-device upgrade-in-place QA (4b.2).
- **Follow-ups (post-v1):** v7 drop of legacy `is_done/done_at`; iCloud/JSON import-restore path (re-enable `data.tsx` restore); iPad responsive grid + the WeeklyGrid/MultiKidGrid fixed-width audit; raise/lower the 60-cap if real usage warrants; reconsider Drizzle now that schema is at 8 tables; revisit a crash SDK only if Apple Organizer is insufficient.

---

## Open Questions (persisted to `.omc/plans/open-questions.md`)

**RESOLVED in Revision Loop 1 (no longer open):** J1 = J1-A (founder-locked, day-specific in scope); legacy `is_done` = frozen, kept to v7; backfill = completed-for-today (M1); day-specific entry point + 반복 default-OFF + (a)/(b) date-binding rule = pinned in 3.1; notification body = Option A.

**Still open (execution-time confirmations, not design forks):**
- **M4 manifest derivation:** does the prebuilt `ios/` privacy aggregation require UserDefaults (C56D.1) and/or FileTimestamp (C617.1) declarations from transitive SDK54 modules? — must be read off the actual artifact, not assumed. *(2.1)*
- **Q7:** does the EAS build log actually show patch-package applying under managed install? *(blocks trusting the production bundle — 1a.2)*
- **Build number:** does `appVersionSource:"remote"` + `production.autoIncrement` supply `ios.buildNumber` without an `app.json` seed value? *(blocks repeated TestFlight uploads — 7.1)*
- **Export stale columns (flag, not blocker):** stop serializing `is_done/done_at` at `db-export.ts:87`, or keep + document "log authoritative" for the disabled v1.1 restore path? *(3.2e)*
