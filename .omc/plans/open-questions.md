# Open Questions

## ralplan-schedul-app-v2 - 2026-05-04

Items deferred from v2 (must-fix list closed; secondary items tracked here for v3/post-MVP).

- [ ] Architect S4 — `ON CONFLICT(schedule_id, date) DO UPDATE` for `schedule_exceptions` writes — Without this, cancel→modify edits hit `SQLITE_CONSTRAINT` and crash the save flow.
- [ ] Architect S5 — Per-child non-color disambiguator + explicit WCAG-paired 6-color palette in `src/domain/constants.ts` — Without this, colorblind parents (8% of males) cannot distinguish children's blocks.
- [ ] Architect S6 — Berlin-DST unit test + TZ assumption header comment in `src/domain/occurrences.ts` — Without this, expat users silently get shifted triggers across DST boundaries.
- [ ] Architect S7 — `BottomSheetScrollView` / `BottomSheetFlatList` wiring inside `ScheduleEditSheet` — Without this, scrolling form content fights the sheet's dismiss-pan gesture.
- [ ] Architect S8 — Decide & document 30-min granularity at schema level (`CHECK(start_minutes % 30 = 0 AND end_minutes % 30 = 0)`) — UX picker already locks to 30-min steps; schema currently does not, allowing CSV/SQL import to violate the contract.
- [ ] Architect T5 / iOS 64-trigger cap — horizon cap with reschedule-on-foreground top-up — Without this, schedules beyond ~60 pending triggers are silently truncated by iOS.
- [ ] Critic #7 — Debounce window tuning beyond the 60-min default for `rescheduleAll()` on `AppState=active` — Current debounce is reasonable but unprofiled on real devices.
- [ ] Critic minor #4 — Resolve `app/schedule/edit.tsx` route file vs `ScheduleEditSheet` modal contradiction — One is dead code unless we deep-link to it.
- [ ] Critic minor #5 — Specify FPS measurement method for Phase 3 acceptance ("scroll FPS ≥ 55") — Currently subjective.
- [ ] Critic minor #6 — Define producer of the visual-verdict reference screenshot for Phase 6 — Currently undefined.
- [ ] DB-import path paired with the v2 export button — Full device-migration story is half-built without it.
- [ ] Revisit Drizzle if/when schema crosses ~10 tables or relationships get hairy.
- [ ] Revisit a materialized-instance cache only if profiling shows `expandOccurrences` exceeds 5ms on a P50 device.

## ralplan-ios-launch-v1 - 2026-06-07

iOS App Store first-launch decisions requiring user input before execution (DELIBERATE consensus draft).

- [ ] A1 — Apple Developer account type: individual vs business/org ("starzip")? — Org needs D-U-N-S (1–2wk lead) and changes public seller name; gates enrollment timeline.
- [ ] A2 — Store display name: "schedul-app" vs "아마따"? — ASC name is near-permanent and user-facing; code brand is 아마따.
- [ ] A3 — iPad support keep (`supportsTablet:true`) vs iPhone-only v1? — CORRECTED (v2): daily grid is fluid (`ScheduleGrid.tsx:351` flex:1), not a likely broken-layout reject. Real cost of keeping = extra iPad screenshot set + a QA pass + the Q8 weekly/multi-kid audit. Default drop on scope-minimization (P4), not fragility.
- [ ] A4 — iCloud entitlement keep (ship verified JSON backup) vs drop for v1? — Entitlement present without working feature = undeclared-capability reject risk; drop simplifies review.
- [ ] A5 — Privacy-policy web host (public https URL)? — Submission is blocked without a reachable policy URL.
- [ ] A6 — App Store category + age rating + confirm NOT a "Kids" category app? — Mis-declaration triggers heavier review.
- [ ] Phase 3.2 — RESOLVED in v2 as v1-BLOCKING: the defect is not horizon/top-up (both exist) but `rescheduleAll` having no count cap + no soonest-first ordering. Fix = collect candidates, sort ascending by fireAt, truncate to ≤60. (Tracking note only.)

## ralplan-ios-launch (v2) - 2026-06-07

New open questions introduced by the v2 revision (still user/Architect-gated).

- [ ] Q7 — Does EAS managed build run `postinstall`? — Drives the react-native-svg Metro-fix delivery: if postinstall is not guaranteed under EAS `npm ci`, the current script silently no-ops and the SVG fix is absent from the production native bundle. Default: migrate to a committed `patch-package` file (postinstall-independent). Confirm against EAS docs in Phase 1.
- [ ] Q8 — WeeklyGrid/MultiKidGrid fixed-pixel-width audit — Only the daily `ScheduleGrid` is verified fluid (`flex:1`). If iPad is kept (A3), `src/ui/weekly/WeeklyGrid.tsx` + `src/ui/weekly/MultiKidGrid.tsx` must be audited for fixed-width layout before claiming iPad support. N/A if A3=drop iPad.

## ralplan-ios-launch (v2.1) - 2026-06-07

Open question introduced by the v2.1 NEW-1 correction (the precedence-resolver claim was fiction; the real gap is store durability).

- [ ] Q9 — `systemEnabled` ("시스템 알림") toggle does nothing at schedule time — Verified: the scheduler reads only the per-row `notifyMinutesBefore` (`scheduler.ts:91,146`); the toggle (`settings.tsx:93,103`) only mutates the Zustand store and never calls `rescheduleAll`/`cancelAll`, so toggling it off suppresses no notifications. A toggle that does nothing = soft Guideline 2.3.8 / UX-honesty risk. v1 sub-decision of 3.1: (a) wire `systemEnabled` to a minimal suppress/reschedule path if cheap, else (b) hide the toggle until v1.1. Default (a) if cheap, else (b). Not necessarily v1-fixed.

## ralplan-ios-launch-v2 (iOS App Store v1.0.0 / 아마따) - 2026-06-22

RESOLVED in Revision Loop 1 (founder scope decisions locked — moved out of open):
- [x] J1 — chosen J1-A; day-specific checklist membership IS in v1 scope (scope question answered YES).
- [x] J1-(i) legacy `is_done/done_at` — FROZEN (kept in v6, not written, not read for completion; drop in v7).
- [x] J1-(ii) backfill — "completed-for-today only" (M1): each existing `is_done=1` → one completion row at today's `occurrence_date`.
- [x] J1-(iii) day-specific entry point + 반복 toggle — default OFF; EditSheet adds recurring (NULL), daily/detail adds day-specific (D); toggle ON ⇒ NULL.
- [x] Notification body — Option A (suppress items completed for that occurrence; keep current UX).

Still open (execution-time confirmations, not design forks):
- [ ] M4 — does the prebuilt `ios/` privacy aggregation require UserDefaults (C56D.1) and/or FileTimestamp (C617.1) declarations from transitive SDK54 modules? Derive from the artifact; do not assert "SQLite-only" (Phase 2.1).
- [ ] Q7 — confirm the EAS build LOG shows `patch-package` applying under managed install (patches/ is empty; fix still rides the postinstall script). Wrong call ships a broken native bundle with react-native-svg unresolved (Phase 1a.2 / Pre-mortem Scenario 3).
- [ ] Build number — does `eas.json appVersionSource:"remote"` + `production.autoIncrement` supply `ios.buildNumber` without an `app.json` seed value? Missing buildNumber blocks repeated TestFlight uploads (Phase 7.1).
- [ ] Export stale columns (flag, not blocker) — stop serializing `is_done/done_at` at `db-export.ts:87`, or keep + document "completion log is authoritative" for the disabled v1.1 restore path (Phase 3.2e).
