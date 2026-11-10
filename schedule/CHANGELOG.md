# Changelog — schedul-app

형식: `## YYYY-MM-DD — 한 줄 요약`. 위가 최신.

## 2026-11-10 — ADR-007 Phase 5 / ADR-008 보호자 캘린더

- 홈 할일·준비물: 왼쪽으로 밀면 빨간 "삭제" → 누르거나 길게 끝까지 밀면 삭제(줄이 사라지고 아래가 올라옴). 할일·이번만 준비물은 바로, 매번 준비물은 다른 날에도 사라지니 한 번 확인.
- 구분선 조금 진하게(separator 토큰), 준비물·할일 항목 사이에도 선.
- 설정 안쪽 화면(자녀 관리·자녀 편집·데이터·약관·캘린더 연동)을 같은 스타일로: 공용 상단 바(빨간 ‹ 설정, 가운데 제목, 빨간 오른쪽 버튼), 회색 바탕, 굵은 섹션 제목 + 흰 둥근 박스, 아이폰식 줄, 글자 토큰.
- 모든 토글 켜짐 색 = 주황(보호자 일정 보기 포함).
- 설정 탭을 홈과 같은 모양으로(큰 제목, 굵은 섹션 제목, 흰 둥근 박스, 아이폰식 줄). 시스템 알림이 켜져 있을 때만 "기본 알림 시점" 표시. 기본 알림 시점에 "없음" 추가, 기본값 = 없음(새 일정의 시작 전 알림에만 적용).
- 하단 + : 다음 정각부터 1시간. 하루 종일 스위치 주황색.
- 홈 준비물: 아이별로 어느 수업의 준비물인지(종류 아이콘·수업 이름·시간) 묶어서 표시, 수업 시간순.
- 홈 할일: "할일 추가" 줄을 새 일정의 "준비물 추가"와 같은 모양(빨간 +원 아이콘·빨간 글씨)으로.
- 사람 필터: 꺼진 사람의 일정은 흐리게(20%) 대신 숨김. 일간은 열도 빠짐.
- 일간 픽업 점이 5열(아이 4 + 보호자)일 때 사라지던 버그 수정.
- 두 아이 픽업이 15분 안으로 붙으면 둘 다 캐러셀 카드로, 카드 아래 `서연 "수영" 픽업(6:10PM)과 겹쳐요` 문구(보호자 겹침 문구와 같은 디자인, 함께 표시 가능).
- 픽업–보호자 일정 겹침(픽업 시각 ±15분, 하루 종일 제외): 저장할 때 "픽업 시간과 겹쳐요" 확인 창(보호자 일정 저장 / 픽업 있는 아이 일정 저장 모두), 홈 "다음 픽업" 카드 아래 안내 한 줄. 푸시 없음.
- 보호자 일정을 누르면 아이 일정과 같은 앱 상세 화면 → "수정"은 같은 새 일정 화면, 삭제(반복이면 이 회차만/이후 모두), 아이폰 캘린더에서 열기. 읽기 전용 캘린더·여러 날 일정은 앱에서 수정 불가 안내.
- 하루 종일 등 토글 줄의 스위치가 위로 붙던 것 → 줄 가운데로.
- 설정 > 캘린더 연동: 보호자 일정 보기(켤 때 캘린더 권한 요청), 표시할 캘린더 선택, 보호자 일정 저장 캘린더. 거부 시 안내 + 설정 열기.
- 일간 보호자 열·주간·월간에 보호자 일정(회색) 표시, 하루 종일 포함. 누르면 iOS 기본 일정 화면(보기·수정), 닫으면 다시 읽음. 앱 복귀 시 갱신.
- 새 일정 화면의 자녀 줄에 "보호자" — 고르면 종류·반복·종료 전 알림·픽업·준비물 숨김, 저장은 기기 캘린더(시작 전 알림 = 캘린더 알람). 일간 보호자 열 길게 누르기 = 보호자 미리 선택.
- 보호자 일정은 SQLite에 저장하지 않음, 설정값은 JSON 내보내기 제외·초기화 시 삭제. 개인정보 처리방침에 캘린더 항목 추가.
- **새 개발 빌드 필요**(expo-calendar 네이티브 모듈).

## 2026-11-10 — 주간 확대·스크롤 개선, 6인 레이아웃

- 캘린더 첫 스크롤: 지금 진행 중인 일정이 있으면 그 일정 제목까지 보이게 위로(현재 시각 선이 화면에 남는 범위 안에서).
- 일간: 사람 이름 줄을 날짜 줄 아래로. 일간 보기 아이콘을 네모(ㅁ)로.
- 주간: 한 명만 켜면 그 사람 블록만, 겹침도 그 사람끼리만 계산해 원래 너비로.
- 일간도 iOS 기본 페이징으로 하루씩 넘김(손가락 1:1). 넘겨도 보던 시간대(세로 위치) 유지, 날짜를 직접 고르면 지금/첫 일정 위치로.
- 월간도 같은 방식: 좌우는 iOS 기본 페이징(한 달씩), 핀치는 주 줄 높이를 실시간으로(글자 안 늘어남, 탄성 없음), 120px부터 두 줄 칩.
- 주간 첫 진입 시 빈 화면(스크롤이 맨 앞으로 밀림), 핀치 중 날짜 튐, 확대 후 회색 배경 수정.
- 주간 핀치를 애플 캘린더처럼: 화면 이미지를 늘리던 방식 → 날짜 칸 너비를 실시간으로 다시 배치(글자 안 늘어남), 7~2일 연속, 놓은 자리에서 멈춤(탄성 없음).
- 주간 좌우 드래그를 iOS 기본 스크롤로(7일 = 주 단위 넘김, 확대 = 하루 경계에 멈춤).
- 주간 핀치 7 → 4 → 3 → 2일. 미리보기는 실제 단계 범위까지만, 날짜 열만 늘어나고(시간 눈금 고정) 놓으면 손가락 아래 날짜를 유지한 채 단계로 이어짐.
- 확대 상태에서 한 주 전체를 옆으로 스크롤(하루 단위 스냅), 양 끝에서 더 끌면 이전/다음 주. 7일·일간·월간은 한 손가락으로 끌면 페이지가 따라 밀림.
- 겹침이 깊어도(최대 6명) 들여쓰기 폭을 줄여 모두 비껴 보이게. 사람 필터 5명+ 컴팩트.
- 자녀 최대 4명 유지(보호자 2 대비 사람 6명까지 레이아웃 보장). 자녀 한도 초과 시 처리 안 된 오류 대신 안내창.

## 2026-11-10 — ADR-007 Phase 4 (새 일정 화면 · 하루 종일 · 종료 전 알림)

- 마이그레이션 v8: `schedules.all_day`, `notify_end_minutes_before` (원자성 게이트, 추가만). 내보내기 스키마 v5.
- 알림: 종료 전 알림(본문에 준비물 없음), 하루 종일은 당일 08:00 기준 시작 전 알림. 60개 상한·직렬화 공유.
- 일·주간 상단 "하루 종일" 줄, 월간 확대 시 "하루 종일", 홈 "지금"에서 제외, 상세에 "하루 종일".
- 새 일정 화면을 아이폰 캘린더 방식으로 재작성: 회색 바탕 + 흰 묶음, 값 행 펼침(자녀·종류·반복·알림), 날짜 인라인 달력·시간 휠, 하루 종일 스위치, 시작/종료 전 알림, 픽업 주황 스위치, 준비물 "매번/이번만" 라벨. 입력 범위 00:00–24:00.

## 2026-11-10 — ADR-007 Phase 3 (주간 · 월간 · 핀치 확대)

- 주간: 7일 시간 그리드(오늘 열·NOW), 고정 일정도 일반 블록, 같은 날 겹침 계단식. 요일 머리글 탭 → 그날 일간. 빈 칸 길게 누르기 → 그 날짜·시간 새 일정.
- 월간: 주 단위 칸, 일정 띠(60%, 시작 시간순, 학교·어린이집 숨김), 넘치면 `+N`. 칸 탭 → 그날 일간.
- 핀치 확대: 주간 = 4일 + 블록 시간 표시, 월간 = 칸 높이↑ · 띠 2줄(제목 … + 시작 시간). 다시 오므리면 원래대로.
- 한 손가락 좌우 스와이프: 일간 ±1일, 주간 ±7일(확대 시 ±4일), 월간 ±1달. 사람 필터는 세 보기 공통.
- 일~월 보기 전환 아이콘 모두 활성.

## 2026-11-10 — ADR-007 Phase 2 (홈 · 독 · 캘린더 일간)

- 독 = 홈 · 캘린더 · 설정(아이콘만, 커스텀 탭 바). 앱 첫 화면 = 홈(다음 픽업 · 지금/다음 · 오늘 챙길 것 · 오늘 할 일, 항상 오늘).
- 캘린더 탭: 상단 바(제목+날짜 선택 · 일/주/월 아이콘 · 검색 · 빨간 +), 자녀 필터 줄 + 집중 모드, 일~토 날짜 줄, 새 `TimeGrid` 일간(자녀 열 + 보호자 열, 계단식 겹침), 좌우 스와이프로 하루 이동. 주·월은 Phase 3까지 비활성.
- 날짜 선택 시트 라우트 `/calendar` → `/date-picker`. 설정은 탭이 되어 뒤로 버튼 제거.
- 삭제(대체됨): 자녀별 주간·전체 주간·자녀 전환 화면, 옛 일간 그리드·상단 바·자녀 알약·탭 줄·WEEK/DAY 토글·옛 독·빈 화면·FAB, `layoutWeek`, ui-store의 안 쓰는 상태값 5개.

## 2026-11-10 — ADR-007 Phase 1 (겹침 레이아웃 · 공통 시간 그리드)

- `src/domain/layout.ts`: `layoutCascade`(같은 열에서 시간이 겹치면 계단식 레벨 배정, 입력 순서 무관) + `clipToDay`. 테스트 18개.
- `src/ui/calendar/`: 0–24시 공통 축(`time-axis.ts`), `TimeGrid`(시간 눈금 `9 AM`·세로 구분선·오늘 열·주황 NOW 선/점/알약), `TimeBlock`(60%/80% 채움·1.5px 진한 막대·`3–4PM`·집중 모드 20%·픽업 점).
- NOW 갱신 로직을 `useNowMinutes` 훅으로 통합(일간·전체 주간의 중복 제거).
- 기존 화면은 아직 옛 그리드 사용 — Phase 2/3에서 교체.

## 2026-11-10 — ADR-007 캘린더 개편 착수 · Phase 0 (토큰 기반)

- ADR-007 Accepted + ralplan v2(`.omc/plans/ralplan-calendar-redesign.md`). 현 디자인 보존 태그 `ui-v1`.
- 토큰: 자녀 팔레트 `deep` 톤(민트·스카이·피치는 잠정값), `withAlpha`/`kidFill`(source 기준 알파), `TOKENS.groupedBg`·`sunday`·`guardian`·`guardianDeep`, `RADIUS.box`(14), iOS 스케일 타이포 프리셋(largeTitle·headline·row·subhead·footnote·blockTitle).
- `fmtRange`(`3–4PM` 표기) 추가, `fmt12hrShort(1440)`가 `12PM`으로 나오던 버그 수정.
- 이름이 색과 어긋난 `KidPaletteKey` 별칭(peach=핑크 등) 삭제.

## 2026-11-10 — Chore: 미사용 코드·의존성 정리

- 삭제: `src/ui/grid/`(DailyGrid·SlotCell·ScheduleBlock) + `layoutDay`/`BlockLayout`, `sheet-container.tsx`, `constants/Colors.ts`, 미사용 아이콘 8종(Car·Grid·Bell·Sparkle·Brain·Game·Pencil·Emoji), `AVATAR_ANIMALS`·`LOGOS` 및 PNG 6개(원본은 `docs/design/amatta-v1/assets/`에 유지).
- 의존성 제거: `@gorhom/bottom-sheet`, `expo-haptics`, `expo-web-browser`, `@testing-library/jest-native` (네이티브 모듈 2종 제거 → 다음 배포는 새 네이티브 빌드 필요).
- gorhom을 전제로 한 낡은 주석을 ADR-004(네이티브 라우트) 기준으로 정정.

## 2026-11-10 — Fix: 백업 준비물 반복 정보 누락 + 알림 재예약 중복 실행

- **백업(JSON export)**: `checklist_items` SELECT에 `occurrence_date`·`recurring` 누락 → 모든 항목이 `recurring:false`·앵커 없음으로 내보내지던 문제 수정. `app_settings`(알림 설정)도 `appSettings`로 포함. `EXPORT_SCHEMA_VERSION` 3 → **4** (v3 번들의 membership 필드는 신뢰 불가 — 가져오기 구현 시 NULL/매번으로 취급).
- **알림**: `rescheduleAll()`을 직렬화 + 병합(coalesce). 스토어 변경마다 un-await로 호출돼 실행이 겹치면 `cancelAll`/예약이 뒤섞여 중복·stale 알림이 남던 문제 수정 (scheduler invariant 5). 3개 스토어의 `reconcile` 복사본은 `requestReschedule` 하나로 통합.
- 회귀 테스트 추가: export membership round-trip, 동시 호출 중복 없음·비인터리빙·trailing run·실패 후 복구.

## 2026-05-05 — Scope expansion: 준비물·할 일·픽업 트래킹 (ADR-002)

- ADR-002 채택 (`docs/architecture/ADR-002-prep-todos-pickup.md`)
- V1.0 In Scope 3개 영역 추가:
  - **준비물(ChecklistItem)**: Schedule 종속 체크리스트, 일정 알림 본문에 자동 prepend
  - **할 일(Todo)**: Schedule 독립 1회성, dueAt 기반 로컬 푸시
  - **픽업 트래킹**: `Schedule.needs_pickup` boolean + 회차별 완료는 별도 테이블 `schedule_pickup_log` (`docs/meetings/2026-05-05-pickup-log-table.md`, 옵션 B). 시간 겹침 시 sub-bar 충돌 pill만 (블록 오버레이·푸시 X)
- 마이그레이션 v2 정의 (테이블 4 → 7: ChecklistItem, Todo, SchedulePickupLog 추가)
- CLAUDE.md Locked Decisions 갱신 (entities 7종·알림 정책·충돌 인디케이터)
- BACKLOG에 user stories 추가: US-015~017, US-024, US-050~052, US-060~062, SPEC-DB-3
- Inputs:
  - 사용자 V0 daily-grid mockup 리뷰 → 회의록(`docs/meetings/2026-05-05-prep-todos-pickup.md`)
  - hugh-lee-hs PR #1 리뷰(CHANGES_REQUESTED) → 픽업 트래킹 옵션 B 채택 후속 회의록(`docs/meetings/2026-05-05-pickup-log-table.md`)

## 2026-05-04 — Project meta scaffold complete

- Deep-interview 7라운드 → ambiguity 5%, ontology 100% 안정 (`.omc/specs/deep-interview-schedul-app.md`)
- ralplan v2 합의 (Architect APPROVE, Critic APPROVE, 5 must-fix 모두 해소) (`.omc/plans/ralplan-schedul-app-v2.md`)
- ADR-001 스택 락: Expo + RN + TS + expo-sqlite + expo-notifications + Zustand (`docs/architecture/ADR-001-stack.md`)
- CLAUDE.md, docs/(product|design|architecture|meetings)/, schedule/(ROADMAP|BACKLOG|SPRINT|CHANGELOG).md 작성
- `.claude/settings.json` hooks 3종 설치 (per-edit eslint --fix, Stop tsc --noEmit, SessionStart expo-doctor)
- `.claude/agents/` 4종: schedule-domain-expert, expo-sqlite-migrator, notification-scheduler, grid-renderer
- `.claude/skills/` 3종: seed-test-data, verify-acceptance, phase-gate
- Expo 프로젝트 부트스트랩 파일들도 함께 생성됨 (executor 과한 실행). 사용자 결정으로 롤백 X — Phase 0 일부 진척 상태로 유지
