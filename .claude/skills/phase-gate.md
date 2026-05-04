---
name: phase-gate
description: Run the v2-plan smoke gate (expo-doctor → expo export → tsc → eslint → jest) before entering or exiting a Phase. Each command must exit 0. Captures output to .omc/logs/phase-gate.log and emits a single PASS/FAIL row.
---

# Skill: phase-gate

## When to use
- Before starting a new Phase from `.omc/plans/ralplan-schedul-app-v2.md`.
- Before declaring a Phase complete.
- Before any commit that touches build config (`tsconfig.json`, `package.json`, `eslint.config.js`).
- When user asks "smoke test" or "phase 게이트 돌려".

## When NOT to use
- For per-file lint (use the PostToolUse hook).
- For a quick syntax check (use `tsc --noEmit` directly).

## Commands (in order, each must exit 0)

```bash
set -e
mkdir -p .omc/logs
LOG=.omc/logs/phase-gate.log
TS=$(date +%Y-%m-%dT%H:%M:%S)

echo "=== phase-gate $TS ===" >> "$LOG"

EXPO_NO_TELEMETRY=1 npx expo-doctor                              2>&1 | tee -a "$LOG"
EXPO_NO_TELEMETRY=1 timeout 60s npx expo export --platform all --dump-assetmap 2>&1 | tee -a "$LOG"
npx tsc --noEmit                                                 2>&1 | tee -a "$LOG"
npx eslint .                                                     2>&1 | tee -a "$LOG"
npx jest --passWithNoTests                                       2>&1 | tee -a "$LOG"

echo "$TS PASS" >> "$LOG"
```

## On failure

1. Stop at the first non-zero exit code.
2. Append `$TS FAIL <step>` to the log.
3. Print the last 30 lines of the failing command to chat.
4. Do NOT auto-fix — surface the failure for the user to decide.

## Output format
```
phase-gate result: PASS | FAIL
- expo-doctor:  ok | warn | fail (X warnings)
- expo export:  ok | fail (Y errors)
- tsc:          ok | fail (Z errors)
- eslint:       ok | fail (N issues)
- jest:         ok | fail (M failed tests)
```

## Hard rules
- The 5-command order is fixed. Don't reorder.
- `expo export --platform all` is non-interactive (no `expo start`). Honor the `timeout 60s` so a hang doesn't pin the agent.
- The log is append-only. Never truncate `.omc/logs/phase-gate.log`.
- `EXPO_NO_TELEMETRY=1` must be set on every Expo command in this skill.
