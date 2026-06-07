# Ralplan — Migrate RN `<Modal>` Sheets/Drawers → expo-router Modal-Route Shells

> Consensus reached (Planner → Architect → Critic, 2 iterations). **Critic verdict: APPROVE**, conditional on the 5 items in §0 being present (they are, below). Mode: SHORT. No new dependencies. Behavior + data flow preserved 1:1; existing drawer tests pass UNCHANGED.

> **⚠️ REVISED DURING CALENDAR PILOT (2026-06-05) — supersedes the `formSheet` presentation choice below.** Native `formSheet` is broken on this stack (rn-screens 4.16 + newArchEnabled + iPhone): inset-card side margins + sheet material brightens white on touch. **FINALIZED standard: `@gorhom/bottom-sheet` (already a dep) inside a `presentation:'transparentModal'` route** — short via snapPoints, fully-controlled white bg (no touch-white), edge-to-edge, swipe/backdrop dismiss. gorhom also natively resolves §0-S7 (BottomSheetScrollView) + keyboard (BottomSheetTextInput). Light mode forced at runtime via `Appearance.setColorScheme('light')` in `_layout` (app.json alone doesn't apply in Expo Go). Calendar pilot done + user-approved; reference impl = `app/calendar/index.tsx`. The `useLocalSearchParams`/shell/store-as-truth model (§0–§7) is UNCHANGED — only the native presentation primitive changed (formSheet → gorhom). Snap targets: Search/EventDetail ~85%, ScheduleEditSheet ~92%.

## Goal
Give four of the five RN `<Modal transparent animationType="slide">` surfaces the same native iOS sheet presentation as `app/dev-gallery.tsx` (background card-recede + native swipe-to-dismiss), by wrapping the **existing component bodies** in thin expo-router route **shells**. **KidSwitch stays an RN `<Modal>`** (host callback, not a destination). **ui-store stays the single source of truth for visibility.**

Stack note: Expo is **SDK ~54 / expo-router ~6** (CLAUDE.md's "~52" is stale — fix in cleanup), so `presentation:'formSheet'` + `sheetAllowedDetents` are available.

---

## 0. Approval conditions (must appear in execution — all included below)
1. **C1** Shell open effect depends on its **scalar params** (`scheduleId`/`mode`/`occurrenceDate`), mirroring `ScheduleEditSheet.tsx:165-199` deps — NOT a bare `[]` mount effect. (else in-place editAll→editOccurrence breaks — highest-risk bug)
2. **S7** is an **UNKNOWN gated on device verification**, not a settled claim: verify on `ScheduleEditSheet` **with keyboard raised** (tall + short form). RNGH `ScrollView` fallback is **pre-authorized as a likely-common path**, NOT gorhom.
3. Delete the **dead gorhom mock in ALL THREE drawer test files** (`EventDetailDrawer.test.tsx:7`, `CalendarDrawer.test.tsx:10`, `SearchDrawer.test.tsx:5`), then run those tests to confirm green.
4. **Invariant**: callers navigate only; shells own all `openX`/`closeX`; bodies cross-navigate only via the `back()`+`push` sibling-swap.
5. **N1** call-site enumeration (§4) is authoritative — flip every listed site; KidSwitch (`child/[id].tsx:235`) is the explicit exception (stays a direct store call).

---

## 1. Decision (ADR — to fold into the Phase 3/4 UI-rework record, NOT a standalone ADR-004)

**Decision:** Migrate Calendar, Search, EventDetail, ScheduleEditSheet from host-/globally-mounted RN `<Modal transparent slide>` to expo-router routes using `presentation:'formSheet'` **thin shells** that drive the **existing** ui-store actions and render the **existing** component bodies. KidSwitch remains a host-mounted RN `<Modal>`. ui-store stays the single source of truth. iOS picker inlined; Android picker dialog untouched. Back-stack: push-to-open, back-to-dismiss, back+push for sibling swaps.

**Drivers:** native iOS sheet parity with `dev-gallery`; single source of truth (keeps existing tests green); presentation-paradigm consistency (max two paradigms: formSheet routes + one RN Modal); amatta-v1 fidelity; no new deps.

**Alternatives rejected:** (A, iter-1) hybrid params+slim store → dual identity source. (B) full route params + delete ui-store modal slice → breaks store-driven tests, lossy `preFill` serialization, no param form for KidSwitch `onPick`. (gorhom for all/one) → third presentation paradigm, consistency regression. (`presentationStyle='pageSheet'` RN-Modal prop) → user rejected; wants real routes.

**Consequences:** Android renders these as plain modals (no detents/recede) — accepted for a local app. Each shell must keep store↔route in lockstep (shared effect). iOS picker becomes inline. Dead gorhom mocks removed. **This is a UI-presentation-only change with zero data-layer impact → it belongs inside the pending Phase 3/4 UI rework**, recorded there + a one-line CLAUDE.md *Locked Decisions* note.

---

## 2. Route structure + named sheet primitive per category

Registered flat in `app/_layout.tsx` `<Stack>` (matching `schedule/edit`/`dev-gallery`). Global mounts at `_layout.tsx:216-219` removed; KidSwitch mount at `child/[id].tsx:273` **stays**.

| Route file | `<Stack.Screen>` | Primitive | Replaces |
|---|---|---|---|
| `app/schedule/edit.tsx` (rewrite bounce-stub) | `name="schedule/edit"` — flip `presentation:'modal'`→`'formSheet'` + `sheetAllowedDetents:[0.92]`, `sheetGrabberVisible:true` (`_layout.tsx:198`) | tall formSheet | `<ScheduleEditSheet/>` (`_layout.tsx:216`) |
| `app/event/detail.tsx` (new) | `name="event/detail"`, `formSheet`, `sheetAllowedDetents:[0.85]` | formSheet | `<EventDetailDrawer/>` (`:219`) |
| `app/calendar/index.tsx` (new — **PILOT**) | `name="calendar/index"`, `formSheet`, `sheetAllowedDetents:[0.5]` | formSheet | `<CalendarDrawer/>` (`:217`) |
| `app/search/index.tsx` (new) | `name="search/index"`, `formSheet`, `sheetAllowedDetents:[0.5,0.85]` | formSheet (2 detents) | `<SearchDrawer/>` (`:218`) |
| — (no route) | KidSwitch stays `child/[id].tsx:273` | RN `<Modal>` | n/a |

Detents are starting proposals — final heights are visual-verdict gated (Open Q#1).

**Shell pattern (identical for all four), with C1 baked in:**
```tsx
// app/<route>.tsx
export default function XShell() {
  const params = useLocalSearchParams();
  const scalars = parse(params); // Number()/string extraction at boundary
  useEffect(() => {
    useUiStore.getState().openX(scalars);
    return () => useUiStore.getState().closeX();
  }, [scalars.a, scalars.b, scalars.c]); // ← C1: depend on SCALAR PARAMS, not []
  return <XBody/>; // existing component body, de-chromed (§5)
}
```

---

## 3. ui-store strategy — UNCHANGED (store as source of truth)

No member removed; no `editPreFill` split. All `openX`/`closeX` actions survive and are now invoked **from the shells** (and from body→body sibling-swaps, see §4) instead of directly from consumer screens. KidSwitch state (`kidSwitchDrawerOpen`/`openKidSwitch`/`closeKidSwitch`) unchanged and still host-driven. `closeX` actions are idempotent constant-sets (`ui-store.ts:85,90,97,101`), so the swipe-dismiss→cleanup `closeX` double-call is safe.

---

## 4. Call-site change list (N1 — authoritative; flip ALL)

**Host callers → `router.push`:**
| File:line | After |
|---|---|
| `app/(tabs)/index.tsx:166` | `router.push({pathname:'/event/detail', params:{scheduleId:String(occ.scheduleId), occurrenceDate: currentDate}})` |
| `app/(tabs)/index.tsx:174` | `router.push({pathname:'/schedule/edit', params:{mode:'create', date: currentDate}})` |
| `app/(tabs)/index.tsx:182` | `router.push('/calendar')` |
| `app/(tabs)/index.tsx:186` | `router.push('/search')` |
| `app/multi.tsx:213` | `router.push({pathname:'/schedule/edit', params:{mode:'create', date: anchorDate}})` |
| `app/multi.tsx:225` | `router.push('/calendar')` |
| `app/multi.tsx:229` | `router.push('/search')` |
| `app/child/[id].tsx:152` | `router.push({pathname:'/schedule/edit', params:{mode:'create', childId:String(childId), date}})` |
| `app/child/[id].tsx:158` | `router.push({pathname:'/event/detail', params:{scheduleId:String(e.scheduleId), occurrenceDate: e.date}})` |
| `app/child/[id].tsx:207` | `onPress={() => router.push('/calendar')}` |
| `app/child/[id].tsx:221` | `onPress={() => router.push('/search')}` |
| `app/child/[id].tsx:235` | **UNCHANGED** — `openKidSwitch()` (KidSwitch stays RN Modal host sheet) |
| `app/child/[id].tsx:273` | **UNCHANGED** — `<KidSwitchDrawer onPick=.../>` |

**Body→body cross-sheet (back()+push sibling-swap rule §7):**
| File:line | After |
|---|---|
| `EventDetailDrawer.tsx:113` (editOccurrence) | `router.back(); router.push({pathname:'/schedule/edit', params:{mode:'editOccurrence', scheduleId, occurrenceDate}})` |
| `EventDetailDrawer.tsx:122` (editAll) | `router.back(); router.push({pathname:'/schedule/edit', params:{mode:'editAll', scheduleId}})` |
| `SearchDrawer.tsx:141,162` (select result) | `router.back(); router.push({pathname:'/event/detail', params:{...}})` |
| `ScheduleEditSheet.tsx:365` (in-place switch) | `router.setParams({mode:'editOccurrence', occurrenceDate})` — shell effect (C1 deps) re-drives `openEditSheet`; no remount, no second sheet |
| all body `closeX()`/`onRequestClose`/backdrop | `router.back()` (store `closeX` fires from shell unmount cleanup) |

---

## 5. Per-component Modal teardown (C1-layout) + S7

Removing the outer `<Modal>` also requires: drop `<Pressable styles.backdrop>` (native scrim replaces), `styles.handle`/`handleArea` (native grabber via `sheetGrabberVisible`), and `position/top/bottom/borderTopRadius` from `styles.sheet`; reconcile KAV.

**KAV:** `behavior={Platform.OS === 'ios' ? undefined : 'height'}` — iOS native formSheet insets the keyboard itself (avoids double-lift); Android (plain modal) keeps `'height'`.

**`ScheduleEditSheet.tsx:385-432` before→after:** delete `<Modal>` + backdrop Pressable + handleArea; `styles.sheet`→`styles.sheetBody = {flex:1, backgroundColor:TOKENS.surfaceWarm}`; 취소/onRequestClose/backdrop→`router.back()`; keep the 취소 header button.
**`EventDetailDrawer.tsx:172-205` before→after:** same teardown; `styles.sheet`→`styles.sheetBody {flex:1}`; **keep `DetailBody` exported + Modal-free** so its test mounts it directly. Calendar (`:166-174`) + Search (`:176-187`) get identical teardown; Search compact-vs-tall → the two-detent `[0.5,0.85]`.

**S7 (UNKNOWN — device gate, condition #2):** Do NOT swap to `BottomSheetScrollView` (no gorhom). The hypothesis is that `react-native-screens`' formSheet host coordinates the native sheet pan with the inner `UIScrollView` (top-edge downward pan dismisses; mid-scroll scrolls) — BUT this is unverified given (a) KAV frame translation when keyboard is up and (b) app-wide `GestureHandlerRootView` (`_layout.tsx:180`, RNGH `Swipeable` already used in `TodoSection.tsx:3`) contending for the drag. **Hard gate:** device-verify on `ScheduleEditSheet` with keyboard raised, tall + short form, for all three scrolling bodies (`ScheduleEditSheet.tsx:432`, `EventDetailDrawer.tsx:211`, `SearchDrawer.tsx:191`). If dismiss-vs-scroll misbehaves, switch that body's scroll to **`react-native-gesture-handler`'s `ScrollView`** (existing dep) — treat this as a likely-common path on the edit sheet, not a rare fallback.

---

## 6. Migration order (pilot = Calendar; ScheduleEditSheet last)

Each step ends green: existing tests pass **unchanged**, `tsc --noEmit` (Stop hook), `eslint` (per-edit hook), manual smoke + **amatta-v1 visual-verdict** of the touched surface. Commit per step.

- **Step 0 — Scaffolding (no behavior change):** register 4 `<Stack.Screen>` + flip `schedule/edit` modal→formSheet (`_layout.tsx:198`); add reusable `useModalRouteShell(openFn, closeFn, scalars)` (mount/param→open, unmount→close; **scalar-param deps, C1**). Leave global mounts. *Accept:* `tsc` green; app identical.
- **Step 1 — PILOT `CalendarDrawer`→`app/calendar/index.tsx`:** shell + de-chrome; `handlePickDate`→`setCurrentDate(...); router.back()`. Flip callers `index.tsx:182`/`multi.tsx:225`/`child/[id].tsx:207`; remove `_layout.tsx:217`. **Delete dead gorhom mock `CalendarDrawer.test.tsx:10`**, run test. *Accept:* `CalendarDrawer.test.tsx` green unchanged (post-mock-removal); native recede+grabber iOS; pick lands right day; visual-verdict passes.
- **Step 2 — `SearchDrawer`→`app/search/index.tsx`:** two detents; KAV reconcile; **delete dead gorhom mock `SearchDrawer.test.tsx:5`**, run test. Result-tap rewired in Step 3. Flip `index.tsx:186`/`multi.tsx:229`/`child/[id].tsx:221`; remove `_layout.tsx:218`. *Accept:* test green; keyboard + clear-on-close intact; S7 pan test passes.
- **Step 3 — `EventDetailDrawer`→`app/event/detail.tsx`:** params `scheduleId`/`occurrenceDate`; `closeDetail→router.back()`; 수정→`router.back()+push(edit)`; keep deleted-schedule guard; keep `DetailBody` exported. **Delete dead gorhom mock `EventDetailDrawer.test.tsx:7-29`**, run test. Rewire Search result-tap (`SearchDrawer.tsx:141,162`). Flip `index.tsx:166`/`child/[id].tsx:158`; remove `_layout.tsx:219`. *Accept:* test green post-mock-removal; block-tap→detail; 수정→edit; mutations fire; deletion no-crash.
- **Step 4 — `ScheduleEditSheet`→`app/schedule/edit.tsx` (LAST):** rewrite bounce-stub to render de-chromed body; shell reconstructs `openEditSheet(mode,{scheduleId,occurrenceDate,preFill:{childId,date}})` from params (**C1 scalar deps**); `handleSwitchToOccurrenceMode`→`router.setParams`. **R1: inline the iOS picker** (replace nested `<Modal>` at `:1074` with an inline card inside the body, iOS only); **Android dialog branch `:1056` UNTOUCHED**. KAV reconcile. Flip `index.tsx:174`/`multi.tsx:213`/`child/[id].tsx:152`; remove `_layout.tsx:216`. *Accept:* full create/editAll/editOccurrence matrix; picker inline iOS / dialog Android; checklist diff; **S7 keyboard-raised device gate**; visual-verdict.
- **Step 5 — Cleanup + docs:** `_layout.tsx` has zero global sheet mounts (KidSwitch host mount remains); grep `openCalendar|openSearch|openEventDetail|openEditSheet` → hits only inside shells (+ KidSwitch). Fix stale CLAUDE.md "SDK ~52"→54; add one-line *Locked Decisions* note; record in Phase 3/4 rework doc.

---

## 7. Back-stack — ONE rule
- Open: `router.push(route)`. Dismiss: `router.back()`. Sheet→sibling sheet (EventDetail→Edit, Search→Detail): `router.back()` **then** `router.push(target)` — preserves the one-sheet-at-a-time invariant the store already enforces (`EventDetailDrawer.tsx:112-122`).

---

## 8. Risks + verification
- **R-C1 (highest)** shell effect `[]` instead of scalar-param deps → editAll→editOccurrence silently won't re-drive. Mitigated by §2/§6-Step0 pattern.
- **S7** native pan vs RNGH/KAV contention → device gate + RNGH `ScrollView` fallback (condition #2).
- **R1** iOS picker inline (no nested Modal in formSheet); Android dialog untouched.
- **R-desync** shell↔store → shared effect + idempotent `closeX`; covered by swipe-dismiss manual tests.
- **Android delta** no detents/recede → accepted, documented.
- **Backdrop-tap on unsaved edits**: no unsaved-edit guard in EITHER model → not a regression (note only).

**Automated gates:** existing `CalendarDrawer/SearchDrawer/EventDetailDrawer` + `edit-sheet-form` tests pass UNCHANGED (after dead-mock deletion + re-run); `tsc --noEmit` (watch `noUncheckedIndexedAccess` at `Number(params.x)` boundaries); `eslint --fix`; per-component amatta-v1 visual-verdict.

**Manual checklist (iOS device + 1 Android pass):** create (3 entry points, preFill correct) · editAll (hydrate, save, 전체삭제, in-place→editOccurrence no double sheet) · editOccurrence (override → applyException, 이회차삭제) · picker (iOS inline / Android dialog) · EventDetail (block tap, 수정, 취소/삭제, delete-no-crash) · Calendar (anchor, pick lands, dismiss-no-change) · Search (results, tap→detail, keyboard, empty-on-reopen) · KidSwitch unchanged (RN Modal, lane swap via setParams) · S7 pan (every scrolling body, keyboard raised) · cross-cutting (iOS recede+grabber, Android plain modal, hardware back, Search→Detail→Edit never stacks two routes, relaunch mid-sheet).

---

## Open Questions (visual-verdict / device gates)
1. Per-route detent heights vs amatta-v1 (`edit ~0.92`, `detail ~0.85`, `calendar ~0.5`, `search [0.5,0.85]`).
2. iOS inline-picker layout (anchored card vs pushed-up row) vs `app-event-form.jsx`.
3. S7 device outcome on ScheduleEditSheet keyboard-raised → confirm native coordination or adopt RNGH `ScrollView`.
4. KAV-disabled-on-iOS: confirm bottom fields (메모/준비물) reachable above keyboard at the chosen detent.
