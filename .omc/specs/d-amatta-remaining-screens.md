# Spec — Batch D: remaining amatta-v1 screen ports

> **Goal**: bring the remaining amatta-v1 prototypes into the app at
> 1:1 visual fidelity, swapping mock data for our Zustand stores.
>
> **Status**: ready for team execution
> **Source**: `docs/design/amatta-v1/` prototypes — multiple JSX files.
> Each worker reads ONE prototype and translates it mechanically into RN.

---

## 1. Scope

### In scope
- **ScheduleEditSheet** rebuild from `app-event-form.jsx` (~600 LOC)
- **EventDetailDrawer** new component from `app-event-detail.jsx` (~300 LOC)
- **WeeklyView** rebuild from `app-weekly.jsx` (~500 LOC) → replaces `app/child/[id].tsx`
- **CalendarDrawer + SearchDrawer** from `app-weekly-drawers.jsx` (~400 LOC), mounted in `app/_layout.tsx` alongside ScheduleEditSheet
- **Settings** 4-screen flow from `app-settings.jsx`, `app-settings-kids.jsx`, `app-settings-data.jsx`, `app-settings-legal.jsx` (~800 LOC)
- **Onboarding** flow from `app-onboarding.jsx` (~400 LOC) → replaces `EmptyChildrenState` when no children

### Out of scope
- Notifications (batch E)
- README + polish (batch F)
- EAS dev build, hand-drawn SVG icons revival (batch G)

---

## 2. Worker assignments (5 workers, parallel single stage)

All workers run in parallel because file scopes don't overlap. Each worker
ports exactly one prototype suite into RN. The integration worker
(worker-drawers) mounts the drawers in `app/_layout.tsx` and wires the
`TopBar` callbacks that are currently TODO no-ops.

### 2.1 worker-event (sheet + detail-drawer)

**Source**: `docs/design/amatta-v1/app-event-form.jsx` + `app-event-detail.jsx`

**Files to rewrite/create:**
- `src/ui/sheets/ScheduleEditSheet.tsx` — full rebuild from `app-event-form.jsx`. The current implementation is from Phase 4 and is functional but the visual doesn't match the prototype. Keep the same external API (`useUiStore.editSheetState` driven, 3 modes: create / editAll / editOccurrence).
- `src/ui/sheets/edit-sheet-form.ts` — keep the existing form validation module; this worker may extend it but should not break existing tests (`tests/ui/sheets/edit-sheet-form.test.ts`).
- NEW `src/ui/drawers/EventDetailDrawer.tsx` — from `app-event-detail.jsx`. Show a single event's full info (title, time, place, kid, kind, recurrence days, pickup status, related ChecklistItems, "이 회차 수정" / "전체 수정" / "이 회차 삭제" / "전체 삭제" actions). Driven by `useUiStore.eventDetailState` (new state slice — add to ui-store with mode='closed'|'open' + scheduleId + occurrenceDate fields).

**Data wiring:**
- Form: pulls from `useChildrenStore` (kid picker), draws current edit state from `useUiStore.editSheetState`. Save → `useSchedulesStore.{add/updateSchedule/applyException}`.
- Detail: pulls schedule by id, child by schedule.childId, checklist items via `useChecklistStore.itemsByScheduleId.get(scheduleId)`. Actions wire to existing store actions.

**Mock-to-real mapping:**
- `app-event-form.jsx KIDS[].id` etc → real `children` store
- `kind: 'school'|'academy'|...` → ScheduleType enum (already matches)
- `daysOfWeek` toggles → daysOfWeek bitmask (already matches)
- Time pickers: keep the ±30min stepper from Phase 4 unless `app-event-form.jsx` shows a different shape — match the prototype.

**Tests:**
- Existing `tests/ui/sheets/edit-sheet-form.test.ts` (22 tests) must stay green.
- New: `tests/ui/drawers/EventDetailDrawer.test.tsx` (~4 tests).

**Bridge to other workers:** worker-event creates the new `useUiStore.eventDetailState` slice. The integration changes to `ui-store.ts` go in this worker (small additive change — keep existing types intact).

---

### 2.2 worker-weekly (weekly view + integration with new drawers)

**Source**: `docs/design/amatta-v1/app-weekly.jsx`

**Files to rewrite:**
- `app/child/[id].tsx` — currently a Phase 4 stub that uses `WeeklyGrid`. Replace with a port of `app-weekly.jsx` (single-kid weekly view, 7 columns Mon–Sun × 35 rows, top bar with prev-week / "이번 주" pill / next-week + kid header + ColorDot + name).
- `src/ui/weekly/WeeklyGrid.tsx` — refresh if the prototype's visual differs from Phase 4's. Re-use `getKidPalette` + `KIND_ICON` + Pretendard tokens.
- Swipe ±7 days via `Gesture.Pan` (same pattern as daily index.tsx commit `1cbfd81`).
- Tap a block → `useUiStore.openEventDetail({scheduleId, occurrenceDate})` (the new slice from worker-event).
- Tap empty slot → `useUiStore.openEditSheet('create', {preFill: {childId, date}})`.

**Tests:**
- `tests/ui/weekly/WeeklyGrid.test.tsx` may need updates — preserve existing 4 tests' intent; adjust the expected component tree shape only as necessary.

---

### 2.3 worker-drawers (calendar + search + mount integration)

**Source**: `docs/design/amatta-v1/app-weekly-drawers.jsx`

**Files NEW/MODIFY:**
- NEW `src/ui/drawers/CalendarDrawer.tsx` — calendar grid for date picking. Single-month view with prev/next month chevrons. Tap a date → `useUiStore.setCurrentDate(iso)` + close. Driven by `useUiStore.calendarDrawerOpen` (boolean slice).
- NEW `src/ui/drawers/SearchDrawer.tsx` — full-text search across schedules + todos + checklist items. Live filter as user types. Result tap → navigate to relevant screen (schedule → /child/[id]? or open EditSheet editAll? — match prototype). Driven by `useUiStore.searchDrawerOpen`.
- MODIFY `src/state/ui-store.ts` — add `calendarDrawerOpen: boolean`, `searchDrawerOpen: boolean`, `openCalendar`, `closeCalendar`, `openSearch`, `closeSearch` actions.
- MODIFY `app/_layout.tsx` — mount `<CalendarDrawer/>` and `<SearchDrawer/>` alongside `<ScheduleEditSheet/>` inside `<BottomSheetModalProvider>`.
- MODIFY `app/(tabs)/index.tsx` — replace TODO no-ops: `handlePressDate` → `useUiStore.openCalendar()`, `handlePressSearch` → `useUiStore.openSearch()`.

**Coordination with worker-event:**
- Both workers touch `src/state/ui-store.ts`. worker-event adds eventDetailState; worker-drawers adds calendarDrawerOpen + searchDrawerOpen. Two separate slices — merge cleanly without conflict.

**Tests:**
- NEW `tests/ui/drawers/CalendarDrawer.test.tsx` (~4 tests: month grid renders, prev/next, tap date sets currentDate + closes, today highlighted).
- NEW `tests/ui/drawers/SearchDrawer.test.tsx` (~3 tests: empty state, typed query filters, result tap dispatches).

---

### 2.4 worker-settings (4 settings screens)

**Source**: `docs/design/amatta-v1/app-settings.jsx`, `app-settings-kids.jsx`, `app-settings-data.jsx`, `app-settings-legal.jsx`

**Files to rewrite/create:**
- MODIFY `app/(tabs)/settings.tsx` — settings hub matching `app-settings.jsx`. Sections: 자녀 관리 row + 데이터 row + 알림 (placeholder for batch E) + 약관 row + 앱 정보. Each row navigates to a sub-screen.
- NEW `app/settings/kids.tsx` — children CRUD per `app-settings-kids.jsx`. Add/edit/delete children. Hard 5th-child cap (existing `ChildCapError` belt). 6-color swatch picker (Petunia/Mint/Glacier/Soft/Citrus/Lavender). Per-child default notification minutes.
- NEW `app/settings/data.tsx` — DB export per `app-settings-data.jsx`. JSON export button. Future-import placeholder.
- NEW `app/settings/legal.tsx` — terms + privacy text from `app-settings-legal.jsx`.
- MODIFY `src/ui/settings/ChildEditModal.tsx` — keep or replace per the prototype's actual UI.

**Tests:**
- Existing `tests/ui/settings/children-cap.test.tsx` (5 tests) must stay green.
- New: maybe 1 test for the hub navigation; lightweight on UI tests for settings since flows are linear.

---

### 2.5 worker-onboarding (replaces EmptyChildrenState)

**Source**: `docs/design/amatta-v1/app-onboarding.jsx`

**Files to rewrite/create:**
- MODIFY `src/ui/common/EmptyChildrenState.tsx` — currently a centered mascot + CTA. Replace with the actual onboarding flow:
  - Welcome screen: mascot illustration + value-prop text + "시작하기" CTA.
  - Add-kid screen: name input + 6-color avatar swatch picker + "추가" CTA → calls `useChildrenStore.add(db, ...)`. After successful add, returns to the daily view (which now has ≥ 1 child and renders the grid).
  - The flow lives inline in `EmptyChildrenState.tsx` — a small state machine (`screen: 'welcome' | 'addKid'`). No route navigation needed since this only shows when `children.length === 0`.

**Tests:**
- Existing `tests/ui/common/EmptyChildrenState.test.tsx` (3 tests) — update to match the new flow (welcome → addKid → save).

---

## 3. New ui-store slices

Two new slices needed across workers:

```ts
// worker-event adds:
interface EventDetailState {
  mode: 'closed' | 'open';
  scheduleId?: number;
  occurrenceDate?: ISODate;
}

eventDetailState: { mode: 'closed' };
openEventDetail: (input: { scheduleId; occurrenceDate }) => void;
closeEventDetail: () => void;

// worker-drawers adds:
calendarDrawerOpen: boolean;
searchDrawerOpen: boolean;
openCalendar: () => void;
closeCalendar: () => void;
openSearch: () => void;
closeSearch: () => void;
```

Both edits to `src/state/ui-store.ts` are additive — coordinate the
merge by each worker preserving the existing state shape and only
appending its new fields/actions.

---

## 4. Shared invariants (every worker)

- 1:1 fidelity per prototype. Mechanical CSS → StyleSheet. Don't reinterpret.
- Pretendard / Geist Mono via FONT_FAMILIES tokens. NO bare `fontWeight` strings.
- Icons via `@expo/vector-icons` Ionicons + MaterialCommunityIcons.
  Hand-drawn SVG icons via react-native-svg are NOT available in Expo
  Go. Add `TODO(EAS-dev-build)` comments where appropriate.
- All Pressables use `Pressable`, not `TouchableOpacity`.
- TS strict + noUncheckedIndexedAccess. Every array indexing is `T | undefined`.
- No new deps. Use installed: react-native-gesture-handler,
  react-native-reanimated, @gorhom/bottom-sheet, @expo/vector-icons,
  expo-file-system, expo-sharing.
- Drawers use `BottomSheetModal` from `@gorhom/bottom-sheet` v5 (same
  pattern as ScheduleEditSheet).

---

## 5. Acceptance gate

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx eslint .` → 0 new findings (pre-existing baseline preserved)
- [ ] `npx jest` → all green; expect 333 baseline + ~20–30 new = ~360
- [ ] Phone hot-reload:
  - Daily view's search button (top bar) opens SearchDrawer.
  - Daily view's date pressable opens CalendarDrawer; tap a date → `currentDate` shifts.
  - Tap a kid in daily header → /child/[id] renders the new weekly view.
  - Tap a block on weekly → EventDetailDrawer opens with full info + actions.
  - Tap "이 회차 수정" inside EventDetailDrawer → ScheduleEditSheet in editOccurrence mode.
  - Settings tab → 4 rows (자녀 / 데이터 / 알림 / 약관). Tap 자녀 → kids CRUD screen.
  - When user deletes all children, daily view shows the new onboarding welcome screen + add-kid form.

---

## 6. Out-of-scope confirmation

- Notifications still NOT wired (batch E).
- Hand-drawn SVG icon revival NOT in this batch (EAS dev build).
- Animations (Reanimated transitions) — implementations OK to skip
  animation specifics; static state must look correct.
