# Backlog — schedul-app

> Spec(`.omc/specs/deep-interview-schedul-app.md`) Acceptance Criteria 와 user-stories 에서 끌어옴.
> 형식: `[Priority] [Source] task — phase`. 우선순위 P0(필수)/P1(중요)/P2(나중).
> SPRINT.md 로 옮기면 `→ SPRINT` 표시.

## P0 — must-have for v0.1.0

### Foundation
- [ ] [SPEC-DB-1] SQLite 스키마 v1 자동 마이그레이션, 재실행 시 데이터 보존 — Phase 1
- [ ] [SPEC-DB-2] 마이그레이션 트랜잭션 PRAGMA 안쪽 + 크래시 복구 테스트 — Phase 1
- [ ] [SPEC-DOM-1] occurrence 알고리즘 8 시나리오 단위 테스트 ≥ 80% 커버리지 — Phase 1

### Data
- [ ] [US-001] 자녀 등록 (이름·6색) — Phase 2
- [ ] [US-002] 자녀 최대 4명 enforce — Phase 2
- [ ] [US-010] 일정 등록 (제목·타입·시간·요일반복) — Phase 2
- [ ] [US-011] 일정에 위치/메모 선택 입력 — Phase 2
- [ ] [US-012] 특정 날짜 일정 1회 취소 (cancel exception) — Phase 2
- [ ] [US-014] 삭제 시 "이 회차만 / 전체" 선택 — Phase 4
- [ ] [US-015] 일정 추가/수정 시트에서 준비물 N개 (label·reorder·complete toggle) — Phase 2 (ADR-002)
- [ ] [US-016] 일정 알림 본문에 준비물 요약 자동 prepend (≤80자) — Phase 5 (ADR-002)
- [ ] [SPEC-DB-3] Migration v2: ChecklistItem·Todo·SchedulePickupLog 테이블 + Schedule.needs_pickup 컬럼 추가 (총 7 tables), v1→v2 데이터 무손실 — Phase 1 (ADR-002)

### UI — Daily
- [ ] [US-020] 메인 일간 그리드 (자녀×시간) 렌더 — Phase 3
- [ ] [US-021] 좌우 스와이프 prev/next day — Phase 3
- [ ] [US-022] 자녀 헤더 탭 → 주간 드릴다운 — Phase 3/4
- [ ] [US-023] 빈 슬롯 탭 → 추가 시트 — Phase 3/4
- [ ] [US-017] 일정 블록 내부에 준비물 inline 표시 (≥45px 높이일 때만) — Phase 3 (ADR-002)
- [ ] [US-024] "오늘 챙길 것" 카드 (자녀별 묶음, 미완료만, 탭 시 블록 스크롤) — Phase 3 (ADR-002)
- [ ] [US-060] 일정에 needsPickup 토글 → 블록 우상단 🚗 — Phase 3 (ADR-002)
- [ ] [US-061] 회차별 픽업 완료 체크 → `schedule_pickup_log` INSERT/DELETE — Phase 4 (ADR-002)
- [ ] [US-062] 시간 겹침 + needsPickup ≥2 → sub-bar `⚠ {hh:mm} 픽업 충돌` pill (블록·푸시 무영향) — Phase 3 (ADR-002)
- [ ] [SPEC-PERF-1] 첫 페인트 < 1.5s (Android API 33 emu, 32-schedule seed) — Phase 3

### Todos (ADR-002)
- [ ] [US-050] Todo 추가/수정/완료/삭제 (반복 X) — Phase 2
- [ ] [US-051] Todo dueAt - notify_minutes_before 시점 로컬 푸시 — Phase 5
- [ ] [US-052] 일간 화면 상단 "오늘 할 일" 카드 (자녀 무관 to-do 포함) — Phase 3

### Notifications
- [ ] [US-030] 일정 N분 전 로컬 푸시 — Phase 5
- [ ] [US-031] 자녀별 minutesBefore 설정 — Phase 5
- [ ] [US-032] 일정 삭제 시 알림 자동 정리 — Phase 5
- [ ] [SPEC-NOTIF-1] rescheduleAll cancelAll 우선 + grep 테스트 — Phase 5

## P1 — should-have

- [ ] [US-003] 자녀 정보 수정·삭제 — Phase 2
- [ ] [US-013] 특정 날짜 일정 시간 1회 변경 (modify exception) — Phase 4
- [ ] [US-040] Settings에서 DB JSON 내보내기 — Phase 6
- [ ] [SPEC-VIS-1] 취소된 일정 30% opacity + strike-through — Phase 3
- [ ] [SPEC-VIS-2] 수정된 일정 우상단 dot/badge — Phase 3
- [ ] [SPEC-A11Y-1] 자녀 색상 텍스트 대비 WCAG AA — Phase 3

## P2 — nice-to-have / 나중

- [ ] [US-041] OS 자동 백업 복원 검증 (iOS iCloud / Android Auto Backup) — Phase 6
- [ ] iOS 64 알림 cap rolling reschedule (open-questions T5) — Phase 5+
- [ ] 빈 상태(EmptyChildrenState) 일러스트·CTA — Phase 6
- [ ] visual-verdict 스크린샷 골든파일 — Phase 6
- [ ] 앱 아이콘·스플래시 디자인 — Phase 6

## Discovered later
(작업 중 새로 발견되면 여기 추가, 우선순위 합의 후 위로 이동)

### Tracked 2026-06-03 (after onboarding + settings + avatar pass)

**Big unfinished feature**
- [ ] [NOTIF-WIRE] expo-notifications 본격 wiring — 일정/할일 추가해도 푸시가 안 울리는 상태.
  ADR-002 정책은 정해놨지만 실제 스케줄링 코드 0줄. P0 우선순위 후보.
- [ ] [NOTIF-PERSIST] 설정 상단의 '시스템 알림' + '기본 알림 시점' 영구 저장.
  현재 useState 만 → 앱 재시작 시 default 로 리셋. app_settings 테이블 추가 또는 AsyncStorage slice.

**시안 fidelity 점검 안 한 surface**
- [ ] [SEARCH-DRAWER-PASS] SearchDrawer 시안 픽셀 매칭 점검. 동작은 함.
- [ ] [DATA-LEGAL-PASS] 설정 → 데이터 / 약관 페이지 시안 비교 (사용자가 "그대로 둬" 했지만 한 번 훑긴 필요).
- [ ] [WELCOME-BLOB-SVG] 온보딩 Welcome 스크린의 라임 트레이 — 현재 2px 직선 합의 상태,
  EAS dev-build 전환 시 react-native-svg bezier 로 정확한 organic 블롭 교체 가능.

**기술 부채 / 정리**
- [ ] [REF-IMAGES-AUDIT] docs/design/references/char_pack*.jpg + sub_colors.webp — git 에 올라가 있는데
  코드에서 안 씀. 사용 여부 확정 후 ref-only 디렉토리로 옮기거나 .gitignore.

### Tracked 2026-06-07 (after design-consistency pass — feat/design-consistency-pass)

- [ ] [ASSET-SWAP] 아이콘 / 이미지 에셋 교체 — 현재 placeholder/임시 에셋을 최종 디자인 에셋으로 교체
  (앱 아이콘·스플래시·마스코트·타입 아이콘 등 전반 점검).
- [ ] [LEGAL-EDIT] 약관 / 개인정보처리방침 본문 수정 — 실제 서비스 내용·연락처·발효일 확정 반영
  (app/settings/legal.tsx 텍스트).
- [ ] [QA-BEHAVIOR] 동작 확인 — 디자인 패스 이후 전 화면 기능 회귀 점검 (일정 CRUD, 날짜 스코프
  todo, 4명 시드/렌더, 모달 흐름, 알림 등) 실기기 동작 검증.
