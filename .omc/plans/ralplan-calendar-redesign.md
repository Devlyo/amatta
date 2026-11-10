# ralplan — 캘린더 개편 (ADR-007) + UI 정리·통일

- **Mode**: ralplan (Planner → Architect → Critic). **Status: v2 Accepted** — Architect/Critic APPROVE-WITH-REVISIONS 반영(§7), 오너 결정(§7-D, §7-E). 2026-11-10 "0단계부터 시작" 신호.
- **Date**: 2026-11-10
- **Scope**: 계획 + ADR만. 코드는 검토 승인 후 "Phase N 가자"/"이제 코드 시작" 신호에서 시작.
- **Decision record**: `docs/architecture/ADR-007-calendar-redesign.md`
- **Design source**: 캔버스 https://claude.ai/artifact/7378YLCUUr4pMf7SgDfybx (보드 1·2·3, 1-1·2-1·3-1, 5, 6). 보드 4(고정 일정)는 이번 범위 밖.
- **Baseline**: `main` @ `b42b7c7` (버그 2건 수정 + 미사용 코드 정리 반영).

---

## 0. 현재 코드 사실 (계획의 근거)

1. 캘린더 화면이 3개 라우트로 흩어져 있다: `app/(tabs)/index.tsx`(일간, `ScheduleGrid`), `app/child/[id].tsx`(자녀 1명 주간, `WeeklyGrid`), `app/multi.tsx`(전체 주간, `MultiKidGrid`). 진입: 일간 `ViewToggle` WEEK → `/multi`, 자녀 알약 → `/child/[id]`, 주간에서 자녀 전환 → `/kid-switch`.
2. 그리드 3종이 시간 상수·NOW 라인·스크롤 로직을 각자 복제(`TOTAL_SLOTS` 2곳, 공통 줄 92줄 등). 축은 셋 다 06–25시(`constants.ts:23`, `MultiKidGrid.tsx:32-33`)이고 **시간당 높이만 다름**(56 vs 64px). CLAUDE.md의 "06:00–23:00"은 이미 코드와 불일치.
3. 겹침 레이아웃 순수 함수는 `layoutWeek`(`src/domain/grid.ts`)만 있고 계단식 포개기는 없음.
4. `src/ui/components` 프리미티브 13종은 **dev-gallery 외 사용처 0**. 실제 화면은 각자 Pill/DayCircle/Toggle/Row/Group/SectionHeader/Divider/Card/DetailTopBar를 재구현(SectionHeader 6벌, DetailTopBar 2벌 등).
5. 리터럴: `fontSize` 숫자 160여 곳(16/12/14가 대부분), `borderRadius` 숫자 37곳(14가 11곳, 18이 7곳). `TYPE` 토큰은 `components/Input.tsx` 외 사용 0곳. `radius.ts:3`·`docs/design/README.md §8`은 "14/18→12/16 귀착" 규칙 — `box:14` 채택 시 개정 필요.
6. 일정 스키마: `start_minutes`/`end_minutes` 필수, `notify_minutes_before` 1개. 하루 종일·종료 전 알림 없음. 최신 마이그레이션 v7.
7. 알림: `rescheduleAll` 직렬화·병합(invariant 5), 가까운 순 60개 상한.
8. `ScheduleEditSheet.tsx` 1,739줄 — 폼 상태·검증(`edit-sheet-form.ts`)·준비물 diff 저장 로직과 UI가 한 파일.

---

## 1. Phases

각 Phase 끝: `tsc` · `eslint` · `jest` 통과 + 실기기(dev client) 확인. Phase 단위 커밋/브랜치.

### Phase 0 — 기반 (토큰·프리미티브 계약)
- **시작 시 `git tag ui-v1`** (현 디자인 보존 — Phase 2부터 화면이 바뀌므로 여기서).
- `palette.ts`: `KidPalette`에 `deep` 추가(6색 전부, 3색 미정 → OQ5). 보호자 회색 세트(`guardian.{bg,deep}`) 추가. NOW/오늘 색 토큰 `now = primary` 로 의미 정리.
- `radius.ts`: `box: 14` 추가(앱 기본 카드/그룹). 기존 14/18 리터럴의 귀착 규칙 확정.
- `palette.ts`: 시스템 화면 바탕 `groupedBg = #F2F1EF` 추가, `surfaceSoft`(#F7F6F5) 사용처를 이 값으로 통합(ADR-007 §7-1).
- `typography.ts`: 실제 쓰는 크기(17/16/15/14/13/12/11)에 맞춰 프리셋 재정의 — iOS 계열(본문 17, 보조 15, 캡션 13·12).
- 시간 포맷 헬퍼 `fmtRange(start,end)` → `3–4PM` 규칙(+ 단위 테스트).
- **산출물**: 토큰 diff + dev-gallery 갱신. 화면 변경 없음.

### Phase 1 — 겹침 레이아웃·시간 그리드 공통화 (도메인 우선)
- `src/domain/layout.ts`: `layoutCascade(items, keyOf)` — 같은 열의 시간 겹침에 대해 "겹치는 앞 항목이 쓰지 않는 가장 왼쪽 레벨" 배정. 순수 함수 + 테스트(무겹침/2·3중/연쇄/동시 시작/하루 종일 제외).
- 공통 `TimeGrid`(시간 눈금 `9 AM`, 가로·세로선, NOW 선·점·알약, 스크롤 초기 위치) 하나로 통합. 시간 축 상수 1벌로 통일(현재 06–25시 유지, OQ로 재검토 가능).
- `TimeBlock`(60% 바탕·1.5px 막대·흰 외곽선·제목/시간 표기·픽업 점·집중 모드 투명도) 하나.

### Phase 2 — 캘린더 셸 + 일간
- 탭 구조: `(tabs)/calendar`(기본), `(tabs)/todo`, `(tabs)/settings`. 플로팅 독 = 3탭 + 라벨, `+` 제거. 새 아이콘 2개(@expo/vector-icons 또는 svg — 기존 A-ICONS 규칙 준수).
- `ui-store`: `calendarView: 'day'|'week'|'month'`(기본 day), `focusKidKey: number|'guardian'|null`.
- `CalendarTopBar`(제목·날짜 선택·보기 세그먼트 아이콘·검색·빨간 `+`), `KidFilterBar`(알약 4칸, 집중 모드).
- 일간: 날짜 줄(일~토) + 자녀 열 + (Phase 5 전까지 빈) 보호자 열. 픽업 캐러셀 숨김(코드 유지).
- 날짜 스와이프·NOW 실시간(ADR-003 B) 유지.

### Phase 3 — 주간·월간
- 주간: `TimeGrid` + 7열 + `layoutCascade`(날짜 단위) + 고정 일정 일반 블록화. 오늘 열 연한 주황.
- 월간: 신규 `MonthGrid`(일정 띠 60%·막대 없음·시작 시간순, 고정 일정 숨김, 넘치면 마지막 자리 `+N`).
- **핀치 확대**(react-native-gesture-handler `Gesture.Pinch`, 두 단계 스냅 — 연속 배율 아님):
  - 월간: 칸 높이 104→136, 띠 2줄(제목 `…` + 시작 시간 `4PM`), 칸당 띠 4→3개, 세로 스크롤.
  - 주간: 7일 → **4일**(오늘부터) + 좌우 페이징, 블록에 시간 줄 추가.
  - 확대 상태는 `ui-store`(보기별), 세션 동안 유지. 핀치와 날짜 스와이프·세로 스크롤 제스처 충돌 처리(`Gesture.Simultaneous`/`Exclusive`) 실기기 확인.
  - 순수 함수: `monthCellChips(list, limit)`(+N 규칙), `visibleWeekDays(anchor, zoom)` 테스트.
- 날짜 탭 → 해당 날짜 일간으로 이동.
- `app/multi.tsx`, `app/child/[id].tsx`, `app/kid-switch.tsx` 및 연결 라우트 제거(§2 인벤토리).

### Phase 4 — 새 일정 화면 + 데이터 확장
- 마이그레이션 **v8**: `schedules.all_day`, `schedules.notify_end_minutes_before` (additive, 원자성 테스트 — expo-sqlite-migrator 규칙).
- 도메인/리포/스토어/내보내기(스키마 v5) 반영. occurrence 확장은 하루 종일을 시간 축 밖으로.
- 폼 재작성: `ScheduleEditSheet` → 상태/검증/저장(`edit-sheet-form.ts` + 저장 서비스)과 UI 분리. 아이폰식 그룹 리스트 프리미티브(`FormGroup`, `FormRow`, `FormToggleRow`, `FormValueRow`, `TimeChip`) 신설. 선택 하위 화면: 자녀, 종류, 반복, 시작 전 알림, 종료 전 알림.
- 준비물: 목록 + "매번/이번만" 라벨(ADR-006a ↻ pill 대체, 멤버십 규칙은 ADR-006 그대로).
- 알림 스케줄러: 종료 전 트리거, 하루 종일 기준 시각(OQ2), 60개 상한 공동 적용. 본문 정책(준비물 prepend)은 시작 전 알림에만.
- 기존 이벤트 상세(`EventDetailDrawer`)도 같은 그룹 리스트 스타일로 정렬.

### Phase 5 — 보호자 캘린더 (expo-calendar)
- 의존성 추가 + config plugin + `NSCalendarsFullAccessUsageDescription`. 권한 플로우(설정 화면에서 켤 때 요청, 거부 시 안내).
- 설정 > 캘린더 연동 화면(시안 보드 5): 표시 여부, 표시할 캘린더 체크.
- 읽기: 보이는 날짜 범위만 조회 + 메모리 캐시, AppState 복귀 시 갱신. 저장 안 함(SQLite에 넣지 않음 — 원천은 기기 캘린더).
- 세 보기에 보호자 일정 표시(회색), 일간 보호자 열, 집중 모드 `'guardian'`.
- (후속) 자녀 일정 내보내기. 픽업–보호자 겹침은 화면 표시만 — 푸시는 §7-C4.

### Phase 6 — (Phase 2로 병합됨)
- 할 일·준비물 탭 분리는 탭 구조와 같이 Phase 2에서 수행(§7-A4).

### Phase 7 — UI 정리·통일 마무리
- 삭제는 각 Phase에서 대체 즉시 수행(§7-A2). 여기서는 남은 "통일" 대상 화면(설정·자녀 편집·온보딩·데이터·약관)을 프리미티브로 교체.
- 리터럴 → 토큰 일괄 치환(글자 크기·모서리·간격). ESLint `no-restricted-syntax`에 `fontSize`/`borderRadius` 숫자 리터럴 규칙 추가(색과 동일하게).
- dev-gallery 재정비, CLAUDE.md Locked Decisions·README 스크린샷 갱신.

---

## 2. UI 정리 인벤토리

분류: **삭제** = 개편으로 대체·미사용 / **교체** = 같은 역할을 새 공통 요소로 / **통일** = 남기되 프리미티브·토큰으로 재작성 / **보류** = 결정 전까지 유지.

### 라우트
| 대상 | 분류 | 비고 |
|---|---|---|
| `app/multi.tsx` | 삭제 | 주간 보기로 흡수 (Phase 3) |
| `app/child/[id].tsx` | 삭제 | 주간 + 자녀 집중 모드로 대체 |
| `app/kid-switch.tsx` + `KidSwitchDrawer` | 삭제 | `child/[id]` 전용 |
| `app/calendar/index.tsx` + `CalendarDrawer` | 교체 | 제목 탭 날짜 선택 → 아이폰식 연·월 선택으로 재작성 또는 월간 보기로 대체(Phase 2에서 결정) |
| `app/(tabs)/index.tsx` | 교체 | `(tabs)/calendar` |
| `app/schedule/edit.tsx`, `app/event/detail.tsx`, `app/search/index.tsx` | 유지 | 내용만 Phase 4·7에서 교체 |
| `app/dev-gallery.tsx` | 통일 | 새 프리미티브 기준 재구성 |

### 화면 구성 요소
| 대상 | 분류 | 대체 |
|---|---|---|
| `ui/common/ViewToggle` (WEEK/DAY) | 삭제 | `CalendarTopBar` 보기 세그먼트(아이콘) |
| `ui/daily/TopBar` | 교체 | `CalendarTopBar` |
| `ui/daily/KidPillsHeader` | 교체 | `KidFilterBar` |
| `ui/daily/TabStrip` | 삭제 | 독의 할 일·준비물 탭 |
| `ui/common/BottomDock` | 통일 | 3탭+라벨, `+` 제거 |
| `ui/daily/ScheduleGrid` | 교체 | `TimeGrid` + `TimeBlock` (일간 래퍼) |
| `ui/weekly/WeeklyGrid`, `ui/weekly/MultiKidGrid` | 삭제 | `TimeGrid` + 주간 래퍼 |
| `ui/daily/PickupCarousel`, `PickupCard`, `CartoonCar`, `pickup-data` | 보류 | 숨김. OQ1 결정 후 삭제 또는 재배치. `pickup-data`의 일부 헬퍼는 다른 화면도 사용 → 분리 이동 |
| `ui/daily/EmptyDayState` | 통일 | 일간 빈 상태 재디자인 |
| `ui/daily/TodoTabContent`, `TodoSection`, `ChecklistSection` | 통일 | 할 일·준비물 탭 화면 |
| `ui/sheets/ScheduleEditSheet` 내부 `Pill`·`DayCircle`·`ToggleSwitch`·`Row`·`Group`·`ActionRow` | 삭제 | Form 프리미티브 |
| `ui/drawers/EventDetailDrawer` 내부 `Group`·`ActionRow` | 교체 | Form 프리미티브 |
| `ui/settings/SwitchPill` | 교체 | 공통 `Toggle`(아이폰식, 켜짐 색 지정 가능) |
| 시스템 화면 바탕 `surfaceSoft`(#F7F6F5) | 통일 | `groupedBg`(#F2F1EF) |
| 설정 화면들의 `SectionHeader`(6벌)·`Divider`(2벌)·`Card`·`DetailTopBar`(2벌, 라우트 파일에서 export) | 통일 | `src/ui/components`로 1벌씩 |
| `onboarding/add-kid` ↔ `settings/kid-edit` 아바타 선택·이름 입력 중복 | 통일 | `AvatarPicker` 1벌 |
| `ui/common/ColorDot`, `KidAvatar`, `TypeIcon` | 유지 | `TypeIcon` 은 `KIND_ICON` 얇은 래퍼 — 정리 시 직접 사용으로 축소 가능 |

### 프리미티브 (`src/ui/components`)
| 대상 | 분류 | 비고 |
|---|---|---|
| `Text`, `Button`, `Card`(radius 14), `Input`, `Badge`, `Pill` | 통일 | 실사용 화면에 적용 |
| `Segmented` | 통일 | 아이콘 세그먼트 지원 추가(보기 전환) |
| `Toggle` | 통일 | 아이폰 규격(51×31), 켜짐 색 prop |
| `DayCircle` | 유지 | 반복 선택 화면에서 사용 |
| `Fab` | 삭제 | 가운데 `+` 폐기 |
| `SelectChip`, `DateField`, `DashedAddButton` | 보류 | 폼이 리스트 행으로 바뀌면 사용처 사라짐 → Phase 4 후 사용처 0이면 삭제(고정 일정 화면 착수 시 재평가) |
| 신규 `FormGroup`·`FormRow`·`FormToggleRow`·`FormValueRow`·`TimeChip`·`SectionHeader`·`DetailTopBar`·`KidFilterPill` | 추가 | |

### 토큰
| 대상 | 분류 | 비고 |
|---|---|---|
| `TOKENS.nowLine`(라임) | 삭제 | NOW = 주황 |
| `pickupLavender/Mint/Sky`, `carBody*`, `carWindow*`, `carWheel`, `carShine`, `PICKUP_CARD_PALETTE` | 보류 | 캐러셀과 운명 같이 |
| `controlActive`(#2A2A29) vs `ink`(#1D1D1B) | 통일 | 하나로 |
| `switchOff`, 토글 켜짐 색 | 통일 | 아이폰식 꺼짐 회색 + 켜짐(초록 `success` / 픽업 `primary`) |
| `KidPalette.deep`, `guardian.*`, `RADIUS.box`, 새 `TYPE` 프리셋 | 추가 | Phase 0 |
| `ink70`, `KidPalette` key 별칭(`paletteKeyForIndex` 등) | 검토 | 사용처 0이면 삭제 |

---

## 3. 테스트 전략
- 도메인: `layoutCascade`, `fmtRange`, 하루 종일 occurrence, 월간 칸 배치 — 순수 함수 단위 테스트.
- 마이그레이션 v8: version-guard + 두 트랜잭션 경로 원자성(기존 패턴).
- 스케줄러: 시작·종료 알림 생성, 60개 상한 합산, 하루 종일 기준, invariant 5 유지.
- 내보내기 v5: `allDay`·`notifyEndMinutesBefore` round-trip.
- UI: 집중 모드 투명도, 보기 전환 상태, 폼 저장(create/editAll/editOccurrence) — 기존 `ScheduleEditSheet.test.tsx` 시나리오 이식.
- 보호자 캘린더: `expo-calendar` 목(mock)으로 권한 거부/허용/빈 목록.

## 4. 위험
| 위험 | 대응 |
|---|---|
| 그리드 재작성 중 성능 저하(4명×주간 블록 수) | `TimeBlock` memo, 레이아웃 계산 useMemo, 실기기 측정(SPEC-PERF-1 기준) |
| 라우트 삭제로 딥링크·알림 탭 진입 경로 깨짐 | 알림 탭 핸들러·검색 결과 이동 경로를 Phase 3에서 전수 점검 |
| `expo-calendar` 네이티브 모듈 → 새 빌드 필요, 심사 문구 | Phase 5를 별도 빌드 단위로 |
| 1,739줄 폼 재작성 회귀 | 저장 로직을 먼저 분리(Phase 4 첫 커밋)하고 기존 테스트 통과 확인 후 UI 교체 |
| 오렌지 위 흰 글씨 대비 | 실기기 확인, 필요 시 굵기/톤 조정 |

## 5. Open Questions (ADR-007과 동일)
1. 픽업 캐러셀 존폐/재배치. 2. 하루 종일 표시·알림 기준. 3. 보호자 일정 탭 동작. 4. 딥 톤 3색 값. (월간 `+N`은 확정 — §Phase 3)

## 6. 검토 요청 포인트 (Architect/Critic)
- Phase 순서: 도메인/공통 그리드(1) → 셸(2) → 보기(3) → 폼·데이터(4) → 보호자(5) → 탭 통합(6) → 정리(7). 정리를 마지막에 몰지 말고 Phase마다 대체 즉시 삭제하는 편이 나은가?
- 보호자 일정을 SQLite에 저장하지 않는 결정(기기 캘린더를 원천으로)의 타당성.
- 시간 축 06–25시 유지 vs 0–24시(아이폰식) 전환.

---

## 7. Architect/Critic 검토 반영 (v2, 2026-11-10)

Verdict: **APPROVE-WITH-REVISIONS**. 아래를 계획에 포함한다.

### A. 구조 변경
1. **루트 라우트 보존**: `(tabs)/index.tsx`를 캘린더 탭으로 유지(파일 이름 변경 없음). `router.replace('/')`(`reset-confirm.tsx:44`, `add-kid.tsx:109`)와 온보딩 `Redirect`(`(tabs)/index.tsx:339`)가 그대로 동작해야 함. 탭 추가는 `(tabs)/todo.tsx`.
2. **삭제는 대체 즉시(Strangler)**. 각 Phase 완료 조건 = "삭제 대상 import grep 0 + `tsc`(typedRoutes) 통과".
   - Phase 2: `TabStrip`, `ViewToggle`, `Fab`, `IconHome`(독 변경 후 사용처 0), `ui-store`의 `kidSwitchDrawerOpen`·`calendarDrawerOpen`(이미 0)·`searchDrawerOpen`·`selectedChildId`(테스트 전용).
   - Phase 3: `multi`·`child/[id]`·`kid-switch` 라우트 파일 + `_layout.tsx` Stack.Screen 등록(`:226·228·312`) + `(tabs)/_layout.tsx` 등록, `WeeklyGrid`·`MultiKidGrid`, `layoutWeek`+`grid-week.test.ts`(→ `layoutCascade`로 흡수), `ui-store.pendingKidId`, `saturday` 토큰 운명 결정.
   - Phase 4: 폼 내부 `RepeatPill`(↻)·`KidPillRow`·`NativeField`·`PickerOverlay`·`FieldError`·`Pill`·`DayCircle`·`ToggleSwitch`·`Row`·`Group`·`ActionRow`, 상세의 `Group`·`ActionRow`·`DRow`, 설정의 `SegmentedRow`(→`Segmented`).
   - Phase 0: `KidPaletteKey` 별칭(`palette.ts:37-44`, 이름이 색과 어긋남 — 'peach'=핑크) 먼저 삭제 후 `deep` 추가.
   - 테스트 파일 분류: `WeeklyGrid.test.tsx`(삭제), `CalendarDrawer.test.tsx`(Phase 2 결정 따라), `PickupCarousel.test.tsx`(보류), `palette*.test.ts`·`ui-store.test.ts`·`icons.test.tsx`(수정).
3. **Phase 2→3 사이 진입 경로**: Phase 2 동안 보기 세그먼트의 주·월은 비활성(회색), 기존 `/multi` 연결 안 함.
4. **Phase 6을 Phase 2로 병합**: 탭 구조와 할 일·준비물 화면 분리를 같이. 탭의 날짜 기준은 §7-C2.

### B. 데이터·알림·연동 보강
1. **하루 종일 저장 규약**: `all_day=1`이면 `start_minutes=0`, `end_minutes=1440` 정규값. `validate`의 06:00 하한·24:30 상한 우회, modify 예외의 `override_*`는 무시, `needs_pickup` 허용 안 함(오너 확인 대상 아님 — 종일 일정에 픽업 시각이 없음). 수정 범위: `row-mappers`, `schedules` repo INSERT/UPDATE, `seed-dev`, `body.ts`, Search/EventDetail 시간 표기, 내보내기.
2. **시간 포맷 버그 선수정**: `fmt12hrShort(1440)` → `"12PM"` 오답(`date.ts:121-127`). `fmtRange`는 `date.ts`에 두고 0/720/1440 경계 테스트.
3. **스케줄러**: 조기 반환(`scheduler.ts:136`)을 "시작·종료 알림 둘 다 null"일 때만으로. 종료 전 알림 본문은 준비물 prepend 없음. 후보 수 ≈2배 → 60개 상한 실효 기간 단축(4자녀 최대 부하 시 하루 남짓) — §7-C3. 설정 화면 truncated 캡션 문구 점검. 테스트: 시작·종료 혼합 정렬 안정성, invariant 5 테스트(`scheduler.test.ts:506`)에 종료 경로 포함.
4. **expo-calendar**: iOS 17+ 읽기 = `NSCalendarsFullAccessUsageDescription`(쓰기 전용 권한으로는 읽기 불가), 최소 배포 iOS 15.1 대응 `NSCalendarsUsageDescription` 함께. 플러그인이 두 키를 모두 넣는지·미리 알림 권한 제외 가능 여부는 **`npx expo config --type introspect`로 확인 단계** 추가. Android `WRITE_CALENDAR`는 `blockedPermissions`. 개인정보처리방침(ADR-005)에 캘린더 읽기 문구. `jest.setup.js`에 목.
5. **보호자 캘린더 선택 저장**: `app_settings`에 캘린더 ID 목록만. 사라진 ID는 무시·정리(iCloud 재동기화 시 ID 변동 가능성 — 실기기 확인). 내보내기 제외, `wipe.ts` 초기화 포함. 검색 대상 제외, 보호자 일정엔 알림 없음.
6. **레이아웃 입력 케이스**: 여러 날에 걸친 일정, 하루 종일, 그리드 축 밖 일정을 `layoutCascade` 테스트에 포함.
7. **투명도 규칙**: 60/80/20%·25%는 모두 `KidPalette.source` 기준 알파(흰 바탕 합성 아님). 집중 모드의 20%는 블록 전체 opacity. 토큰: `kidFill(colorIndex, alpha)` 헬퍼.
8. **ESLint 리터럴 규칙**에 `rgba(` 문자열 포함(현재 hex만 검사).
9. **문서 갱신 목록**: CLAUDE.md(그리드 축, ↻ 글리프 RNSVG 차단 문구는 현재 사실과 다름 — EAS 빌드에서 SVG 동작), `radius.ts:3`·`docs/design/README.md §8`(14 채택).

### C. 오너 결정 필요
1. **시간 축**: 06–25시 유지 vs **0–24시(아이폰식, 검토 권장)**. 0–24시면 이른 아침·자정 넘는 보호자 일정이 잘리지 않고, 초기 스크롤은 현재 시각/오전 7시. 자녀 일정 입력 하한(06:00)은 별개.
2. **할 일·준비물 탭의 날짜**: 항상 오늘 / 캘린더에서 보던 날짜를 따라감.
3. **종료 전 알림으로 iOS 알림 한도(60개)가 빨리 차는 것** 수용 여부(가까운 순으로 예약되므로 먼 날짜 알림이 늦게 예약됨).
4. **픽업–보호자 일정 겹침 "알림"**: 잠금 규칙("충돌 푸시 X", 새 푸시 surface 금지)과 충돌 → 화면 표시만 할지, 별도 ADR로 푸시까지 갈지. (ADR-007 OQ로 이동)

### D. 오너 결정 (2026-11-10)
- C1 → **0–24시 축.** 공통 `TimeGrid` 상수를 0–24로, 독에 가리는 하단은 패딩으로. 초기 스크롤 = 현재 시각(오늘) / 오전 7시(다른 날).
- C2 → **항상 오늘.**
- C3 → **수용.**
- C4 → **화면 표시만.** (ADR-007 OQ에서 제거)
- 신규 제안 검토 중: **홈 탭(오늘 요약)** — 시안 보드 `0 홈`. 채택 시 독 = 홈 · 캘린더 · 설정, 할 일·준비물은 홈으로 흡수, 픽업 카드(보류 항목)는 홈에서 부활. Phase 2 범위와 인벤토리의 `PickupCarousel` 분류가 바뀜.

### E. 홈 탭 채택 (2026-11-10) — 계획 변경점
- 독 = **홈 · 캘린더 · 설정**, 아이콘만(라벨 없음, `accessibilityLabel` 유지). 앱 첫 화면 = 홈.
- 라우트: `(tabs)/index.tsx` = **홈**(루트 `/` 유지 → `router.replace('/')`·온보딩 Redirect 그대로 동작, §7-A1 충족). 캘린더 = `(tabs)/calendar.tsx`, 설정 = `(tabs)/settings.tsx`. `(tabs)/todo.tsx` 만들지 않음.
- Phase 2 범위: 탭 구조 + **홈 화면**(다음 픽업 카드 · 지금·다음 · 오늘 챙길 것 · 오늘 할 일) + 캘린더 셸·일간. 기존 `TodoTabContent`/`TodoSection`/`ChecklistSection`의 로직을 홈 섹션으로 이식, 할 일 `전체 보기` 화면 신설.
- 인벤토리 변경: `PickupCarousel`·`PickupCard`·`CartoonCar`·`pickup-data`·car/pickup 토큰 = **보류 → 유지(홈으로 이동)**. `IconHome` = 삭제 대상에서 제외(독에서 사용). `TodoTabContent` = 삭제(홈으로 대체).
- 도메인 신규 순수 함수: `nowAndNextByKid(occurrences, now)`(진행 중/다음/상태 칩) — 테스트 포함.
