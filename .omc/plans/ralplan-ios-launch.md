# RALPLAN-DR — iOS App Store First Launch (아마따 / schedul-app) — **v2**

> **Mode:** DELIBERATE consensus (Planner v2 → for Architect, then Critic re-review)
> **Scope:** App Store first submission readiness. **PLANNING ONLY — code implementation is OUT OF SCOPE.** This document defines phases, gates, risks, and decisions; it writes no code.
> **Date:** 2026-06-07 · **Author:** Planner · **Status:** REVISED v2 (was: Architect NEEDS-REVISION + Critic REJECT on v1)
> **Final file:** `.omc/plans/ralplan-ios-launch.md` · **Supersedes:** `.omc/drafts/ralplan-ios-launch-v1.md`

---

## v1 → v2 Change Log (all changes are code-verified against current `main`)

The v1 REJECT was about **specific technical errors**, not plan craft. The structure that worked is kept (phase ordering, reject-class checklist, A1–A6 gating, device-level E2E, pre-mortem). The following defects are corrected, each with a file:line citation re-verified at revision time:

| # | v1 error | Verified reality | v2 fix |
|---|---|---|---|
| 1 | "Remove the SVG patch — it's Expo-Go-only." | `scripts/fix-react-native-svg-manifest.js` fixes a **Metro** manifest-resolution bug (`react-native` field → unshipped `src/index.ts`) that breaks **native release bundles too**. It runs via `postinstall` (`package.json:13`). | **KEEP the patch through launch.** Migrate to a committed `patch-package` file (postinstall-independent) OR upgrade react-native-svg past the bug. Verify it survives EAS managed install. (Phase 1.3, Q7) |
| 2 | "Add 14-day horizon + AppState top-up." | Both ALREADY EXIST: horizon `scheduler.ts:53` (`DEFAULT_HORIZON_DAYS = 14`); AppState 60-min debounced `rescheduleAll` `_layout.tsx:~140-156`. | Don't re-add them. The real defect: `rescheduleAll` (`scheduler.ts:178-231`) schedules the entire in-horizon set with **no count cap and no soonest-first ordering** → overflows iOS 64-pending limit, OS silently drops, no guarantee the soonest survive. Rewrite as count-bounded soonest-first truncation. (Phase 3.2, Scenario 1) |
| 3 | (implicit) "export covers all 7 tables." | `src/utils/db-export.ts:48-85` (`ExportEnvelope` type at `:27-34`) exports **only 4 tables** (children, schedules, exceptions, notificationSettings). Omits todos, checklist_items, schedule_pickup_log. Yet `data.tsx:115-117` shows 준비물/할일 counts as "내보낼 정보" and `data.tsx:121` promises cross-device restore — while import is disabled "v1.1" (`data.tsx:154`). | Two-part fix + a test asserting exported categories == on-screen counts. Make the §7 "all 7 tables" claim TRUE or remove it. (Phase 3.3) |
| 4 | "[NOTIF-PERSIST] persist the `useState` toggle." | It is **Zustand**, not useState: `notif-settings-store.ts` (global in-memory, resets on relaunch). Two OTHER persisted layers exist and are fine. | Disambiguate the layers; pick storage medium (decide, don't fork). (Phase 3.1) **[v2.1: the "precedence rule" originally noted here was fiction — see v2.1 NEW-1; corrected to a plain store-persist + rehydrate.]** |
| 5 | iCloud removal list missing `usesIcloudStorage`. | `app.json:19` `usesIcloudStorage: true` is a separate key from the entitlements block. Verified zero iCloud refs in `src/`/`app/` — export uses document dir + share sheet, not the ubiquity container. | Add `usesIcloudStorage:true` to the Phase 2.4 removal list AND the pre-submit grep (Scenario 2). Drop is evidence-based and safe. |
| 6 | "iPad grid will break → broken-layout reject." | Daily grid is **FLUID**: `ScheduleGrid.tsx:316-317` outer/scroll `flex:1`, `:351` columns `flex:1`, gutter fixed (`:327`). It widens, does not break at iPad width. | Re-frame D3: the iPad cost is the extra screenshot set + a QA pass, NOT a likely reject. Justify any v1 drop on scope-minimization (P4), not false fragility. WeeklyGrid/MultiKidGrid not exhaustively audited → Q8. |
| 7 | Phase 1 was monolithic, on the enrollment critical path. | — | Split: **1a** = free dev-client build (Expo free account + registered UDID) to verify SVG render + LOCAL notification firing, runs IN PARALLEL with Phase 0 paid enrollment. **1b** = production build, gated on paid account. |
| 8 | P3 (verify-on-build) vs P5 (account-order-is-law) contradiction; P4 applied asymmetrically. | — | Resolve via the 1a/1b split (high-uncertainty tech risk verified off the enrollment critical path). Apply P4 symmetrically — the `usesIcloudStorage` omission was the asymmetry, now closed. |

### v2.1 corrections (post-Architect re-review — must-fixes #1,2,3,4,6 confirmed RESOLVED; these 3 NARROW fixes only)

| # | v2 error | Verified reality | v2.1 fix |
|---|---|---|---|
| NEW-1 | §3.1 claimed a "per-schedule → per-child → global precedence resolver" and "`systemEnabled` suppresses all". | **Fiction vs the code.** The scheduler reads ONLY the per-row `notifyMinutesBefore` (`scheduler.ts:91,146`); it never reads `notification_settings` (per-child) nor `systemEnabled` at schedule time. The global default is **materialized into the per-row column at WRITE time** (`edit-sheet-form.ts:47,74`) — no runtime fallback chain. `systemEnabled` toggle (`settings.tsx:93,103`) only mutates the Zustand store; it calls no reschedule/cancel → suppresses nothing today. | Rewrote §3.1 to the narrow real gap: **persist the global Zustand layer (`systemEnabled`+`defaultMinutesBefore`) to a SQLite `app_settings` row + rehydrate on boot.** Removed the false precedence-resolver + suppression claims (and their gates/tests). New gate = write→rehydrate round-trip; materialized-at-write flow unchanged. Per-child `notification_settings` reclassified as already-persisted-but-not-read (latent, v1.1). Added honesty flag **Q9** (wire `systemEnabled` minimally if cheap, else hide). |
| NEW-2 | Export file path written as `db-export.ts` (implying `src/db/`). | Real path is **`src/utils/db-export.ts`**; line numbers (48-85; `ExportEnvelope` 27-34) are correct. | Corrected the dir to `src/utils/db-export.ts` in change-log #3, §3.3, and the §10 footer (line numbers untouched). |
| NEW-3 | Scenario 2 grep ran `grep ... app.json ios/` unconditionally. | Managed Expo has **no `ios/` dir until `expo prebuild`** → a bare grep on a missing dir could **silently "pass"**. | Qualified the gate: always grep `app.json`; grep `ios/` **only if it exists** (post-prebuild). Reworded so the gate can't silently pass on a missing dir. |

> Everything else from v2 is intact and untouched (1a/1b split, 3.2 soonest-first ≤60, 3.3 backup two-part, iCloud completeness, iPad re-framing, ADR-005, pre-mortem, expanded test plan, A1–A6/Q7/Q8).

---

## 0. Open Assumptions — REQUIRE USER INPUT before execution

Load-bearing unknowns. Plan branches on them; flagged `[A#]`/`[Q#]` where they recur. **All defaults are labeled; all stay user-gated.**

| # | Assumption needing confirmation | Why it blocks | Default if no answer |
|---|---|---|---|
| **A1** | **Apple Developer account type**: individual vs. org ("starzip"). Bundle ID `io.starzip.schedulapp` implies an org domain. | Org enrollment needs D-U-N-S (1–2 wk lead); public "Seller name" differs (individual = personal legal name shown). | **individual** (fastest); revisit if starzip branding required. |
| **A2** | **Store display name**: keep "schedul-app" or ship as **"아마따"**? `app.json` name/slug = `schedul-app`; code brand = 아마따. | ASC name is unique & hard to change post-approval. | **"아마따"** display name; bundle ID unchanged. |
| **A3** | **iPad support**: `supportsTablet:true` today. | Keep ⇒ extra iPad screenshot set + a QA pass (grid is fluid, see #6 — NOT a likely reject). Drop ⇒ one-line change, removes that QA surface. | **drop iPad** (iPhone-only) for v1 **on scope-minimization (P4)**, not on layout fragility; re-add later. |
| **A4** | **iCloud usage**: `usesIcloudStorage:true` + CloudDocuments entitlement ON, but verified **zero iCloud feature** in code. CLAUDE.md: "online 기능 일체 없음". | Entitlement/`usesIcloudStorage` with no working feature = Guideline 2.1 reject risk + extra privacy scrutiny. | **drop iCloud** (entitlement + `usesIcloudStorage` + infoPlist NSUbiquitousContainers). Export already uses doc dir + share sheet. |
| **A5** | **Privacy-policy hosting**: is there a reachable https domain for the policy URL? | ASC submission blocked without a live https URL. | **GitHub Pages / Notion public page** (zero-cost). |
| **A6** | **Age rating / category**: Productivity vs. Lifestyle; confirm NOT "Made for Kids" (parent-facing). | Mis-declaring Kids triggers COPPA-grade review. | **Productivity, 4+, NOT Kids category.** |
| **Q7** | **Does EAS managed build run `postinstall`?** Drives SVG-fix delivery: if postinstall is NOT guaranteed during EAS's `npm ci`, the current script silently no-ops and SVG breaks in the production bundle. | Determines patch-package (committed `patches/`, postinstall-independent) vs. relying on the script. | **Assume postinstall is NOT reliable under managed `npm ci` → migrate to committed `patch-package` file** (safest). Confirm against EAS docs in Phase 1. |
| **Q8** | **WeeklyGrid/MultiKidGrid fixed-pixel-width audit** — only the *daily* `ScheduleGrid` is verified fluid. | If iPad is kept (A3), a fixed-width weekly/multi-kid grid could mis-render on iPad. | If A3=drop iPad, **N/A**. If A3=keep, **run a quick fixed-width audit task** (added to Phase 4.7). |
| **Q9** | **`systemEnabled` toggle does nothing at schedule time** — "시스템 알림" (`settings.tsx:93,103`) only mutates the Zustand store; it does NOT call `rescheduleAll`/`cancelAll`, so toggling it off suppresses no notifications today (verified — the scheduler reads only the per-row `notifyMinutesBefore`, `scheduler.ts:91,146`). | A toggle that does nothing = soft Guideline 2.3.8 / UX-honesty risk. | **(a) wire `systemEnabled` to a minimal suppress/reschedule path** (false → cancel-all/skip scheduling) **if cheap, else (b) hide the toggle** until v1.1. Flagged sub-decision of 3.1; not necessarily v1-fixed. |

> Architect/Critic: pressure-test A3, A4 (highest reject-risk-vs-effort leverage), Q7 (the SVG delivery mechanism — a wrong call here ships a broken native bundle), and **Q9** (ship a non-functional toggle, wire it, or hide it).

---

## 1. Principles (5)

1. **Local-only is the moat, not a gap.** No server/accounts/remote push is a *deliberate* product stance (ADR-001). The "collects nothing" privacy story is a selling point; file it confidently.
2. **Reject-cost dominates effort-cost.** A rejection adds ~24–48h loop latency. Pay upfront to eliminate *known* reject classes before first submission.
3. **Nothing ships unverified on a real native build.** Expo Go is not ground truth (SDK53+ dropped push; SVG needs the Metro patch). Every launch-critical behavior — especially LOCAL notifications and SVG render — must be proven on a real device. **Operationalized by the 1a/1b split**: the free dev-client build (1a) verifies the highest-uncertainty runtime behaviors in parallel with paid enrollment, so verification never waits on, and never reorders, the account critical path.
4. **Minimize the declared surface — symmetrically.** Every entitlement, permission string, capability, and config key (`usesIcloudStorage`, entitlements, `supportsTablet`) is an audit liability. Remove what v1 doesn't use. Applied to ALL such keys equally (the v1 `usesIcloudStorage` omission was the asymmetry that broke this principle — now closed; Scenario 2 grep enforces it).
5. **Dependency order is law — but only for true dependencies.** Account → build infra → privacy/compliance → bug-fix/QA → assets/metadata → TestFlight → submit. **Reconciled with P3:** behaviors that do NOT depend on the paid account (SVG render, local-notification firing) are pulled into the parallel free track (1a) rather than blocked behind enrollment. Account order is law only for tasks that genuinely require the paid account (production signing, TestFlight, submit).

## 2. Decision Drivers (top 3)

1. **Time-to-first-approval** (founder wants live; minimize review loops + de-risk the critical path).
2. **Review-rejection risk** (5.1.1 privacy, 2.1 completeness, 4.0/2.3.10 layout, 2.3.1 undisclosed features, 2.3.8 metadata accuracy — incl. the export-claim mismatch).
3. **Notification reliability** — the app's core value (parents *trusting* pickup/schedule alerts). The 64-cap truncation defect is a launch-blocking quality bug, not polish.

## 3. Viable Options (bounded pros/cons; each retains ≥2 paths)

### D1 — Build pipeline: **EAS cloud** vs. **local Xcode**
- **1A — EAS Build (cloud)** ✅ *recommended* — Pros: no local cert wrangling; managed signing; reproducible; `eas submit` to TestFlight. Cons: free-tier queue; Expo account; secrets setup.
- **1B — Local Xcode / `expo run:ios --configuration Release`** — Pros: no queue; native debugging. Cons: manual signing/profiles (the pain EAS removes); harder to reproduce; manual upload.
- **Recommendation:** **1A**; keep 1B as fallback if queue latency threatens a deadline.

### D2 — iCloud: **keep** vs. **drop for v1** `[A4]`
- **2A — Keep iCloud** — Pros: real device-migration story. Cons: must *actually implement & verify* CloudDocuments R/W (currently unbuilt — code OOS = NOT v1-ready); extra privacy declarations; **undeclared-capability reject risk** (entitlement + `usesIcloudStorage:true` present, feature absent).
- **2B — Drop iCloud for v1** ✅ *recommended* — Pros: removes 3-location config (`usesIcloudStorage` + entitlements + infoPlist NSUbiquitousContainers) + a compliance surface; export already works via doc dir + share sheet (`data.tsx:55-89`), no entitlement needed; cleanest review. Cons: no cross-device iCloud backup in v1 (OS-level sandbox backup still covers SQLite — verify in 4.6).
- **Recommendation:** **2B drop for v1.** Hard gate: never ship an entitlement/`usesIcloudStorage` for an unverified feature.

### D3 — iPad: **support** vs. **iPhone-only v1** `[A3]` (RE-FRAMED — see #6)
- **3A — Keep `supportsTablet:true`** — Pros: larger market; iPad-optimized search. Cons (HONEST): the daily grid is **fluid and does NOT break at iPad width** (`ScheduleGrid.tsx:351` `flex:1`); the real cost is **(i)** an additional iPad screenshot set and **(ii)** a dedicated iPad QA pass, plus **(iii)** a quick WeeklyGrid/MultiKidGrid fixed-width audit (Q8, not yet verified). It is NOT a likely broken-layout reject.
- **3B — iPhone-only v1** (`supportsTablet:false`) ✅ *recommended* — Pros: smaller v1 QA + screenshot scope (**scope-minimization, P4** — the honest reason); iPhone runs on iPad in compatibility mode. Cons: not iPad-optimized in search; perceived as a phone app on iPad.
- **Recommendation:** **3B for v1, justified on scope-minimization (P4), NOT on layout fragility.** Re-add iPad in v1.1 after the Q8 audit + an iPad QA pass.

> All three decisions retain ≥2 viable paths; no forced-single-option invalidation rationale required.

---

## 4. Dependency-Ordered Phases

Legend — **Owner:** `HUMAN` (account/legal/portal/device tap-test) · `CODE` (config/impl in a *separate executor session*) · `MIXED`. **Effort:** S (<½d) · M (½–2d) · L (>2d, often external-latency-gated). Each phase has a single **BLOCKER** scope tag and **objective** acceptance gates (no "verify it works"; no gate asserting behavior the plan doesn't build).

---

### PHASE 0 — Decisions & Paid Account Foundation `[BLOCKER for production build + submit]`
**Goal:** Resolve A1–A6 + Q7/Q8; stand up the paid Apple identity that production signing/submission depend on. **Runs in parallel with Phase 1a.**

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 0.1 Confirm A1–A6, Q7 (patch mechanism), Q8 (iff iPad kept) | HUMAN | S | Drives D1–D3 + downstream phases. |
| 0.2 Enroll in Apple Developer Program ($99/yr); org ⇒ obtain D-U-N-S first | HUMAN | L (external) | **Lead time 1–14 days — start day 1.** Does NOT block Phase 1a. |
| 0.3 Create ASC app record: name (A2), primary language Korean, bundle ID `io.starzip.schedulapp`, SKU | HUMAN | S | Reserves "아마따". |
| 0.4 Confirm bundle ID unchanged across the iCloud-drop (A4) | MIXED | S | If A4=drop, iCloud container ID becomes irrelevant. |

- **Prerequisite:** none (entry point).
- **Acceptance (objective):** Apple Developer account shows **status = Active** in the portal; ASC app record exists with the reserved name; A1–A6 + Q7 (+ Q8 if iPad) answered and written back into §0.

---

### PHASE 1a — Free Dev-Client Verification (PARALLEL with Phase 0) `[BLOCKER for trusting the runtime; NOT gated on paid account]`
**Goal:** Pull the two highest-uncertainty technical risks (SVG render, local-notification firing) off the enrollment critical path using a **free Expo account + a registered device UDID** (no $99 needed for a dev-client build on your own device).

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 1a.1 Free Expo account + register physical iPhone UDID; author `eas.json` `development` profile (dev-client, internal distribution) `[D1]` | MIXED | M | Dev-client signing does not require the paid program. |
| 1a.2 **Decide & apply the SVG fix delivery** per Q7: migrate `scripts/fix-react-native-svg-manifest.js` to a **committed `patch-package` file** (`patches/react-native-svg+*.patch`) OR upgrade react-native-svg past the bug. Keep the fix in place through launch. | CODE | M | Do NOT remove the fix. It addresses a Metro manifest bug affecting native bundles. |
| 1a.3 Build the dev-client and install on the physical iPhone | MIXED | M | Free track — no paid account dependency. |
| 1a.4 On-device smoke: SVG renders ([WELCOME-BLOB-SVG] + empty-state illustration); schedule a ~2-min-out LOCAL notification and observe it fire (foreground + background) | HUMAN | S | These are the Expo-Go-invisible risks. |

- **Prerequisite:** none (free track; starts day 1 alongside Phase 0).
- **Acceptance (objective):**
  - SVG assets render on-device with the patch applied; **negative check:** on a clean `node_modules` install **without** the patch, the dev-client bundle fails to resolve react-native-svg (proves the patch is load-bearing and must stay — feeds the §7 regression test).
  - A scheduled LOCAL notification **fires** on the physical device (banner observed foreground AND background). Screenshot/photo evidence captured.
  - App cold-launches without crash on a clean install.

---

### PHASE 1b — Production Build Infra `[BLOCKER for TestFlight & submit; gated on Phase 0 paid account]`
**Goal:** Produce a real signed **production** iOS build on the paid account.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 1b.1 Extend `eas.json` with `preview` + `production` profiles `[D1]` | CODE | M | Reuses the `development` profile from 1a. |
| 1b.2 Configure EAS production credentials (distribution cert + provisioning profile, EAS-managed) | MIXED | M | Requires the paid account from Phase 0. |
| 1b.3 First production-profile build via EAS; **confirm the SVG patch survived EAS's managed install** (Q7 resolved in practice) | MIXED | M | If postinstall did NOT run and 1a.2 chose patch-package, this is the proof it worked. |
| 1b.4 Install the production build on a physical iPhone (TestFlight internal or ad-hoc) | HUMAN | S | |

- **Prerequisite:** Phase 0 (paid account, signing) + Phase 1a (SVG-fix decision applied).
- **Acceptance (objective):** A production build completes on EAS; **SVG renders in the production build on-device** (proving the fix survives managed install); cold-launch no crash.

---

### PHASE 2 — Privacy & Compliance Filing `[BLOCKER for submission]`
**Goal:** Eliminate 5.1.1 / privacy-manifest reject classes. Local-only still must be *declared*.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 2.1 Add **`PrivacyInfo.xcprivacy`** with required-reason API declarations: File timestamp/disk-space (filesystem). **Storage medium for NOTIF-PERSIST is decided in 3.1 as a SQLite `app_settings` row → SQLite needs NO required-reason entry; if (and only if) 3.1 had chosen AsyncStorage, a UserDefaults required-reason entry would be mandatory here.** | CODE | M | Required-reason APIs are auto-scanned; a missing/incomplete manifest = reject. The 3.1 medium choice directly determines this manifest's contents. |
| 2.2 Set **`ITSAppUsesNonExemptEncryption=false`** in `ios.infoPlist` | CODE | S | No non-exempt crypto ⇒ skips export-compliance docs. |
| 2.3 File **App Privacy "nutrition label"** in ASC: **Data Not Collected** | HUMAN | S | Must be affirmatively filed even though nothing is collected. |
| 2.4 If A4=drop: remove **all three** iCloud surfaces — **`usesIcloudStorage:true` (`app.json:19`)** + the `entitlements` iCloud block (`app.json:20-29`) + `infoPlist.NSUbiquitousContainers` (`app.json:31-37`) `[D2]` | CODE | S | All three keys, not just the entitlement (the v1 miss). |
| 2.5 Verify permission usage strings exist, are human-readable Korean, non-placeholder | MIXED | S | Empty/placeholder strings = reject. |

- **Prerequisite:** A4 decided (Phase 0); a native build (Phase 1a/1b) to test that removal does not break the build; **3.1 storage decision** (determines 2.1 contents).
- **Acceptance (objective):** A build with the privacy manifest passes TestFlight processing (no undeclared required-reason flag); ASC privacy label submitted = Data Not Collected; encryption answered in-binary; **pre-submit grep finds zero iCloud keys** if A4=drop (cross-ref Scenario 2 grep list).

---

### PHASE 3 — Launch-Blocking Bug Fixes `[BLOCKER for QA sign-off]`
**Goal:** Close defects that crash, lose/silently-corrupt user data, mis-state metadata, or break the core trust loop.

#### 3.1 — [NOTIF-PERSIST] Persist the **global** notification defaults (NARROW: the real gap is store durability, not a precedence resolver)
**Code-verified reality (no fiction):** the scheduler reads **ONLY** the per-row `notifyMinutesBefore` column — `schedule.notifyMinutesBefore` (`scheduler.ts:91`) and `todo.notifyMinutesBefore` (`scheduler.ts:146`). It **never** reads the per-child `notification_settings` table and **never** reads the global `systemEnabled` at schedule time. The global store default is **materialized into the per-row column at WRITE time** (`edit-sheet-form.ts:47` `coerceToNotifyOption` fallback, `:74` `defaultFormState`), so there is **no runtime fallback chain** — by the time the scheduler runs, the per-row value is already concrete. Therefore the only real gap is that the **global Zustand store does not survive relaunch.**

Layer map (corrected):
- **Global, in-memory (THE GAP):** `notif-settings-store.ts` — **Zustand**, holds `systemEnabled` + `defaultMinutesBefore`, **resets to defaults on every relaunch**. Consumed only at WRITE time (materialized into the per-row column); not read by the scheduler.
- **Persisted, per-row (already durable):** `schedules.notify_minutes_before` / `todos.notify_minutes_before` — the **only** values the scheduler reads. No change.
- **Persisted, per-child STORAGE (latent):** `notification_settings` SQLite table is written/persisted but **is NOT read at schedule time** today — i.e. dead-ish/latent storage. Leave as-is for v1; revisit wiring in v1.1.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 3.1a Persist the global layer (`systemEnabled` + `defaultMinutesBefore`) to a **SQLite `app_settings` (key,value) row** (the DECIDED medium — do NOT fork "SQLite or AsyncStorage"). Rationale: AsyncStorage adds a UserDefaults required-reason to the Privacy Manifest; SQLite does not → cleaner manifest (Principle 4). Re-hydrate on cold start; keep the Zustand store as the in-memory front, backed by SQLite. | CODE | M | This is the entire narrow fix. The materialized-at-write-time default flow is **unchanged** — persisting the store just means new schedules created after relaunch inherit the user's chosen default instead of the hardcoded reset value. |

- **Acceptance (objective):** kill-and-relaunch ⇒ the user's `systemEnabled` + `defaultMinutesBefore` survive (**unit test: write → rehydrate round-trip read-back from the SQLite `app_settings` row**). The materialized-at-write-time default flow is unchanged. **Do NOT gate on a precedence resolver — none exists in the scheduler and none is being built.**

> **Honesty flag (Q9, user sub-decision):** `systemEnabled` currently does **nothing at schedule time** — toggling "시스템 알림" off (`settings.tsx:93,103`) only mutates the Zustand store; it does **not** call `rescheduleAll`/`cancelAll`, so it suppresses no notifications today. A toggle that does nothing is a soft Guideline 2.3.8 / UX-honesty risk. For v1, pick one (Q9): **(a)** wire `systemEnabled` to a minimal suppress/reschedule path (when false → cancel-all / skip scheduling), or **(b)** hide the toggle until v1.1. **Default: (a) if cheap, else (b).** This is flagged, not necessarily v1-fixed — the user decides.

#### 3.2 — iOS 64-pending-trigger cap: count-bounded, soonest-first truncation (THE REAL DEFECT)
Horizon (`scheduler.ts:53`) and AppState top-up (`_layout.tsx:~140-156`) **already exist — do not re-add.** The defect: `rescheduleAll` (`scheduler.ts:178-231`) iterates schedules then todos and schedules **every** in-horizon trigger with **no global count cap and no ordering**. 4 kids × dense weekdays ≈ ~280 triggers/14d → exceeds iOS's 64-pending limit; the OS silently drops, with **no guarantee the soonest survive**.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 3.2a Refactor `rescheduleAll` to **collect all schedule + todo candidates** in-horizon as `(fireAt, payload)` tuples **without scheduling yet** (separate the build-candidates step from the OS-write step). | CODE | M | Today scheduling happens inline inside `scheduleForSchedule`/`scheduleForTodo`; restructure so OS writes are centralized. |
| 3.2b **Sort candidates ascending by `fireAt`**, truncate to **≤60** (headroom under 64 for OS-reserved + race slack), then schedule those 60. | CODE | M | Soonest-first guarantees the next alerts always survive. |
| 3.2c If truncated, surface a **network-free in-app indicator** ("표시 가능한 알림이 많아 가까운 60개만 예약됨" or similar) — NO push, NO network. | CODE | S | Honesty; respects ADR-002 "그 외 새 푸시 surface 금지". |

- **Acceptance (objective):** an on-device stress case of **≥65 in-horizon occurrences** ⇒ exactly the **60 soonest fire**, **none beyond** the 60th-soonest; the truncation indicator appears. (Verified in §7 e2e-device + a unit test on the candidate-sort-and-truncate function.)

#### 3.3 — Backup integrity: export ↔ UI-promise consistency (two-part)
`src/utils/db-export.ts:48-85` (`ExportEnvelope` at `:27-34`) exports only 4 of 7 tables (omits **todos, checklist_items, schedule_pickup_log**), yet `data.tsx:115-117` displays 준비물/할일 counts under "내보낼 정보" and `data.tsx:121` promises cross-device restore, while import is disabled "v1.1" (`data.tsx:154`). This is both a data-fidelity bug and a Guideline 2.3.8 (accurate-metadata) risk. **Choose ONE option:**

| Option | Tasks | Owner | Effort |
|---|---|---|---|
| **3.3-i — Make export complete & promise honest** | Extend `exportDb` to all 7 tables (add todos, checklist_items, schedule_pickup_log to the envelope + `EXPORT_SCHEMA_VERSION` bump). **AND** rewrite/remove the cross-device-restore promise (`data.tsx:121`) + the disabled import row (`data.tsx:144-157`) so the UI promises only what v1 delivers (export-only, restore is v1.1). | CODE | M |
| **3.3-ii — Honestly de-scope to "local keep only"** | Keep export at the tables it actually serializes, **remove the cross-device-restore claim** (`data.tsx:121` → "백업용으로 보관" only), and **make the displayed "내보낼 정보" categories match exactly the exported tables** (drop 준비물/할일 rows OR add them to the export — but no category may be shown that isn't in the file). | CODE | M |

- **Recommendation:** **3.3-i** (complete the export — it is small, all-SQLite, and preserves the user's full data) unless the founder wants to keep v1 strictly minimal, in which case 3.3-ii.
- **Mandatory regardless of option:** add a test asserting **exported envelope categories == the counts/categories `data.tsx` displays**. Make the §7 "all 7 tables" claim TRUE under 3.3-i, or scope §7's claim to the actual table set under 3.3-ii.

#### 3.4 — Boot / permission-denied reschedule path
| Task | Owner | Effort | Notes |
|---|---|---|---|
| 3.4 Verify notifications re-arm after reboot (cold-start `rescheduleAll`) and degrade gracefully when permission denied (no crash, clear in-app state). | CODE | M | Cross-checked on-device in 4.5. |

- **Phase 3 Prerequisite:** Phase 1a (must verify on-device).
- **Phase 3 Acceptance (objective):** relaunch retains global notif settings via the `app_settings` write→rehydrate round-trip (3.1; **no precedence-resolver gate**); ≥65 occurrences → 60 soonest fire, none beyond (3.2); export categories == displayed counts and the cross-device claim matches reality (3.3); permission-denied → no crash (3.4).

---

### PHASE 4 — Device QA Sweep `[BLOCKER for TestFlight-external / submit]`
**Goal:** Behavioral verification of the full app on real hardware. **[QA-BEHAVIOR]**

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 4.1 Schedule CRUD (create/edit/delete/recurrence + single-exception) | HUMAN | M | |
| 4.2 Date-scoped todos + checklist prepend-to-notification (≤80 chars, ADR-002) | HUMAN | S | |
| 4.3 **4-kid render** stress (grid 06–23h × 4, 6-color palette, overlap) | HUMAN | M | Worst-case layout. |
| 4.4 All modals/sheets (expo-router native formSheet/modal, ADR-004) incl. iOS "close then double-tap" regression | HUMAN | M | |
| 4.5 Notification firing incl. **permission-denied** + **post-reboot reschedule** + foreground banner + **≥65-occurrence truncation guard** | HUMAN | M | Cross-check 3.2/3.4. |
| 4.6 **[US-041]** OS backup→restore: back up device, restore, confirm SQLite data + scheduled notifications survive | HUMAN | M | The OS-backup leg of the backup story (relevant since A4=drop iCloud). |
| 4.7 If A3=keep iPad: full iPad layout pass **+ the Q8 WeeklyGrid/MultiKidGrid fixed-width audit**; else confirm `supportsTablet:false` | HUMAN | M | Conditional on A3; Q8 only if iPad kept. |

- **Prerequisite:** Phases 1a/1b, 2, 3.
- **Acceptance (objective):** documented pass/fail checklist with zero P0/P1 open; backup-restore verified; ≥65-occurrence guard passed.

---

### PHASE 5 — Assets & Store Media `[BLOCKER for metadata/submit]`
**Goal:** Replace every placeholder; produce required imagery. **[ASSET-SWAP]**

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 5.1 1024×1024 App Store icon (no alpha, no baked rounded corners) | HUMAN/design | M | Current `icon.png` is placeholder. |
| 5.2 In-app icon set + splash + Android adaptive (fg/bg) | MIXED | M | |
| 5.3 [WELCOME-BLOB-SVG] onboarding blob + empty-state illustration finalized & rendering (cross-check 1a.4) | MIXED | M | amatta-v1 fidelity is mandatory (project memory). |
| 5.4 App Store **screenshots**: **6.9" required**, **6.5" required**; iPad set only if A3=keep | HUMAN | M | Korean UI; show grid + pickup carousel + a notification. |
| 5.5 Optional app-preview video | HUMAN | S | Nice-to-have, non-blocking. |

- **Prerequisite:** Phase 1a (capture real on-device screenshots); A3 (iPad set?).
- **Acceptance (objective):** no placeholder assets remain in binary or listing; screenshot sets uploaded for all required device classes.

---

### PHASE 6 — Legal & Store Metadata `[BLOCKER for submit]`
**Goal:** Reachable privacy URL + finalized listing. **[LEGAL-EDIT]**

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 6.1 Finalize privacy-policy text (Korean) — adapt `docs/design/amatta-v1/Settings - Privacy.html` to a real "collects nothing, local-only" policy | HUMAN | M | |
| 6.2 **Host the privacy policy at a public https URL** `[A5]`; enter in ASC | HUMAN | S | **Submission blocked without this.** |
| 6.3 Finalize Terms text (from `Settings - Terms.html`) + in-app links | MIXED | S | |
| 6.4 Store metadata: description, keywords, subtitle, **category (A6)**, **age-rating questionnaire**, support URL, marketing URL (optional). **Description must NOT claim cross-device backup if 3.3-ii chosen.** | HUMAN | M | Keep metadata consistent with 3.3 outcome (2.3.8). |
| 6.5 Confirm support URL/contact reachable | HUMAN | S | |

- **Prerequisite:** A5, A6 (Phase 0); 3.3 outcome (so the description matches the shipped backup behavior).
- **Acceptance (objective):** privacy URL returns 200 publicly; all required ASC metadata complete; age-rating submitted; no metadata claim contradicts shipped behavior.

---

### PHASE 7 — Versioning & Final Config `[BLOCKER for build-to-submit]`
**Goal:** Deterministic version/build identity.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 7.1 Confirm `version` = `1.0.0`; add **`ios.buildNumber`** (currently MISSING) = "1" or adopt EAS `autoIncrement` | CODE | S | Missing buildNumber blocks repeated TestFlight uploads. |
| 7.2 Decide build-number strategy: manual vs `eas.json` `autoIncrement` | MIXED | S | Recommend `autoIncrement` to avoid "build already exists". |
| 7.3 Apply A2 store-name + A3 iPad flag in `app.json` | CODE | S | |

- **Prerequisite:** D1 (`eas.json`).
- **Acceptance (objective):** production build uploads to TestFlight with no version/build collision; build number increments on rebuild.

---

### PHASE 8 — TestFlight → Review Submission → Response `[FINAL]`
| Task | Owner | Effort | Notes |
|---|---|---|---|
| 8.1 Upload production build (`eas submit` or Transporter) to TestFlight | MIXED | S | |
| 8.2 Internal TestFlight full pass; then optional external testers (lighter Beta App Review) | HUMAN | M | |
| 8.3 Complete export-compliance / content-rights answers (cross-check 2.2 encryption=false) | HUMAN | S | |
| 8.4 Submit for App Review; attach reviewer notes (local-only, no account, how to test notifications, how to test export) | HUMAN | S | Good notes reduce avoidable rejects. **Run §5 reject-checklist BEFORE this.** |
| 8.5 Monitor review; respond to any rejection within 24h | HUMAN | M (external) | |

- **Prerequisite:** Phases 1a–7 all green.
- **Acceptance (objective):** build reaches "Ready for Sale" (or "Pending Developer Release").

---

## 5. App Store REJECT-Risk Pre-Removal Checklist

Run this gate **before 8.4.** Each maps to a known rejection class.

- [ ] **Placeholder content** (2.3.x) — no placeholder icon/splash/screenshots/demo text in binary or listing. *(Phase 5.)*
- [ ] **Broken/missing privacy-policy link** (5.1.1) — URL public, https, 200, content matches data practices. *(6.2.)*
- [ ] **Minimum functionality** (4.2) — useful on first run with zero data (empty states + onboarding render). *(5.3 / 1a.4.)*
- [ ] **Permission strings** (5.1.1) — every permission has a clear, honest, localized description; no placeholders. *(2.5.)*
- [ ] **iPad layout** (2.3.10 / 4.0) — if `supportsTablet:true`, grid renders on iPad **and Q8 audit passed**; else `supportsTablet:false`. *(A3 / 4.7.)*
- [ ] **Crash on launch** (2.1) — clean-install cold launch never crashes on a real device. *(1a/1b / 4.)*
- [ ] **Privacy nutrition label** (5.1.1) — Data Not Collected, matches behavior; no undeclared network. *(2.3.)*
- [ ] **Undeclared capability** (2.1) — no iCloud entitlement / `usesIcloudStorage` shipped for an absent feature. *(A4 / 2.4 / Scenario 2 grep.)*
- [ ] **Required-reason API** — `PrivacyInfo.xcprivacy` declares filesystem (+ UserDefaults ONLY if 3.1 used AsyncStorage, which it does not); passes TestFlight processing. *(2.1.)*
- [ ] **Notification honesty** — app does not promise alerts it can't deliver; 64-cap truncation is bounded soonest-first + indicated. *(3.2.)*
- [ ] **Metadata accuracy** (2.3.8) — store description + in-app "내보낼 정보" + export file all agree on what's backed up and whether cross-device restore exists. *(3.3 / 6.4.)*
- [ ] **Export compliance** — `ITSAppUsesNonExemptEncryption=false`; ASC compliance answered. *(2.2 / 8.3.)*
- [ ] **Sign-in / account** — confirm NO account UI (local-only); any login UI triggers 5.1.1(v)/4.8. *(Verify in 4.x.)*
- [ ] **SVG render in production bundle** — the Metro-patch fix survived EAS managed install; SVGs render. *(1b.3.)*

---

## 6. DELIBERATE — Pre-Mortem (3 concrete failure scenarios)

### Scenario 1 — "Approved, but the soonest notifications silently never fire for power users"
**Failure:** A parent with 4 kids × dense weekday schedules generates ~280 in-horizon triggers. `rescheduleAll` schedules them in schedule-then-todo order with no cap; iOS keeps only ~64 in an **arbitrary** order, dropping the rest — and there is **no guarantee the next-due alerts are among the kept 64**. Pickup alerts for the very next event silently vanish. 1-star "알림이 안 와요".
**Root cause:** `rescheduleAll` (`scheduler.ts:178-231`) has no count cap and no soonest-first ordering. The horizon + AppState top-up (which DO exist) don't help — the problem is *which* triggers survive within the cap.
**Mitigation:** Phase 3.2 — collect all candidates, sort ascending by `fireAt`, truncate to ≤60, schedule those, surface a network-free truncation indicator.
**Verification:** §7 e2e-device ≥65-occurrence case on a **real device** (not simulator) ⇒ the 60 soonest fire, none beyond; plus a unit test on the sort-and-truncate function.

### Scenario 2 — "Rejected for an iCloud capability we don't use"
**Failure:** First review bounces (2.1) because the binary declares CloudDocuments + `usesIcloudStorage:true` but no iCloud feature is reachable. +48h loop.
**Root cause:** A4 unresolved and/or only the entitlement removed while `usesIcloudStorage:true` (`app.json:19`) lingers (the exact v1 miss).
**Mitigation:** Force A4 in Phase 0; default drop. Phase 2.4 removes **all three** surfaces.
**Verification (pre-submit grep, must return ZERO if A4=drop):**
This is a **managed** Expo project — there is **no `ios/` dir until `expo prebuild`** runs. A bare `grep ... ios/` would error/return nothing on a missing dir and could **silently "pass"**. So: always grep `app.json`, and include `ios/` **only if it exists** (post-prebuild). Run:
```sh
PATTERN='usesIcloudStorage|icloud|ubiquit|CloudDocuments|NSUbiquitousContainers'
grep -rniE "$PATTERN" app.json || echo "app.json: clean"
[ -d ios ] && { grep -rniE "$PATTERN" ios/ || echo "ios/: clean"; } || echo "ios/: not prebuilt (skipped)"
```
⇒ the only acceptable output lines are `clean` / `not prebuilt (skipped)`; **any match = fail.** The `app.json` grep always runs (so the gate can never silently pass on a missing dir); the `ios/` grep runs iff the dir exists.

### Scenario 3 — "Account/EAS latency blows the launch date"
**Failure:** Org D-U-N-S verification stalls (days–weeks), or EAS production queue + signing misconfig eats the buffer; everything downstream blocks.
**Root cause:** Account + production build infra (external-latency) started late.
**Mitigation:** Start Phase 0.2 enrollment **and** the entire **free Phase 1a** on day 1, in parallel; 1a verifies the highest-uncertainty runtime risks **without** the paid account. If org/D-U-N-S risk is high, fall back to A1=individual.
**Verification:** account status = Active **and** one successful EAS *production* build (1b) before committing to a public launch date.

---

## 7. DELIBERATE — Expanded Test Plan

> Code/test *implementation* is OOS; this defines the **strategy & acceptance** the executor phase must satisfy. Current gates: tsc 0, eslint 0, jest 347 green — keep green, add the cases below. The plan must actually catch: (a) count>64 truncation, (b) SVG-patch-removal regression, (c) export categories == displayed counts.

### Unit
- **NOTIF-PERSIST (3.1):** global `systemEnabled`+`defaultMinutesBefore` write→rehydrate round-trip to/from the SQLite `app_settings` row; re-hydrate on simulated cold start. **No precedence-resolver test** — the scheduler reads only the per-row `notifyMinutesBefore` column (`scheduler.ts:91,146`); there is no per-schedule→per-child→global resolver to test. (If Q9=(a), add a test that `systemEnabled=false` ⇒ the wired suppress/cancel path runs.)
- **64-cap (3.2):** given N candidate `(fireAt,payload)` tuples (N>64), the sort-and-truncate function returns exactly the 60 with the smallest `fireAt`, in ascending order, and flags `truncated=true`. Boundary cases: N=60 (no truncation, no flag), N=61 (truncate 1, flag set), N=65.
- **Export coverage (3.3):** envelope contains the exact table set the plan committed to (all 7 under 3.3-i); a test asserts **exported categories == the categories/counts `data.tsx` renders** (the consistency guard).
- **Config-lint:** snapshot `app.json` asserts `ITSAppUsesNonExemptEncryption=false`, `ios.buildNumber` present, and — if A4=drop — **zero** iCloud/`usesIcloudStorage` keys.

### Integration
- **Scheduler ↔ persistence:** changing the global default lead-time reschedules pending notifications consistently (reconcile-on-mutate), and the resulting candidate set still obeys the ≤60 cap.
- **Permission-denied path:** scheduler no-ops gracefully; UI reflects denied state without crash.
- **Export round-trip:** `exportDb` over an in-memory SQLite with rows in all committed tables produces valid JSON whose categories match the live `data.tsx` selectors.

### E2E — on-device (physical iPhone; simulator is NOT valid for notifications)
- Schedule ~2 min out → background → banner fires.
- Foreground handler shows in-app banner.
- **≥65 occurrences across 4 kids → the 60 soonest fire, none beyond (Scenario 1 guard); truncation indicator visible.**
- Reboot → notifications re-armed.
- Cold install → onboarding → create child → create schedule → see grid → no crash.
- OS backup → restore → SQLite data + schedules intact ([US-041]).
- **SVG-patch-removal regression (negative test):** on a clean `node_modules` install **without** the patch/patch-package file, the native bundle fails to resolve react-native-svg (or SVGs fail to render) — proving the fix is load-bearing and must remain. Re-apply ⇒ renders.

### Observability / crash reporting (no SDK)
- v1 = **Apple's built-in Crashes / Xcode Organizer / ASC crash reports** (zero data collection, zero privacy-label change). NO Sentry/Crashlytics (would add network + a privacy-label entry, contradicting "Data Not Collected").
- Define a **manual triage cadence for the first 2 weeks post-launch** (check Organizer daily). Revisit a crash SDK only if Organizer proves insufficient (Follow-up).

---

## 8. ADR-005 — "iOS App Store v1 Launch Posture" (full)

> Promote to `docs/architecture/ADR-005-ios-app-store-launch.md` once A1–A6 + Q7/Q8 resolved & Critic-approved.

- **Status:** Proposed (pending A1–A6, Q7, Q8 + Architect/Critic re-review of v2).
- **Decision:** Ship a minimal-surface, local-only iPhone v1 via EAS production build. Defaults (override per A#): **(D1)** EAS cloud build + submit (local Xcode = fallback); **(D2)** drop ALL iCloud surfaces (`usesIcloudStorage` + entitlements + NSUbiquitousContainers), export via doc dir + share sheet; **(D3)** iPhone-only (`supportsTablet:false`) on scope-minimization; store name **"아마따"**; **individual** Apple account (A1). Plus: keep the react-native-svg Metro fix through launch (as committed patch-package per Q7); fix the 64-cap via soonest-first ≤60 truncation; persist global notif defaults to a SQLite `app_settings` row; make export ↔ UI promises consistent.
- **Drivers:** time-to-first-approval; reject-risk minimization; notification reliability (§2).
- **Alternatives considered:**
  - Local Xcode build (D1B) — rejected for signing complexity/non-reproducibility; retained as fallback.
  - Keep iCloud (D2A) — rejected for v1: backup feature unverified/unbuilt (code OOS); undeclared-capability reject risk from `usesIcloudStorage:true` + CloudDocuments.
  - iPad support (D3A) — deferred for v1 **on scope-minimization, NOT layout fragility** (daily grid is fluid, `ScheduleGrid.tsx:351`); re-add after the Q8 weekly/multi-kid audit + an iPad QA pass.
  - **Remove the SVG patch** (the v1 error) — rejected: it fixes a Metro manifest bug affecting native bundles, not just Expo Go.
  - **AsyncStorage for notif persistence** — rejected: adds a UserDefaults required-reason to the Privacy Manifest; SQLite `app_settings` keeps the manifest cleaner.
  - **Disable export / keep mismatched UI** — rejected: 2.3.8 metadata-accuracy + data-loss risk; instead either complete the export (3.3-i) or honestly de-scope the claim (3.3-ii).
- **Why chosen:** smallest declared/audited surface that still ships the core value (local schedule grid + reliable, soonest-first local notifications + honest export), on the documented Expo path, with highest-uncertainty tech risk pulled off the enrollment critical path (1a/1b split).
- **Consequences:**
  - (+) Fast, low-risk first approval; clean "collects nothing" privacy story.
  - (+) Soonest-first notification cap = the next alert always survives, even for 4-kid power users.
  - (+) Export ↔ UI promise consistency removes a metadata-accuracy reject vector and prevents silent data omission.
  - (−) No cross-device/iCloud backup (OS sandbox backup still covers SQLite) and no iPad-optimized layout in v1 — both deferred to v1.1 ADRs.
  - (−) Truncation indicator is a UX compromise for very dense users (acceptable; honest).
  - (−) Crash visibility limited to Apple Organizer (acceptable; preserves privacy posture).
- **Follow-ups (post-v1):** iCloud/JSON backup + the disabled import path (v1.1 ADR — pairs with restoring `data.tsx`'s cross-device promise); iPad responsive grid + Q8 audit; external-tester beta; raise/lower the 60-cap if real usage warrants; revisit a crash SDK only if Organizer is insufficient.

---

## 9. Effort Roll-Up & Critical Path

- **Critical path (external-latency-dominated):** Phase 0.2 enrollment (1–14d) → Phase 1b first production build → Phase 3/4 fix+QA → Phase 8 review (1–3d Apple).
- **Parallel from day 1 (no paid account):** **Phase 1a (free dev-client verification of SVG + notifications)**, Phase 5 asset design, Phase 6.1/6.3 legal drafting, A1–A6/Q7/Q8 decisions.
- **Total active effort (excl. external waits):** ~M-heavy, roughly 7–11 focused working days (3.2 + 3.3 add real bug-fix scope vs. v1); calendar time gated by enrollment + review latency.

---

## 10. Hand-off Note

- **Planning artifact only. No code written; none authorized by this document.** Execution (eas.json, patch-package migration, manifest, NOTIF-PERSIST SQLite layer, 64-cap soonest-first refactor, export completion/UI reconciliation, iCloud key removal) is delegated to a later executor session via `/oh-my-claudecode:start-work` **after** Architect + Critic sign-off and A1–A6 + Q7/Q8 resolution.
- **Reviewers, please prioritize:** the corrected **3.2 soonest-first cap** logic, the **3.3 option choice** (i vs ii), **Q7** (SVG delivery under EAS managed install), and **A3/A4**.
- All code claims in this v2 were re-verified at revision time: `scheduler.ts:53,178-231`; `_layout.tsx:~140-156`; `src/utils/db-export.ts:48-85` (`ExportEnvelope` `:27-34`); `scheduler.ts:91,146`; `notif-settings-store.ts`; `edit-sheet-form.ts:47,74`; `settings.tsx:93,103`; `data.tsx:115-121,144-157`; `app.json:17,19,20-37`; `ScheduleGrid.tsx:316-317,327,351`; `package.json:13` (postinstall); `scripts/fix-react-native-svg-manifest.js`.
