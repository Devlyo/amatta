# Handoff: 픽업 배너 (Pickup Banner Carousel)

## Overview
"아마따" 일정 앱 홈 화면 상단의 **다음 픽업 배너**입니다. 곧 데리러 가야 할 아이별로
가로 스와이프 카드를 한 장씩 보여줍니다. 각 카드는 색상 배경 + 일러스트 자동차 +
시간/이름/활동 텍스트로 구성되고, 카드가 2장 이상이면 하단에 위치 점(dot)이 표시됩니다.

## About the Design Files
이 번들의 파일들은 **HTML/React(JSX)로 만든 디자인 레퍼런스**입니다 — 의도한 모양과
동작을 보여주는 프로토타입이지, 그대로 복붙할 프로덕션 코드가 아닙니다. 목표는 이
디자인을 **타겟 코드베이스의 기존 환경**(React/Vue/SwiftUI/네이티브 등)과 그 패턴·
라이브러리로 **재구현**하는 것입니다. 환경이 아직 없다면 프로젝트에 가장 적합한
프레임워크를 골라 구현하면 됩니다.

`app-daily-b.reference.jsx`는 전체 일일 화면 코드이며, **이 핸드오프에서 참고할 부분은
픽업 배너 영역(아래에 명시된 컴포넌트)뿐**입니다. 나머지는 맥락용입니다.

## Fidelity
**High-fidelity (hifi)** — 색상·타이포·간격·인터랙션이 최종 사양에 가깝습니다.
배너 UI는 아래 값으로 픽셀 단위까지 재현하되, 코드베이스의 기존 컴포넌트/토큰으로 구현하세요.

## 참고할 컴포넌트 (reference jsx 내 위치)
- `CartoonCar` — 자동차 일러스트 SVG (sedan / round 두 가지 형태)
- `PICKUPS` — 카드 데이터 배열 (배경색, 텍스트색, 자동차 색 팔레트)
- `PickupCarousel` — 드래그 스와이프 컨테이너 + 트랜스폼 로직
- `PickupCard` — 개별 카드 (배경 + 텍스트 블록 + 자동차 + 도트)

## Screen / View

### 픽업 배너 카드
- **Purpose**: 다음에 데리러 갈 아이/시간/활동을 한눈에. 좌우 스와이프로 카드 전환.
- **Layout**:
  - 바깥 래퍼 padding `6px 14px 8px`
  - 뷰포트(viewport) `overflow: hidden`, `border-radius: 18px`, `touch-action: pan-y`
  - 트랙(track) `display: flex`, 카드마다 `flex: 0 0 100%`
  - 전환 `transform: translateX(calc(-idx*100% + dragDx px))`, `transition: transform .28s cubic-bezier(.2,.8,.2,1)` (드래그 중엔 transition none)

### Components

**PickupCard (개별 카드)**
- 컨테이너: `position: relative; overflow: hidden; border-radius: 14px; padding: 6px 14px 10px; min-height: 44px;`
  - `display: flex; align-items: center; gap: 8px;`
  - 배경: `data.bg` (카드별 색상)
  - 그림자: `0 6px 16px {data.bg}40` (배경색 + 25% 알파)
  - 텍스트색: 배경 휘도(luminance)로 자동 결정 — `lum > 0.65 → #1d1d1b`, 아니면 `#fff`
    - 휘도식: `(0.299*R + 0.587*G + 0.114*B)/255`
- **도로 선(road line)**: `position:absolute; left/right:0; bottom:6px; height:2px;` 배경 흰색 위 `rgba(255,255,255,0.18)` / 밝은 카드 위 `rgba(0,0,0,0.10)`
- **Eyebrow** ("NEXT PICKUP · {eta}"):
  - `font-size: 10px; font-weight: 500; letter-spacing: 0.8px; text-transform: uppercase;`
  - `font-family: "Geist", "Pretendard", sans-serif;`
  - 색: `data.eyebrowColor` 없으면 onBg의 서브색(`rgba(255,255,255,0.85)` 또는 `rgba(29,29,27,0.6)`)
  - 앞에 6×6px 펄스 점: `border-radius:99px; background:onBg; animation: amattaPulse 1.6s ease-in-out infinite`
- **타이틀** ("{time}  {who} · {what}"):
  - `font-family: "Pretendard", sans-serif; font-weight: 600; line-height: 1.15; letter-spacing: -0.4px;`
  - `font-size: data.titleSize || 15px`, 색: `data.titleColor || onBg`
  - `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`
  - 시간 부분(`{time}`)은 `margin-right: 8px; font-size: 14px`
- **자동차 일러스트**: `CartoonCar`, 렌더 크기 `width=68 height=40` (viewBox 130×78)
- **도트 (카드 2장 이상)**: `position:absolute; bottom:4px; left/right:0; display:flex; justify-content:center; gap:3px;`
  - 각 점: `height:3px; border-radius:99px; background:#fff;`
  - 활성 `width:10px; opacity:1`, 비활성 `width:3px; opacity:0.5`
  - `transition: all .25s cubic-bezier(.2,.8,.2,1)`

## Interactions & Behavior
- **드래그 스와이프**: pointer 이벤트(down/move/up/cancel). down에서 `setPointerCapture`.
- **전환 임계값**: `threshold = max(40, 뷰포트너비 * 0.15)`
  - `dragDx < -threshold` 이고 마지막 카드 아님 → 다음 카드
  - `dragDx > threshold` 이고 첫 카드 아님 → 이전 카드
  - 그 외 → 현재 카드로 스냅백
- **첫 번째 카드**는 앱 테마의 `primary` 색을 따라감 (테마 변경 시 반영). 나머지 카드는 고유 bg 유지.
- 화살표/버튼 없음 — 순수 드래그.

## State Management
- `idx` — 현재 활성 카드 인덱스
- `dragDx` — 드래그 중 X 이동량(px)
- `dragRef` — `{ active, startX, pointerId }` (리렌더 불필요한 드래그 상태)
- `viewportRef` — 뷰포트 너비 측정용

## Design Tokens

### 카드 색상 팔레트 (PICKUPS)
| # | 활동 | 배경 bg | 텍스트색 | 자동차 body / window | 형태 |
|---|------|---------|---------|----------------------|------|
| 1 | 태권도 | `#FF7144` (primary) | `#FFFFFF` | `#FFF4E5` / `#FFD8C2` | sedan |
| 2 | 수영 | `#D4B4FA` | `#1d1d1b` | `#FFFFFF` / `#E8F2C9` | round |
| 3 | 미술 | `#A5DC85` | `#1d1d1b` | `#FFFFFF` / `#FFE2D0` | sedan |
| 4 | 어린이집 | `#A9C8F5` | `#1d1d1b` | `#FFFFFF` / `#FFF0C2` | round |

공통 자동차 값: `wheel #1d1d1b`, `hub` = body색, `shine rgba(255,255,255,0.9~0.95)`

### 그 외
- Ink/텍스트: `#1d1d1b`
- Border radius: 래퍼 18px, 카드 14px, 점/펄스 99px(원형)
- 카드 그림자: `0 6px 16px {bg}40`
- Easing: `cubic-bezier(.2,.8,.2,1)` (전환 .28s, 도트 .25s)
- 폰트: Pretendard (본문/타이틀), Geist (eyebrow 라벨)

### 필요한 keyframes
```css
@keyframes amattaPulse { 0%,100%{ opacity:1 } 50%{ opacity:.35 } }
```
(펄스 점용 — 정확한 값은 reference jsx의 `<style>` 참고)

## Assets
- `car-sedan.svg` — 세단형 자동차 (viewBox 130×78). 흰 바디 기준.
- `car-round.svg` — 라운드/토이형 자동차 (viewBox 130×78). 흰 바디 기준.
- 두 SVG 모두 fill 값을 바꿔 카드별 색상에 맞추세요 (body / window / wheel / hub / shine).
- 코드로 색을 주입하려면 `CartoonCar` 컴포넌트(reference jsx)를 그대로 포팅하는 게 가장 깔끔합니다.

## Files
- `app-daily-b.reference.jsx` — 전체 일일 화면 (배너 컴포넌트 4개가 여기 들어있음, 위 "참고할 컴포넌트" 참조)
- `car-sedan.svg`, `car-round.svg` — 자동차 일러스트 단독 에셋
