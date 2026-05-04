# Roadmap — schedul-app

> 캘린더 날짜는 잡지 않습니다 (1인 개발 / 가변 페이스).
> 각 마일스톤은 *완료 기준* 으로만 정의 — 모두 통과해야 다음 마일스톤 진입.

## M0 — Project meta scaffold ✅ DONE
완료 기준
- [x] deep-interview spec 작성 (ambiguity ≤ 20%)
- [x] ralplan v2 합의 (Architect+Critic APPROVE)
- [x] CLAUDE.md, docs/, schedule/, .claude/agents/, .claude/skills/ 셋업
- [x] hooks(.claude/settings.json) 설치
- [x] gitignore 정책 확정 (.omc/specs, .omc/plans만 공유)

## M1 — Phase 0 dev environment ✅ DONE (during executor over-reach)
완료 기준
- [x] Expo 프로젝트 부트스트랩
- [x] TS strict + ESLint + Prettier + jest-expo
- [x] tsconfig (no exactOptionalPropertyTypes)
- [ ] **smoke gate 실행 + 통과 (.omc/logs/phase0-smoke.log 기록)** ← 사용자 트리거 필요
- [ ] 첫 git commit `chore: bootstrap expo + tooling (Phase 0)`

## M2 — Phase 1 foundation
완료 기준
- [ ] `src/db/schema.ts` v1 (children, schedules, schedule_exceptions, notification_settings)
- [ ] 마이그레이션 러너 (PRAGMA user_version 트랜잭션 안쪽, 크래시 복구 테스트)
- [ ] `src/db/occurrences.ts` 순수 함수 + 8개 시나리오 단위 테스트 ≥ 80% 커버리지
- [ ] phase-gate 통과

## M3 — Phase 2 domain & data
완료 기준
- [ ] repositories (Child, Schedule, ScheduleException, NotificationSetting)
- [ ] 자녀 4명 한도 — repository 레이어에서 enforce
- [ ] `src/ui/grid/layout.ts` 순수 헬퍼 + 단위 테스트
- [ ] phase-gate 통과

## M4 — Phase 3 daily spread UI
완료 기준
- [ ] 메인 화면 일간 그리드 렌더 (4 자녀 × 34행)
- [ ] 좌우 스와이프 prev/next day
- [ ] 빈 슬롯 탭 → 일정 추가 시트
- [ ] 자녀 헤더 탭 → 주간 드릴다운 라우팅
- [ ] 첫 페인트 < 1.5s (Android API 33 emu, seed 적용 상태)
- [ ] phase-gate 통과

## M5 — Phase 4 weekly drill-down + CRUD
완료 기준
- [ ] `app/child/[id].tsx` 주간 그리드
- [ ] 일정 추가/수정/삭제 시트 (BottomSheet)
- [ ] 삭제 시 "이 회차만 / 전체" 선택
- [ ] 키보드 회피(BottomSheetTextInput)
- [ ] phase-gate 통과

## M6 — Phase 5 notifications
완료 기준
- [ ] 권한 요청 플로우
- [ ] `rescheduleAll()` cancelAll 우선 + 14일 horizon
- [ ] 일정 삭제/예외 추가 시 알림 정리
- [ ] 앱 종료 상태에서도 알림 발생 (시뮬레이터 검증)
- [ ] phase-gate 통과 + verify-acceptance 보고서 통과율 ≥ 90%

## M7 — Phase 6 polish & QA
완료 기준
- [ ] 빈 상태(EmptyChildrenState) 디자인
- [ ] visual-verdict 그리드 스크린샷 통과
- [ ] iOS sim + Android emu 양쪽 acceptance criteria 전부 PASS
- [ ] DB → JSON 내보내기 / 가져오기 라운드트립
- [ ] CHANGELOG.md "v0.1.0 ready" 마크

## Out-of-roadmap (향후)
- 위젯 / Live Activity
- iCloud 외 클라우드 동기화 (재론하면 새 ADR)
- 다국어
- 학원비 / 출결
