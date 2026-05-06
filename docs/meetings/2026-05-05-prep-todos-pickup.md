# Scope expansion: 준비물·할 일·픽업 — schedul-app

- **Date**: 2026-05-05
- **참석**: hyunsoolee (오너/제품 결정), saeboman (프로덕트 엔지니어), Claude (페어)
- **Mode**: V0 daily-grid mockup 리뷰 후 스코프 확장 합의

## 결정 요약

1. **준비물(ChecklistItem) V1.0 포함**
   - Schedule FK 종속 별도 테이블, label/sort_order/is_done/done_at
   - 일정 알림 본문에 ≤80자 자동 prepend
   - 별도 푸시 surface 금지 (알림 피로 방지)

2. **할 일(Todo) V1.0 포함**
   - Schedule 독립 1회성 (반복 X)
   - `child_id` nullable — 부모 자체 to-do 가능
   - dueAt 기반 단독 로컬 푸시

3. **픽업 트래킹 V1.0 포함**
   - `Schedule.needs_pickup` boolean + `ScheduleException.pickup_completed_at` (회차별 완료)
   - 시간 겹침 + needs_pickup ≥2 → 일간 그리드 sub-bar `⚠ {hh:mm} 픽업 충돌` pill **단일 위치만**
   - 그리드 블록 오버레이·푸시 둘 다 금지

4. **Schema v2 마이그레이션**
   - 테이블 4 → 6 (ChecklistItem, Todo 추가)
   - Schedule, ScheduleException 컬럼 추가
   - 세부 SQL: ADR-002 §Schema delta 참조

5. **알림 정책**
   - 새 알림 surface는 Todo dueAt 단독 푸시뿐
   - 일정 알림은 본문만 풍부해짐 (준비물 prepend)
   - 충돌 푸시 발송 금지

## 액션 아이템
- [x] ADR-002 작성 (`docs/architecture/ADR-002-prep-todos-pickup.md`)
- [x] CLAUDE.md Locked Decisions 갱신 (entities·알림 정책·충돌 인디케이터)
- [x] CHANGELOG.md 항목 추가 (2026-05-05)
- [x] BACKLOG.md user stories 추가 (US-015·016·017·024·050·051·052·060·061·062, SPEC-DB-3)
- [x] 회의록 작성 (이 문서)
- [ ] 친구 리뷰 요청 (ADR-002 + CLAUDE.md 갱신 사항)
- [ ] V1 mockup: 일정 추가/수정 시트의 준비물 입력, "오늘 할 일" 카드, needsPickup 토글, 회차별 픽업 완료 체크 UI
- [ ] schedule-domain-expert 에이전트가 ADR-002 schema delta를 occurrences/notification 로직에 어떻게 반영할지 sketch (Phase 1 진입 전)

## 다음 회의 트리거
- Phase 1 진입 직전: schema v2 마이그레이션 라운드 (open-questions.md 산물 포함)
- V1 mockup 리뷰: 위 액션 아이템 V1 mockup 완료 시
