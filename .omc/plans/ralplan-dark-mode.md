# ralplan — 다크 모드 (ADR-009)

> v2 (2026-11-10): Planner 초안 v1 → Architect/Critic 검토(§7) 반영. 판정: **승인(수정 조건부)**, A안 유지.
> 범위: 시스템/라이트/다크 선택, 전 화면 다크 지원. 비범위: 아이 색 재설계, 이미지 다크 전용본.

## 1. 현황 (측정)
- 색 토큰: `src/ui/palette.ts` `TOKENS`(평면 객체) + `getKidPalette()`(source/bg/deep…) + `withAlpha()`/`kidFill()`.
- 정적 사용: `StyleSheet.create` 안 `TOKENS.*` — 48 파일, ~430곳.
- 문자열 prop: `color={TOKENS.x}` / SVG `stroke`/`fill` / Switch `trackColor` / DateTimePicker `accentColor` — ~70곳.
- 계산: `withAlpha`/`kidFill` 7곳, Reanimated 스타일 안 색 몇 곳, `rgba(...)` 리터럴 3파일(elevation, PickupCard, add-kid).
- 라이트 고정: `app.json userInterfaceStyle:"light"`, `_layout` `Appearance.setColorScheme('light')`, `<StatusBar style="dark" />`, 라우트 `contentStyle` 배경 6곳.

## 2. 구현 방식 비교
| | A. `useTheme()` + `makeStyles` | B. `DynamicColorIOS` 토큰 |
|---|---|---|
| 원리 | 렌더 때 현재 스킴 팔레트로 스타일 생성(스킴별 메모) | 토큰 값을 `{light,dark}` 네이티브 동적 색으로; iOS가 자동 전환 |
| 변경량 | 모든 화면의 `StyleSheet.create` → `makeStyles`, `TOKENS.` → `t.` (기계적) | palette.ts 위주; 단 문자열이 필요한 곳(SVG, withAlpha, 보간)은 훅 필요 |
| 안드로이드 | 동작 | 미지원(라이트 고정) |
| 색 계산 | 문자열이라 그대로 | 객체라 `withAlpha` 불가 → 쌍으로 미리 계산 |
| 성능 | 스킴 변경 시 전체 리렌더(드묾) | 네이티브 전환, 리렌더 없음 |
| 테스트 | 스킴 바꿔 렌더 가능 | jest에서 동적 색 해석 불가(목 필요) |
- **권고: A.** 이유 — 안드로이드 출시 계획(BACKLOG A-BUILD), 색 계산·SVG·Reanimated가 많아 B는 결국 A와 혼용, 테스트 용이. 기계적 변경은 코드모드 스크립트 + 리뷰로 처리.

## 3. 설계 (A안)
- `palette.ts`: `LIGHT`, `DARK` (같은 키, `satisfies Record<TokenKey,string>`로 누락 컴파일 에러). `KID_PALETTES_LIGHT/DARK`(deep만 다름). `TOKENS`는 **라이트 별칭으로 남겨** 전환 안 된 파일이 깨지지 않게(마지막 단계에서 제거 + ESLint 금지).
- `src/ui/theme/ThemeProvider.tsx`: `useColorScheme()`(RN) 결과로 팔레트 선택 → context. `useTheme(): { t, kid(colorIndex), scheme }`. `makeStyles(fn)` = `(t) => StyleSheet.create(fn(t))`를 스킴별 1회 캐시하는 훅 팩토리.
- 모드 저장: `appearance-store`(zustand) ← `app_settings.appearance`('system'|'light'|'dark'), 부팅 시 `Appearance.setColorScheme`. 초기화/내보내기 규칙은 notif 설정과 동일.
- 네이티브: `userInterfaceStyle:"automatic"`, StatusBar `style="auto"`, 라우트 `contentStyle`은 테마에서, DateTimePicker `themeVariant` 자동.
- 블록 채움 알파: `TimeBlock`/`AllDayRow`/`MonthView` 칩의 0.6/0.8 → `t.blockFill`/`t.blockFillFocused`(라이트 0.6/0.8, 다크 0.85/0.95). 블록 글씨는 양쪽 `#1D1D1B`(새 토큰 `onKidFill`).

## 4. 단계 (v2 — 각 단계 = 커밋, 단계 끝마다 tsc·jest·라이트 화면 무변화 확인)
0. **기반 + 다크로 볼 수 있게** — ✅ 2026-11-10 (dev 미리보기 = 설정 > 화면 > 개발용, dev-gallery는 앱에서 링크가 없어 대신)
   - 전체 팔레트 확정(§3-1: 45개 토큰 전부 라이트/다크 쌍) + 테마 고정 토큰(`onLight #1D1D1B`, `onDark #FFFFFF`).
   - `LIGHT_THEME`/`DARK_THEME` 두 고정 객체, context 기본값 = 라이트(기존 테스트 그대로 통과).
   - `makeStyles(fn)`: 파일 로드 때 라이트·다크 StyleSheet를 **둘 다 한 번** 만들고 훅은 고르기만(컴포넌트별 useMemo 금지 — TimeBlock 수백 개).
   - `userInterfaceStyle:"automatic"` + `expo-system-ui`(창 바탕 `setBackgroundColorAsync`) + **새 빌드**, 런타임 라이트 고정은 유지, `__DEV__` 전용 모드 전환(dev-gallery).
   - ESLint: `TOKENS` 직접 import = **경고**(남은 개수 추적), 색 리터럴 금지에 `rgba(` 추가.
   - 테스트: 쌍 완전성, 대비(반투명 채움은 **바탕에 섞은 뒤** 4.5:1/3:1 검사), makeStyles 캐시.
1. ✅ 2026-11-10 공용 프리미티브(form-rows, HomeSection, SettingsChrome, TimeBlock, TimeGrid, AllDayRow, KidFilterBar, FloatingDock, SwipeToDelete, ItemLine, PagingStrip) + **아이콘 기본 색**(icons.tsx `color = TOKENS.ink` 기본값 → 테마) + `ELEVATION`을 테마 함수로.
2. ✅ 2026-11-10 캘린더 화면 + 픽업 카드(`PickupCard`의 `onBg === TOKENS.surface` 비교 → `onLight/onDark` 고정 토큰) + `PICKUP_CARD_PALETTE`, `WeekView` 등 색을 굽는 `useMemo`에 `t` 의존성.
3. ✅ 2026-11-10 홈 / 설정 / 설정 안쪽 / 온보딩(`BLOB_CITRUS`) / 검색 / 날짜 선택(`CalendarDrawer` `WEEKEND_COLOR_SAT`) / 상세·폼(DateTimePicker `themeVariant="light"`·`textColor` 하드코딩 제거).
   + React Navigation `ThemeProvider`(커스텀 Default/DarkTheme)로 탭·스택·헤더 바탕.
4. ✅ 2026-11-10 `TOKENS` 별칭 제거, ESLint 경고 → **에러**.
5. 설정 > 화면 모드(시스템/라이트/다크) 노출. 저장값은 **부팅 중 `setBootState('ready')` 전에** 적용(스플래시가 가림). 초기화·JSON 가져오기 시 다시 적용. 실기기 확인(아래 §6).

## 5. 위험
| 위험 | 대응 |
|---|---|
| 전환 누락으로 다크에서 흰 박스/검정 글씨 잔존 | 4단계 ESLint로 `TOKENS` 잔존 0 보장, 스킴별 스냅샷 테스트 몇 개 |
| 네이티브 시트(formSheet)·키보드·피커가 앱 스킴과 불일치 | `Appearance.setColorScheme`가 네이티브까지 적용 — 실기기 확인 항목 |
| 스킴 전환 시 리렌더 비용 | 드문 이벤트, 메모 캐시 |
| 이미지(아바타 PNG) 흰 배경 | 투명 여부 확인, 아니면 원형 바탕 토큰 |
| 대비 미달(주황 글씨 등) | 단계 0 자동 대비 테스트 |

## 6. 검증
- 단위: 팔레트 쌍 완전성, 대비, `makeStyles` 캐시, appearance-store 저장/복원/초기화/내보내기.
- 화면: 주요 화면을 라이트·다크로 렌더해 배경/글씨 토큰 적용 확인.
- 실기기(5단계): 홈·캘린더 3보기·새 일정·상세·설정, 시스템 설정 변경 중 실시간 전환, 시트·피커·키보드.

## 7. 검토 (Architect + Critic, 2026-11-10) — 판정: 승인(수정 조건부)
1. A안 타당(B는 PickupCard 문자열 색 비교·withAlpha와 안 맞음). 혼용 불필요. makeStyles는 **모듈 로드 시 두 벌 생성**, 테마 context는 두 고정 객체 + 라이트 기본값. → §4-0 반영.
2. **논리 버그**: `PickupCard.tsx:39-41,143`이 `onBg === TOKENS.surface` / `pickOnBg → TOKENS.ink|surface` — 다크에서 뒤집힘 → 테마 고정 `onLight`/`onDark` 토큰. 블록 글씨(`onKidFill`)도 동일. → §4-2.
3. **팔레트 미완**: ADR 표는 ~15/45 키. `ink70/50/30/12/06/04`·`separator`는 *밝은 글씨색의 반투명*으로, `controlActive #2A2A29`(다크 바탕에서 안 보임), `controlIdle`·`switchOff`·`surfaceWarm/Soft`·`nowLine`, `saturday #3F66D8`(#272523 위 2.9:1 미달), `sunday`, 픽업 카드·차 색, 아이 `bg` 미정 → 단계 0 전에 전부 확정.
4. **대비 미달**: 다크 보호자 블록(`#5A5751` 85% + 검정 글씨) < 3:1 → 채움별 글씨색(아이 = 검정, 보호자 = 밝은 글씨). 대비 테스트는 섞은 색 기준.
5. **모듈 로드 시 굳는 색**(계획 누락): `ELEVATION.dock`, `PICKUP_CARD_PALETTE`, `CalendarDrawer.tsx:39 WEEKEND_COLOR_SAT`, `welcome.tsx:91 BLOB_CITRUS`, icons.tsx 기본 색, 색을 굽는 `useMemo`(WeekView 132-162). Reanimated 워클릿은 색을 안 읽음(위험 과대평가였음).
6. **네이티브 크롬 누락**: React Navigation 테마(탭·스택·dev-gallery 헤더), 루트 창 바탕(`expo-system-ui` — 안드로이드는 이것 없이 `userInterfaceStyle` 무시), DateTimePicker `themeVariant="light"`/`textColor` 하드코딩(`ScheduleEditSheet.tsx:1171-1172`).
7. `Appearance.setColorScheme` 가정은 맞음(RN 0.81: 모든 창 `overrideUserInterfaceStyle`, Alert도 따름). 주의: `null` → 'unspecified', 호출 직후 읽기는 변경 이벤트 전까지 이전 값 → 부팅 중 적용. 새 아키텍처에서 `useColorScheme` 미갱신 보고·iOS 앱 전환 스냅샷 시 잠깐 깜빡임 보고 → 실기기 조기 확인.
8. **순서**: 그대로면 5단계 전엔 다크를 볼 수 없어 1–3단계 검증 불가 → `automatic`·새 빌드·개발용 전환을 단계 0으로. → §4 반영.
9. **가드레일 늦음**: `TOKENS` import 금지 경고를 단계 0부터, 4단계에서 에러. 색 리터럴 규칙에 `rgba(` 추가(PickupCard, add-kid.tsx:490이 빠져나감).
10. **제품 결정 필요**: 기본값 "시스템"이면 폰이 다크인 사용자는 업데이트하자마자 다크로 바뀜(선택 없이) → 의도적으로 결정. JSON 가져오기·초기화 때 모드 다시 적용.
11. **테스트**: `TimeBlock.test.tsx:45-48`(0.6/0.8 하드코딩), `CalendarDrawer.test.tsx:90`(`'#FF7144'`)은 기본 라이트면 통과 유지. TimeBlock·PickupCard 다크 렌더 테스트 추가.
