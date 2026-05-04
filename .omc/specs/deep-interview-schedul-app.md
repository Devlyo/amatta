# Deep Interview Spec: schedul-app (학부모 자녀 스케줄 관리 앱)

## Metadata
- Interview ID: schedul-app-2026-05-04
- Rounds: 7
- Final Ambiguity Score: 5.0%
- Type: greenfield
- Generated: 2026-05-04
- Threshold: 0.20
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|---|---|---|---|
| Goal Clarity | 0.95 | 0.40 | 0.380 |
| Constraint Clarity | 0.95 | 0.30 | 0.285 |
| Success Criteria | 0.95 | 0.30 | 0.285 |
| **Total Clarity** | | | **0.950** |
| **Ambiguity** | | | **0.050** |

## Goal

학부모가 한 디바이스(iOS/Android)에서 **여러 자녀의 학원/학교 스케줄을 등록**하고, 메인 화면에서 **`가로=자녀 / 세로=시간`의 일간 타임 스프레드 그리드**로 자녀들의 일정을 동시에 비교하며, 자녀 이름을 탭하면 그 자녀의 **주간 캘린더**로 드릴다운한다. 데이터는 디바이스 로컬 SQLite에만 저장되며 OS 제공 백업(iCloud Documents / Android Auto Backup)에 의존한다. 일정 시작 N분 전 로컬 푸시 알림이 자녀별 설정에 따라 발송된다.

## Constraints

- **플랫폼**: iOS + Android (Expo / React Native + TypeScript 단일 코드베이스)
- **데이터 저장**: `expo-sqlite` 로컬 DB. 외부 서버/계정 없음.
- **백업**: OS 제공 자동 백업만 사용(iCloud Documents on iOS, Auto Backup on Android). 별도 클라우드 동기화 구현 없음.
- **알림**: `expo-notifications` 로컬 알림(원격 푸시 X). 자녀별 minutesBefore 설정.
- **다자녀 수**: 최대 4명 고정.
- **그리드 시간 단위**: 30분 고정.
- **표시 시간 범위**: 06:00–23:00 고정.
- **자녀 색상**: 6색 팔레트에서 선택(자유색상 X).
- **일정 타입**: `school | academy | activity | other` 4종 고정.
- **반복**: 요일 반복(daysOfWeek 비트마스크) + 단일 예외(ScheduleException) 만. iCal RRULE 등 복잡 규칙 미지원.
- **시간 포맷**: 24h 분 단위(예: `17:30`). 12h 토글 없음.
- **온라인 기능 일체 없음**: 회원가입, 로그인, 가족 공유, 클라우드 동기화 모두 비목표.

## Non-Goals

- 서버, 회원가입, 로그인, 비밀번호 재설정 등 모든 인증/계정 시스템.
- 가족 다중 사용자 동시 편집 / 배우자 공유.
- iCal RRULE 수준의 복잡 반복(매달 N번째 주 요일, 격주 등).
- 외부 캘린더(Google Calendar, iOS Calendar) 양방향 연동.
- 위젯 / Live Activity / 홈스크린 위젯(향후 단계로 분리).
- 다국어. 일단 한국어 단일 로케일.
- 학원비 정산, 출결 체크인 같은 부가 기능.

## Acceptance Criteria

데이터 모델 / DB
- [ ] SQLite 스키마 마이그레이션이 첫 실행 시 자동 생성되고, 두 번째 실행 이후에는 동일 데이터가 보존된다.
- [ ] `Child` 최대 4명 등록·수정·삭제 가능. 자녀 색상은 6색 팔레트 중 선택.
- [ ] `Schedule`은 `daysOfWeek`(비트마스크), `startTime`, `endTime`, `validFrom`, `validUntil`, `type`, `title`, `location?`, `notes?`, `notifyMinutesBefore?` 필드를 갖는다.
- [ ] 특정 날짜 일정 1회 취소/수정은 `ScheduleException`으로 표현된다(원본 Schedule 레코드 변경 X).

뷰
- [ ] 메인 화면은 일간 타임 스프레드(가로=자녀, 세로=06:00–23:00 30분 grid)를 렌더링한다.
- [ ] 일정 블록은 자녀 색상으로 표시되고, 30분 미만 짜투리는 30분 슬롯 안에 시각적으로 보존된다(잘림 X).
- [ ] 자녀 이름 헤더 탭 → 해당 자녀의 주간 캘린더(가로=요일, 세로=시간)로 드릴다운.
- [ ] 메인 화면에서 좌우 스와이프로 전일/익일 이동.

CRUD
- [ ] 메인 화면 빈 슬롯 탭 → 일정 추가 시트 오픈, 자녀·타입·시간·반복요일·알림분 입력 후 저장.
- [ ] 일정 블록 탭 → 수정/삭제 시트. 삭제 시 "이 회차만" / "전체" 선택 가능(전자는 ScheduleException, 후자는 Schedule 삭제).

알림
- [ ] 일정 등록·수정 시 OS 알림 권한이 필요하면 자동 요청한다.
- [ ] `notifyMinutesBefore`가 설정된 일정은 향후 N일치 트리거가 OS notification scheduler에 등록된다.
- [ ] 일정 삭제 / 회차 취소 시 해당 알림이 OS scheduler에서 제거된다.
- [ ] 앱이 종료된 상태에서도 등록된 알림이 정상 발생한다.

품질 게이트
- [ ] TypeScript strict mode 빌드 무경고.
- [ ] DB 레이어(Schedule 발생 인스턴스 계산, 예외 적용)의 단위 테스트 커버리지 ≥ 80%.
- [ ] iOS 시뮬레이터(iOS 16+) / Android 에뮬레이터(API 33+) 양쪽에서 핵심 시나리오(등록→표시→알림→삭제) 수동 통과.

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|---|---|---|
| 온라인 동기화는 절대 안 함 | 배우자 공유/기기변경 시 데이터 유실 위험을 contrarian 모드로 도전 | 의도된 결정 — 단 OS 자동 백업(iCloud/AndroidAutoBackup)은 활용해 기기변경 대비 |
| "타임 스프레드"의 모양 | 사용자가 시각화 미정 → 추천 요청 | 일간(자녀×시간) 메인 + 자녀 주간 드릴다운으로 확정 |
| 반복 일정 복잡도 | RRULE까지 가야 하나? | 요일반복+단일예외만 — 학원 일정 90% 커버 |
| 알림 필요 여부 | 단순 표시 앱일 수도? | 필수로 결정 — 학부모 픽업 동선의 핵심 |
| 자녀 수, 시간 단위 등 옵션 | 모두 사용자 설정으로? | simplifier 도전 — 디폴트로 잠금(4명/30분/06-23h/6색/4타입) |
| 모바일 스택 | 네이티브 vs 크로스플랫폼 | Expo + RN + TS 확정(이유: 단일 코드베이스, 공식 지원 모듈로 모든 요구 커버) |

## Technical Context (Greenfield)

### 스택 결정
- **앱 프레임워크**: Expo SDK (React Native + TypeScript)
- **로컬 DB**: `expo-sqlite` (Drizzle ORM 또는 raw SQL — 결정은 Phase 1 ralplan에서 Architect가 검토)
- **알림**: `expo-notifications` (로컬 스케줄링)
- **UI 라이브러리**: 후보 — `react-native-gesture-handler` + 커스텀 grid, `tamagui` 또는 `react-native-paper` (Phase 1에서 결정)
- **상태 관리**: 후보 — Zustand or React Context + reducer (Phase 1에서 결정)
- **테스트**: `jest` + `@testing-library/react-native`
- **린트/포맷**: ESLint(typescript-eslint) + Prettier
- **타입체크**: `tsc --noEmit` strict

### 디렉토리 초안 (제안, 변경 가능)
```
schedul-app/
├── app/                          # Expo Router 화면
│   ├── (tabs)/
│   │   ├── index.tsx             # 메인 일간 스프레드
│   │   └── settings.tsx
│   ├── child/[id].tsx            # 자녀 주간 드릴다운
│   └── schedule/edit.tsx         # 일정 추가/수정 시트
├── src/
│   ├── db/
│   │   ├── schema.ts             # SQLite 스키마 + 마이그레이션
│   │   ├── repositories/
│   │   └── occurrences.ts        # daysOfWeek + exceptions → 인스턴스 전개
│   ├── domain/                   # 순수 함수, DB 비의존
│   ├── notifications/
│   ├── ui/                       # grid, schedule block, color palette
│   └── hooks/
└── tests/
```

## 개발 환경 사전 셋업 (Phase 0 — 사용자 명시 요구)

> 사용자는 본 인터뷰 도입부에서 "개발 *시작 전*에 skills/hooks/agents 설정"을 명시적으로 요구함. 이 항목은 spec의 일부로서, autopilot/ralph 진입 전에 *반드시* 통과되어야 한다.

### Skills (OMC 슬래시 커맨드)
이 프로젝트에서 자주 쓸 OMC 스킬:
- `/oh-my-claudecode:autopilot` — 본 spec을 입력으로 전체 자율 실행.
- `/oh-my-claudecode:ralplan` — Planner/Architect/Critic 합의 정제. spec → 실행계획 변환.
- `/oh-my-claudecode:ultrawork` — 병렬 태스크 실행기 (다중 컴포넌트 동시 작업).
- `/oh-my-claudecode:trace` — 알림 미발생 등 인과 추적이 필요한 디버깅 라운드.
- `/oh-my-claudecode:visual-verdict` — 그리드 UI 시각 QA(스크린샷 비교).
- `/frontend-design:frontend-design` — 그리드 컴포넌트 시각 디자인 단계.

### Hooks (`.claude/settings.json`)
다음 hook을 프로젝트 settings.json에 설치:
- **PreToolUse → Bash**: 병렬 실행 권장 메시지(이미 글로벌 존재 확인됨).
- **PostToolUse → Edit/Write**: TypeScript 변경 시 `tsc --noEmit` 자동 실행 + ESLint --fix.
- **PostToolUse → Edit/Write (테스트 영역)**: jest watch trigger.
- **UserPromptSubmit**: vague 요청에 ralplan gate 자동 권유(글로벌 OMC 동작과 호환).
- **SessionStart**: 마지막 빌드 상태(`expo-doctor` 결과) 1줄 요약.

### Agents (subagent_type)
이 프로젝트에서 가장 자주 쓰일 OMC 에이전트:
- `executor` (sonnet/opus) — 코드 작성.
- `oh-my-claudecode:explore` — 코드 탐색.
- `architect` — DB 스키마/그리드 렌더링 알고리즘 검토.
- `code-reviewer` — PR 단위 리뷰.
- `qa-tester` — Expo 시뮬레이터 인터랙티브 테스트(tmux).
- `oh-my-claudecode:visual-verdict` — UI 픽셀 검증.
- `tracer` — 알림이 안 뜬다 같은 인과 추적.
- `document-specialist` — Expo / expo-sqlite / expo-notifications 공식 문서 참조.

### MVP Phase 0 체크리스트 (Pre-execution)
- [ ] `npx create-expo-app schedul-app --template default` 또는 `--template tabs`.
- [ ] TypeScript strict, ESLint, Prettier 설치 + 설정.
- [ ] `expo-sqlite`, `expo-notifications`, `expo-router` 설치.
- [ ] `jest-expo` + `@testing-library/react-native` 설정.
- [ ] `.claude/settings.json` 에 위 hooks 등록.
- [ ] `.gitignore` 표준 RN/Expo 패턴.
- [ ] `git init` + 첫 커밋 (`chore: bootstrap expo + tooling`).

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|---|---|---|---|
| Parent | core domain | (implicit single user) | owns Children |
| Child | core domain | id, name, color(palette idx), createdAt | has many Schedule |
| Schedule | core domain | id, childId, title, type, location?, notes?, daysOfWeek(bitmask), startTime, endTime, validFrom, validUntil?, notifyMinutesBefore? | belongs to Child, has many ScheduleException |
| ScheduleException | core domain | id, scheduleId, date, kind(cancel\|modify), overrideStartTime?, overrideEndTime?, overrideTitle? | belongs to Schedule |
| ScheduleType | supporting | enum: school \| academy \| activity \| other | applied to Schedule.type |
| NotificationSetting | supporting | childId, minutesBefore, sound, enabled | belongs to Child (default for new schedules) |
| DailyView | supporting (UI) | date, children[], slots(30min × 06–23h) | renders Schedule occurrences |
| WeeklyView | supporting (UI) | childId, weekStart, days[7], slots | renders one Child's Schedule occurrences |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Removed | Stability |
|---|---|---|---|---|---|---|
| 1 | 6 | 6 | - | - | - | N/A |
| 2 | 6 | 2 (WeeklyView, ScheduleType) | 1 (TimeSpreadView→DailyView) | 3 | 2 (Academy, School subsumed) | 67% |
| 3 | 7 | 1 (ScheduleException) | - | 6 | - | 86% |
| 4 | 7 | - | - | 7 | - | 100% |
| 5 | 8 | 1 (NotificationSetting) | - | 7 | - | 87.5% |
| 6 | 8 | - | - | 8 | - | 100% |
| 7 | 8 | - | - | 8 | - | 100% |

3라운드 연속 100% 안정 → 도메인 모델 완전 수렴.

## Interview Transcript (요약)

<details>
<summary>전체 7라운드 Q&A</summary>

**R1 — Goal Clarity 타게팅**
- Q: 어떤 플랫폼/실행 환경?
- A: 모바일 앱 (iOS/Android)
- 후 ambiguity: 70.5%

**R2 — Goal Clarity 타게팅**
- Q: "타임 스프레드"의 시각 구조?
- A: 추천 요청 → 추천(일간=자녀×시간 / 드릴다운=자녀 주간) 그대로 채택
- 후 ambiguity: 59%

**R3 — Success Criteria 타게팅**
- Q: 반복 일정 지원 범위?
- A: 요일 반복 + 단일 예외
- 후 ambiguity: 43%

**R4 — Constraints 타게팅 (Contrarian Mode)**
- Q: "온라인 없음"이 진짜 결정인가? 배우자/기기변경 대비는?
- A: 로컬 고수 + iCloud/Google Drive 같은 OS 백업만
- 후 ambiguity: 34%

**R5 — Success Criteria 타게팅**
- Q: MVP에 알림 포함?
- A: 필수 — 일정 N분 전 로컬 푸시 (자녀별 설정)
- 후 ambiguity: 24.5%

**R6 — Success Criteria 타게팅 (Simplifier Mode)**
- Q: 디폴트 묶음(4자녀/30분/06-23h/6색/4타입)으로 잠가도 되나?
- A: 그대로 확정
- 후 ambiguity: 9.2%

**R7 — Constraints 타게팅**
- Q: 모바일 스택?
- A: Expo (RN + TS) + expo-sqlite + expo-notifications
- 후 ambiguity: 5.0%

</details>
