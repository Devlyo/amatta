# ADR-002 — Scope expansion: preparation items, standalone todos, pickup tracking

- **Date**: 2026-05-05
- **Status**: Accepted
- **Authors**: hyunsoolee (오너/제품 결정), saeboman (프로덕트 엔지니어), Claude (페어)
- **Source**: V0 daily-grid mockup 리뷰 세션 (`docs/meetings/2026-05-05-prep-todos-pickup.md`)
- **Supersedes**: 없음 (ADR-001 위에 누적)

## Decision

V1.0 In Scope를 다음 3개 도메인 영역으로 **확장**한다:

1. **Preparation Items (일정별 준비물)**
   - 새 엔티티 `ChecklistItem` — Schedule에 종속된 체크리스트.
   - 필드: `id, schedule_id (FK), label (varchar 60), sort_order, is_done (boolean default 0), done_at? (timestamp)`.
   - UI: 일정 블록 내부에 🎒 + 준비물 라벨 inline 표시. 일간 화면 상단에 **"오늘 챙길 것"** 자녀별 요약 카드.
   - 알림: 일정의 N분 전 로컬 푸시 본문에 준비물 요약을 자동 prepend (예: `[민준/영어학원 16:00] 영어책·워크북`). **별도 푸시 발송 금지** (알림 피로 방지).

2. **Standalone Todos (기타 해야할 일 리마인더)**
   - 새 엔티티 `Todo` — Schedule과 독립된 단발 일거리.
   - 필드: `id, child_id? (nullable FK — 부모 자체 to-do는 null), title (varchar 120), due_at (timestamp), notify_minutes_before? (int), is_done (boolean), done_at? (timestamp), created_at`.
   - 반복 미지원 (V1.0). 1회성만. (학원 패턴이 90%인 일정과 달리 to-do는 1회성이 다수라는 가정.)
   - UI: 일간 화면 상단 "오늘 할 일" 카드 (준비물 카드 아래) + 설정/별도 탭에서 전체 목록.
   - 알림: `due_at - notify_minutes_before` 시점 로컬 푸시. 같은 `expo-notifications` cancelAll→reschedule 사이클을 공유.

3. **Pickup Tracking (픽업 여부 체크 + 시간 겹침 시각 경고)**
   - `Schedule`에 한 필드 추가: `needs_pickup (boolean default 0)`.
   - **회차별 픽업 완료는 별도 테이블 `schedule_pickup_log`로 기록** — `(schedule_id, occurrence_date, completed_at)` 단일 책임. UNIQUE(schedule_id, occurrence_date)로 같은 회차 중복 방지. (이전 안 `ScheduleException.pickup_completed_at`은 hugh-lee-hs 리뷰에서 의미 충돌 지적되어 옵션 B 채택, 회의록 `docs/meetings/2026-05-05-pickup-log-table.md` 참조.)
   - UI: 일정 블록 우상단에 `🚗` 아이콘으로 `needs_pickup=true` 표시. 일정 상세 시트에서 회차별 완료 토글 시 `schedule_pickup_log`에 INSERT/DELETE.
   - **충돌 시각화**: 같은 자녀 또는 다른 자녀 일정 사이에 시간이 겹치면서 `needs_pickup=true`인 일정이 ≥2 동시 진행이면, 일간 그리드 상단 sub-bar에 `⚠ {hh:mm} 픽업 충돌` pill로만 표시. **그리드 블록 위에 별도 마크 또는 푸시 알림 발송 금지** — 시각 인지로 충분.

## Decision drivers

1. **사용자가 V0 mockup을 보고 "이 흐름이 맞다"고 즉시 판정** — 디자인 검증 사이클을 단축하기 위해 V1.0 안에 흡수하는 비용이 V1.1에 미루는 것보다 낮다.
2. **준비물은 한국 학부모용 자녀 일정 앱이 비어 있는 영역** — 일정 알림이 곧 "내일 챙길 것" 알림이 되는 흐름이 V1.0 코어 가치와 직결.
3. **픽업 충돌 시각화는 페르소나 P1(다자녀 워킹맘) 핵심 페인 직접 해결** — `personas.md` "지금 누가 어디에서 끝나고 누구 데리러 가야 하나"를 그리드만으로는 못 푼다.
4. **알림 피로 방지** — 친구 ADR-001 정신 그대로, 새 알림 소스(준비물·픽업 충돌)는 모두 **시각 표시 위주, 푸시는 기존 일정 알림에 piggyback**.
5. **테이블 수가 4→7로 증가** — ADR-001 follow-up "schema가 ~8 tables 넘으면 Drizzle 재검토" 트리거 한 칸 남음. 그래도 raw SQL 유지 가능.

## Alternatives considered

### 준비물을 일정 description에 단순 텍스트로
- **Reject**: 체크 토글이 안 됨. 알림 본문 자동 추출도 비결정적. 일정 수정 시 텍스트 안에서 손으로 편집하는 마찰.

### 준비물을 별도 엔티티가 아니라 JSON column으로
- **Reject**: SQLite JSON1 확장 의존도 ↑, 정렬/완료 상태 쿼리 비효율, expo-sqlite의 next-gen async API에서 typing 타격. ChecklistItem 별도 테이블이 단순.

### Todo 반복(요일 비트마스크) 지원
- **Reject (V1.0)**: 반복 to-do는 결국 Schedule과 같아짐. 1회성으로 한정해 도메인 분리 유지. V1.1에서 "주간 루틴 to-do" 패턴 발견되면 재검토.

### 픽업 충돌을 그리드 블록 위에 직접 인디케이터
- **Reject**: 시각 노이즈 ↑. 같은 자녀의 학원 직후 픽업 같은 정상 케이스도 모두 마크되어 alert fatigue. **상단 sub-bar 단일 pill**이 면적 대비 정보 밀도가 가장 좋음.

### 픽업 충돌을 푸시 알림으로 발송
- **Reject**: 친구 ADR-001 정신("알림은 일정 N분 전 픽업 유도용에 한정"). 충돌 푸시는 학부모가 이미 일정 알림으로 인지. 중복 푸시 = 무시되는 푸시.

### 회차별 픽업 완료를 Schedule.last_pickup_at 단일 컬럼으로
- **Reject**: 반복 일정에서 어제·오늘 둘 다 완료 표시 못 함. 회차당 진실의 단일 출처가 필요.

### 회차별 픽업 완료를 ScheduleException.pickup_completed_at 컬럼으로 (이전 초안)
- **Reject (2026-05-05 hugh-lee-hs 리뷰)**: ScheduleException은 `kind IN ('cancel','modify')` CHECK 제약이 락된 "회차 override" 의미. 픽업 완료는 cancel/modify와 독립 축이라, kind 의미가 모호해지고 override 필드가 모두 NULL인 modify row를 양산하게 됨. 의미적 단일성 훼손.

### 별도 테이블 `schedule_pickup_log` (chosen)
- **Chosen**: `(schedule_id, occurrence_date, completed_at)` 단일 책임. ScheduleException 의미 유지, 픽업 완료 조회 인덱스 효율, 향후 "누가 픽업했는지" 같은 픽업 로그 확장 자연스러움. 테이블 6 → 7로 증가하지만 ADR-001 follow-up "8 tables 한계" 안.

## Consequences

### Positive
- V1.0이 "다자녀 동시 비교 + 챙길 것 + 챙겼는지" 한 화면에 다 들어옴 → 마케팅 메시지 깔끔.
- 알림 피로 추가 없음 (push surface는 기존 일정 알림에 본문만 풍부해짐 + Todo의 dueAt 푸시).
- ChecklistItem과 Todo는 모두 단순 entity — DB 레이어 80% 재사용 가능 (CRUD 패턴, occurrence 영향 없음).

### Negative
- 마이그레이션 v2 필요 (`ChecklistItem`, `Todo`, `schedule_pickup_log` 테이블 추가 + `Schedule.needs_pickup` 컬럼 추가). ScheduleException은 손대지 않음.
- 일정 추가/수정 시트 UI 복잡도 ↑ (탭 또는 collapsible "준비물" 섹션 도입).
- 알림 본문 prepend 로직이 추가됨 — `notification-scheduler` 에이전트 로직 갱신 필요.
- 일간 그리드 충돌 감지 알고리즘 신설: `O(자녀 × 일정수²)` 단순 비교로 충분 (자녀 ≤ 4, 일정 ≤ 32/일).

### Neutral
- 영어 도메인 용어 정합: ChecklistItem (단어), Todo (단어). UI는 한글 (준비물, 할 일, 픽업).

## Schema delta (v1 → v2 migration)

```sql
-- v2 migration (PRAGMA user_version 트랜잭션 안쪽)
ALTER TABLE schedules ADD COLUMN needs_pickup INTEGER NOT NULL DEFAULT 0;

CREATE TABLE checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (length(label) <= 60),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_done INTEGER NOT NULL DEFAULT 0,
  done_at INTEGER
);
CREATE INDEX idx_checklist_schedule ON checklist_items(schedule_id);

CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER REFERENCES children(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(title) <= 120),
  due_at INTEGER NOT NULL,
  notify_minutes_before INTEGER,
  is_done INTEGER NOT NULL DEFAULT 0,
  done_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_todos_due ON todos(due_at) WHERE is_done = 0;

-- 픽업 회차별 완료 로그 (ScheduleException과 분리, hugh-lee-hs 리뷰 옵션 B)
CREATE TABLE schedule_pickup_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  occurrence_date INTEGER NOT NULL,        -- yyyymmdd 정수 (예: 20260505)
  completed_at INTEGER NOT NULL,           -- epoch ms
  UNIQUE(schedule_id, occurrence_date)     -- 같은 회차 중복 방지
);
CREATE INDEX idx_pickup_schedule_date ON schedule_pickup_log(schedule_id, occurrence_date);
```

## Impact on locked decisions

`CLAUDE.md` Locked Decisions에 다음 항목 추가:
- **Entities**: 기존 4종(Child / Schedule / ScheduleException / NotificationSetting)에 **ChecklistItem · Todo · SchedulePickupLog** 3종 추가 (총 7 tables).
- **Schedule extra fields**: `needs_pickup` boolean.
- **회차별 픽업 완료**: 별도 테이블 `schedule_pickup_log`(schedule_id, occurrence_date, completed_at, UNIQUE 제약). ScheduleException은 손대지 않음.
- **알림 정책**: 일정 알림 본문에 ChecklistItem 자동 prepend. Todo는 자체 dueAt 알림. 그 외 새 푸시 surface 금지.
- **충돌 인디케이터**: 일간 그리드 sub-bar pill 단일 위치. 블록 오버레이·푸시 둘 다 금지.

## Acceptance criteria (v0.1.0에 추가)

- [ ] [SPEC-DB-3] migration v2 자동 적용, v1 → v2 데이터 손실 없음. 새 테이블 3종(ChecklistItem, Todo, SchedulePickupLog) 생성 + Schedule.needs_pickup 컬럼 추가. 총 7 tables.
- [ ] [US-015] 일정 추가/수정 시트에서 준비물 N개(label, drag reorder, complete toggle).
- [ ] [US-016] 일정 알림 본문에 준비물 요약이 자동 포함된다 (≤80자, ellipsis 처리).
- [ ] [US-017] 일정 블록 내부에 준비물 inline 표시 (≥45px 높이일 때만).
- [ ] [US-024] "오늘 챙길 것" 카드: 자녀별 묶음, 미완료 항목만 표시, 항목 탭 시 일정 블록으로 스크롤.
- [ ] [US-050] Todo 추가/수정/완료/삭제 (반복 X).
- [ ] [US-051] Todo dueAt 기반 로컬 푸시 (notify_minutes_before 적용).
- [ ] [US-052] 일간 화면 상단 "오늘 할 일" 카드 (자녀 무관 to-do 포함).
- [ ] [US-060] 일정에 `needsPickup` 토글 → 블록 우상단 🚗 아이콘.
- [ ] [US-061] 회차별 픽업 완료 체크 → `schedule_pickup_log` row INSERT/DELETE (UNIQUE 제약으로 idempotent).
- [ ] [US-062] 시간 겹침 + needsPickup ≥2 → sub-bar `⚠ {hh:mm} 픽업 충돌` pill (그리드 블록·푸시 무영향).

## Follow-ups

- ChecklistItem 알림 본문 길이 정책(80자 ellipsis)이 한글 자모 기준에서 깨지는지 시뮬레이터 검증.
- Todo의 자녀 nullable 정책이 UX에서 혼동 없는지 베타 피드백 수집.
- 픽업 충돌 알고리즘이 4 자녀 × 32 일정 한계에서 P50 ≤ 3ms 인지 측정 (open-questions에 추가).
- ADR-001 follow-up "schema 8 tables 넘으면 Drizzle 재검토"의 카운터: 현재 7 tables (한 칸 남음).
