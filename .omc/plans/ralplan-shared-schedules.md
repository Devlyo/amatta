# 함께하는 일정 (2.0) — 실행 계획

ADR-013 (Accepted — 0–3단계 구현, 리뷰 반영: 일정마다 1개 + `fanOutByMember`, 알림 시점 불변, 트리거·JOIN 백필, 인라인 `memberIds`). 보드 M1(보기 A)·M3(새 일정). 브랜치 `feat/shared-schedules` (`chore/version-2.0.0` 위에서).

## 0단계 — DB (expo-sqlite-migrator)
- `009_v9_shared_schedules.sql.ts`:
  - `CREATE TABLE schedule_children(schedule_id REFERENCES schedules ON DELETE CASCADE, child_id REFERENCES children ON DELETE CASCADE, PRIMARY KEY(schedule_id, child_id))`
  - 인덱스 `child_id`
  - `INSERT … SELECT id, child_id FROM schedules`
  - `ALTER TABLE schedules ADD with_guardian INTEGER NOT NULL DEFAULT 0`
  - 이 모두와 `user_version 9`를 한 트랜잭션에서 처리한다.
- `Schedule` 타입에 `memberIds: number[]`(대표 자녀가 첫째)와 `withGuardian: boolean`을 추가한다. row-mapper와 리포지토리도 고친다.
  - 일정을 읽을 때 `schedule_children`를 한 번에 읽어서 붙인다(N+1 없이).
  - 저장(create/update)할 때 멤버 행을 지우고 다시 넣는다. 같은 트랜잭션에서 처리한다.
- `deleteChild`: 그 자녀가 대표인 일정 중 다른 자녀가 있는 일정은 대표를 바꾼 뒤 지운다.
- 테스트: 마이그레이션(기존 행 채움, 중간 실패 시 롤백), 대표 바꾸기, CASCADE.

## 1단계 — 도메인
- `expandOccurrences`: 자녀 멤버마다 회차를 하나씩 만든다. `memberIds`와 `withGuardian`을 같이 넣는다. 꺼진(없는) 자녀는 건너뛴다.
- `dedupeBySchedule(occ)` 헬퍼(`scheduleId`+날짜 기준)를 만든다. now-next 홈 목록, 오늘 챙길 것, 검색, `pickup-data`, 알림 scheduler에 적용한다.
- 알림:
  - 회차마다 1개. 대상 이름을 이어 붙이고(본문 ≤80자 규칙 유지), 멤버 중 한 명이라도 켜져 있으면 보낸다.
  - 시간(분)은 일정 값을 먼저 쓰고, 없으면 대표 자녀의 기본값을 쓴다.
- 보호자 열: SQLite에서 `withGuardian` 회차를 보호자 회차 목록과 합친다. 탭하면 일정 상세(SQLite)로 간다.
- 테스트: 펼치기, 중복 제거, 알림 1개, 필터.

## 2단계 — 화면
- `ScheduleEditSheet` 자녀 칸:
  - 체크 목록에서 여러 명을 고른다. 값 = 이름 1명이면 이름, 2명 이상이면 겹친 얼굴 + "N명".
  - 보호자만 고르면 기기 캘린더(기존 흐름). 자녀 + 보호자면 SQLite에 `with_guardian`.
  - 수정 모드에서도 바꿀 수 있지만 자녀는 1명 이상이어야 한다. 이번만 수정에서는 잠근다.
  - 폼 `childId`를 `childIds`로 바꾸고 검증도 고친다.
- 블록·막대·상세에 겹친 얼굴(2명 이상)을 붙인다. `KidAvatar`로 쌓는 작은 컴포넌트를 만든다.
- 상세 화면(EventDetailDrawer): 함께하는 사람 줄을 보여 준다.
- 월간: 회차가 자녀마다 보이므로 그대로 둔다(같은 날 같은 일정은 사람 수만큼 점이 찍힌다).

## 3단계 — 백업
- `EXPORT_SCHEMA_VERSION` 6: `scheduleChildren[]`, `schedules[].withGuardian`.
- 가져오기: 3–6 정규화(3–5 → `[child_id]`, false). 멤버 참조를 검증한다(자녀가 있는지, 대표가 멤버에 들어 있는지). 왕복 테스트.

## 4단계 — 마무리
- tsc, lint, jest. 개발 빌드 없이 Metro로 확인한다(네이티브 변경 없음).
- ADR-013 Accepted, CLAUDE.md Locked Decisions 갱신(Entities 9 tables, 내보내기 v6).
