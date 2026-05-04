# Current sprint — Meta scaffold completion

- **Started**: 2026-05-04
- **Goal**: 개발 시작 *전* 의 모든 메타(docs/agents/skills/hooks) 셋업
- **Exit criteria**: 사용자가 "Phase 1 가자" 신호를 줄 수 있는 상태

## In progress / done this sprint

- [x] deep-interview spec (`.omc/specs/deep-interview-schedul-app.md`)
- [x] ralplan v2 합의 (`.omc/plans/ralplan-schedul-app-v2.md` + 리뷰들)
- [x] `.claude/settings.json` hooks
- [x] `CLAUDE.md`
- [x] `docs/onboarding.md`, `docs/product/{PRD,personas,user-stories}.md`
- [x] `docs/architecture/ADR-001-stack.md`
- [x] `docs/design/README.md` (seed)
- [x] `docs/meetings/2026-05-04-kickoff.md`
- [x] `schedule/{ROADMAP,BACKLOG,SPRINT,CHANGELOG}.md`
- [x] `.claude/agents/{schedule-domain-expert,expo-sqlite-migrator,notification-scheduler,grid-renderer}.md`
- [x] `.claude/skills/{seed-test-data,verify-acceptance,phase-gate}.md`
- [ ] `.gitignore` patches for `.omc/state/`, `.omc/notepad.md`, `.omc/project-memory.json`, `.omc/research/`
- [ ] CLAUDE.md cross-reference 검증 (모든 인용 경로 존재 확인)

## Out of this sprint (do NOT pull yet)
- Phase 0 smoke gate 실제 실행 (사용자 트리거 필요)
- 첫 git commit
- 모든 Phase 1+ 작업

## 다음 스프린트 후보 (사용자 신호 받으면)
1. **Phase 0 close-out**: smoke gate 실행 + 첫 커밋
2. **Phase 1**: SQLite 스키마 v1 + 마이그레이션 러너 + occurrence 알고리즘
