# Design system — schedul-app (seed)

> 이 문서는 *씨드*입니다. UI 작업이 시작되면 (Phase 3) 디자이너/개발자가 함께 확장합니다.
> 현재는 코드 작성 시 흔들리지 말아야 할 *결정된 토큰* 위주로만 적습니다.

## Color palette — child colors (6색)

자녀 등록 시 6색 중 하나 선택. 색상 이름과 헥스는 고정.

| index | name | hex | 사용처 |
|---|---|---|---|
| 0 | red | `#E53935` | 첫째 기본값 |
| 1 | orange | `#FB8C00` | 둘째 기본값 |
| 2 | yellow | `#FDD835` | 셋째 기본값 |
| 3 | green | `#43A047` | 넷째 기본값 |
| 4 | blue | `#1E88E5` | 추가 |
| 5 | purple | `#8E24AA` | 추가 |

명도 대비 (WCAG AA 4.5:1)는 텍스트가 색 위에 직접 올라갈 때 흰색 또는 검정 자동 선택 (`getReadableTextColor(bg)` 헬퍼 예정).

## Schedule type icons (4종 고정)

| type | icon (lucide-react-native) | 의미 |
|---|---|---|
| `school` | `School` | 학교/유치원 |
| `academy` | `BookOpen` | 학원/과외 |
| `activity` | `Dumbbell` | 운동/취미/예체능 |
| `other` | `MoreHorizontal` | 기타 |

## Grid typography

- 시간 컬럼 라벨: `12px / regular / mono` (예: `09:00`, `09:30`)
- 자녀 헤더: `14px / semibold`
- 일정 블록 제목: `12px / medium`, 1줄 truncate, 블록이 너무 작으면 숨기고 아이콘만
- 일정 블록 위치: `10px / regular`, 2줄째 truncate

## Schedule block visual rules

- 배경: 자녀 색 50% 채도 + 8px 라운드
- 테두리: 자녀 색 100% 1px
- 취소(예외 cancel): opacity 0.3, 가운데 strike-through 1px
- 수정(예외 modify): 우상단에 6px dot (warning yellow) 또는 작은 ✏️ 아이콘
- 30분 미만 일정: 슬롯 안에서 비례 높이로 렌더 (잘림 X)
- 동일 자녀의 같은 슬롯에 여러 일정이 겹칠 때: 가로로 50:50 분할 (드물어야 함, 회피)

## 시간 그리드 상수 (`src/ui/grid/layout.ts`에 export)

```ts
GRID_START_HOUR = 6
GRID_END_HOUR   = 23
SLOT_MINUTES    = 30
ROWS            = 34
ROW_HEIGHT      = 24  // px
TIME_COL_WIDTH  = 56
CHILD_COL_MIN   = 80
```

## 미정 / 디자이너 합류 시 채울 것
- 라이트/다크 모드 토큰
- 빈 상태(EmptyChildrenState) 일러스트
- 일정 추가 시트 입력 필드 정렬·간격
- 알림 권한 요청 화면 카피·일러스트
- 앱 아이콘·스플래시
- 폰트 (현재는 시스템 기본)
