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
