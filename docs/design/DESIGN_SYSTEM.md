# Amatta — Design System

> Token values below mirror the shipped code in [`src/ui/`](../../src/ui) (`palette.ts`,
> `typography.ts`, `radius.ts`, `spacing.ts`, `elevation.ts`). An ESLint rule forbids literal
> colors / sizes / shadows, so every value in the app resolves to one of these tokens.
>
> 🔗 **Interactive version:** [live design-system page](https://devlyo.github.io/amatta/design-system/) ·
> Korean source of truth: [`amatta-v1/DESIGN_SYSTEM.md`](amatta-v1/DESIGN_SYSTEM.md)

## Brand & atmosphere

Amatta is a **warm tool for handling family schedules** — closer to a tactile paper note than a
cold productivity app. Pure white base, a hint of warm cream for raised surfaces, and a single
**Sunset Orange** accent that owns every CTA. Secondary color is reserved entirely for *per-child
identity*; mascots appear only in content areas, never in system chrome (headers, tabs, buttons).

## Color

### Primary & semantic

| | Token | Hex | Use |
|---|---|---|---|
| ![](https://placehold.co/18/FF7144/FF7144.png) | `primary` | `#FF7144` | Main CTA, FAB, brand accent, focus |
| ![](https://placehold.co/18/D8501F/D8501F.png) | `primaryDeep` | `#D8501F` | Hover / pressed |
| ![](https://placehold.co/18/FFE2D0/FFE2D0.png) | `primaryTint` | `#FFE2D0` | Faint primary fill |
| ![](https://placehold.co/18/00C951/00C951.png) | `success` | `#00C951` | Checklist done, save toast, pickup complete |
| ![](https://placehold.co/18/FF4444/FF4444.png) | `danger` | `#FF4444` | Delete / warning |
| ![](https://placehold.co/18/FFB000/FFB000.png) | `warningDot` | `#FFB000` | Schedule-exception 6px dot (info-level) |

### Ink (text & lines) — single warm hue, opacity-based

| | Token | Value | Use |
|---|---|---|---|
| ![](https://placehold.co/18/1D1D1B/1D1D1B.png) | `ink` | `#1D1D1B` | Text primary, headings |
| ![](https://placehold.co/18/7A756E/7A756E.png) | `inkSub` | `#7A756E` | Secondary text, caption (warm gray) |
| | `ink70 … ink04` | `rgba(29,29,27, .70 → .04)` | Strong text → micro fill |
| ![](https://placehold.co/18/ECEAE4/ECEAE4.png) | `hair` | `#ECEAE4` | Passive border, divider |

### Surface

| | Token | Hex | Use |
|---|---|---|---|
| ![](https://placehold.co/18/FFFFFF/CCCCCC.png) | `surface` | `#FFFFFF` | Base background (screens, sheets) |
| ![](https://placehold.co/18/FAF8F2/FAF8F2.png) | `surfaceWarm` | `#FAF8F2` | Raised / accented surface, inputs |
| ![](https://placehold.co/18/F7F6F5/F7F6F5.png) | `surfaceSoft` | `#F7F6F5` | Child-group grouping background |

## Kid colors (6)

One color per child, picked at registration. Names and hexes are fixed. The **source** (saturated)
is used for the dot / border / avatar ring; the **block background** is derived deterministically
as `color-mix(source 15%, #FFFFFF 85%)` so the grid stays light. Block text is always `ink`.

| | Index · Name | source | block-bg |
|---|---|---|---|
| ![](https://placehold.co/18/FFA9FF/FFA9FF.png) | 0 · Petunia Pink | `#FFA9FF` | `#FFF2FF` |
| ![](https://placehold.co/18/C0F0AA/C0F0AA.png) | 1 · Vibrant Mint | `#C0F0AA` | `#F6FDF2` |
| ![](https://placehold.co/18/D8E6FF/D8E6FF.png) | 2 · Glacier Blue | `#D8E6FF` | `#F9FBFF` |
| ![](https://placehold.co/18/FFE8D2/FFE8D2.png) | 3 · Soft Peach | `#FFE8D2` | `#FFFCF8` |
| ![](https://placehold.co/18/E0E446/E0E446.png) | 4 · Citrus Green | `#E0E446` | `#FAFBE3` |
| ![](https://placehold.co/18/C7B0FF/C7B0FF.png) | 5 · French Lavender | `#C7B0FF` | `#F7F3FF` |

> Sunset Orange (`#FF7144`) is brand-primary only and is **excluded** from the kid-color pool — the
> avatar picker offers exactly these 6.

## Typography

Pretendard for Korean display & body, Geist Mono for the grid time column. Weights are limited to
**400 / 500 / 600 / 700**.

| Role | Size | Weight | Line-height | Tracking |
|------|------|--------|-------------|----------|
| Display | 32 | 700 | 1.15 | -0.02em |
| Title L | 24 | 700 | 1.20 | -0.01em |
| Title M | 20 | 600 | 1.25 | — |
| Title S | 16 | 600 | 1.30 | — |
| Body L | 16 | 400 | 1.50 | — |
| Body | 14 | 400 | 1.45 | — |
| Caption | 12 | 500 | 1.40 | — |
| Mono | 12 | 400 | 1.00 | grid time labels (`09:00`) |

## Radius

| Token | px | Use |
|---|---|---|
| `xs` | 6 | tag, micro pill |
| `sm` | 8 | schedule block |
| `md` | 12 | button, input |
| `lg` | 16 | card, sheet handle |
| `xl` | 24 | bottom-sheet top |
| `full` | 9999 | FAB, avatar ring, status pill |

## Spacing — 4px grid

`xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · xxxl 32`

## Elevation

Containment is done with a `hair` **border**, not drop shadows. Shadows are reserved for floating
chrome only:

| Token | Shadow | Use |
|---|---|---|
| `none` | — | cards, buttons, containers (default) |
| `fab` | `0 4px 10px rgba(29,29,27,.25)` | FAB (ink-tinted, center dock button) |
| `dock` | `0 10px 26px rgba(0,0,0,.10)` | floating bottom dock |

## Schedule-type icons (4, fixed — ADR-002)

`school` · `academy` · `activity` · `other` — one icon per type, mapped 1:1 in the grid and forms.

## Components

- **Button / Primary** — bg `primary` → pressed `primaryDeep`, text white, padding `12×20`, radius `md`.
- **Button / Ghost** — transparent, text `ink`, `1px` `ink30` border, radius `md`.
- **Card** — white (or `surfaceWarm` when accented), `1px` `hair` border, radius `lg`, **no drop shadow**.
- **Input** — bg `surfaceWarm`, `1px` `hair` border, focus = `2px` primary ring, radius `md`.
- **FAB** — ink (`#1D1D1B`), full pill, `fab` shadow. *(The shipped FAB is ink, not orange.)*

Primitives live in [`src/ui/components/`](../../src/ui/components) (13: Text, Button, Card, Input,
Fab, Pill, Badge, SelectChip, DayCircle, Toggle, DateField, DashedAddButton, Segmented) with a
`__DEV__` gallery at [`app/dev-gallery.tsx`](../../app/dev-gallery.tsx).

## Do / Don't

**Do** — keep Sunset Orange for CTA/brand/focus only; run kid colors through the block-fill rule
before using large areas; unify grays as `ink` opacities (no stray `#999`/`#CCC`); contain cards
with `hair` borders.

**Don't** — pave every background in warm cream (white is the base; `surfaceWarm` is for accents);
place the 6 kid colors adjacent as a palette (they're a *grouping* tool); use `danger` inside a
primary area (both are warm and read alike).
