# ADR-004 — 바텀시트·모달은 네이티브 expo-router 라우트 (gorhom 미사용)

- **Status**: Accepted (2026-06-06)
- **Supersedes**: 없음. ADR-001의 UI 스택에서 `@gorhom/bottom-sheet` 사용 의도를 폐기.

## Context

앱의 모든 오버레이 surface(달력, 검색, 일정 상세, 새 일정/수정, 데이터 초기화 확인, 자녀 선택)는
초기 구현에서 전역 mount된 RN `<Modal transparent animationType="slide">` + 커스텀 backdrop으로
ui-store가 구동했다. 이를 "갤러리처럼" 네이티브 시트 느낌(뒤 화면 카드 리세스 + swipe-to-dismiss)으로
바꾸려는 과정에서 두 가지가 드러났다:

1. **gorhom `BottomSheet`/`BottomSheetModal`을 쓰면 "닫은 뒤 첫 탭이 먹히는" 버그**가 iOS 실기기에서
   발생. 라우트/전역 mount 무관하게 재현. 반대로 `presentation:'modal'`(dev-gallery, gorhom 미사용)은
   문제 없음 → **원인은 gorhom의 backdrop/제스처 시스템**으로 확정. 시도했지만 실패한 우회:
   closingRef 가드, `containedTransparentModal`, root `pointerEvents="box-none"`, 라우트별
   `GestureHandlerRootView`, `animation:'none'` 제거, BottomSheetModal-at-root.
2. 네이티브 `formSheet` 초기 시도 시 보였던 "어두운 좌우/하단 여백·터치 시 흰색 번짐"은 전부
   **다크모드 아티팩트**였고, 런타임 `Appearance.setColorScheme('light')` + `contentStyle` 흰색으로 해결됨
   (앱은 amatta-v1 기준 라이트 전용 디자인).

## Decision

**모든 시트/모달은 expo-router 네이티브 라우트로 표시한다. gorhom은 쓰지 않는다.**

- **짧은 시트** (달력 0.5, 검색 0.5↔0.92): `presentation:'formSheet'` + `sheetAllowedDetents`(분수 배열)
  + `sheetGrabberVisible` + `sheetCornerRadius`.
- **콘텐츠 크기 시트** (데이터 초기화, 자녀 선택): `presentation:'formSheet'` + `sheetAllowedDetents:'fitToContents'`
  (래퍼 View는 `flex:1` 금지 — 콘텐츠 높이를 시트가 hug).
- **풀 모달** (새 일정/수정, 일정 상세 — 콘텐츠가 많고 헤더+스크롤 폼): `presentation:'modal'`.
- 공통: `contentStyle:{backgroundColor:'#FFFFFF'}`, 라우트 root에 상단 패딩(grabber/모서리 클리어),
  키보드는 `ScrollView automaticallyAdjustKeyboardInsets`(iOS) — `KeyboardAvoidingView` 미사용.
- **앱 라이트모드 런타임 고정**: `app/_layout.tsx` 모듈 스코프 `Appearance.setColorScheme('light')`
  (app.json `userInterfaceStyle:'light'`는 Expo Go에서 미적용이라 런타임 호출 필수).
- **상태**: ui-store가 visibility/식별의 source of truth 유지. 일부 라우트(상세·편집)는 route params로
  식별값을 받아 `useModalRouteShell`로 ui-store를 seed. 자녀 선택은 host 콜백이라 `ui-store.pendingKidId`
  → `/child/[id]`가 `useFocusEffect`로 소비(레인 교체).

## Consequences

- ✅ "두 번 탭" 버그 제거 (네이티브 시트 = dev-gallery와 동일 메커니즘).
- ✅ 네이티브 짧은 시트(detent) + grabber + swipe-to-dismiss + 다크모드 안전.
- ⚠️ iOS가 formSheet를 양측·하단 ~8px floating 인셋으로 그림(네이티브 스타일). 짧은 높이를 유지하는 한
  제거 불가 — 수용(두 번 탭보다 나음). 풀 height가 필요하면 `presentation:'modal'`.
- ⚠️ 작은 네이티브 시트는 탭 시 살짝 확대되는 네이티브 피드백 있음 — 수용.
- 🧹 `@gorhom/bottom-sheet`는 더 이상 사용 안 함(package.json엔 남아 있음 — 후속 제거 가능).
  `react-native-gesture-handler`/`react-native-reanimated`는 그리드 제스처 등에서 계속 사용.

상세 구현/실패 우회 기록: 메모리 `project_drawer-route-modal.md` + `.omc/plans/ralplan-drawer-route-modal.md`.
