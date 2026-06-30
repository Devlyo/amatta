# ADR-006 — 준비물(ChecklistItem) 반복/당일 분리 + 회차별 완료 로그 (PREP-RECUR)

- **Date**: 2026-06-30
- **Status**: Accepted
- **Authors**: 안새봄(saeboman, 프로덕트 엔지니어), Claude (페어). 스코프 결정: 오너.
- **Source**: qa 2차 논의 + ralplan 합의계획 `.omc/plans/ralplan-ios-launch-v2.md` (Architect/Critic APPROVE) Phase 3.
- **Amends**: ADR-002 (준비물·할일·픽업). ADR-002의 `ChecklistItem` 완료 모델만 교체, 나머지는 유지.

## 문제 (출시 차단 결함)

ADR-002의 `ChecklistItem`은 완료를 **스케줄(템플릿) 행의 단일 `is_done` 플래그**로 기록했다. 반복 일정(예: 영어학원 월·수·금)에서 준비물을 **한 번 체크하면 모든 회차에 영구히 완료로 남고 다시 안 풀린다**. "월요일에 체크 → 화요일에도 체크된 상태". 다자녀 반복 일정 앱에서 치명적이라 출시 전 수정 대상으로 합의(PREP-RECUR).

## Decision

준비물 완료를 **회차별 로그**로 옮기고, 항목 자체에 **반복/당일 귀속**을 도입한다.

1. **완료 = 단일 출처 = 회차별 로그.** 새 테이블
   `checklist_completion(id, checklist_item_id FK, occurrence_date, completed_at, UNIQUE(checklist_item_id, occurrence_date))`.
   `schedule_pickup_log` 패턴을 그대로 미러(`INSERT OR IGNORE`/`DELETE`/`COUNT`).
   모든 완료(반복·당일·비반복 일정)가 여기로 흐른다. **이중 경로 없음.**
   - `occurrence_date`는 **`yyyymmdd INTEGER`** (예: 20260630) — `schedule_pickup_log`와 동일. `schedules.valid_from`/`schedule_exceptions.date`의 TEXT 포맷 아님. 변환은 공용 헬퍼 `isoToYyyymmdd()`(`src/ui/utils/date.ts`).

2. **목록 멤버십 = `checklist_items.occurrence_date`(nullable).**
   - `NULL` = **반복** (모든 회차에 표시).
   - 값 있음 = **당일 전용** (그 날짜에만 표시).
   - 날짜 D 멤버십: `occurrence_date IS NULL OR occurrence_date == D`.

3. **항목별 "반복" 토글, 기본 OFF**(= 당일 전용). ON ⇒ `occurrence_date = NULL`.
   - **진입점별 기본값(고정):**
     (a) `ScheduleEditSheet` — 구체 날짜 없음(반복 템플릿 편집) ⇒ 새 항목 기본 **반복(NULL)**.
     (b) 일간/상세 컨텍스트 — 조회 날짜 D 있음 ⇒ 새 항목 기본 **당일(`occurrence_date = D`)**, 사용자가 토글로 반복 전환 가능.

4. **알림 본문 = Option A** (현행 UX 유지). 본문은 그 회차의 멤버십에서 **이미 완료된 항목을 제외**하고 prepend(≤80자, ADR-002 정책 유지). 새 푸시 surface 없음. (`scheduler.ts`가 `occ.date`별로 `checklist_completion`을 조회해 pending만 본문에 전달.)

5. **레거시 `is_done/done_at` = FROZEN.** v6에서 유지하되 더 이상 쓰지/읽지 않는다(완료 판정에서 제외). 실제 컬럼 drop은 후속 **v7**.

## 마이그레이션 (v6) — 안전성

- `006_v6_checklist_recurrence`: `CREATE TABLE IF NOT EXISTS checklist_completion` + `ALTER TABLE checklist_items ADD COLUMN occurrence_date INTEGER`(DEFAULT NULL) + 백필. **additive only, 파괴적 ALTER 없음.**
- 안전성 = **원자성(atomicity)** — 버전 게이트 러너(`migrations/index.ts:38`) + `user_version`을 트랜잭션 안쪽에서 설정(`:49-53`, `withTransactionAsync` 폴백 `:65-68`). **statement-idempotency가 아님** (`ADD COLUMN`은 `IF NOT EXISTS` 불가). 테스트: version-guard + 양쪽 tx 경로 atomicity(2번째 문 강제 실패 → user_version=5 유지, 테이블/컬럼 부재).
- **백필(M1)**: 기존 행 `occurrence_date = NULL`(반복 보존). 기존 `is_done=1` 각각 → `occurrence_date = 오늘`인 `checklist_completion` 1행(= 오늘 챙긴 것만 보존, 이후 회차는 새로 시작). 정오 업그레이드 시 그날 진행분 유실 방지.

## Decision drivers

1. **출시 차단 정확성** — 반복 일정 완료가 회차별로 독립해야 함이 #1.
2. **검증된 패턴 재사용** — `schedule_pickup_log`의 회차별 로그를 그대로 미러(위험 최소).
3. **당일 전용 항목 = v1 스코프**(오너 확정) — "반복 vs 당일 귀속" 분리가 실제 사용 흐름.

## Alternatives considered

- **J1-C (단일 `last_done_date` 컬럼, 새 테이블 X)** — 반복 항목의 매일 리셋은 되지만 **당일 전용 멤버십을 표현 불가**. 오너가 당일 전용 항목을 v1 스코프로 확정 → 기각.
- **J1-B (준비물은 템플릿 유지, 1회성은 Todo로)** — "한 번 체크 = 영구 완료" 결함을 그대로 둠 → 완료 모델로서 기각.

## Consequences

- 테이블 **7 → 8** (`checklist_completion` 추가). ADR-001 follow-up "~8 tables 넘으면 Drizzle 재검토" 트리거에 도달 — **이번엔 raw SQL 유지**, Drizzle 전환은 별도 검토 항목으로만 기록(미실행).
- export 엔벨로프 `EXPORT_SCHEMA_VERSION` 2 → **3** (`checklistCompletion` 추가). 레거시 `is_done/done_at`는 직렬화 유지하되 "완료 권위는 `checklist_completion`" 주석(미래 v1.1 복원 경로용).
- `checklistItemsRepo.toggleDone`(구 `is_done` writer)는 호출되지 않음 — v7에서 컬럼과 함께 정리.

## Follow-ups

- **v7**: `is_done/done_at` 컬럼 + 구 `toggleDone` 제거.
- **v1.1 복원 경로**: importer는 `checklist_completion`을 완료 권위로 취급(레거시 `is_done` 무시).
- ADR-001 Drizzle 재검토 트리거 도달 기록 (실행은 보류).
