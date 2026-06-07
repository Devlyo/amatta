# RALPLAN-DR — iOS App Store First Launch (아마따 / schedul-app)

> **Mode:** DELIBERATE consensus draft (Planner output → for Architect, then Critic review)
> **Scope:** App Store first submission readiness. **PLANNING ONLY — code implementation is OUT OF SCOPE.** This document defines phases, gates, risks, and decisions; it does not write code.
> **Date:** 2026-06-07 · **Author:** Planner · **Status:** DRAFT (awaiting Architect/Critic)
> **Pipeline target file:** `.omc/plans/ralplan-ios-launch-v1.md` (promote on consensus)

---

## 0. Open Assumptions — REQUIRE USER INPUT before execution

These are the load-bearing unknowns. The plan branches on them; flag-tagged below as `[A#]` where they recur.

| # | Assumption needing confirmation | Why it blocks | Default if no answer |
|---|---|---|---|
| **A1** | **Apple Developer account type**: individual vs. business/organization ("starzip"). Bundle ID `io.starzip.schedulapp` implies an org domain. | Org enrollment needs D-U-N-S number (1–2 wk lead). "Seller name" on the store listing differs (individual = personal legal name shown publicly). | Assume **individual** for fastest path; revisit if starzip branding required. |
| **A2** | **Store display name**: keep "schedul-app" or ship as **"아마따"**? `app.json` name/slug = `schedul-app`; code brand = 아마따. | App Store Connect name must be unique & is hard to change post-approval. Korean store name "아마따" is the user-facing brand. | Assume **"아마따"** display name; keep bundle ID unchanged. |
| **A3** | **iPad support**: `supportsTablet:true` today. Grid is designed for iPhone (06–23h × ≤4 kids). | iPad keep ⇒ must pass iPad layout review (Guideline 4.0 / 2.3.10 broken-layout reject). Drop ⇒ one-line change, removes a whole QA surface. | Assume **drop iPad** (iPhone-only) for v1; re-add later. |
| **A4** | **iCloud usage**: entitlements ON but is JSON-export-to-iCloud actually shipping in v1? CLAUDE.md says "online 기능 일체 없음". | iCloud entitlement with no working feature = Guideline 2.1 reject risk ("declares capability it doesn't use") + extra privacy scrutiny. | Assume **drop iCloud entitlement** for v1 (local export to Files/share sheet instead). |
| **A5** | **Privacy-policy hosting**: do you have a web domain to host the policy URL (App Store Connect requires a reachable URL)? | Submission is blocked without a live https URL. | Assume **GitHub Pages / Notion public page** as zero-cost host. |
| **A6** | **Age rating / category**: target category (Productivity vs. Lifestyle) and whether any "Kids" framing (it's parent-facing, not a kids app). | Mis-declaring "Made for Kids" triggers COPPA-grade review. Parent-facing ⇒ NOT a kids-category app. | Assume **Productivity**, age 4+, **not** in Kids category. |

> Architect/Critic: please pressure-test A3 and A4 — they have the highest reject-risk-vs-effort leverage.

---

## 1. Principles (guiding constraints, 5)

1. **Local-only is the moat, not a gap.** No server/accounts/remote push is a *deliberate* product stance (ADR-001). The privacy story ("collects nothing") is a selling point — file it confidently, don't apologize for it.
2. **Reject-cost dominates effort-cost.** A single rejection adds ~24–48h review-loop latency. Pay upfront to eliminate the *known* reject classes (placeholders, dead capabilities, broken iPad, missing privacy URL) before first submission.
3. **Nothing ships unverified on a real native build.** Expo Go is no longer ground truth (SDK53+ dropped push; svg is patched). Every launch-critical behavior — especially LOCAL notifications — must be proven on a TestFlight/dev-client build on a physical device.
4. **Minimize the declared surface.** Every entitlement, permission string, and capability is an audit liability. Remove what v1 doesn't use (iCloud, iPad if undecided) rather than defend it.
5. **Dependency order is law.** Account → build infra → privacy/compliance → bug-fix/QA → assets/metadata → TestFlight → submit. Skipping forward wastes work (e.g., screenshots before final assets are throwaway).

## 2. Decision Drivers (top 3)

1. **Time-to-first-approval** (founder wants to be live; minimize review loops).
2. **Review-rejection risk** (Guideline 5.1.1 privacy, 2.1 completeness, 4.0/2.3.10 broken layout, 2.3.1 hidden/undocumented features).
3. **Notification reliability** — the app's core value (parents *trusting* pickup/schedule alerts). An unreliable local-notification path is a launch-blocking quality bug, not a polish item.

## 3. Viable Options (with bounded pros/cons)

### Decision D1 — Build pipeline: **EAS cloud build** vs. **local Xcode/`expo run:ios` build**
- **Option 1A — EAS Build (cloud)** ✅ *recommended*
  - Pros: no local Xcode/cert wrangling; managed signing & provisioning; reproducible CI; direct TestFlight submit via `eas submit`; matches Expo-managed workflow.
  - Cons: free tier has a build queue (minutes–hours); requires Expo account; cloud secrets setup.
- **Option 1B — Local Xcode / `expo run:ios --configuration Release`**
  - Pros: zero queue; full native debugging; no Expo build minutes.
  - Cons: manual signing/cert/provisioning-profile management (the exact pain EAS removes); requires a Mac with current Xcode; harder to reproduce; manual Transporter/Xcode upload.
- **Recommendation:** **1A (EAS)**. Even local-built, you still need `eas.json` + credentials; EAS unifies build+submit and is the documented Expo path. Keep 1B as the fallback if queue latency blocks a deadline.

### Decision D2 — iCloud: **keep entitlement** vs. **drop for v1** `[A4]`
- **Option 2A — Keep iCloud (ship JSON-export-to-iCloud backup)**
  - Pros: real device-migration/backup story (addresses [US-041] backup-restore); differentiator for a local-only app.
  - Cons: must *actually implement & verify* CloudDocuments read/write (currently unverified, code OUT OF SCOPE here = NOT v1-ready); extra privacy/data-flow declarations; reject risk if entitlement present but feature absent/broken.
- **Option 2B — Drop iCloud entitlement for v1** ✅ *recommended*
  - Pros: removes 3-location config (entitlements + ubiquity container + NSUbiquitousContainers infoPlist) + a whole compliance surface; export instead via share-sheet/Files (no entitlement); fastest clean review.
  - Cons: no cross-device backup in v1; OS-level iCloud backup of the app sandbox still covers SQLite ([US-041] partially satisfied by default iOS backup — verify).
- **Recommendation:** **2B drop for v1**, ship local export via Files/share-sheet, re-introduce iCloud as a deliberate v1.1 ADR. **Hard gate:** do not ship an entitlement for an unverified feature.

### Decision D3 — iPad: **support** vs. **iPhone-only v1** `[A3]`
- **Option 3A — Keep `supportsTablet:true`**
  - Pros: larger addressable market; iPad screenshots optional only if you *don't* claim support... but claiming it means it must work.
  - Cons: grid layout (fixed 06–23h × ≤4 kids) untested at iPad dimensions = top broken-layout reject vector; adds iPad screenshot set + iPad QA matrix.
- **Option 3B — iPhone-only v1** (`supportsTablet:false`) ✅ *recommended*
  - Pros: removes the single highest layout-reject risk; smaller QA & screenshot scope; iPhone runs on iPad in compatibility mode anyway.
  - Cons: not in iPad-optimized search; perceived as "phone app" on iPad.
- **Recommendation:** **3B iPhone-only v1.** Re-add iPad after a dedicated responsive-grid pass.

> Where a single option is forced (none here are forced — all three retain ≥2 viable paths), invalidation rationale would be documented. All three decisions keep a live alternative, satisfying the ≥2-option requirement.

---

## 4. Dependency-Ordered Phases

Legend — **Owner**: `HUMAN` (account/legal/Apple portal/device tap-testing) · `CODE` (config/impl, *separate executor session — not this plan*) · `MIXED`. **Effort**: S (<½d) · M (½–2d) · L (>2d, often gated by external latency).

---

### PHASE 0 — Decisions & Account Foundation `[BLOCKER for everything]`
**Goal:** Resolve A1–A6; stand up the Apple identity that all signing/submission depends on.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 0.1 Confirm A1 (account type), A2 (store name "아마따"), A3 (iPad), A4 (iCloud), A5 (policy host), A6 (category/age) | HUMAN | S | Drives D1–D3 + later phases. |
| 0.2 Enroll in Apple Developer Program ($99/yr). Org ⇒ obtain D-U-N-S first | HUMAN | L (external) | **Lead time 1–14 days** — start day 1. |
| 0.3 Create App Store Connect app record: name, primary language (Korean), bundle ID `io.starzip.schedulapp`, SKU | HUMAN | S | Bundle ID must match `app.json`. Name reserves "아마따". |
| 0.4 Finalize bundle ID & confirm it is unchanged across iCloud-drop (A4) decision | MIXED | S | If A4=drop, the iCloud container ID is irrelevant. |

- **Prerequisite:** none (entry point).
- **Acceptance:** Apple Developer account active; ASC app record exists with reserved name; A1–A6 answered & recorded in this doc's Assumptions table.

---

### PHASE 1 — EAS Build Infra + First Verified Native Build `[BLOCKER for QA & TestFlight]`
**Goal:** Produce a real signed iOS build and prove the runtime that Expo Go could not.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 1.1 Author `eas.json` (development, preview, production profiles) `[D1]` | CODE | M | development = dev-client for device debugging; production = store. |
| 1.2 Configure EAS credentials (signing managed by EAS) | MIXED | M | Distribution cert + provisioning profile. |
| 1.3 Resolve `react-native-svg` properly for native build; **remove `scripts/fix-react-native-svg-manifest.js` postinstall workaround** once native build renders SVG | CODE | M | Workaround was Expo-Go-specific. Verify [WELCOME-BLOB-SVG] + empty-state illustration render. |
| 1.4 First **production-profile** build via EAS | MIXED | M | Gated by Phase 0 account. |
| 1.5 Install build on a physical iPhone (TestFlight internal or dev-client) | HUMAN | S | |

- **Prerequisite:** Phase 0 (account, signing).
- **Acceptance / verification:**
  - SVG assets render on-device (no patch present).
  - **LOCAL notification actually fires** on a physical device (schedule a near-future trigger; observe banner foreground + background).
  - Android channel + foreground handler exercised at least once (Phase 5 wiring) — even if Android isn't the launch target, regressions surface here.
  - App cold-launches without crash on a clean install.

---

### PHASE 2 — Privacy & Compliance Filing `[BLOCKER for submission]`
**Goal:** Eliminate Guideline 5.1.1 / privacy-manifest reject classes. Local-only still must be *declared*.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 2.1 Add **`PrivacyInfo.xcprivacy`** with required-reason API declarations: File timestamp/disk-space (filesystem), **UserDefaults** (settings persistence — see Phase 3), SQLite/system boot time if used | CODE | M | Required-reason APIs are auto-scanned by Apple; missing manifest = reject. |
| 2.2 Set **`ITSAppUsesNonExemptEncryption=false`** in `ios.infoPlist` | CODE | S | App uses no non-exempt crypto; declaring false skips export-compliance docs. |
| 2.3 File **App Privacy "nutrition label"** in ASC: **Data Not Collected** (no analytics, no network) | HUMAN | S | Must still be affirmatively filed even though nothing is collected. |
| 2.4 Drop iCloud entitlement if A4=drop (remove entitlements + ubiquity container + NSUbiquitousContainers) `[D2]` | CODE | S | Keeps declared surface minimal (Principle 4). |
| 2.5 Verify all permission usage strings exist & are human/Korean: notifications (no explicit Info.plist string needed for local, but ensure prompt copy is sensible) | MIXED | S | Empty/placeholder permission strings = reject. |

- **Prerequisite:** A4 decided (Phase 0); Phase 1 native build (to test entitlement removal doesn't break build).
- **Acceptance:** Build with privacy manifest passes a TestFlight processing pass (Apple's automated privacy scan does not flag undeclared required-reason APIs); ASC privacy label submitted; encryption question answered in-binary.

---

### PHASE 3 — Launch-Blocking Bug Fixes `[BLOCKER for QA sign-off]`
**Goal:** Close defects that would either crash, lose user data, or break the core trust loop.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 3.1 **[NOTIF-PERSIST]** Persist system-notif toggle + default lead-time (currently `useState` only → resets on app restart) | CODE | M | Data-loss/trust bug: user's notification prefs silently reset. Persist to SQLite or AsyncStorage; if AsyncStorage/UserDefaults ⇒ reflect in 2.1 privacy manifest. |
| 3.2 iOS **64-pending-trigger cap** horizon + reschedule-on-foreground top-up (pre-tracked v2 Open Q "Architect T5") | CODE | M | Without this, schedules beyond ~60 triggers are silently truncated by iOS — core reliability defect. **Architect: confirm whether this is v1-blocking or v1.1.** |
| 3.3 Boot/permission-denied reschedule path: verify notifications re-arm after reboot and degrade gracefully when permission denied | CODE | M | |

- **Prerequisite:** Phase 1 (must verify on-device).
- **Acceptance:** kill-and-relaunch app ⇒ notif settings retained; ≥65 scheduled occurrences ⇒ no silent truncation (top-up confirmed); permission-denied ⇒ no crash, clear in-app state.

---

### PHASE 4 — Device QA Sweep `[BLOCKER for TestFlight-external/submit]`
**Goal:** Behavioral verification of the full app on real hardware. **[QA-BEHAVIOR]**

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 4.1 Schedule CRUD (create/edit/delete/recurrence + single-exception) | HUMAN | M | |
| 4.2 Date-scoped todos + checklist prepend-to-notification (≤80 chars, ADR-002) | HUMAN | S | |
| 4.3 **4-kid render** stress (grid 06–23h × 4 children, 6-color palette, overlap) | HUMAN | M | Worst-case layout. |
| 4.4 All modals/sheets (expo-router native formSheet/modal, ADR-004) — incl. iOS "close then double-tap" regression | HUMAN | M | |
| 4.5 Notification firing incl. **permission-denied** + **post-reboot reschedule** + foreground banner | HUMAN | M | Cross-check Phase 3. |
| 4.6 **[US-041]** OS backup→restore: back up device, restore, confirm SQLite data + scheduled notifications survive | HUMAN | M | Confirms the iOS-backup leg of the backup story (relevant if A4=drop iCloud). |
| 4.7 If A3=keep iPad: full iPad layout pass; else confirm `supportsTablet:false` | HUMAN | M | Conditional on A3. |

- **Prerequisite:** Phases 1–3.
- **Acceptance:** documented pass/fail checklist; zero P0/P1 defects open; backup-restore verified.

---

### PHASE 5 — Assets & Store Media `[BLOCKER for metadata/submit]`
**Goal:** Replace every placeholder; produce required store imagery. **[ASSET-SWAP]**

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 5.1 1024×1024 App Store icon (no alpha, no rounded corners baked) | HUMAN/design | M | Current `icon.png` is placeholder. |
| 5.2 In-app icon set + splash + Android adaptive (foreground/background) | MIXED | M | |
| 5.3 [WELCOME-BLOB-SVG] onboarding blob + empty-state illustration finalized & rendering (cross-check 1.3) | MIXED | M | amatta-v1 fidelity is mandatory (project memory). |
| 5.4 App Store **screenshots**: **6.9" required**, **6.5" required**; iPad set only if A3=keep | HUMAN | M | Korean-language UI; show grid + pickup carousel + notification. |
| 5.5 Optional app preview video | HUMAN | S | Nice-to-have, not blocking. |

- **Prerequisite:** Phase 1 (to capture real on-device screenshots); A3 (iPad set?).
- **Acceptance:** no placeholder assets remain in binary or store listing; screenshot sets uploaded for all required device classes.

---

### PHASE 6 — Legal & Store Metadata `[BLOCKER for submit]`
**Goal:** Reachable privacy URL + finalized listing. **[LEGAL-EDIT]**

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 6.1 Finalize privacy-policy text (Korean) — adapt from `docs/design/amatta-v1/Settings - Privacy.html` to a real policy reflecting "collects nothing, local-only" | HUMAN | M | |
| 6.2 **Host privacy policy at a public https URL** `[A5]`; enter URL in ASC | HUMAN | S | **Submission blocked without this.** |
| 6.3 Finalize Terms text (from `Settings - Terms.html`) + in-app links | MIXED | S | |
| 6.4 Store metadata: description, keywords, subtitle, **category (A6)**, **age rating questionnaire**, support URL, marketing URL (optional) | HUMAN | M | |
| 6.5 Confirm support URL/contact is reachable | HUMAN | S | |

- **Prerequisite:** A5, A6 (Phase 0).
- **Acceptance:** privacy URL returns 200 publicly; all required ASC metadata fields complete; age-rating questionnaire submitted.

---

### PHASE 7 — Versioning & Final Config `[BLOCKER for build-to-submit]`
**Goal:** Deterministic version/build identity.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 7.1 Confirm `version` (marketing) = `1.0.0`; add **`ios.buildNumber`** (currently MISSING) — set to "1", or adopt EAS `autoIncrement` | CODE | S | Missing buildNumber blocks repeated TestFlight uploads. |
| 7.2 Decide build-number strategy: manual vs `eas.json` `autoIncrement` | MIXED | S | Recommend autoIncrement to avoid "build already exists" upload errors. |
| 7.3 Apply A2 store-name & A3 iPad flag in `app.json` | CODE | S | |

- **Prerequisite:** D1 (eas.json).
- **Acceptance:** production build uploads to TestFlight without version/build collision; build number increments on rebuild.

---

### PHASE 8 — TestFlight Beta → Review Submission → Response `[FINAL]`
**Goal:** External validation, then approval.

| Task | Owner | Effort | Notes |
|---|---|---|---|
| 8.1 Upload production build (`eas submit` or Transporter) to TestFlight | MIXED | S | |
| 8.2 Internal TestFlight (self) full pass; then optional external testers | HUMAN | M | External testers require a Beta App Review (lighter than full). |
| 8.3 Complete export-compliance / content-rights answers in ASC | HUMAN | S | Cross-check 2.2 encryption=false. |
| 8.4 Submit for App Review; attach reviewer notes (explain local-only, no account, how to test notifications) | HUMAN | S | Good reviewer notes reduce avoidable rejects. |
| 8.5 Monitor review; prepare to respond to rejections within 24h | HUMAN | M (external latency) | |

- **Prerequisite:** Phases 1–7 all green.
- **Acceptance:** build "Ready for Sale" (or "Pending Developer Release" if manual release chosen).

---

## 5. App Store REJECT-Risk Pre-Removal Checklist

Run this gate **before** 8.4. Each item maps to a known rejection class.

- [ ] **Placeholder content** (Guideline 2.3.x) — no lorem/placeholder icon, splash, screenshots, or demo text in binary or listing. *(Current assets ARE placeholders — Phase 5 mandatory.)*
- [ ] **Broken/missing privacy-policy link** (5.1.1) — URL is public, https, returns 200, content matches actual data practices. *(Phase 6.2.)*
- [ ] **Minimum functionality** (4.2) — app does something useful on first run even with zero data (empty states render, onboarding works). *(Empty-state illustration + onboarding blob — Phase 5.3.)*
- [ ] **Permission strings** (5.1.1) — every requested permission has a clear, honest, localized usage description; no empty/placeholder strings. *(Phase 2.5.)*
- [ ] **iPad broken layout** (2.3.10 / 4.0) — if `supportsTablet:true`, grid renders correctly on iPad; otherwise `supportsTablet:false`. *(A3 / Phase 4.7.)*
- [ ] **Crash on launch** (2.1) — clean-install cold launch on a real device never crashes. *(Phase 1 / 4.)*
- [ ] **Guideline 5.1.1 privacy / nutrition label** — App Privacy filed (Data Not Collected) and matches behavior; no undeclared network calls. *(Phase 2.3.)*
- [ ] **Undeclared capability** (2.1) — no entitlement (iCloud) shipped for a feature that isn't present/working. *(A4 / Phase 2.4.)*
- [ ] **Required-reason API** — `PrivacyInfo.xcprivacy` declares filesystem/UserDefaults/etc. reasons; passes TestFlight processing scan. *(Phase 2.1.)*
- [ ] **Notifications honesty** — app does not promise alerts it can't reliably deliver (64-trigger cap handled). *(Phase 3.2.)*
- [ ] **Export compliance** — `ITSAppUsesNonExemptEncryption=false` set; ASC compliance answered. *(Phase 2.2 / 8.3.)*
- [ ] **Sign-in / account** — confirm NO account UI is present (local-only); if any login UI exists it triggers 5.1.1(v)/4.8 sign-in rules. *(Verify during 4.x.)*

---

## 6. DELIBERATE — Pre-Mortem (3 concrete failure scenarios)

### Scenario 1 — "Approved, but notifications silently don't fire for power users"
**Failure:** App ships. A parent with 3 kids × many weekly schedules has >64 pending iOS triggers; iOS truncates. Pickup alerts silently stop. 1-star reviews: "알림이 안 와요" (notifications don't come) — the exact core promise broken.
**Root cause:** 64-trigger cap (Phase 3.2) deferred as "polish"; Expo Go never surfaced it.
**Mitigation:** Treat 3.2 as a launch P0. Add the on-foreground reschedule/top-up + horizon cap. **Verification:** Phase 4.5 acceptance must include a ≥65-occurrence stress case on a real device, not a simulator.

### Scenario 2 — "Rejected on first submission for the iCloud entitlement we don't actually use"
**Failure:** First review bounces (Guideline 2.1) because the binary declares CloudDocuments/iCloud capability but no iCloud feature is reachable in-app. +48h loop, founder morale hit, possibly compounded with a second nit.
**Root cause:** A4 left unresolved; entitlement shipped "just in case."
**Mitigation:** Force A4 in Phase 0. Default = **drop iCloud** (Phase 2.4). If keeping, 2A requires a *verified* working backup feature, which is OUT OF SCOPE for v1 code here ⇒ do not keep without that work scheduled. **Verification:** grep build entitlements pre-submit; confirm no iCloud keys if A4=drop.

### Scenario 3 — "EAS/account latency blows the launch date"
**Failure:** Org enrollment stalls on D-U-N-S verification (days–weeks); or EAS production-build queue + signing misconfig eats the buffer. Everything downstream (TestFlight, screenshots-on-device, review) is blocked.
**Root cause:** Account + build infra (external-latency tasks) started late; treated as quick.
**Mitigation:** Start Phase 0.2 (enrollment) and Phase 1.1–1.2 (eas.json + credentials) **on day 1, in parallel** with all doc/asset/legal work (Phases 5–6 prep, which don't need the account). If org/D-U-N-S risk is high, fall back to A1=individual. **Verification:** account "active" + one successful EAS production build before committing to a public launch date.

---

## 7. DELIBERATE — Expanded Test Plan

> Note: code/test *implementation* is OUT OF SCOPE; this defines the test **strategy & acceptance** the executor phase must satisfy. Current gates already green: tsc 0, eslint 0, jest 347.

### Unit
- NOTIF-PERSIST: persistence read/write round-trips default-lead-time + toggle; survives a simulated cold start (store re-hydration).
- 64-trigger horizon math: given N occurrences, scheduler caps at the iOS limit and selects the correct nearest-future window.
- Encryption/privacy config: snapshot test on `app.json`/manifest asserting `ITSAppUsesNonExemptEncryption=false` and presence of required-reason entries (config-lint).
- (Regression) keep existing 347 jest green; add cases above.

### Integration
- Scheduler ↔ persistence: changing default lead-time reschedules pending notifications consistently (reconcile-on-mutate, per Phase 5 notif commit).
- Permission-denied path: scheduler no-ops gracefully; UI reflects denied state without crash.
- Export (if A4=drop ⇒ share-sheet/Files export) produces a valid JSON dump of all 7 tables.

### E2E — on-device (physical iPhone, NOT simulator for notifications)
- Schedule a notification ~2 min out → background app → banner fires.
- Foreground notification handler shows in-app banner.
- ≥65 occurrences across 4 kids → verify no silent truncation (Scenario 1 guard).
- Reboot device → notifications re-armed.
- Cold install → onboarding → create child → create schedule → see grid → no crash.
- OS backup → restore → data + schedules intact ([US-041]).

### Observability / crash reporting
- **Decision needed (defer to ADR/Architect):** local-only ethos vs. needing crash visibility. Options: (a) **no crash SDK** — rely on Apple's built-in Crashes/Organizer (zero data collection, zero privacy-label change) ✅ recommended for v1; (b) Sentry/Crashlytics — requires network + a privacy-label entry, contradicting "Data Not Collected."
- v1 acceptance: enable **Xcode Organizer / App Store Connect crash reports** (free, no SDK, no privacy impact). Define a manual triage cadence for the first 2 weeks post-launch.

---

## 8. ADR Skeleton — "ADR-005: iOS App Store v1 Launch Posture"

> Promote to `docs/architecture/ADR-005-ios-app-store-launch.md` once A1–A6 resolved & Critic-approved.

- **Status:** Proposed (pending A1–A6 + Architect/Critic).
- **Decision:** Ship a minimal-surface, local-only iPhone v1 via EAS production build to the App Store. Specifically (defaults, override per A#): **(D1)** EAS cloud build + submit; **(D2)** drop iCloud entitlement for v1, export via Files/share-sheet; **(D3)** iPhone-only (`supportsTablet:false`); store name **"아마따"**; **individual** Apple account (A1).
- **Drivers:** time-to-first-approval; reject-risk minimization; notification reliability (§2).
- **Alternatives considered:**
  - Local Xcode build (D1B) — rejected for signing complexity & non-reproducibility; retained as fallback.
  - Keep iCloud (D2A) — rejected for v1 because the backup feature is unverified/unbuilt (code OOS); undeclared-capability reject risk.
  - iPad support (D3A) — rejected for v1 due to untested grid layout = broken-layout reject vector.
- **Why chosen:** Smallest declared/audited surface that still ships the core value (local schedule grid + reliable local notifications), on the documented Expo path, with the fewest external-latency and reject-risk dependencies.
- **Consequences:**
  - (+) Fastest, lowest-risk first approval; clean "collects nothing" privacy story.
  - (+) Removes Expo Go workarounds (svg patch) once native build verified.
  - (−) No cross-device/iCloud backup and no iPad-optimized layout in v1 (both deferred to v1.1 ADRs).
  - (−) Crash visibility limited to Apple Organizer (acceptable; preserves privacy posture).
- **Follow-ups (post-v1):** iCloud/JSON backup+restore (v1.1 ADR, pairs with the still-open DB-import path); iPad responsive grid; external-tester beta program; revisit crash SDK only if Organizer proves insufficient; close v2 open-questions S4/S5/S6/S8 as they intersect quality.

---

## 9. Effort Roll-Up & Critical Path

- **Critical path (external-latency-dominated):** Phase 0.2 enrollment (1–14d) → Phase 1 first build → Phase 3/4 fix+QA → Phase 8 review (1–3d Apple).
- **Parallelizable from day 1 (no account needed):** Phase 5 asset design, Phase 6.1/6.3 legal text drafting, A1–A6 decision-making.
- **Total active effort (excl. external waits):** ~M-heavy, roughly 6–10 working days of focused work; calendar time gated by enrollment + review latency.

---

## 10. Hand-off Note

- This is a **planning artifact only. No code was written and none is authorized by this document.** Execution (eas.json authoring, manifest, NOTIF-PERSIST fix, etc.) is delegated to a later executor session via `/oh-my-claudecode:start-work` **after** Architect + Critic sign-off and A1–A6 resolution.
- Reviewers: prioritize feedback on **A3 (iPad)**, **A4 (iCloud)**, and whether **Phase 3.2 (64-trigger cap)** is v1-blocking or v1.1.
