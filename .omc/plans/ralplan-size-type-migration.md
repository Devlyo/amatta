# Ralplan — Size/Typography Token Migration

> Consensus (Planner → Architect → Critic). Critic verdict: ITERATE → the genuine fork is a **design decision for the user** (§10 Q7). This doc presents that fork + the corrected lossless plan. Colors are already migrated + ESLint-enforced; this is the size/type pass.

## 0. THE DECISION (user's call — §10 Q7 is design-led)

The shipped screens are **1:1 ports of the amatta-v1 prototypes**; their off-scale literals (fontSize 13/11/15/17, radius 14/18, padding 14/10/7…) encode the intended design. `docs/design/amatta-v1/DESIGN_SYSTEM.md` §10 Q7 **freezes amatta-v1** ("박제·건드리지 않음") and assigns real re-tokenization to a **future README-based, Claude-Design-led round**. The token files agree: `radius.ts:3` / `spacing.ts:5-6` say off-scale 14/18/10 should **fold INTO** md/lg/12-16, not become new tokens.

So there are two legitimate paths:

- **(D) Lossless now + defer** *(recommended default)* — migrate only pixel-identical literals to existing tokens, document the rest, ship a radius lint, and **capture** the off-scale candidates into a counted inventory for the real v2 round. Mints **zero** new tokens. Honors the freeze. Is a prerequisite of B′ anyway.
- **(B′) Authorize the §10 Q7 round NOW (properly)** — new ADR + README §4/§7/§8 amendment + design sign-off, THEN mint the off-scale tokens data-driven (from counts). Bigger, design-led, changes the "official" scale.

**Recommendation: D.** B′ is only legitimate with the ADR/README/design preconditions, and D's work (lossless snaps + candidate capture) is needed regardless.

## 1. Scope (corrected)
~350–450 size literals (≈92 fontSize lines, ≈88 borderRadius, ≈270 spacing) across `app/` + `src/ui/`. (Earlier "~150" and "~900" were both wrong.)

## 2. Lossless-safe set (Option D — the ONLY things migrated; byte-equivalent = acceptance criterion)
- `borderRadius: 99` → `RADIUS.full` (8×) **and** `borderRadius: 9999` → `RADIUS.full` (28×) — identical render.
- Bare **on-scale** radius → token: `12`→`RADIUS.md`, `16`→`RADIUS.lg`, `24`→`RADIUS.xl`, `6`→`RADIUS.xs`, `8`→`RADIUS.sm`.
- Bare **on-scale** spacing (padding/margin/gap) → `SPACING.*`: `4`→xs, `8`→sm, `12`→md, `16`→lg, `20`→xl, `24`→xxl, `32`→xxxl, `2`→xxs.
- Bare **on-scale** fontSize/lineHeight that EXACTLY equals a TYPE preset → swap to `TYPE.*` ONLY where the whole text style matches a preset (else leave; do not partial-migrate).
- **Everything off-scale stays put**, annotated `// amatta-v1 fidelity (§10 Q7)`: fontSize 8/9/10/11/12.5/13/15/17, radius 14/18/2/1/3, padding 6/7/10/14, etc. Captured to the inventory (§4), NOT tokenized.
- **Mint zero new tokens. No primitive consolidation** (see §6).

## 3. Enforcement (radius lint, with escape hatch — models existing color ban at `eslint.config.js:29-46`)
- `no-restricted-syntax`: ban bare `borderRadius` numeric literals → must be `RADIUS.*`. Specifically flag on-scale `6/8/12/16/24` and pill `99/9999`.
- **Escape hatch (required, else false-positives on fidelity literals):** off-scale radii (14/18/2…) are exempt when the line carries a trailing `// amatta-v1 fidelity (§10 Q7)` comment OR via a per-file override (mirror the palette exemption pattern). 
- **No blanket fontSize/padding lint** — too many legitimate fidelity literals; would be red on day one. (Convention only: new code imports tokens.)

## 4. v2 candidate inventory (replaces "mint tokens now")
`docs/design/v2-token-candidates.md` — for each off-scale value: **value · occurrence count · file list**. Generate from grep. Resolves the data the Q7 round needs (e.g. fontSize 13 ≈ 13× / 8 files, fontSize 10 ≈ 13×, fontSize 11/15 ≈ 9×, padding 6 ≈ 35×, padding 10 ≈ 24×, padding 14 ≈ 11×, radius 14 ≈ 9×, radius 18 ≈ 3×). Makes B′ a small approval step later, not a from-scratch effort. ("deferred round may never happen" → pre-baked.)

## 5. Two-tier verification (right-sized)
- **Byte-equivalent ops (all of Option D):** `git diff` review confirming each change is literal→token with identical pixels + `tsc --noEmit` + `eslint src app` (0 err) + `jest` (341). NO device screenshot needed (pixels mathematically unchanged).
- **Pixel-affecting ops (NONE in D; only the deferred sheet consolidation):** device amatta-v1 visual-verdict.

## 6. Deferred to the v2/Q7 round (NOT this pass)
- Minting TYPE.label/micro/body15, RADIUS.card/soft, SPACING half-steps.
- `ScheduleEditSheet` local `Pill`/`DayCircle`/`ToggleSwitch` → shared primitives: CONFIRMED pixel deltas (local 7/13/12.5/r99 vs shared SPACING 4/12 / caption12 / RADIUS.full) → defer.
- Wholesale `<Text>`→`<Text variant>` swaps (re-chrome risk).

## 7. File order (Option D)
- **Phase 0:** radius `99`/`9999`→`RADIUS.full` everywhere + add the radius lint (+ escape hatch). Generate the v2-candidate inventory.
- **Pilot:** a real-surface file with on-scale snaps + off-scale fidelity literals + the lint — e.g. `src/ui/daily/TopBar.tsx` or `drawers/EventDetailDrawer.tsx` (NOT legal.tsx — too trivial to validate the escape hatch).
- Then groups, low→high: settings → onboarding → drawers/detail → daily/todo → **grids (high, locked layout) last**.

## ADR (to write on user ratification)
- **Decision:** Option D — lossless size/type token migration; radius lint w/ fidelity escape hatch; off-scale values documented + inventoried for the future §10 Q7 round; zero new tokens; no primitive consolidation now.
- **Drivers:** mandatory amatta-v1 fidelity + §10 Q7 freeze; green gates; enforcement realism.
- **Alternatives:** A (snap-to-scale → breaks fidelity, rejected); B/B′ (mint now → process violation unless Q7 round authorized w/ ADR+README+design).
- **Consequences:** off-scale literals remain (documented); only durable enforcement win now = radius lint; full scale cleanup explicitly deferred to a legitimate design round, pre-baked via the candidate inventory.
