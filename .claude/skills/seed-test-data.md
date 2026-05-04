---
name: seed-test-data
description: Seed the local SQLite DB with QA-ready fixtures (4 children, 8 schedules, 3 exceptions). Run after a fresh install or DB reset to populate the daily/weekly grids for manual testing.
---

# Skill: seed-test-data

## When to use
- After `expo start` on a fresh device/simulator (DB is empty).
- After a manual DB reset during QA.
- When verifying acceptance criteria via the app UI.

## When NOT to use
- In production builds. The skill writes to a dev DB only — **refuse if `__DEV__` is false**.
- When user asks for *real* data entry — this is a fixture seeder, not a real-data import.

## Procedure

1. Read `src/db/repositories/*.ts` to confirm the current insert APIs.
2. Construct the seed payload (see Fixtures below).
3. Wrap inserts in `db.withTransactionAsync(...)` so partial failure rolls back.
4. Run inserts in order: children → schedules → schedule_exceptions → notification_settings.
5. Trigger `rescheduleAll()` so OS notifications match the new DB state.
6. Print a summary: `Seeded N children, M schedules, K exceptions. Notifications rebuilt.`

## Fixtures (deterministic)

### Children (4)
| name | color_index |
|---|---|
| 첫째 | 0 (red) |
| 둘째 | 1 (orange) |
| 셋째 | 2 (yellow) |
| 넷째 | 3 (green) |

### Schedules (8)
| child | title | type | days | start–end | location | notify |
|---|---|---|---|---|---|---|
| 첫째 | 학교 | school | 월–금 | 08:30–14:30 | 행복초 | 0 |
| 첫째 | 피아노 | academy | 월·수·금 | 17:00–18:00 | 베토벤뮤직 | 10 |
| 첫째 | 영어 | academy | 화·목 | 16:00–17:30 | YBM | 5 |
| 둘째 | 학교 | school | 월–금 | 08:30–14:30 | 행복초 | 0 |
| 둘째 | 수학 | academy | 월·화·수 | 15:30–17:00 | CMS | 10 |
| 둘째 | 태권도 | activity | 화·목 | 18:00–19:00 | 송무관 | 15 |
| 셋째 | 유치원 | school | 월–금 | 09:00–13:00 | 햇살유치원 | 0 |
| 넷째 | 미술 | activity | 토 | 10:00–11:30 | 색깔놀이 | 30 |

### Schedule exceptions (3)
| schedule | date | kind | override |
|---|---|---|---|
| 첫째 피아노 | 다음 주 수요일 | cancel | — |
| 둘째 수학 | 내일 | modify | 16:00–17:30 |
| 넷째 미술 | 다음 주 토요일 | cancel | — |

### Notification settings
- Default `minutesBefore` per child mirrors above; sound on, enabled true.

## Output format
```
Seed result:
  children:   4
  schedules:  8
  exceptions: 3
  notif rules: 4
  rescheduleAll: ok
```
