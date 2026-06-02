# Spec — v2 UI batch: PickupCarousel + 준비물&할일 tab + pickup dot

> **Goal**: surface the v2 data layer in the daily view UI by porting
> `docs/design/amatta-v1/app-daily-b.jsx`'s PickupCarousel + TodoB +
> pickup-dot details, swapping the prototype's mock `KIDS/SCHEDULE/TODOS/TASKS`
> for our Zustand stores. **No data layer changes.** Data already lives
> in `useSchedulesStore` (needsPickup), `useChecklistStore`, `useTodosStore`,
> `usePickupLogStore` (shipped in commit `0ceb7e7`).
>
> **Status**: ready for team execution
> **Author**: team-lead (orchestrator), 2026-06-02
> **Sources**:
> - `.omc/specs/v2-schema-migration.md` (data contract, complete)
> - `docs/design/amatta-v1/app-daily-b.jsx` lines 60–61 (`<PickupCarousel/>`), 100–104 (tab switch + TodoB), 314–453 (PickupCarousel + PickupCard), 483–637 (ScheduleB pickup dot), 639–807 (TodoB)
> - `docs/architecture/ADR-002-prep-todos-pickup.md` §Decision (UI intent for each entity)
> - `docs/architecture/ADR-003-*.md` (pickup carousel single-position, conflict cards = additional carousel entries)

---

## 1. Scope

### In scope
- **NEW** `src/ui/daily/PickupCarousel.tsx` — top-of-screen banner, horizontal swipe between cards.
- **NEW** `src/ui/daily/PickupCard.tsx` — individual card (Sunset Orange or French Lavender bg per index).
- **NEW** `src/ui/daily/CartoonCar.tsx` — RN-rendered car illustration. Uses `@expo/vector-icons` (Expo Go constraint — no SVG). MaterialCommunityIcons "car-side" with size 40 sits in the trailing slot.
- **NEW** `src/ui/daily/TodoTabContent.tsx` — top-level routing inside the `tab === 'todo'` branch. Renders ChecklistSection + TodoSection.
- **NEW** `src/ui/daily/ChecklistSection.tsx` — 준비물 section. Lists today's schedules whose `needsPickup=true` (or schedules that have ChecklistItems — doc note). Grouped by kid, each row: checkbox + label + due-time pill.
- **NEW** `src/ui/daily/TodoSection.tsx` — 할일 section. Flat list sorted by `dueAt ASC`, parent-level (childId=null) + per-kid. Inline add row at the bottom.
- **MODIFY** `app/(tabs)/index.tsx`:
  - mount `<PickupCarousel/>` between TopBar and TabStrip (matches prototype line 62).
  - replace `v1.1에서 출시 예정` placeholder with `<TodoTabContent/>` in the `tab === 'todo'` branch.
- **MODIFY** `src/domain/occurrences.ts` — propagate `needsPickup` from source `Schedule` into produced `Occurrence`. Spec §3.
- **MODIFY** `src/domain/types.ts` — extend `Occurrence` with `needsPickup: boolean`.
- **MODIFY** `src/ui/daily/ScheduleGrid.tsx` (`ScheduleBlockDaily`) — render the 7px pickup dot in the title row when `occ.needsPickup === true`. Use `TOKENS.primary` color, white inset ring via 2px white border or shadow.

### Out of scope (later batches)
- Drawers (Calendar / Search / NewEvent / EventDetail) — batch D.
- Settings + weekly + onboarding rebuilds — batch D.
- Notifications (ChecklistItem prepend to push body, Todo dueAt push) — batch E.

---

## 2. Pickup carousel — detailed contract

### 2.1 Data derivation (`src/ui/daily/pickup-data.ts` — helper module)

Compute the list of "next pickup" cards for the currently-viewed date:

```ts
import type { Occurrence, SchedulePickupLog } from '../../domain/types';
import { todayIso } from '../utils/date';

export interface PickupCardData {
  scheduleId: number;
  occurrenceDate: ISODate;
  occurrenceDateInt: number;  // yyyymmdd
  time: string;          // "오후 3:30" via fmtKoTime
  timeShort: string;     // "3:30" — used in pill
  who: string;           // 자녀 name
  what: string;          // 일정 title (schedule.title)
  etaText: string;       // "1시간 10분" — diff between now and start
  childColorIndex: ColorIndex;
}

export function computePickupCards(
  occurrences: Occurrence[],
  pickupLogIsComplete: (scheduleId: number, occurrenceDateInt: number) => boolean,
  childrenById: Map<number, Child>,
  nowMinutes: number,
  currentDate: ISODate,
): PickupCardData[];
```

Logic:
1. Filter `occurrences` to those with `needsPickup === true`.
2. For each, compute `occurrenceDateInt = isoToYyyymmdd(occurrence.date)`.
3. Drop occurrences already marked complete: `pickupLogIsComplete(scheduleId, occurrenceDateInt)`.
4. Drop occurrences in the past for today (`endMinutes < nowMinutes` on `currentDate === today`).
5. Sort by `(date, endMinutes)` ASC — soonest pickup first. (Pickup happens at `endMinutes` — that's when kid is done and needs picking up.)
6. Cap at first 4 (matches MAX_CHILDREN; multi-pickup conflict shows up to 4 cards).

If `currentDate !== today`: still render but ETA caption switches to "예정" since we can't compute time-from-now for past/future dates. Or simpler: only render carousel when `currentDate === today`. **Decision: render only when today.** Other dates show an empty area where the carousel would sit (matches "no carousel" branch in prototype when `PICKUPS.length === 0`).

### 2.2 Carousel UI (`PickupCarousel.tsx`)

Prototype reference: `app-daily-b.jsx` lines 314–373.

- Outer container: `paddingHorizontal: 14, paddingVertical: 6`.
- Inner: `overflow: 'hidden', borderRadius: 18`.
- Use **RN `ScrollView` horizontal pagingEnabled** instead of the prototype's pointer-drag math. Easier to reliably implement in RN; native paging snap = same visual effect.
- Cards stacked horizontally, each `flex: 0 0 100%, minWidth: 0` (matches prototype).
- Hidden scroll indicator. Track scroll offset → derived `activeIdx` for dots.
- Dots indicator: only render when `cards.length > 1`. Position `absolute, bottom: 4, left: 0, right: 0`. Active dot 10x3 white, inactive 3x3 0.5 opacity white. `gap: 3`. `borderRadius: 99`. Animated width transition with Reanimated (or just immediate change — animation optional).
- Render no carousel block when `cards.length === 0` (today and no pickups, or non-today).

### 2.3 PickupCard (`PickupCard.tsx`)

Prototype reference: lines 375–453.

- Variant 1 (first card): bg = `TOKENS.primary` Sunset Orange.
- Variant 2 (second+ card): bg = `'#D4B4FA'` French Lavender (per ADR-003 §A locked).
- Variant 3+ (rare): cycle through `[orange, lavender]`. Conflict rendering policy per ADR-003 §C consequences.
- Luminance-based text color: if bg luminance > 0.65, use ink black; else white. Same formula as prototype (line 17–22).
- Layout: `flex: 0 0 100%, padding: 6/14/10, borderRadius: 14, flexDirection: row, alignItems: center, gap: 8, minHeight: 44`.
- Subtle road line: `position: absolute, left/right/0, bottom: 6, height: 2`, color = on-bg with 0.10-0.18 opacity (matches prototype).
- Text block (flex 1):
  - Eyebrow: `NEXT PICKUP · {etaText}` — `fontSize: 10, fontWeight: 500, letterSpacing: 0.8, uppercase, fontFamily: Geist Mono`. With a 6px pulsating dot prefix (skip pulse animation in v1 to reduce complexity; static dot OK).
  - Title row: `{timeShort} {who} · {what}` — `fontFamily: Pretendard SemiBold, fontSize: 14`. Truncate.
- Trailing slot: `<CartoonCar/>` component, 68x40.

### 2.4 CartoonCar (`CartoonCar.tsx`)

Prototype is a hand-drawn SVG (~200 lines). For Expo Go we cannot use react-native-svg. **Use `MaterialCommunityIcons "car-side"` from `@expo/vector-icons` at size 40, color = on-bg (white or ink).** Document `// TODO(eas-dev-build): replace with the hand-drawn SVG from amatta-v1 once react-native-svg works`.

---

## 3. Occurrence.needsPickup propagation

### 3.1 Type extension (`src/domain/types.ts`)

```ts
export interface Occurrence {
  // ... existing fields ...
  needsPickup: boolean;  // ← NEW
}
```

### 3.2 expandOccurrences extension (`src/domain/occurrences.ts`)

In the per-schedule per-date loop, when building each Occurrence object, set `needsPickup: schedule.needsPickup`. One-line addition inside the existing factory.

### 3.3 Test extensions

- `tests/domain/occurrences.test.ts` — add 1 case verifying `Occurrence.needsPickup` matches source `Schedule.needsPickup`.
- Existing tests still pass (the new field is non-breaking).

---

## 4. ScheduleBlock pickup dot

### 4.1 Render

`src/ui/daily/ScheduleGrid.tsx` `ScheduleBlockDaily` — in the title row, after the title `<Text>`, conditionally render a 7px round dot when `occ.needsPickup === true`:

```tsx
{occ.needsPickup ? (
  <View style={styles.pickupDot} />
) : null}
```

Style:
```ts
pickupDot: {
  width: 7,
  height: 7,
  borderRadius: 9999,
  backgroundColor: TOKENS.primary,
  marginLeft: 4,
  // 2px white ring via outline shadow — but RN can't do outline shadow,
  // so use a wrapper View with white bg + 2px padding via larger borderRadius.
  // Simpler: skip the ring; the dot directly on the pastel block-bg already
  // reads clearly because the bg is so light.
},
```

Note: prototype uses `boxShadow: 0 0 0 2px pal.block` as an inset ring; RN
approximation = wrap dot in a 11×11 View with the kid's bg color (already
matches block bg) + 2px padding to inset the inner 7px primary dot. Document.

### 4.2 No test needed for the dot — visual only. Existing block render tests
remain compatible.

---

## 5. Todo tab content — detailed contract

### 5.1 Layout (`TodoTabContent.tsx`)

Prototype reference: `app-daily-b.jsx` lines 639–807 `TodoB`.

Outer: `flex: 1, padding: '4/14/100', background: '#F7F6F5', fontFamily: Pretendard`. ScrollView for the whole tab.

Sections rendered top-to-bottom:
1. `<ChecklistSection/>` (준비물)
2. `<TodoSection/>` (할일)

### 5.2 ChecklistSection (`ChecklistSection.tsx`)

Prototype reference: lines 678–738.

Data derivation:
- From `useChildrenStore` get children.
- From `useChecklistStore` get items grouped by scheduleId.
- From `useSchedulesStore` get schedules (filter to schedules with needsPickup OR with at least one checklist item — keep as is for now: show all schedules that have items).
- Group by kid: `kids.map(kid => ({ kid, items: <flatten all checklist items across kid's schedules, sorted by sort_order> }))`.
- Optionally filter to today's schedules only — yes, since 준비물 is "오늘 챙길 것". Use `expandOccurrences(..., today)` and only include schedules whose IDs appear in today's occurrences.

UI:
- Section header (`SectionHeader` helper inside the file):
  - "준비물" `fontSize: 16, weight: 600`
  - "done/total" caption `11/400/inkSub`
- White rounded card container `bg: #fff, borderRadius: 18, padding: 6, marginBottom: 16`.
- Per kid (if items > 0): kid row with avatar (KidAvatar 30) + name (`13/700/ink`) + remaining caption (`10/inkSub`, "N/M 남음").
- Item rows: `flexDirection: row, padding: 7/10, borderRadius: 12, gap: 10`.
  - Checkbox: 22×22, borderRadius 99. When done: bg = `pal.dot` (kid color), border = pal.dot, inner check icon white. When undone: bg = white, border = ink-30, no inner.
  - Label: `13/400/ink letterSpacing: -0.2`. Strike-through when done.
  - Due-time pill (optional, when item has associated time): `10/inkSub, bg: ink-04, padding: '2px 7px', borderRadius: 99`. ChecklistItem schema has no due time directly — derive from parent schedule's `endMinutes` formatted as `hh:mm`.

- Between kids: horizontal divider (`borderTop: 1px solid hair, margin: 4/8`).

- Tap a row: dispatch `useChecklistStore.getState().toggleDone(db, itemId)`.

### 5.3 TodoSection (`TodoSection.tsx`)

Prototype reference: lines 741–805.

Data:
- `useTodosStore` → flat Todo[] sorted by dueAt ASC.
- Show ALL todos (both parent-level and per-kid). Sort by dueAt ASC.

UI:
- Section header: "할일" + "done/total" caption.
- White rounded card container same as ChecklistSection.
- Todo rows: similar to checklist but no kid avatar grouping (todos can be parent-level). Optional: if `todo.childId !== null`, show kid avatar 18 inline. Else just the row.
  - Checkbox: 22×22 same shape. When done: bg = `TOKENS.primary` Sunset Orange. Border = primary. Inner check icon white.
  - Title: `13/400/ink, letterSpacing: -0.2`. Strike when done.
  - Due caption: `10/inkSub, bg: ink-04, padding: '2/7', borderRadius: 99`. Format dueAt → "5/8" via small helper, or "내일", "오늘", "MM/DD" depending on relative.

- Inline add row at the bottom:
  - Tappable area that toggles `adding` state.
  - When `adding === false`: dashed-border 22×22 plus icon + "할일 추가" caption.
  - When `adding === true`: focused TextInput where user types title + Enter to commit. Commit creates a Todo with `childId: null, title: trimmed, dueAt: Date.now() + 24h, notifyMinutesBefore: null`. Default due is today + 24h; user can edit later.

- Tap an existing row: dispatch `toggleDone(db, id)`.

### 5.4 Section helper file scope

Both sections may live in their own files (recommended) OR co-located with `TodoTabContent.tsx`. Decide based on file size. **Recommendation: separate files.** Easier code review.

---

## 6. app/(tabs)/index.tsx wiring

### 6.1 PickupCarousel mount

Currently: TopBar → (TabStrip → grid OR todo placeholder). After: TopBar → PickupCarousel → TabStrip → (...).

```tsx
<TopBar ... />
<PickupCarousel
  occurrences={occurrences}
  childrenById={childrenById}
  nowMinutes={nowMinutes}
  currentDate={currentDate}
/>
<TabStrip ... />
```

PickupCarousel internally short-circuits to render nothing when `cards.length === 0`. So when no pickup today, the carousel area has zero height (TopBar abuts TabStrip — matches prototype's behavior when PICKUPS=[]).

### 6.2 Todo tab replacement

Currently `tab === 'todo'` renders `<View><Text>v1.1에서 출시 예정</Text></View>`. Replace with `<TodoTabContent/>`. TodoTabContent self-contained — derives its own data via Zustand selectors.

### 6.3 TabStrip propagation

`TabStrip` already takes `todoCount={0}` placeholder. Update:

```tsx
const todoCount =
  useTodosStore((s) => s.todos.filter((t) => !t.isDone).length) +
  useChecklistStore((s) => /* count undone items today */);
```

Show the actual count badge in the tab. This is a small derived computation — keep in `app/(tabs)/index.tsx` rather than inside TabStrip (TabStrip stays pure).

---

## 7. Tests

### 7.1 Pickup data helper

`tests/ui/daily/pickup-data.test.ts`:
- Empty occurrences → empty cards.
- 1 occurrence needsPickup, not in log → 1 card.
- 1 occurrence needsPickup, completed in log → 0 cards.
- 2 occurrences same end time, both needsPickup → 2 cards sorted by scheduleId tiebreaker.
- Past occurrence (endMinutes < nowMinutes on today) → dropped.
- Cap at 4.

### 7.2 PickupCarousel render

`tests/ui/daily/PickupCarousel.test.tsx`:
- 0 cards → renders empty (`height === 0` or absent).
- 1 card → renders 1 PickupCard, no dots.
- 3 cards → renders 3 PickupCards, 3 dots.

### 7.3 ChecklistSection / TodoSection

`tests/ui/daily/ChecklistSection.test.tsx` and `TodoSection.test.tsx`:
- 0 items / 0 todos → empty section header with 0/0.
- Some items → renders checkbox + label rows.
- Tap a checkbox → calls toggleDone with correct id (mock the store).

### 7.4 Occurrence.needsPickup

`tests/domain/occurrences.test.ts` — extend with `needsPickup` propagation case.

Total expected new tests: ~20.

---

## 8. Team execution plan

3 workers, 2 stages:

### Stage 1 — parallel

- **worker-pickup-domain** (`schedule-domain-expert`):
  - Files: `src/domain/types.ts` (add `Occurrence.needsPickup`), `src/domain/occurrences.ts` (propagate). `tests/domain/occurrences.test.ts` (extend).
  - Smallest task; finishes fastest.

- **worker-pickup-ui** (`oh-my-claudecode:executor` opus):
  - Files: `src/ui/daily/pickup-data.ts`, `PickupCarousel.tsx`, `PickupCard.tsx`, `CartoonCar.tsx`.
  - Tests: `pickup-data.test.ts`, `PickupCarousel.test.tsx`.
  - Doesn't need `Occurrence.needsPickup` to be set yet — accepts any Occurrence-shaped array (the helper checks the field defensively).

- **worker-todo-tab** (`oh-my-claudecode:executor` opus):
  - Files: `src/ui/daily/TodoTabContent.tsx`, `ChecklistSection.tsx`, `TodoSection.tsx`.
  - Tests: `ChecklistSection.test.tsx`, `TodoSection.test.tsx`.
  - Independent of pickup work.

### Stage 2 — depends on Stage 1

- **worker-integration** (`oh-my-claudecode:executor` opus):
  - Files: `app/(tabs)/index.tsx` (mount carousel + todo tab content + todo count badge), `src/ui/daily/ScheduleGrid.tsx` (pickup dot in title row).
  - Tests: `tests/ui/daily/ScheduleGrid.test.tsx` extension for pickup dot (if such a test file exists; otherwise just confirm visual via worker report).

### Stage 3 — verify (orchestrator)

```
export EXPO_NO_TELEMETRY=1
npx tsc --noEmit
npx eslint .
npx jest
```

Expected: 311 baseline + ~20 new ≈ 331 tests.

---

## 9. Acceptance gate

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx eslint .` → 0 new errors/warnings (1 pre-existing + 2 OK)
- [ ] `npx jest` → all green, expect ~331 tests
- [ ] Phone hot-reload: today (2026-06-02 Tue) seed shows...
  - No pickup card on the carousel (Tue has no needsPickup schedules — needsPickup=1 are schedules 3 [Sat], 6 [Sat], 8 [Wed]). Empty carousel area = zero height.
  - Swipe to Wed (2026-06-03) → carousel shows 1 card: 도윤 발레 17:00–18:00 needs pickup at 6:00 PM.
  - Swipe to Sat (2026-06-06) → carousel shows 2 cards: 민준 수영 (Sunset Orange) + 서연 미술학원 (French Lavender), conflict via separate cards per ADR-003.
- [ ] Tap 준비물 & 할일 tab → ChecklistSection + TodoSection render. 4 todos visible.
- [ ] Schedule blocks for 민준수영/서연미술/도윤발레 show 7px pickup dot in title row when on respective days.

---

## 10. Explicitly NOT in this batch

- No drawer ports (calendar / search / new-event / event-detail). Batch D.
- No weekly drilldown rebuild. Batch D.
- No settings rebuild. Batch D.
- No notification body prepend (ChecklistItem auto-summary). Batch E.
- No pulse animation on the NEXT PICKUP dot (static OK).
- No CartoonCar SVG port (uses @expo/vector-icons fallback). EAS dev build.
- No checklist add/edit UI (existing edit-sheet remains the create path; this batch only renders + toggles existing items). Inline add UI inside the daily-view tab is OUT of scope (no `inline add` for checklist). Inline ADD is only on TodoSection.
- ScheduleBlock pickup dot's "white 2px outline ring" — RN limitation; v1 ships without ring (dot directly on pastel bg reads clearly). Marked TODO.
