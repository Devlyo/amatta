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

### UI — Daily
- [ ] [US-020] 메인 일간 그리드 (자녀×시간) 렌더 — Phase 3
- [ ] [US-021] 좌우 스와이프 prev/next day — Phase 3
- [ ] [US-022] 자녀 헤더 탭 → 주간 드릴다운 — Phase 3/4
- [ ] [US-023] 빈 슬롯 탭 → 추가 시트 — Phase 3/4
- [ ] [SPEC-PERF-1] 첫 페인트 < 1.5s (Android API 33 emu, 32-schedule seed) — Phase 3

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

- (none yet)
