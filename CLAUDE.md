# schedul-app — Claude Project Context

> 이 파일은 Claude가 매 세션 자동 로드합니다. **항상 알아야 하는 핵심**만 적습니다.
> 디테일은 아래 *Authoritative Documents* 의 링크를 따라가세요.

## 한 줄 요약
학부모가 자녀 4명까지의 학원·학교 일정을 등록하고, **일간 자녀×시간 그리드**(타임 스프레드)로 동시 비교하는 모바일 앱. 로컬 SQLite 단독, 서버/계정 없음, 로컬 푸시 알림 필수.

## Locked Decisions (변경하려면 새 ADR 필요)
- **Stack**: Expo SDK ~54 + React Native 0.81 (new arch) + TypeScript + expo-sqlite + expo-notifications + expo-router
- **UI**: bare RN primitives + react-native-gesture-handler + react-native-reanimated. 시트/모달은 네이티브 expo-router 라우트(ADR-004) — **@gorhom/bottom-sheet 미사용**(deps엔 남아 있으나 제거 가능)
- **State**: Zustand (per-slice)
- **DB 접근**: raw SQL + 손수 마이그레이션 (PRAGMA user_version 트랜잭션 안쪽)
- **Recurrence**: daysOfWeek 비트마스크 + ScheduleException 단일 예외 only (NO RRULE)
- **그리드**: 06:00–23:00 / 30분 슬롯 / 자녀 최대 4명 / 6색 팔레트 / 일정 타입 4종 (school|academy|activity|other)
- **TS**: strict + noUncheckedIndexedAccess (NO exactOptionalPropertyTypes)
- **온라인 기능 일체 없음**: 회원가입·로그인·가족공유·클라우드동기화 모두 비목표
- **Entities (ADR-002, ADR-006)**: Child / Schedule / ScheduleException / NotificationSetting + **ChecklistItem · Todo · SchedulePickupLog · ChecklistCompletion** (총 8 tables)
- **준비물 반복/완료 (ADR-006, PREP-RECUR)**: ChecklistItem 완료는 **회차별 로그** `checklist_completion(checklist_item_id, occurrence_date, completed_at)` UNIQUE — 픽업 로그 패턴 미러. 완료 단일 출처(`is_done/done_at`는 FROZEN, v7에서 drop). 항목별 `occurrence_date` nullable = **NULL 반복 / 값 당일전용**. 항목별 "반복" 토글 기본 OFF(당일), 단 EditSheet 추가는 기본 반복(NULL)·일간/상세 추가는 기본 당일(D). `occurrence_date`는 **yyyymmdd INT**(`isoToYyyymmdd`). 알림 본문은 그 회차 완료분 제외(Option A). 마이그레이션 v6 = atomicity-gated(idempotency 아님).
- **Schedule extra (ADR-002)**: `needs_pickup` boolean. ScheduleException은 손대지 않음 (kind CHECK 제약 유지). 회차별 픽업 완료는 `schedule_pickup_log(schedule_id, occurrence_date, completed_at)` UNIQUE 제약으로 별도 기록.
- **알림 정책 (ADR-002)**: 일정 알림 본문에 ChecklistItem 자동 prepend(≤80자). Todo는 dueAt 기반 단독 푸시. **그 외 새 푸시 surface 금지** (충돌 푸시 X).
- **픽업 시각화 (ADR-003, ADR-002 supersede)**: 일간 그리드 상단 `PickupCarousel` 단일 위치. 다음 픽업 1+개를 swipe 가능 카드(Sunset Orange / French Lavender bg)로 표시. 동시 시간 픽업 ≥ 2 → carousel 추가 카드. 블록 오버레이·푸시 둘 다 금지. `⚠ {hh:mm} 픽업 충돌` sub-bar pill은 ADR-003에서 폐기.
- **NOW 라인 (ADR-003)**: 일간 그리드 라임색 NOW 라인은 분 단위 실시간 갱신 (setInterval 60s + 다음 분 경계 align + AppState focus 즉시 동기화).
- **모달/시트 (ADR-004)**: 모든 바텀시트·모달 = expo-router 네이티브 라우트. 짧은 시트 = `presentation:'formSheet'` + `sheetAllowedDetents`(분수/`'fitToContents'`); 큰 폼(새일정·수정·상세) = `presentation:'modal'`. **gorhom 미사용** (iOS "닫은 뒤 두 번 탭" 버그). 앱 라이트모드 런타임 고정(`Appearance.setColorScheme('light')` in `_layout`). 키보드 = `ScrollView automaticallyAdjustKeyboardInsets`.
- **디자인 시스템 (ADR 없음, 2026-06 신설)**: `src/ui` 토큰(`spacing`·`radius`·`typography`·`elevation` + `palette` TOKENS) + `src/ui/components` primitives(Text·Button·Card·Input·Fab·Pill·Badge·SelectChip·DayCircle·Toggle·DateField·DashedAddButton·Segmented). **임의 색·크기·shadow 리터럴 금지 — 토큰 사용**. dev 갤러리: 설정→개발자→🎨 (`__DEV__`, `app/dev-gallery.tsx`).

## Authoritative Documents
| 무엇 | 어디 |
|---|---|
| 풀 spec (deep interview 결과) | `.omc/specs/deep-interview-schedul-app.md` |
| 합의된 실행 계획 v2 | `.omc/plans/ralplan-schedul-app-v2.md` |
| Architect/Critic 리뷰 | `.omc/plans/ralplan-schedul-app-v2.{architect,critic}-review.md` |
| 보류된 결정 | `.omc/plans/open-questions.md` |
| 제품 PRD·페르소나 | `docs/product/` |
| 아키텍처·ADR | `docs/architecture/` (ADR-001 stack lock, ADR-002 prep·todos·pickup, ADR-003 pickup carousel + NOW tick, **ADR-004 modal sheets — 네이티브 formSheet/modal, gorhom 미사용**) |
| UI/UX 가이드 | `docs/design/` |
| 회의록 | `docs/meetings/` |
| 로드맵·백로그·스프린트 | `schedule/` |

## 협업 규칙
- 큰 결정은 `docs/architecture/ADR-NNN-주제.md`로 기록 후 이 파일의 *Locked Decisions* 갱신
- 회의록: `docs/meetings/YYYY-MM-DD-주제.md`
- 작업: `schedule/BACKLOG.md` → `schedule/SPRINT.md` → 완료 시 `schedule/CHANGELOG.md`
- spec/plan을 직접 수정하지 말고, 변경이 필요하면 새 ADR 또는 새 deep-interview round로 처리

## Claude 동작 메모
- `.claude/settings.json` hooks 활성: per-edit eslint --fix, Stop hook tsc --noEmit --incremental
- `.claude/agents/` 의 전문 에이전트 자동 라우팅: 도메인 로직 → schedule-domain-expert, 마이그레이션 → expo-sqlite-migrator, 알림 → notification-scheduler, 그리드 UI → grid-renderer
- 사용자가 명시 신호("이제 코드 시작"·"Phase N 가자") 주기 전까지 **코드 작성 금지**, 문서·계획만 작업
- 큰 변경은 ralplan(Planner→Architect→Critic) 거친 후 진행
