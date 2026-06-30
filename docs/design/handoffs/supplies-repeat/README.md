# Handoff: 준비물 반복 토글 (Supplies Repeat Toggle)

## Overview
아마따(육아 일정 관리 앱)의 **새 일정 추가/수정 폼** 안 "준비물(supplies)" 섹션에, 각 준비물이 **매 반복마다 챙기는 항목**인지 **이번 일정에만 해당하는 항목**인지 구분하는 토글을 추가합니다.

핵심 기획:
- 준비물의 반복 여부는 **일정 자체의 반복(요일) 설정에 종속적**이다.
- **일정이 반복(요일이 1개 이상 선택됨)** → 각 준비물 행에 ↻ 토글을 노출. 켜짐 = "매번"(매 반복마다 챙김), 꺼짐 = "이번만"(해당 날짜에만).
- **일정이 1회성(반복 요일 없음)** → 반복 개념이 없으므로 토글을 **렌더링하지 않음**. 준비물은 단순 리스트.

## About the Design Files
이 번들의 파일들은 **HTML로 만든 디자인 레퍼런스**입니다 — 의도한 모양과 동작을 보여주는 프로토타입이며, 그대로 복붙할 프로덕션 코드가 아닙니다. 작업은 이 HTML 디자인을 **대상 코드베이스의 기존 환경(React Native / React / Flutter 등)과 패턴에 맞게 재현**하는 것입니다. 환경이 아직 없다면 프로젝트에 가장 적합한 프레임워크를 선택해 구현하세요.

`app-event-form.jsx`는 React + Babel(standalone)로 작성된 프로토타입이라 빌드 도구 없이 브라우저에서 바로 돕니다. 실제 앱에서는 이 로직/마크업을 해당 프레임워크 컴포넌트로 옮기면 됩니다.

## Fidelity
**High-fidelity (hifi)** — 최종 색상·타이포·간격·인터랙션이 확정된 목업입니다. UI는 코드베이스의 기존 라이브러리/패턴으로 픽셀에 가깝게 재현하세요.

## Screens / Views

### 새 일정 추가 — 준비물 섹션
- **Name**: 준비물 (Supplies) 섹션 — "새 일정" 풀스크린 모달 내부
- **Purpose**: 일정에 챙겨야 할 준비물 목록을 추가/편집. 반복 일정이면 항목별로 매번/이번만 구분.
- **Layout**:
  - 흰색 라운드 카드(`Group`, border-radius 14, 좌우 margin 14px) 안에 라벨 "준비물" + 준비물 리스트 + "추가" 버튼.
  - 라벨은 좌측 고정폭 컬럼(width 56), 콘텐츠는 나머지 폭(`align="top"`).
  - 각 준비물 행: `display:flex; align-items:center; gap:10px; padding:6px 0`. 2번째 행부터 상단 hairline(`1px solid rgba(29,29,27,0.04)`).

- **Components**:

  1. **체크 원 (placeholder)**
     - 18×18, border-radius 99, `border: 1.5px solid rgba(29,29,27,0.30)`. (완료 체크용 — 폼에서는 비활성 표시)

  2. **준비물 이름 입력 (`<input>`)**
     - `flex:1; min-width:0`, border/background 없음, outline 없음.
     - 타이포: 14px / weight 400 / letter-spacing -0.2 / color `#1D1D1B` / Pretendard.
     - placeholder: "준비물 이름"

  3. **↻ 반복 토글 버튼** — `suppliesRepeatable === true`일 때만 렌더
     - 아이콘: repeat/cycle 글리프 (13px, stroke 2.2, round cap/join). SVG paths 아래 Design Tokens 참고.
     - **켜짐(repeat: true)**: 배경 `#FFE2D0`(primaryTint), 글자/아이콘 `#D8501F`(primaryDeep), padding `4px 9px 4px 7px`, border-radius 99, 아이콘 우측에 "매번" 텍스트 라벨(12.5px / weight 500).
     - **꺼짐(repeat: false)**: 배경 transparent, 아이콘 색 `rgba(29,29,27,0.30)`(ink30), padding `4px 5px`, 텍스트 라벨 없음(아이콘만).
     - transition: `all .14s`.
     - aria-label: 켜짐 "매번 챙김 (탭하면 이번만)" / 꺼짐 "이번만 (탭하면 매번)".

  4. **삭제 버튼 (X)**
     - xMark 아이콘 14px, stroke `#7A756E`(inkSub), padding 4, background 없음.

  5. **"추가" 버튼**
     - 행이 있으면 상단 hairline + margin-top 4. plus 아이콘 12px + "추가" 텍스트(12.5px / weight 500 / color inkSub).

## Interactions & Behavior
- **반복 토글 노출 조건**: `suppliesRepeatable = days.length > 0` (일정의 반복 요일이 1개 이상 선택됨). false면 토글 버튼을 DOM에 렌더링하지 않음 — 비활성/숨김(visibility)이 아니라 **조건부 렌더**.
- **토글 동작**: 탭하면 해당 항목의 `repeat` 값을 반전. 켜짐↔꺼짐 사이 배경/색/라벨이 `.14s`로 전환.
- **새 준비물 기본값**: 반복 일정이면 새 항목의 `repeat`는 기본 **true(매번)**, 1회성 일정이면 `false`. (대부분의 준비물이 매 반복마다 챙기는 물건이라는 가정.)
- **반복 요일을 모두 해제했을 때**: `suppliesRepeatable`이 false가 되어 토글이 사라짐. 기존 항목의 `repeat` 값은 데이터에 남아 있어도 무방하나, 저장 시점에 1회성이면 `repeat`은 의미 없음(저장 후 무시 가능).
- **저장**: `onSave`로 `supplies` 배열이 그대로 전달됨. 각 항목 형태 `{ id, title, done, repeat }`.

## State Management
NewEventForm 내부 React state:
- `days: number[]` — 선택된 반복 요일 (0=일 … 6=토). 예: `[1,3,5]` = 월·수·금.
- `supplies: Array<{ id: string, title: string, done: boolean, repeat: boolean }>`
- 파생값: `suppliesRepeatable = days.length > 0`

핸들러:
- `addSupply()` → `[...supplies, { id, title:'', done:false, repeat: suppliesRepeatable }]` (id는 충돌 방지를 위해 timestamp + random suffix)
- `editSupply(id, title)`
- `rmSupply(id)`
- `toggleSupplyRepeat(id)` → 해당 항목 `repeat` 반전

## Design Tokens
색상 (from `app-tokens.jsx` / `DESIGN_SYSTEM.md`):
- `ink` (text primary): `#1D1D1B`
- `inkSub` (text secondary): `#7A756E`
- `ink30`: `rgba(29,29,27,0.30)`
- `ink04` (hairline): `rgba(29,29,27,0.04)`
- `primary` (Sunset Orange): `#FF7144`
- `primaryDeep` (pressed/active text): `#D8501F`
- `primaryTint` (toggle-on background): `#FFE2D0`

타이포:
- 본문/입력: 14px / 400 / letter-spacing -0.2
- 알약/라벨("매번", "추가"): 12.5px / 500 / letter-spacing -0.2
- 캡션(섹션 라벨): 13px / 400
- Font: Pretendard

기타:
- Group 카드 radius: 14, 좌우 margin: 14
- 토글 radius: 99 (pill)
- 토글 transition: `all .14s`

repeat/cycle 아이콘 SVG (viewBox 0 0 24 24, fill none, stroke currentColor, strokeWidth 2.2, round cap/join):
```
<path d="M17 2l4 4-4 4"/>
<path d="M3 11V9a4 4 0 014-4h14"/>
<path d="M7 22l-4-4 4-4"/>
<path d="M21 13v2a4 4 0 01-4 4H3"/>
```

## Assets
별도 이미지 에셋 없음. 아이콘은 모두 인라인 SVG (위 repeat 글리프, xMark, plus). 실제 코드베이스에 아이콘 라이브러리가 있으면 동등한 repeat/cycle, close, plus 아이콘으로 대체하세요.

## Files
- `Supplies Repeat (A안).html` — 두 상태(1회성 / 반복)를 나란히 보여주는 **독립 실행형 시각 레퍼런스**. 가장 먼저 열어 의도를 파악하세요.
- `app-event-form.jsx` — 실제 새 일정 폼 컴포넌트. 준비물 섹션 + 토글 로직이 통합돼 있음. 검색 키워드: `suppliesRepeatable`, `toggleSupplyRepeat`, `RepeatGlyph`, `준비물`.
- `app-tokens.jsx` — 공유 디자인 토큰(AMATTA 팔레트), 아이콘 세트(`Icon`), 더미 데이터. 색상/아이콘 출처.

### 구현 핵심 (요약)
```
const suppliesRepeatable = days.length > 0;

// 새 항목 기본값
{ id, title:'', done:false, repeat: suppliesRepeatable }

// 행 내부
{suppliesRepeatable && (
  <button onClick={() => toggleSupplyRepeat(s.id)}>
    <RepeatGlyph/>
    {s.repeat && <span>매번</span>}
  </button>
)}
// 켜짐: bg #FFE2D0, color #D8501F, "매번" 라벨
// 꺼짐: bg transparent, color rgba(29,29,27,0.30), 아이콘만
```
