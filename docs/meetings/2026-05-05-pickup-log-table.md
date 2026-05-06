# Pickup tracking — schedule_pickup_log 분리 (옵션 B 채택)

- **Date**: 2026-05-05
- **참석**: hyunsoolee (오너/제품 결정), saeboman (프로덕트 엔지니어), Claude (페어)
- **Mode**: PR #1 리뷰(CHANGES_REQUESTED) 후속 결정

## 컨텍스트

ADR-002 초안에서 회차별 픽업 완료를 `ScheduleException.pickup_completed_at` 컬럼으로 기록할 계획이었음. PR #1 리뷰에서 hugh-lee-hs가 의미 충돌 지적:

- ScheduleException은 `kind IN ('cancel','modify')` CHECK 제약이 락된 "회차 override" 의미
- 픽업 완료는 cancel/modify와 독립 축
- "정상 진행 + 픽업만 완료" 케이스에서 kind 의미 모호, override 필드가 모두 NULL인 modify row 양산

## 검토한 옵션

- **A** ScheduleException row에 piggyback — override 필드 비어있는 modify row 양산 → 의미 훼손 (reject)
- **B** 별도 테이블 `schedule_pickup_log` 신설 — 단일 책임, 인덱스 효율, 향후 픽업 로그 확장 자연스러움 (chosen)
- **C** kind enum에 `'pickup_only'` 추가 — CHECK 제약 변경 + ScheduleException이 다축 모델로 변질 (reject)

## 결정 요약

1. **별도 테이블 `schedule_pickup_log` 채택**
   - `(schedule_id, occurrence_date, completed_at)` 단일 책임
   - UNIQUE(schedule_id, occurrence_date)로 같은 회차 중복 방지
   - INDEX(schedule_id, occurrence_date)로 회차 진행 표시 쿼리 최적
   - ScheduleException 의미 단일성 유지 (cancel/modify override)

2. **Schedule.needs_pickup 필드는 그대로 유지**
   - 일정 단위 "픽업 필요 여부" 플래그
   - 회차별 완료와 직교

3. **테이블 카운트**: 4 → 7 (ChecklistItem, Todo, SchedulePickupLog)
   - ADR-001 follow-up "8 tables 한계" 한 칸 남음

4. **회차별 픽업 완료 토글 동작**
   - on → `schedule_pickup_log` INSERT (충돌 시 do nothing)
   - off → 해당 row DELETE
   - idempotent

## 액션 아이템
- [x] ADR-002 §Decision §3, §Schema delta, §Alternatives, §Impact on locked decisions, §Acceptance criteria 갱신
- [x] CLAUDE.md Locked Decisions 갱신 (entities 6 → 7, ScheduleException extra 제거)
- [x] BACKLOG [SPEC-DB-3], [US-061] 갱신
- [x] CHANGELOG 항목 갱신
- [x] 회의록 작성 (이 문서)
- [ ] PR #1에 갱신된 변경사항 push + 리뷰 응답
- [ ] schedule-domain-expert 에이전트 doc 업데이트(픽업 로그 쿼리 패턴) — follow-up 이슈

## 다음 회의 트리거
- Phase 1 진입 직전: schema v2 마이그레이션 라운드
- 친구가 옵션 B 외 추가 코멘트 주면 별도 회의록
