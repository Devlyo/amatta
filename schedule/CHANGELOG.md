# Changelog — schedul-app

형식: `## YYYY-MM-DD — 한 줄 요약`. 위가 최신.

## 2026-11-10 — ADR-007 캘린더 개편 착수 · Phase 0 (토큰 기반)

- ADR-007 Accepted + ralplan v2(`.omc/plans/ralplan-calendar-redesign.md`). 현 디자인 보존 태그 `ui-v1`.
- 토큰: 자녀 팔레트 `deep` 톤(민트·스카이·피치는 잠정값), `withAlpha`/`kidFill`(source 기준 알파), `TOKENS.groupedBg`·`sunday`·`guardian`·`guardianDeep`, `RADIUS.box`(14), iOS 스케일 타이포 프리셋(largeTitle·headline·row·subhead·footnote·blockTitle).
- `fmtRange`(`3–4PM` 표기) 추가, `fmt12hrShort(1440)`가 `12PM`으로 나오던 버그 수정.
- 이름이 색과 어긋난 `KidPaletteKey` 별칭(peach=핑크 등) 삭제.

## 2026-11-10 — Chore: 미사용 코드·의존성 정리

- 삭제: `src/ui/grid/`(DailyGrid·SlotCell·ScheduleBlock) + `layoutDay`/`BlockLayout`, `sheet-container.tsx`, `constants/Colors.ts`, 미사용 아이콘 8종(Car·Grid·Bell·Sparkle·Brain·Game·Pencil·Emoji), `AVATAR_ANIMALS`·`LOGOS` 및 PNG 6개(원본은 `docs/design/amatta-v1/assets/`에 유지).
- 의존성 제거: `@gorhom/bottom-sheet`, `expo-haptics`, `expo-web-browser`, `@testing-library/jest-native` (네이티브 모듈 2종 제거 → 다음 배포는 새 네이티브 빌드 필요).
- gorhom을 전제로 한 낡은 주석을 ADR-004(네이티브 라우트) 기준으로 정정.

## 2026-11-10 — Fix: 백업 준비물 반복 정보 누락 + 알림 재예약 중복 실행

- **백업(JSON export)**: `checklist_items` SELECT에 `occurrence_date`·`recurring` 누락 → 모든 항목이 `recurring:false`·앵커 없음으로 내보내지던 문제 수정. `app_settings`(알림 설정)도 `appSettings`로 포함. `EXPORT_SCHEMA_VERSION` 3 → **4** (v3 번들의 membership 필드는 신뢰 불가 — 가져오기 구현 시 NULL/매번으로 취급).
- **알림**: `rescheduleAll()`을 직렬화 + 병합(coalesce). 스토어 변경마다 un-await로 호출돼 실행이 겹치면 `cancelAll`/예약이 뒤섞여 중복·stale 알림이 남던 문제 수정 (scheduler invariant 5). 3개 스토어의 `reconcile` 복사본은 `requestReschedule` 하나로 통합.
- 회귀 테스트 추가: export membership round-trip, 동시 호출 중복 없음·비인터리빙·trailing run·실패 후 복구.

## 2026-05-05 — Scope expansion: 준비물·할 일·픽업 트래킹 (ADR-002)

- ADR-002 채택 (`docs/architecture/ADR-002-prep-todos-pickup.md`)
- V1.0 In Scope 3개 영역 추가:
  - **준비물(ChecklistItem)**: Schedule 종속 체크리스트, 일정 알림 본문에 자동 prepend
  - **할 일(Todo)**: Schedule 독립 1회성, dueAt 기반 로컬 푸시
  - **픽업 트래킹**: `Schedule.needs_pickup` boolean + 회차별 완료는 별도 테이블 `schedule_pickup_log` (`docs/meetings/2026-05-05-pickup-log-table.md`, 옵션 B). 시간 겹침 시 sub-bar 충돌 pill만 (블록 오버레이·푸시 X)
- 마이그레이션 v2 정의 (테이블 4 → 7: ChecklistItem, Todo, SchedulePickupLog 추가)
- CLAUDE.md Locked Decisions 갱신 (entities 7종·알림 정책·충돌 인디케이터)
- BACKLOG에 user stories 추가: US-015~017, US-024, US-050~052, US-060~062, SPEC-DB-3
- Inputs:
  - 사용자 V0 daily-grid mockup 리뷰 → 회의록(`docs/meetings/2026-05-05-prep-todos-pickup.md`)
  - hugh-lee-hs PR #1 리뷰(CHANGES_REQUESTED) → 픽업 트래킹 옵션 B 채택 후속 회의록(`docs/meetings/2026-05-05-pickup-log-table.md`)

## 2026-05-04 — Project meta scaffold complete

- Deep-interview 7라운드 → ambiguity 5%, ontology 100% 안정 (`.omc/specs/deep-interview-schedul-app.md`)
- ralplan v2 합의 (Architect APPROVE, Critic APPROVE, 5 must-fix 모두 해소) (`.omc/plans/ralplan-schedul-app-v2.md`)
- ADR-001 스택 락: Expo + RN + TS + expo-sqlite + expo-notifications + Zustand (`docs/architecture/ADR-001-stack.md`)
- CLAUDE.md, docs/(product|design|architecture|meetings)/, schedule/(ROADMAP|BACKLOG|SPRINT|CHANGELOG).md 작성
- `.claude/settings.json` hooks 3종 설치 (per-edit eslint --fix, Stop tsc --noEmit, SessionStart expo-doctor)
- `.claude/agents/` 4종: schedule-domain-expert, expo-sqlite-migrator, notification-scheduler, grid-renderer
- `.claude/skills/` 3종: seed-test-data, verify-acceptance, phase-gate
- Expo 프로젝트 부트스트랩 파일들도 함께 생성됨 (executor 과한 실행). 사용자 결정으로 롤백 X — Phase 0 일부 진척 상태로 유지
