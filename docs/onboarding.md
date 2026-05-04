# Onboarding — schedul-app

새로 합류했다면 이 페이지만 30분 안에 읽으면 됩니다.

## 1. 우리가 뭘 만드는가
한 줄: **학부모가 자녀들의 학원·학교 일정을 일간 자녀×시간 그리드로 동시 비교하는 로컬 모바일 앱.**

- 풀 컨텍스트: `CLAUDE.md` (루트) → `.omc/specs/deep-interview-schedul-app.md`

## 2. 어떻게 만드는가
- Stack: Expo + React Native + TypeScript + expo-sqlite + expo-notifications
- 실행 계획 v2: `.omc/plans/ralplan-schedul-app-v2.md`

## 3. 어디에 뭐가 있는가
| 폴더 | 무엇 |
|---|---|
| `app/` | Expo Router 화면 |
| `src/` | 도메인·DB·UI 모듈 (생성 예정) |
| `tests/` | jest 테스트 |
| `docs/product/` | PRD·페르소나·유저스토리 |
| `docs/design/` | UI 가이드 |
| `docs/architecture/` | ADR |
| `docs/meetings/` | 회의록 |
| `schedule/` | 로드맵·백로그·스프린트·체인지로그 |
| `.omc/` | Claude 자동화 산출물 (specs/plans만 공유, 나머지 gitignore) |
| `.claude/` | Claude 동작 설정 (hooks·agents·skills) |

## 4. 매일/매주 흐름
- **할 일 잡기**: `schedule/BACKLOG.md` 보고 우선순위 P0/P1 끌어와서 `schedule/SPRINT.md` 에 옮김
- **회의 후**: `docs/meetings/YYYY-MM-DD-주제.md` 메모 추가
- **큰 결정**: ADR 작성 → `docs/architecture/ADR-NNN-주제.md`, 그리고 `CLAUDE.md` *Locked Decisions* 갱신
- **완료**: `schedule/CHANGELOG.md` 에 한 줄

## 5. Claude와 협업하기
- 매 세션 시작 시 `CLAUDE.md`가 자동 로드됨
- 코드 변경 시 `eslint --fix` 자동, 턴 끝날 때 `tsc --noEmit` 자동
- 큰 작업은 `/oh-my-claudecode:ralplan` 으로 합의 후 진행
- 도메인 로직은 `schedule-domain-expert` 에이전트에게, 마이그레이션은 `expo-sqlite-migrator`, 알림은 `notification-scheduler`, 그리드는 `grid-renderer`

## 6. 환경 셋업 (개발 시작 시점에)
```bash
# (아직 npm install 전 — 사용자가 "Phase 1 가자" 신호 주면 진행)
npm install
npx expo-doctor
npx expo start
```

## 7. 헷갈리면
- 제품 질문 → `docs/product/PRD.md`
- 기술 결정 이유 → `docs/architecture/`
- 누가 뭘 결정했나 → `docs/meetings/`
- 지금 누가 뭐 하고 있나 → `schedule/SPRINT.md`
