# Changelog — schedul-app

형식: `## YYYY-MM-DD — 한 줄 요약`. 위가 최신.

## 2026-05-04 — Project meta scaffold complete

- Deep-interview 7라운드 → ambiguity 5%, ontology 100% 안정 (`.omc/specs/deep-interview-schedul-app.md`)
- ralplan v2 합의 (Architect APPROVE, Critic APPROVE, 5 must-fix 모두 해소) (`.omc/plans/ralplan-schedul-app-v2.md`)
- ADR-001 스택 락: Expo + RN + TS + expo-sqlite + expo-notifications + Zustand (`docs/architecture/ADR-001-stack.md`)
- CLAUDE.md, docs/(product|design|architecture|meetings)/, schedule/(ROADMAP|BACKLOG|SPRINT|CHANGELOG).md 작성
- `.claude/settings.json` hooks 3종 설치 (per-edit eslint --fix, Stop tsc --noEmit, SessionStart expo-doctor)
- `.claude/agents/` 4종: schedule-domain-expert, expo-sqlite-migrator, notification-scheduler, grid-renderer
- `.claude/skills/` 3종: seed-test-data, verify-acceptance, phase-gate
- Expo 프로젝트 부트스트랩 파일들도 함께 생성됨 (executor 과한 실행). 사용자 결정으로 롤백 X — Phase 0 일부 진척 상태로 유지
