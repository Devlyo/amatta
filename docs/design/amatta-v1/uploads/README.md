# 아마따 — Design System (v1)

> 이전 시드는 전부 기각. 이 문서가 현재 디자인 시스템의 **유일한 source of truth**입니다.
> 인터랙티브 시안은 [`amatta-v1/`](./amatta-v1/), 톤 레퍼런스는 [`references/lovable.DESIGN.md`](./references/lovable.DESIGN.md).

---

## 1. Brand & Atmosphere

아마따는 **가족 일정을 다루는 따뜻한 도구**. 차가운 생산성 앱이 아니라 *손에 잡히는 노트 같은* 결.

- **베이스 톤**: 순백색(`#FFFFFF`) 위에 살짝 따뜻한 크림(`#FAF8F2`)을 surface로 깔아 *오프-화이트의 인상*을 만든다. 순백 강박 없음.
- **포인트**: Sunset Orange(`#FF7144`) 한 컬러로 모든 CTA·강조를 잡는다. 다른 보조 컬러는 *자녀별 색*에만 쓰고 UI 자체에는 거의 비중을 주지 않는다.
- **마스코트**: 캐릭터(아마따 6종)는 *콘텐츠 영역*에서만 등장. 시스템 chrome(헤더/탭/버튼)에는 등장하지 않는다.

---

## 2. Color Palette

### Primary

| token | hex | 사용처 |
|---|---|---|
| **Sunset Orange** | `#FF7144` | 메인 CTA, FAB, brand 강조, focus 표식 |
| Sunset Orange Deep | `#D8501F` | hover/pressed 상태 |
| Sunset Orange Tint | `#FFE2D0` | primary 영역의 매우 옅은 background fill |

### 자녀 6색 (sub colors)

자녀 등록 시 1인당 1색을 고른다. 색상 *이름·헥스는 고정*.

| index | name | hex | 캐릭터 매핑 | 자녀 기본 |
|---|---|---|---|---|
| 0 | **Petunia Pink** | `#FFA9FF` | petunia_pink | 첫째 |
| 1 | **Vibrant Mint** | `#C0F0AA` | vibrant_mint | 둘째 |
| 2 | **Glacier Blue** | `#D8E6FF` | glacier_blue | 셋째 |
| 3 | **Soft Peach** | `#FFE8D2` | soft_peach | 넷째 |
| 4 | **Citrus Green** | `#E0E446` | citrus_green | 추가 |
| 5 | **French Lavender** | `#C7B0FF` | french_lavender | 추가 |

이 6색은 **자녀 색 원본**(saturated source). UI에 직접 쓸 때의 변형 규칙은 §3 *Color application*.

> **자녀 아바타/색 선택 풀은 정확히 6종**. Sunset Orange(`#FF7144`)는 *brand primary* 전용이라 자녀 색 후보에서 제외 — 자녀 추가/편집 화면의 아바타가 7개로 보이면 주황이를 빼고 6개로 맞춰야 함 (현재 amatta-v1 시안 수정 필요, §10 Q7 참조).

### Ink (텍스트·라인)

opacity 기반 톤 단일 휴, lovable 방식 따라간다.

| token | 값 | 사용처 |
|---|---|---|
| `ink` | `#1D1D1B` | text primary, heading |
| `ink-sub` | `#7A756E` | text secondary, caption (warm gray) |
| `ink-70` | `rgba(29,29,27,0.70)` | strong secondary text |
| `ink-50` | `rgba(29,29,27,0.50)` | disabled text |
| `ink-30` | `rgba(29,29,27,0.30)` | interactive border |
| `ink-12` | `rgba(29,29,27,0.12)` | strong divider |
| `ink-06` | `rgba(29,29,27,0.06)` | hover tint, micro fill |
| `ink-04` | `rgba(29,29,27,0.04)` | barely-visible overlay |
| `hair`   | `#ECEAE4` | passive border, divider |

### Surface

| token | hex | 사용처 |
|---|---|---|
| `surface` | `#FFFFFF` | 베이스 background (스크린·시트) |
| `surface-warm` | `#FAF8F2` | alt surface, card 강조 |
| `surface-soft` | `#F5F3EE` | 자녀 그룹 묶음 background |

### Semantic

| token | hex | 사용처 |
|---|---|---|
| `success` | `#00C951` | 체크리스트 완료, 저장 토스트, 픽업 완료 표식 |
| `danger`  | `#FF4444` | 삭제·경고·warning 통합. 따뜻한 톤이지만 primary(`#FF7144`)와 휴가 달라 구분됨 |
| `warning-dot` | `#FFB000` | 일정 예외(수정/추가) 우상단 6px dot. *danger와 별도 — info-level 표식* |

---

## 3. Color application — 자녀 색을 UI에 쓰는 방법

자녀 6색은 *원본 saturated*가 source of truth. UI에 깔 때는 다음 규칙으로 *deterministic하게 derive*해서 쓴다.

### Derivation rule

```css
--kid-source: <자녀 색>;                                       /* dot, border, avatar ring */
--kid-bg:     color-mix(in srgb, var(--kid-source) 15%, #FFFFFF); /* block background */
```

- **bg**: 원본 × 15% + 흰색 × 85% — 거의 흰색에 가까운 옅은 톤. 그리드 채도가 가벼움.
- **dot / border / avatar ring**: 원본 그대로 (saturated).
- **block 내 텍스트**: 항상 `ink #1D1D1B` 사용 (자녀별 컬러 ink 없음 — 정체성은 dot/border가 담당).

### 6색 적용 결과 (참조용 — 코드는 위 `color-mix`로 자동 계산)

| 자녀 색 | source (dot/border) | block-bg |
|---|---|---|
| Petunia Pink | `#FFA9FF` | `#FFF2FF` |
| Vibrant Mint | `#C0F0AA` | `#F6FDF2` |
| Glacier Blue | `#D8E6FF` | `#F9FBFF` |
| Soft Peach | `#FFE8D2` | `#FFFCF8` |
| Citrus Green | `#E0E446` | `#FAFBE3` |
| French Lavender | `#C7B0FF` | `#F7F3FF` |

> 구현 헬퍼 예정: `getKidPalette(name) → { source, bg }` in `src/ui/palette.ts`.

### Avatar / dot
- 캐릭터 PNG 아바타와 함께 배치할 때 ring: `box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px var(--kid-source)`

---

## 4. Typography

### Family

| role | font | 용도 |
|---|---|---|
| `--font-display` | **Pretendard** | 한글 헤딩·디스플레이 |
| `--font-text` | **Pretendard** | 한글 본문·UI |
| `--font-en` | **Noto Sans** | 영문/숫자 (`Pretendard`로 fallback) |

* fallback stack: `-apple-system, system-ui, sans-serif`

### Hierarchy

| role | size | weight | line-height | letter-spacing | 비고 |
|---|---|---|---|---|---|
| Display | 32px | 700 | 1.15 | -0.02em | 온보딩 히어로, 스플래시 워드마크 |
| Title L | 24px | 700 | 1.20 | -0.01em | 화면 타이틀 |
| Title M | 20px | 600 | 1.25 | normal | 섹션 제목, 카드 헤더 |
| Title S | 16px | 600 | 1.30 | normal | 리스트 row 제목 |
| Body L | 16px | 400 | 1.50 | normal | 본문 (긴 텍스트) |
| Body | 14px | 400 | 1.45 | normal | 기본 본문·버튼 라벨 |
| Caption | 12px | 500 | 1.40 | normal | 메타·타임스탬프 |
| Mono | 12px | 400 | 1.00 | normal | 시간 컬럼 라벨 (`09:00`, `09:30`) — `Geist Mono` 또는 시스템 mono |

> **Weight 정책**: 한글·영문 모두 **400 / 500 / 600 / 700** 4단만 사용. 800/900은 시스템 외 자산(로고 마크 등)에만 예외적으로 허용.

---

## 5. Schedule type icons (4종 고정 · ADR-002)

| type | icon (lucide-react-native) | 의미 |
|---|---|---|
| `school` | `School` | 학교/유치원/어린이집 |
| `academy` | `BookOpen` | 학원/과외 |
| `activity` | `Dumbbell` | 운동/취미/예체능 |
| `other` | `MoreHorizontal` | 기타 |

* amatta-v1 프로토타입은 동일 의미의 손그림 SVG 사용 ([`app-tokens.jsx`](./amatta-v1/app-tokens.jsx) 의 `Icon.school|academy|activity|etc`).

---

## 6. Grid (일간 그리드)

`src/ui/grid/layout.ts`에 export 되는 상수 — *ADR-001 + CLAUDE.md에서 잠금*.

```ts
GRID_START_HOUR = 6
GRID_END_HOUR   = 23
SLOT_MINUTES    = 30
ROWS            = 34
ROW_HEIGHT      = 24  // px
TIME_COL_WIDTH  = 56
CHILD_COL_MIN   = 80
```

### Grid typography
- 시간 컬럼 라벨: `Mono / 12px / 400`
- 자녀 헤더: `Title S / 16px / 600`
- 일정 블록 제목: `12px / 500`, 1줄 truncate (블록 높이가 너무 작으면 숨기고 아이콘만)
- 일정 블록 장소: `10px / 400`, 2번째 줄 truncate

### Schedule block visual rules

- **Bg**: 자녀 색 §3의 *Block fill* 규칙
- **Border**: `1px solid {kid.dot}`
- **Radius**: 8px
- **취소 예외(cancel)**: opacity 0.3 + 가운데 가로 strike-through 1px
- **수정 예외(modify)**: 우상단 6px dot (`warning-dot #FFB000`) 또는 작은 ✏️ 아이콘
- **30분 미만**: 슬롯 안에서 비례 높이로 렌더 (잘림 X)
- **동일 자녀·동일 슬롯 충돌**: 가로 50:50 분할 (드물어야 함, UX 상 회피)
- **픽업 충돌 인디케이터 (ADR-002)**: 그리드 sub-bar에 `⚠ {hh:mm} 픽업 충돌` pill — *블록 오버레이·푸시 둘 다 금지*

---

## 7. Components — 기본 규칙

### Buttons

**Primary (Sunset Orange filled)**
- Bg: `#FF7144` → pressed `#D8501F`
- Text: `#FFFFFF`
- Padding: `12px 20px`
- Radius: `12px`
- Inset highlight (옵션): `inset 0 0.5px 0 rgba(255,255,255,0.25), inset 0 0 0 0.5px rgba(0,0,0,0.15)`
- Focus shadow: `0 4px 12px rgba(255,113,68,0.25)`

**Ghost / Outline**
- Bg: transparent
- Text: `#1D1D1B`
- Border: `1px solid {ink-30}`
- Radius: `12px`

**Tertiary (Surface)**
- Bg: `surface-warm #FAF8F2`
- Text: `ink #1D1D1B`
- Border: none

### Cards
- Bg: `#FFFFFF` (또는 강조 시 `surface-warm`)
- Border: `1px solid {hair #ECEAE4}`
- Radius: `16px`
- Drop shadow 사용 금지 — *border가 컨테인먼트 담당*

### Inputs
- Bg: `surface-warm #FAF8F2`
- Border: `1px solid {hair}`
- Focus: `2px ring {primary}` + radius `12px`
- Placeholder: `ink-sub`

### FAB
- Bg: `#FF7144`
- 그림자: `0 6px 16px rgba(255,113,68,0.35)`
- Radius: full pill `9999px`

---

## 8. Radius scale

| token | px | 용도 |
|---|---|---|
| `r-xs` | 6 | tag, micro pill |
| `r-sm` | 8 | schedule block |
| `r-md` | 12 | button, input |
| `r-lg` | 16 | card, sheet handle |
| `r-xl` | 24 | bottom sheet 상단 |
| `r-full` | 9999 | FAB, avatar ring, status pill |

---

## 9. Do's & Don'ts

### Do
- Sunset Orange는 **CTA·brand·focus**에만. 자녀 색이랑 섞지 말 것.
- 자녀 색은 §3의 *Block fill* 규칙 거쳐서 큰 면적에 쓴다 (원본을 큰 면적에 깔지 말 것).
- 회색은 `ink` opacity 변형으로 통일. 임의의 `#999`, `#CCC` 같은 hex 금지.
- Pretendard weight 400/500/600/700 만 사용 (디스플레이는 800/900 예외).
- 카드 컨테인먼트는 `hair` 보더로. drop shadow 남용 금지.

### Don't
- 순백(`#FFFFFF`)이 베이스지만 *대비 강조용 paper feel*이 필요한 곳은 `surface-warm`으로 살짝 올린다. 모든 배경을 따뜻한 크림으로 깔지는 *말 것* (lovable 톤은 레퍼런스이지 카피 대상이 아님).
- 자녀 6색끼리 직접 인접해서 *팔레트 자체로 디자인*하지 말 것. 자녀를 *그룹핑*하는 도구로만.
- danger 색을 primary 영역에 쓰지 말 것 (둘 다 따뜻한 톤이라 헷갈림).

---

## 10. Open Questions — 답이 필요한 것

> 정해진 답은 이 섹션 밖 본문에 이미 반영됨. 아래는 *아직 미해결*만 남김.

### Q7. amatta-v1 토큰 sync — *deferred*
amatta-v1은 *디자인 스냅샷*으로 박제. 토큰(`app-tokens.jsx` 자녀 hyflow 팔레트, `fonts.css`의 Geist)은 README와 불일치하지만 *건드리지 않음*. 다음 라운드에서 Claude Design과 함께 새 시안을 만들 때 README 기준으로 토큰을 다시 잡는다.

> 단, **자녀 편집/추가 아바타 picker의 주황이는 제거** — 주황은 brand primary 전용이라 자녀 색 후보에 있으면 안 됨.

---

## 11. Pending — 다음 라운드에서 만들 것

- [ ] **앱 아이콘** (iOS · Android adaptive · 1024 마스터)
- [ ] **스플래시 화면** (Sunset Orange + 캐릭터, prototypes/splash-amatta-v0.html 모션 검토)
- [ ] **자녀 1명 뷰** — 현재 시안은 4명 그리드 위주. 1명 때의 레이아웃·여백·캐릭터 강조 별도 정의 필요

---

## Authoritative refs
- 톤 레퍼런스: [`references/lovable.DESIGN.md`](./references/lovable.DESIGN.md) (Lovable.dev 분석)
- 인터랙티브 시안: [`amatta-v1/`](./amatta-v1/) — `index.html` 에서 시작
- ADR-002 (Prep · Todos · Pickup): [`../architecture/ADR-002-*.md`](../architecture/)
