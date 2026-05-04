---
name: verify-acceptance
description: Walk through every Acceptance Criterion in .omc/specs/deep-interview-schedul-app.md and produce a pass/fail report. Read-only verification — no code changes.
---

# Skill: verify-acceptance

## When to use
- Before declaring a Phase complete.
- Before promoting a build to manual QA.
- When the user asks "are we done?" or "어디까지 됐어?".

## When NOT to use
- For code changes (this is read-only).
- For adding new criteria — those go through ADR / spec amendment.

## Procedure

1. Read `.omc/specs/deep-interview-schedul-app.md` § Acceptance Criteria.
2. For each criterion, decide one of:
   - ✅ PASS — automated test exists and is green
   - 🟡 PASS-MANUAL — only verifiable by manual run; check git log or QA notes for evidence
   - ❌ FAIL — code not present or tests red
   - ⏳ PENDING — not yet implemented, expected per phase ordering
3. For PASS, cite the test file path + line range as evidence.
4. For FAIL/PENDING, cite which phase of `.omc/plans/ralplan-schedul-app-v2.md` covers it.
5. Emit a markdown table to stdout AND append a copy to `.omc/logs/acceptance-YYYY-MM-DD.md`.

## Output format

```markdown
# Acceptance verification — <date>

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | SQLite migration auto-runs on first launch | ✅ PASS | tests/db/migrations.test.ts:42-78 |
| 2 | Child max 4 enforced | ⏳ PENDING | Phase 2 §3 (repositories) |
| ... |

Summary: 12/24 PASS, 5/24 PASS-MANUAL, 0/24 FAIL, 7/24 PENDING.
Next phase to unlock: Phase 3 (Daily Spread UI).
```

## Hard rules
- Do NOT modify any source file.
- Do NOT run destructive commands (no `git checkout`, no `rm`).
- DO run read-only test commands like `jest --listTests`, `tsc --noEmit`, `eslint --no-fix`.
- If a criterion is ambiguous, mark `🟡 PASS-MANUAL` with a note — never silently mark PASS.
