# Design References — saeboman design track

> 디자인 톤·컬러·레퍼런스 자산. 실제 디자인 적용은 `frontend-design` 스킬 또는 후속 라운드에 위임.

## 자산

| 파일 | 용도 |
|---|---|
| `lovable.DESIGN.md` | Lovable.dev 디자인 시스템 분석 — cream + charcoal 베이스, opacity-driven gray, Camera Plain Variable, border-driven depth |
| `ColorPalette.png` | Figma color palette export — 5×7 = 35색. 우하단 highlighted 4색이 사용자 채택 액센트 |
| `aesthetic-1.png` | Henri Matisse paper-cutout 스타일 1 — humanist 유기적 도형 |
| `aesthetic-2.png` | Henri Matisse paper-cutout 스타일 2 — 동일 톤 |

## 디자인 방향

### 베이스 (Lovable 추출)
- 페이지 배경 cream `#f7f4ed` (not pure white)
- 텍스트 charcoal `#1c1c1c` (not pure black)
- Gray = `#1c1c1c` opacity 변형 (단일 hue)
- Border `#eceae4` (passive), `rgba(28,28,28,0.4)` (interactive)
- Border-driven depth (그림자 거의 없음, dark button inset shadow만 signature)
- Radius 4/6/8/12/16/9999px scale
- Weight 400 + 600 only
- 폰트: Camera Plain Variable (대체: Pretendard / system)

### 액센트 (사용자 4색)
| Hex | 톤 | 역할 후보 |
|---|---|---|
| `#FF9302` | vivid orange | **primary action**, today highlight |
| `#FBB008` | mustard | accent, FAB, 강조 |
| `#FBE26E` | warm yellow | secondary tint, badge |
| `#E2EFEA` | mint cream | surface variant, 자녀 6색 한 자리 |

### 미적 톤 (Matisse paper-cutout)
- 유기적 곡선, 손그림 느낌, 컬러풀한 단순 도형
- 장식 요소(empty state 일러스트, 빈 셀 인디케이터, 자녀 아바타 placeholder)에 활용 후보
- 일간 그리드 자체는 정돈·읽기 우선 — Matisse 톤은 보조 surface(온보딩, 빈 상태, 자녀 캐릭터)에 한정

## 친구 트랙(brand-ui-v3) vs 사용자 트랙

| 차원 | 친구 | 사용자 |
|---|---|---|
| 시스템 성격 | Untitled UI 정밀 컴포넌트 | Lovable + Matisse warm humanist |
| Primary | `#171717` | `#FF9302` 또는 `#1c1c1c` (TBD) |
| 자녀 6색 | algorithmic tint + child-0 rose-pink | TBD (`#E2EFEA` 1자리만 fix) |
| 액센트 | 거의 없음 (warm-neutral) | 4색 명시 |
| 폰트 | RN system | Camera Plain Variable (또는 Pretendard) |

→ A/B 비교 후 머지 결정 — 별도 ADR로 락 예정.

## 다음 단계
1. `docs/design/SCREENS.md` 초안 (화면별 디자인 가이드)
2. HTML 프로토타입 — `docs/prototypes/` (frontend-design 스킬 위임 가능)
3. 자녀 6색 정확 hex 결정 (디자이너 검수 또는 frontend-design)
