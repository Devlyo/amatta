# ADR-005 — iOS App Store v1.0.0 첫 출시 포스처

- **Status**: Accepted (2026-06-07) — ralplan 합의(Planner→Architect→Critic, 2 iteration, APPROVE) + 사용자 결정 반영
- **Supersedes/relates**: ADR-001(stack lock), ADR-004(modal sheets). 실행계획 본문: `.omc/plans/ralplan-ios-launch.md`

## Context
로컬 전용(서버/계정 없음) Expo SDK ~54 / RN 0.81 앱을 iOS App Store에 v1.0.0로 처음 제출/출시한다. 현재 Expo Go 개발 상태(네이티브 빌드 미검증), 에셋 placeholder, eas.json 없음. ralplan 리뷰에서 코드 검증으로 출시 차단급 결함 3건이 발견되어 계획에 반영됨.

## Decision (사용자 확정)
1. **Apple 계정 = 개인(individual)** — D-U-N-S 불필요, 최단 경로. (A1)
2. **스토어 표시명 = "아마따"** — bundleId `io.devlyo.amatta` (2026-06-30 QA7: 레거시 `io.starzip.schedulapp`에서 Devlyo/아마따 브랜드에 맞게 변경, ASC 레코드/첫 제출 전이라 안전). (A2)
3. **v1은 아이폰 전용** — `supportsTablet:false`. iPad는 v1.1로 연기(그리드는 fluid해서 깨지진 않으나 범위 최소화). 재개 시 WeeklyGrid/MultiKidGrid 고정폭 감사 필요(구 Q8). (A3)
4. **iCloud 표면 전부 제거** — `usesIcloudStorage`(app.json:19) + entitlements + `NSUbiquitousContainers`. 코드에 iCloud 사용 0이라 미사용 capability 거절(Guideline 2.1) 제거. 진짜 백업은 v1.1. (A4)
5. **개인정보처리방침 공개 https URL 호스팅** (GitHub Pages/Notion). (A5)
6. **카테고리=생산성, 연령=4+, Kids 카테고리 아님.** (A6)
7. **react-native-svg 픽스 = committed patch-package** — postinstall 의존 제거(EAS 관리 install에서 안 돌 위험). 패치 자체는 **유지**(Metro 네이티브 번들 버그라 제거 시 SVG 깨짐). (Q7)
8. **시스템 알림 토글 = 실제 연결(a)** — 현재 토글이 schedule 시점에 미반영(작동 안 함). v1에서 끄면 실제로 알림 suppress/cancel 되도록 연결. (Q9)

## Drivers
1. Time-to-first-approval(+ 가입 지연을 critical path에서 분리) · 2. 심사 거절 리스크 최소화 · 3. 알림 신뢰성(64캡 truncation = 차단급).

## Alternatives considered (rejected)
- 법인 계정(거절 — D-U-N-S 1~2주 지연) · iPad v1 포함(연기 — 범위) · iCloud 유지(거절 — 미사용 capability) · **SVG 패치 제거**(거절 — Metro 네이티브 버그, v1 오류였음) · 알림영구저장에 AsyncStorage(거절 — UserDefaults required-reason 추가 → SQLite `app_settings`가 매니페스트 깔끔) · 알림 horizon 추가(불필요 — 이미 존재; 진짜 갭은 무제한 스케줄) · 시스템토글 숨김(b)(미채택 — 사용자가 실제연결 선택).

## Consequences
- (+) 최소·검증된 표면으로 빠른 저위험 승인. 4명 사용자도 다음 알림 항상 보존(soonest-first ≤60). export↔UI 정합으로 메타데이터정확성(2.3.8) 벡터 제거.
- (−) v1엔 iCloud/iPad/cross-device 복원 없음. 알림 truncation 인디케이터는 UX 타협. 크래시 가시성은 Apple Organizer만.

## 출시 차단 결함(계획서 P3에서 해결)
- **64 알림 캡**: `rescheduleAll`(scheduler.ts:178-231)이 무제한 스케줄 → 가까운 순 ≤60 truncation으로 수정.
- **백업 정합**: `src/utils/db-export.ts`가 4/7 테이블만 내보내며 UI는 7개+복원 약속 → export 7테이블 확장 or 약속 축소 + "카테고리==표시카운트" 테스트.
- **NOTIF-PERSIST**: 전역 Zustand 설정이 재시작 시 리셋 → SQLite `app_settings` 영구저장(precedence 리졸버는 없음, 만들지 않음).

## Follow-ups (v1.1+)
iCloud 백업 + import 경로 / iPad 반응형 그리드 + 그리드 고정폭 감사 / 외부 베타 / 60캡 튜닝 / 필요 시 크래시 SDK.
