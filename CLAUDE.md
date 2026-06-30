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
- **준비물 반복/완료 (ADR-006/006a/006b, PREP-RECUR)**: 완료는 **회차별 로그** `checklist_completion(checklist_item_id, occurrence_date, completed_at)` UNIQUE(픽업 패턴), keying은 viewed-date. `is_done/done_at` FROZEN. **멤버십(v7): `occurrence_date`=앵커 + `recurring` 플래그** — NULL=항상(레거시) / recurring=1 매번(`O>=앵커`, 등록일 forward) / recurring=0 이번만(`O===앵커`). 단일 헬퍼 `isChecklistItemVisibleOn`을 3곳(일간 탭·알림 scheduler·상세 EventDetailDrawer)에 적용. EditSheet: 새 항목 앵커=boundDateInt + recurring 기본 true, ↻ pill은 `recurring` 토글; 1회성 저장은 occ=null/recurring=true 정규화(3 지점). ↻ 글리프 = vector-icons(RNSVG 차단). `occurrence_date`=yyyymmdd INT. 알림 본문 그 회차 완료분 제외(Option A). 마이그 v6/v7 = atomicity-gated.
- **준비물 반복 토글 UI (ADR-006a, A안)**: 항목별 반복 컨트롤 = **↻ pill**(이전 라벨+스위치 폐기). **반복 일정(`daysOfWeek !== 0`)일 때만 렌더**(1회성은 조건부 미렌더 = 단순 리스트). 새 항목 기본 **매번**(`occurrence_date = NULL`). ON="매번"(primaryTint/primaryDeep), OFF=아이콘 only(ink30) — 토큰만(리터럴 금지). ↻ 글리프 = `@expo/vector-icons` Ionicons `repeat`(react-native-svg 금지, A-ICONS). **이번만 OFF = 편집을 연 날짜에 귀속**(`boundDateInt`; fix-1로 `EventDetailDrawer.handleEditAll`이 `occurrenceDate` 전달). 1회성 저장(`daysOfWeek===0`) 시 **diff 이전 단일 변환**으로 전 행 `occurrence_date`→NULL(create/INSERT/UPDATE 3 지점 모두 커버 → 고아 행 방지).
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
| 아키텍처·ADR | `docs/architecture/` (ADR-001 stack lock, ADR-002 prep·todos·pickup, ADR-003 pickup carousel + NOW tick, **ADR-004 modal sheets — 네이티브 formSheet/modal, gorhom 미사용**, ADR-006 PREP-RECUR 회차별 완료, **ADR-006a 준비물 반복 ↻ pill — 반복 일정 종속 노출**) |
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
