# ralplan — 준비물 반복 토글 rework (Supplies Repeat, A안) + ADR-006 verify

- **Mode**: SHORT consensus (ralplan: Planner → Architect → Critic). **Status: Architect APPROVE-WITH-REVISIONS folded in; founder decision locked.** Risk = medium (UI rework of code merged hours ago + correctness re-verify of a launch-blocker fix).
- **Date**: 2026-06-30
- **Scope**: PLAN + ADR amendment ONLY. No code in this pass. Coding happens after Architect/Critic APPROVE and an explicit "Phase N 가자" / "이제 코드 시작" signal.
- **Source of truth (design)**: `docs/design/handoffs/supplies-repeat/{README.md, app-event-form.jsx, app-tokens.jsx, Supplies Repeat (A안).html}`.
- **Shipped baseline (re-verify)**: ADR-006 / PREP-RECUR (`docs/architecture/ADR-006-checklist-recurrence.md`), migration v6, `checklist_completion` per-occurrence log.

---

## 0. Ground truth established by reading the code (not assumptions)

These facts drive every decision below; cited so Architect/Critic can audit fast.

1. **The shipped EditSheet renders the 반복 control unconditionally** as a label "반복" + `ToggleSwitch`, one per checklist row, for ALL `sheetMode !== 'editOccurrence'` (`src/ui/sheets/ScheduleEditSheet.tsx:747-766`). It does NOT key off `daysOfWeek`. → This is the central thing A안 changes.
2. **The shipped "add" button hardcodes `occurrenceDate: null`** (recurring) for every new row regardless of context (`ScheduleEditSheet.tsx:769-777`, comment claims "entry-point rule (a)"). The `boundDateInt` (day-specific bind target) is used ONLY when a user flips an existing row's toggle OFF (`:759`).
3. **There is no SEPARATE daily/detail "add day-specific item" surface — and the founder confirmed none is needed.** Grep confirms the only `checklist` add caller is the EditSheet; `TodoSection.tsx` adds Todos, not checklist items; `ChecklistSection.tsx` is read + toggle-completion only (no add). The day-specific capability is delivered THROUGH the EditSheet via the founder's "navigate-to-date then toggle 이번만 OFF" model (see Decision A). → Decision **A** is a documentation/coherence call, not a code-removal call, and it does NOT retire any capability.
4. **`boundDateInt` resolves to `preFill.date ?? occurrenceDate ?? currentDate`** (`ScheduleEditSheet.tsx:179-185`) — the bind target a 이번만-OFF row uses. The fallback chain is correct-by-design ONLY ONCE editAll carries the viewed occurrence through (fix-1 below). **Today it diverges on two paths** because `EventDetailDrawer.handleEditAll` (`EventDetailDrawer.tsx:123-129`) routes `{mode:'editAll', scheduleId}` and **DROPS `occurrenceDate`** (unlike `handleEditOccurrence` at `:118` which forwards `detail.occurrenceDate`). So `app/schedule/edit.tsx:35` sets `occurrenceDate: undefined` → `boundDateInt` falls through to `currentDate`:
   - **Search → detail → editAll**: `SearchDrawer.tsx:135` opens detail with `occurrenceDate: todayIso()` and never calls `setCurrentDate` → a 이번만-OFF row would bind to `currentDate`, NOT the searched date. (verified)
   - **Single-kid weekly tap → detail → editAll**: `child/[id].tsx:169` opens detail with `occurrenceDate: e.date` → editAll binds to the week-anchor `currentDate`, NOT `e.date`. (verified)
   The daily-grid flow happens to work (viewed day == `currentDate`), which is why this was initially mis-read as "always correct." **fix-1 (Phase 2 task): make `handleEditAll` forward `occurrenceDate: detail.occurrenceDate`** through the route params (mirroring `handleEditOccurrence`); `app/schedule/edit.tsx:35` ALREADY plumbs `params.occurrenceDate` into the sheet, so this is a one-line change in the drawer. After fix-1, `boundDateInt`'s 2nd fallback resolves to the exact occurrence the user viewed on ALL paths, and "이번만 = the date I'm looking at" is literally true. The earlier "currentDate not in useMemo deps" concern (old Smell-2) then becomes genuinely moot — the value is captured once on open and that is exactly the edit-context date.
5. **`noRepeat` (one-time) path**: when `form.daysOfWeek === 0` at save, `effectiveDaysOfWeek = weekdayMaskFromIso(validFrom)` and `effectiveValidUntil = validFrom` — a single-occurrence schedule clamped to one day (`ScheduleEditSheet.tsx:275-286`). The schedule is NOT stored with `daysOfWeek === 0`; it always persists ≥1 weekday bit.
6. **Membership + completion are fully decoupled from item `occurrenceDate` at the completion layer.** `checklist_completion` is keyed `(checklist_item_id, occurrence_date=viewed date)` and written by `toggleDone(db, id, dateInt)` using the VIEWED date (`ChecklistSection.tsx:130-133`, `checklist-store.ts:100-114`). Membership filtering (`item.occurrenceDate === null || === dInt`) is a SEPARATE check (`ChecklistSection.tsx:49`, `scheduler.ts:162-168`). → This is why the default-flip (D) is safe: see §3.
7. **Tokens already exist.** `primaryTint #FFE2D0`, `primaryDeep #D8501F`, `ink30 rgba(29,29,27,0.30)` are ALL already named in `TOKENS` (`src/ui/palette.ts:63-72`). **No new tokens needed.** The handoff's "add them if missing" clause does not fire.
8. **No repeat/sync glyph in the icon set yet.** `src/ui/icons.tsx` has no repeat/cycle icon. react-native-svg is BLOCKED (file header `icons.tsx:3-11`, BACKLOG A-ICONS) → the ↻ glyph MUST be `@expo/vector-icons` (Ionicons `sync` / `repeat`, or MaterialCommunityIcons `repeat-variant`/`sync`), NOT inline SVG and NOT the handoff's `RepeatGlyph` SVG.

---

## 1. RALPLAN-DR summary

### Principles (anchor every later decision)
1. **Correctness of the launch-blocker (per-occurrence completion) is sacrosanct.** This rework must not reintroduce "check once = every occurrence marked." Completion authority stays `checklist_completion`; `is_done` stays FROZEN.
2. **Design = A안 to the pixel, via tokens only.** Reproduce the handoff's ↻ pill states exactly; zero color/size/shadow literals at call sites (only-defined-tokens rule, amatta-v1 fidelity mandatory).
3. **One coherent data model end-to-end.** `repeat:boolean` (handoff) ⇄ `occurrence_date` (our model) must hold identically across display, count, completion log, and notification body — with NO migration change.
4. **Minimal surface, maximal determinism.** Change only the EditSheet checklist UI + its save mapping + tests. Define deterministic behavior for every edge (toggle off weekdays, one-time semantics) rather than leaving it implementation-defined.
5. **Expo-Go-safe primitives.** No react-native-svg; vector-icons only until EAS build (A-ICONS).

### Decision drivers (top 3)
1. **Conditional render correctness** — the toggle must appear iff the schedule is recurring, and "recurring" must be defined on a signal that is live in the form at edit time (the `daysOfWeek` mask), not on a persisted/derived field.
2. **Default-value reconciliation** — A안 says recurring⇒new item default `repeat=true`; the shipped code already defaults new items to recurring(null). We must reconcile WITHOUT regressing, and define the one-time⇒`repeat=false` default that the shipped code does NOT currently express.
3. **Edge determinism on save** — what `occurrence_date` is written when (a) weekdays are toggled off after items were added, and (b) the schedule is one-time. Both must keep membership + completion + notification body correct.

### Biggest judgment call = **A: how is a day-specific ("이번만") item created?** — FOUNDER-LOCKED

The handoff specifies only the EVENT FORM. The question was whether a SEPARATE daily/detail "add day-specific item to date D" surface (ADR-006 rule b) is needed. **The founder resolved this (locked):**

> **A안 with the "navigate-to-date" binding semantic.** Toggling a checklist row to 이번만 (OFF) binds it to **the date the edit was opened from** (= `boundDateInt`). Example: a recurring schedule created 6/1; navigate to 6/20; edit the schedule; add a 준비물; toggle 이번만 OFF ⇒ that item gets `occurrence_date = 6/20` and shows ONLY on 6/20.

This is the chosen design. Consequences:
- The arbitrary-date day-specific capability the founder asked for two days ago is **PRESERVED** — delivered through "navigate to the target date, then toggle 이번만 OFF" inside the existing EditSheet. **No separate daily-add surface and no extra date-picker UI are needed.**
- **The binding is correct-by-design only AFTER fix-1** (Phase 2): editAll must carry the viewed `occurrenceDate` into the sheet. Today the search and single-kid-weekly entry paths drop it and bind to `currentDate` instead of the viewed date (ground truth #4). fix-1 is a one-line plumb in `EventDetailDrawer.handleEditAll`; the route already forwards `params.occurrenceDate`. NOT a no-op — this is a real correctness fix the rework must land.
- A1 ("retire rule b") is **superseded**: nothing is retired. The day-specific UX simply lives in the EditSheet rather than a hypothetical second surface. The ADR documents the navigate-to-date binding (plus fix-1) as **the** day-specific mechanism.

Options considered (for the record, now closed by the founder):
- **Chosen — EditSheet 이번만 toggle binds to the edit-context date.** Pros: matches the handoff (toggle visibility ⇔ `daysOfWeek !== 0`); single add-default rule; reuses the existing, correct `boundDateInt`; covers arbitrary future dates via navigation; smallest testable surface. Cons: discovering "navigate to a date to make an item day-specific to it" is implicit UX — acceptable per founder.
- **Rejected — a separate daily/detail quick-add surface with its own day-specific default.** Cons: introduces a second add-surface with a DIFFERENT default than the form → the dual-default membership confusion ADR-006 set out to kill; speculative; founder explicitly says it is unnecessary.

---

## 2. Reconciliation decisions B / C / D (the judgment calls)

### B — One-time schedule semantics: what `occurrence_date` do its items get?
**Decision: one-time schedules store their checklist items as `occurrence_date = NULL` (recurring-NULL), and DO NOT render the 반복 toggle.**

Justification (ground truth #5, #6): a "one-time" schedule still persists with ≥1 weekday bit (`effectiveDaysOfWeek`) clamped to a single day via `validUntil = validFrom`. It produces exactly ONE occurrence. For that single occurrence date D:
- Membership: `occurrence_date IS NULL` ⇒ member of D (the only date it occurs). ✔ identical result to `occurrence_date = D`.
- Completion: `toggleDone` writes `(itemId, D)` regardless of `occurrence_date` (it uses the VIEWED date). ✔ correct either way.
- Notification body: `candidatesForSchedule` only loops the schedule's own occurrences; the single occurrence is D; NULL items are members. ✔ correct.

NULL is preferred over `= D` because: (1) it requires the "add" button to keep its current `null` default (no per-context branching), (2) it is robust if the user later edits the one-time schedule into a recurring one (the item is already correctly recurring — no stale day-bound value to fix), and (3) it sidesteps the `boundDateInt`/`validFrom` divergence risk. **The toggle is hidden because the choice is meaningless, not because the value is special.**

Testable: a one-time schedule (saved with `daysOfWeek=0` in the form) → its checklist rows persist `occurrence_date = NULL`; ChecklistSection shows them on D with correct count; toggling completion on D marks only D.

### C — Toggling weekdays OFF after items were added: what happens to already-set `occurrence_date` on save?
**Decision: weekday state does NOT mutate item `occurrence_date`. The value persisted is exactly what the row currently holds in the draft, period. The toggle merely hides when `suppliesRepeatable` is false.**

Concretely:
- While the form is open, flipping all weekdays off sets `suppliesRepeatable = false` → the per-row ↻ toggle disappears (conditional render). Existing draft rows keep whatever `occurrenceDate` they had (a recurring row stays `null`; a row the user had flipped to day-specific keeps its bound int).
- On save, a one-time schedule (`daysOfWeek===0`) produces a single occurrence on `validFrom`'s weekday. Per B, NULL items are correct there. **A day-specific row whose bound int ≠ that single occurrence's date would become orphaned (member of no occurrence).** To keep membership coherent and avoid silently-invisible items, save MUST normalize `occurrenceDate → null` for every persisted row.

**There are THREE sites that persist `occurrenceDate`, and the normalization MUST cover all three (no exceptions, no "and/or"):**
1. create-mode loop — `checklistAdd({ …, occurrenceDate: row.occurrenceDate })` at `ScheduleEditSheet.tsx:315`.
2. `persistChecklistDiff` **INSERT** branch — `:906`.
3. `persistChecklistDiff` **UPDATE** branch — `:919` ← the critical regression site: an EXISTING day-specific row must be re-written to NULL, not left at its stale int.

**Implementation (preferred — ONE pre-diff transform covering all three):** when `noRepeat` (`form.daysOfWeek === 0`), null every draft row's `occurrenceDate` BEFORE the diff is computed and before the create loop runs — build `const rowsToPersist = noRepeat ? checklist.map((c) => ({ ...c, occurrenceDate: null })) : checklist;` and feed `rowsToPersist` to BOTH the create loop and `persistChecklistDiff`. Because the normalized value flows into the diff comparison (`prev.occurrenceDate !== e.occurrenceDate`, `:914`), an existing day-specific row is detected as changed → the UPDATE branch (`:919`) writes NULL; the create loop reads the same normalized array → site (1) covered. One transform, all three sites, zero per-site edits.

This is the deterministic save-time transform A안 hints at ("저장 시점에 1회성이면 repeat은 의미 없음 — 저장 후 무시 가능"). We make "무시" concrete = normalize to NULL. Result: no orphaned day-specific rows can be written for a one-time schedule via ANY of the three sites.

Testable (two DISTINCT cases — see Phase 4): (a) **create path** — one-time schedule with a day-specific draft row → persists NULL; (b) **UPDATE path (the named regression)** — editAll on a recurring schedule with an EXISTING day-specific row (`occurrence_date` set) → toggle ALL weekdays off → save → assert the UPDATE branch wrote `occurrence_date = NULL` (not the stale int), verified via repo read.

### D — Default-flip correctness: does recurring-default reintroduce the check-once-marks-every-occurrence bug?
**Decision: No, and here is the proof — no code guards this beyond what already exists.**

The original PREP-RECUR bug was a SINGLE `is_done` flag on the template row. The v6 fix moved completion to `checklist_completion(item_id, occurrence_date)`. Critically (ground truth #6): **completion isolation is independent of an item's `occurrence_date` membership value.** A recurring item (`occurrence_date NULL`) checked on day D writes exactly one row `(id, D)`; viewing D+1 finds no row for `(id, D+1)` → unchecked (`ChecklistSection.tsx:97 isComplete`, proven by test `tests/state/checklist-store.test.ts:231-246` and `tests/ui/daily/ChecklistSection.test.tsx:197-220`).

Defaulting NEW items to recurring(NULL) only affects MEMBERSHIP (which dates show the item), never the completion key. So even if every item is recurring, checking on D never marks D+1. The bug cannot return through the default change. The default-flip is purely a UX/membership choice, fully orthogonal to the completion log.

Testable: covered by retaining the existing per-occurrence completion tests unchanged; add one asserting a recurring item checked on D is unchecked on D+1 *after* being created via the new default path (already covered, keep green).

---

## 3. Code-review of the shipped PREP-RECUR (functional re-verify the user asked for)

Run these as concrete checks against the CURRENT code BEFORE/ALONGSIDE the rework. Each is a pass/fail with a file:line anchor.

| # | Check | Where | Expected | Status from read |
|---|-------|-------|----------|------------------|
| R1 | **Membership query** filters day-specific correctly | `ChecklistSection.tsx:49`; `scheduler.ts:162-168` | `occurrenceDate === null || === dInt`; both compare yyyymmdd INT | ✔ correct in both display + scheduler |
| R2 | **Count recompute** uses per-occurrence completion, not is_done | `ChecklistSection.tsx:124-128` | `done = items.filter(isComplete)`, `isComplete` reads `completionMap.has(\`${id}|${dateInt}\`)` | ✔ correct; `is_done` never read |
| R3 | **Completion-log per-occurrence isolation** | `checklist-store.ts:100-114`, `checklist-completion.ts:25-54` | mark/clear keyed `(id, occurrence_date)`, INSERT OR IGNORE + DELETE | ✔ correct; UNIQUE enforces idempotency |
| R4 | **Notification body Option-A suppression** | `scheduler.ts:159-176`, `body.ts:41-68` | per-date pending = member AND not in `completedByDate[dInt]`; completed items dropped from body | ✔ correct; `is_done` not read in body |
| R5 | **EditSheet new-item default** | `ScheduleEditSheet.tsx:769-777` | new row default occurrence_date | ⚠ currently ALWAYS `null` (recurring) regardless of `daysOfWeek` — see Defect-1 |
| R6 | **Migration v6 backfill** | `006_v6_checklist_recurrence.sql.ts:44-61` | existing rows → NULL; each `is_done=1` → one completion row at `today` | ✔ correct; additive-only, atomicity-gated |
| R7 | **toggleDone writes completion, not is_done** | `checklist-store.ts:100-114` | flips completion row only | ✔ correct (test `checklist-store.test.ts:200-229` proves is_done stays 0) |
| R8 | **reconcile-on-mutate** keeps notif body fresh | `checklist-store.ts:16-20, 78, 88, 97, 113` | every add/update/remove/toggle calls `rescheduleAll` | ✔ correct |

**Defects / smells found while reading (flag for the rework):**

- **Defect-1 (behavioral gap, not a crash): the shipped UI renders the 반복 control unconditionally and pre-dates A안's rule.** `ScheduleEditSheet.tsx:747-766` shows a label+switch for every row regardless of `daysOfWeek`; the add handler (`:776`) hardcodes `occurrenceDate: null`. A안 wants: recurring ⇒ default recurring(null) [already matches], one-time ⇒ toggle hidden + items null (Decision B). The new-row default stays `null` (correct for both cases); what changes is (i) toggle VISIBILITY (`daysOfWeek !== 0`) and (ii) the save-time NORMALIZATION (Decision C). Document in ADR-006a so the "default flip" is understood as a no-op for recurring and a hide+normalize for one-time.
- **Defect-2 (real, must-fix): editAll drops the viewed `occurrenceDate` → `boundDateInt` binds to the wrong date on two paths.** `EventDetailDrawer.handleEditAll` (`EventDetailDrawer.tsx:123-129`) routes `{mode:'editAll', scheduleId}` WITHOUT `occurrenceDate`, so a 이번만-OFF row binds to `currentDate` instead of the date the user actually viewed (search → `todayIso()`; single-kid weekly → `e.date`). **Fix = fix-1 (Phase 2): forward `occurrenceDate: detail.occurrenceDate`** in `handleEditAll` (mirror `handleEditOccurrence` `:118`); `app/schedule/edit.tsx:35` already plumbs `params.occurrenceDate` into the sheet. One-line drawer change. After fix-1 the old "currentDate not in useMemo deps" concern is moot (the captured value IS the correct edit-context date).
- **Smell-3: dead/legacy `validUntil` picker field** referenced in `PickerOverlay` (`ScheduleEditSheet.tsx:836-837`) though the 종료일 row was dropped (`:602-603`). Not in scope; leave.
- **Confirm-4: no second completion path.** Grep confirms only `toggleDone` → completion store writes completion; `checklistItemsRepo.toggleDone` (legacy) is not called anywhere. ✔ matches ADR-006 "이중 경로 없음."

**Code-review verdict to carry into Architect/Critic:** the shipped PREP-RECUR data/notification layer is correct; the ONLY shipped-impl gap is the UI default/visibility (Defect-1), which the rework addresses. No migration or store changes required.

---

## 4. Work plan — phases, files, testable criteria

### Phase 1 — Repeat glyph icon (Expo-Go-safe) — glyph PINNED
- **File**: `src/ui/icons.tsx` — add `IconRepeat` using `@expo/vector-icons`. **Pinned: Ionicons `repeat`** (default). During the visual pass, if MaterialCommunityIcons `repeat-variant` reads closer to the handoff ↻, swap to that — but ship ONE of these two, decided at implementation, defaulting to Ionicons `repeat`. NO inline SVG, NO react-native-svg (BLOCKED, A-ICONS). Follow the existing `memo(function Icon…)` pattern in the file (e.g. `IconXMark` at `:77-79`).
- **Verify**: `IconRepeat` renders at size≈13 with a `color` prop; no new `react-native-svg` import anywhere (grep clean); typecheck passes (strict).

### Phase 2 — EditSheet checklist UI rework (the core) + fix-1 binding plumb
- **Files**: `src/ui/sheets/ScheduleEditSheet.tsx` (UI rework) + `src/ui/drawers/EventDetailDrawer.tsx` (fix-1, one line).
- In `ScheduleEditSheet.tsx`:
  - Derive `const suppliesRepeatable = form.daysOfWeek !== 0;` (live from the form mask).
  - Replace the per-row `반복` label + `ToggleSwitch` block (`:747-766`) with the A안 ↻ **pill** that renders ONLY when `suppliesRepeatable`:
    - ON (`occurrenceDate === null`): bg `TOKENS.primaryTint`, icon+text `TOKENS.primaryDeep`, "매번" label (12.5px/500, letterSpacing -0.2), pill radius 99, padding 4/9/4/7.
    - OFF (`occurrenceDate !== null`): transparent bg, icon-only, color `TOKENS.ink30`, padding 4/5.
    - aria: ON "매번 챙김 (탭하면 이번만)" / OFF "이번만 (탭하면 매번)".
    - tap → flip `occurrenceDate` between `null` and `boundDateInt`.
  - When `!suppliesRepeatable`, render NO pill (conditional render, not disabled/hidden) — supplies are a plain list.
  - Add new style entries `checklistRepeatPill` / `...PillOn` / `...PillOff` / `...PillLabel` using TOKENS only; **remove** the now-unused `checklistRepeatRow` / `checklistRepeatLabel` styles (`:1424-1437`).
  - "Add" button (`:769-777`): keep new-row default `occurrenceDate: null` (correct for both cases per B/Defect-1). Optionally annotate the comment to cite A안 + decision B.
- **fix-1 (Defect-2 / Critic M2) — File: `src/ui/drawers/EventDetailDrawer.tsx`**: in `handleEditAll` (`:123-129`) add `occurrenceDate: detail.occurrenceDate` to the route `params` (mirroring `handleEditOccurrence` at `:118`). This makes `boundDateInt`'s 2nd fallback resolve to the exact occurrence the user viewed, so 이번만-OFF binds correctly on the search and single-kid-weekly paths (not just the daily grid). No change needed in `app/schedule/edit.tsx` — it already forwards `params.occurrenceDate` into the sheet (`:35`).
- **Verify** (component test, see Phase 4): with `daysOfWeek=0` no `매번`/repeat control renders; with `daysOfWeek≠0` the pill renders per row; ON state shows "매번" text + tint bg token; OFF shows icon-only + ink30; tapping flips and visual state changes; **fix-1**: editAll opened for an occurrence on date X binds a toggled-OFF row to X (not `currentDate`).

### Phase 3 — Save-time normalization (decision C) — ALL THREE persist sites (Critic M1)
- **File**: `src/ui/sheets/ScheduleEditSheet.tsx`. `noRepeat = form.daysOfWeek === 0` is already computed in `handleSave` (`:275`).
- **Single pre-diff transform** (covers all three sites at once): in `handleSave`, before the create loop and before calling `persistChecklistDiff`, build
  `const rowsToPersist = noRepeat ? checklist.map((c) => ({ ...c, occurrenceDate: null })) : checklist;`
  then feed `rowsToPersist` to BOTH paths. This normalizes every one of the three `occurrenceDate` persist sites:
  1. **create loop** `checklistAdd(...)` — `:315` (reads `rowsToPersist`).
  2. **`persistChecklistDiff` INSERT** branch — `:906` (reads normalized `e.occurrenceDate`).
  3. **`persistChecklistDiff` UPDATE** branch — `:919` ← the critical regression site. Because the normalized value flows into the diff comparison (`prev.occurrenceDate !== e.occurrenceDate`, `:914`), an EXISTING day-specific row is detected as changed → UPDATE writes `NULL` (not the stale int).
- Guarantee: no orphaned day-specific rows can be written for a one-time schedule via ANY of the three sites. (If a future refactor splits the paths, the alternative is to plumb a `noRepeat` flag into `persistChecklistDiff` — but the single pre-diff transform is preferred precisely because it cannot miss a site.)
- **Verify** (three tests, see Phase 4):
  - *create path*: save a one-time schedule (`daysOfWeek=0`) whose draft rows include a day-specific `occurrenceDate` → all persist `occurrence_date = NULL`.
  - **NAMED UPDATE-path regression (Critic M1)**: open `editAll` on a recurring schedule that has an **EXISTING** day-specific row (`occurrence_date` set) → toggle ALL weekdays OFF → save → assert the **UPDATE branch wrote `occurrence_date = NULL`** (not the stale int), verified via repo read. Distinct from the create-path test.
  - *inverse*: saving a recurring schedule (`daysOfWeek≠0`) preserves each row's `occurrenceDate` exactly (recurring stays null, day-specific keeps its bound int).

### Phase 4 — Tests (update + add)
- **`tests/ui/sheets/edit-sheet-form.test.ts`**: no change to validation (daysOfWeek still optional). If a `suppliesRepeatable` helper is extracted to the form module, add a unit test (`daysOfWeek !== 0`).
- **New / updated component test for the checklist section of the EditSheet** (mounting `ScheduleEditContent`, mirroring existing RTL patterns): 
  - one-time (`daysOfWeek=0`): repeat pill absent (conditional render).
  - recurring (`daysOfWeek≠0`): pill present; ON renders "매번"; OFF renders icon-only.
  - **navigate-to-date binding (founder semantic)**: open `editAll` with the viewed date = some date D (via `occurrenceDate`), add a row, toggle 이번만 OFF → the row's `occurrenceDate` becomes D's yyyymmdd int (= `boundDateInt`); save persists `occurrence_date = D`.
  - **fix-1 binding correctness (M2)**: editAll opened from a detail for date X (where X ≠ `currentDate`) → toggle a row OFF → it binds `occurrence_date = X` (NOT `currentDate`). This exercises the `EventDetailDrawer.handleEditAll` → route `occurrenceDate` → `boundDateInt` path; covers the search (`todayIso()`) and single-kid-weekly (`e.date`) entries by construction.
  - tap flips `occurrenceDate` null⇄boundDateInt (assert via state or save payload).
  - **C / create path**: save one-time schedule with a day-specific draft row → persists null.
  - **C / NAMED UPDATE-path regression (M1)**: editAll on a recurring schedule with an EXISTING day-specific row → toggle ALL weekdays OFF → save → repo read shows the UPDATE branch wrote `occurrence_date = NULL` (not the stale int; no orphaned row). Distinct test from the create-path case above.
  - **C / inverse**: recurring save preserves a day-specific row's bound int.
- **`tests/state/checklist-store.test.ts`**: keep all green (no store change). The per-occurrence isolation tests (`:200-246`) remain the D-guard.
- **`tests/ui/daily/ChecklistSection.test.tsx`**: unchanged (display/membership/completion logic untouched). Keep green as regression guard for R1/R2/R3.
- **`tests/notifications/scheduler.test.ts`**: unchanged; keep green as R4 guard. (If it lacks an explicit "completed item suppressed from body for its date only" case, add one — confirm during execution.)
- **Verify**: full `jest` suite green; `tsc --noEmit` clean (Stop hook will run it).

### Phase 5 — Docs
- Amend **ADR-006** with the sub-decision (§6 below). Update `CLAUDE.md` *Locked Decisions* 준비물 line if needed to reference the toggle-visibility rule. Append any residual open items to `.omc/plans/open-questions.md`.

---

## 5. Reject-risk / regression checklist (must all hold)
- [ ] **No reintroduction of check-once-marks-every-occurrence** — completion stays keyed by VIEWED date; `is_done` untouched & unread. (D; tests `checklist-store.test.ts:231-246`, `ChecklistSection.test.tsx:197-220` stay green.)
- [ ] **Notification body still suppresses completed items per-date** (Option A) — no change to `scheduler.ts`/`body.ts`; `scheduler.test.ts` green. (R4)
- [ ] **No migration change** — v6 untouched; no v7 in this rework.
- [ ] **Tokens, not literals** — `primaryTint`/`primaryDeep`/`ink30` referenced via `TOKENS`; zero hex/rgba literals added at call sites. (Per-edit eslint --fix + only-defined-tokens rule.)
- [ ] **No react-native-svg** — repeat glyph via `@expo/vector-icons` only. (A-ICONS guard.)
- [ ] **One-time schedules never persist orphaned day-specific rows** — single pre-diff transform normalizes ALL THREE persist sites (create `:315`, INSERT `:906`, UPDATE `:919`) to null when `daysOfWeek===0`; named UPDATE-path regression test green. (C / M1)
- [ ] **Recurring schedules preserve per-row `occurrenceDate`** on save — day-specific rows survive a normal recurring save. (C inverse)
- [ ] **editAll binds 이번만 to the VIEWED occurrence, not `currentDate`** — fix-1 forwards `detail.occurrenceDate` in `EventDetailDrawer.handleEditAll`; search + single-kid-weekly paths bind correctly; binding test green. (M2)
- [ ] **Conditional render, not visibility toggle** — when one-time, the pill is absent from the tree (matches README §52-53).
- [ ] **strict TS + noUncheckedIndexedAccess** — array indexing in the checklist map/loop stays guarded.
- [ ] **editOccurrence still hides the whole 준비물 section** (template-level checklists) — unchanged (`ScheduleEditSheet.tsx:703`).

---

## 6. ADR — amendment to ADR-006 (new sub-decision)

> Add as a new section "ADR-006a — 준비물 반복 토글 노출 = 일정 반복 종속 (A안)" appended to `docs/architecture/ADR-006-checklist-recurrence.md`, Status: Proposed → Accepted on Architect/Critic APPROVE.

- **Decision**: The per-item 반복 control is rendered **iff the schedule is recurring**, defined live in the edit form as `daysOfWeek !== 0` (`suppliesRepeatable`). Visual = A안 ↻ pill (ON = "매번", `primaryTint`/`primaryDeep`; OFF = icon-only, `ink30`) replacing the prior label+switch. New items default recurring (`occurrence_date = NULL`). **Day-specific ("이번만") binding semantic (founder-locked):** toggling a row OFF binds it to the date the edit was opened from (`boundDateInt = preFill.date ?? occurrenceDate ?? currentDate`, `ScheduleEditSheet.tsx:179-185`) — i.e. the item gets `occurrence_date =` the viewed/edit-context date and shows ONLY on that date. **This requires fix-1**: `EventDetailDrawer.handleEditAll` (`:123-129`) must forward `detail.occurrenceDate` into the route (it currently drops it, so search/single-kid-weekly edits bind to `currentDate` instead of the viewed date); after fix-1 the binding is correct on ALL entry paths. A user makes an item day-specific to an arbitrary date by navigating to that date, editing the schedule, and toggling 이번만 OFF — **no separate daily-add surface or date-picker is required.** For one-time schedules the control is hidden and all rows persist `occurrence_date = NULL`; on save, when `daysOfWeek === 0`, a single pre-diff transform normalizes every row's `occurrence_date` to `NULL` across ALL THREE persist sites (create loop `:315`, `persistChecklistDiff` INSERT `:906` + UPDATE `:919`) — no orphaned day-specific rows. The mapping `repeat=true ⇄ occurrence_date=NULL`, `repeat=false ⇄ occurrence_date=edit-context date` is preserved; NO migration change.
- **Drivers**: (1) conditional-render correctness keyed on a live form signal (`daysOfWeek`); (2) reconcile A안's recurring-default with the shipped recurring-default (no-op for recurring; hide+normalize for one-time); (3) deterministic save-time behavior for one-time + weekday-off edges (normalize-to-NULL in both write paths).
- **Alternatives considered**:
  - *A separate daily/detail day-specific add surface with its own default.* Rejected by founder: introduces a second add-default conflicting with the form default (the dual-default confusion ADR-006 set out to kill); unnecessary because the navigate-to-date + 이번만-OFF mechanism already covers arbitrary dates.
  - *Store one-time items as `occurrence_date = single date` instead of NULL.* Rejected: equivalent membership for a single-occurrence schedule but brittle under later recurring edits and forces per-context add defaults; NULL is simpler and edit-robust.
  - *Keep the existing label+switch UI.* Rejected: violates A안 hi-fi handoff + amatta-v1 fidelity.
- **Why chosen**: smallest coherent surface; single add-default rule + in-row toggle covers BOTH recurring and arbitrary-date day-specific items (via navigation); provably cannot reintroduce the PREP-RECUR completion bug (completion key = viewed date, orthogonal to membership — Architect-verified); tokens already exist so zero palette churn.
- **Consequences**: The day-specific UX is delivered entirely through the EditSheet (navigate-to-date + 이번만 OFF); no new add-surface is built and nothing is retired. `boundDateInt`'s edit-context-date fallback becomes load-bearing — fix-1 (forward `detail.occurrenceDate` from `EventDetailDrawer.handleEditAll`) is required so it binds to the viewed occurrence on the search/single-kid-weekly paths, not just the daily grid. EditSheet checklist UI + the one-line drawer plumb (fix-1) + save mapping (single pre-diff transform across all 3 persist sites) + associated tests change. Data layer, migration, scheduler, completion store: unchanged. ↻ glyph = `@expo/vector-icons` (Ionicons `repeat`) until EAS build restores custom SVG (A-ICONS).
- **Follow-ups**: (a) revisit custom ↻ SVG glyph post-EAS (A-ICONS); (b) v7 still owns `is_done/done_at` column drop (unchanged from ADR-006). (No deferred daily-add surface — founder closed it.)

---

## 7. Open questions

**Both prior open questions are now RESOLVED:**
- ✅ **Day-specific add model** — founder locked: navigate-to-date + 이번만 OFF binds to the edit-context date; no separate surface. (Was the A1/A2 question.)
- ⏳ **Only remaining (low-risk, implementation-time):** final ↻ glyph choice — ship Ionicons `repeat` by default, swap to MaterialCommunityIcons `repeat-variant` only if it reads visibly closer to `Supplies Repeat (A안).html` during the visual pass. Pinned default = Ionicons `repeat`; not a blocker. Tracked in `.omc/plans/open-questions.md`.
