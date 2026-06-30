# Backlog — schedul-app

> Spec(`.omc/specs/deep-interview-schedul-app.md`) Acceptance Criteria 와 user-stories 에서 끌어옴.
> 형식: `[Priority] [Source] task — phase`. 우선순위 P0(필수)/P1(중요)/P2(나중).
> SPRINT.md 로 옮기면 `→ SPRINT` 표시.

## P0 — must-have for v0.1.0

### Foundation
- [ ] [SPEC-DB-1] SQLite 스키마 v1 자동 마이그레이션, 재실행 시 데이터 보존 — Phase 1
- [ ] [SPEC-DB-2] 마이그레이션 트랜잭션 PRAGMA 안쪽 + 크래시 복구 테스트 — Phase 1
- [ ] [SPEC-DOM-1] occurrence 알고리즘 8 시나리오 단위 테스트 ≥ 80% 커버리지 — Phase 1

### Data
- [ ] [US-001] 자녀 등록 (이름·6색) — Phase 2
- [ ] [US-002] 자녀 최대 4명 enforce — Phase 2
- [ ] [US-010] 일정 등록 (제목·타입·시간·요일반복) — Phase 2
- [ ] [US-011] 일정에 위치/메모 선택 입력 — Phase 2
- [ ] [US-012] 특정 날짜 일정 1회 취소 (cancel exception) — Phase 2
- [ ] [US-014] 삭제 시 "이 회차만 / 전체" 선택 — Phase 4
- [ ] [US-015] 일정 추가/수정 시트에서 준비물 N개 (label·reorder·complete toggle) — Phase 2 (ADR-002)
- [ ] [US-016] 일정 알림 본문에 준비물 요약 자동 prepend (≤80자) — Phase 5 (ADR-002)
- [ ] [SPEC-DB-3] Migration v2: ChecklistItem·Todo·SchedulePickupLog 테이블 + Schedule.needs_pickup 컬럼 추가 (총 7 tables), v1→v2 데이터 무손실 — Phase 1 (ADR-002)

### UI — Daily
- [ ] [US-020] 메인 일간 그리드 (자녀×시간) 렌더 — Phase 3
- [ ] [US-021] 좌우 스와이프 prev/next day — Phase 3
- [ ] [US-022] 자녀 헤더 탭 → 주간 드릴다운 — Phase 3/4
- [ ] [US-023] 빈 슬롯 탭 → 추가 시트 — Phase 3/4
- [ ] [US-017] 일정 블록 내부에 준비물 inline 표시 (≥45px 높이일 때만) — Phase 3 (ADR-002)
- [ ] [US-024] "오늘 챙길 것" 카드 (자녀별 묶음, 미완료만, 탭 시 블록 스크롤) — Phase 3 (ADR-002)
- [ ] [US-060] 일정에 needsPickup 토글 → 블록 우상단 🚗 — Phase 3 (ADR-002)
- [ ] [US-061] 회차별 픽업 완료 체크 → `schedule_pickup_log` INSERT/DELETE — Phase 4 (ADR-002)
- [ ] [US-062] 시간 겹침 + needsPickup ≥2 → sub-bar `⚠ {hh:mm} 픽업 충돌` pill (블록·푸시 무영향) — Phase 3 (ADR-002)
- [ ] [SPEC-PERF-1] 첫 페인트 < 1.5s (Android API 33 emu, 32-schedule seed) — Phase 3

### Todos (ADR-002)
- [ ] [US-050] Todo 추가/수정/완료/삭제 (반복 X) — Phase 2
- [ ] [US-051] Todo dueAt - notify_minutes_before 시점 로컬 푸시 — Phase 5
- [ ] [US-052] 일간 화면 상단 "오늘 할 일" 카드 (자녀 무관 to-do 포함) — Phase 3

### Notifications
- [ ] [US-030] 일정 N분 전 로컬 푸시 — Phase 5
- [ ] [US-031] 자녀별 minutesBefore 설정 — Phase 5
- [ ] [US-032] 일정 삭제 시 알림 자동 정리 — Phase 5
- [ ] [SPEC-NOTIF-1] rescheduleAll cancelAll 우선 + grep 테스트 — Phase 5

## P1 — should-have

- [ ] [US-003] 자녀 정보 수정·삭제 — Phase 2
- [ ] [US-013] 특정 날짜 일정 시간 1회 변경 (modify exception) — Phase 4
- [ ] [US-040] Settings에서 DB JSON 내보내기 — Phase 6
- [ ] [SPEC-VIS-1] 취소된 일정 30% opacity + strike-through — Phase 3
- [ ] [SPEC-VIS-2] 수정된 일정 우상단 dot/badge — Phase 3
- [ ] [SPEC-A11Y-1] 자녀 색상 텍스트 대비 WCAG AA — Phase 3

## P2 — nice-to-have / 나중

- [ ] [US-041] OS 자동 백업 복원 검증 (iOS iCloud / Android Auto Backup) — Phase 6
- [ ] iOS 64 알림 cap rolling reschedule (open-questions T5) — Phase 5+
- [ ] 빈 상태(EmptyChildrenState) 일러스트·CTA — Phase 6
- [ ] visual-verdict 스크린샷 골든파일 — Phase 6
- [ ] 앱 아이콘·스플래시 디자인 — Phase 6

## Discovered later
(작업 중 새로 발견되면 여기 추가, 우선순위 합의 후 위로 이동)

### Tracked 2026-06-03 (after onboarding + settings + avatar pass)

**Big unfinished feature**
- [ ] [NOTIF-WIRE] expo-notifications 본격 wiring — 일정/할일 추가해도 푸시가 안 울리는 상태.
  ADR-002 정책은 정해놨지만 실제 스케줄링 코드 0줄. P0 우선순위 후보.
- [ ] [NOTIF-PERSIST] 설정 상단의 '시스템 알림' + '기본 알림 시점' 영구 저장.
  현재 useState 만 → 앱 재시작 시 default 로 리셋. app_settings 테이블 추가 또는 AsyncStorage slice.

**시안 fidelity 점검 안 한 surface**
- [ ] [SEARCH-DRAWER-PASS] SearchDrawer 시안 픽셀 매칭 점검. 동작은 함.
- [ ] [DATA-LEGAL-PASS] 설정 → 데이터 / 약관 페이지 시안 비교 (사용자가 "그대로 둬" 했지만 한 번 훑긴 필요).
- [ ] [WELCOME-BLOB-SVG] 온보딩 Welcome 스크린의 라임 트레이 — 현재 2px 직선 합의 상태,
  EAS dev-build 전환 시 react-native-svg bezier 로 정확한 organic 블롭 교체 가능.

**기술 부채 / 정리**
- [ ] [REF-IMAGES-AUDIT] docs/design/references/char_pack*.jpg + sub_colors.webp — git 에 올라가 있는데
  코드에서 안 씀. 사용 여부 확정 후 ref-only 디렉토리로 옮기거나 .gitignore.

### Tracked 2026-06-07 (after design-consistency pass — feat/design-consistency-pass)

- [ ] [ASSET-SWAP] 아이콘 / 이미지 에셋 교체 — 현재 placeholder/임시 에셋을 최종 디자인 에셋으로 교체
  (앱 아이콘·스플래시·마스코트·타입 아이콘 등 전반 점검).
- [ ] [LEGAL-EDIT] 약관 / 개인정보처리방침 본문 수정 — 실제 서비스 내용·연락처·발효일 확정 반영
  (app/settings/legal.tsx 텍스트).
- [ ] [QA-BEHAVIOR] 동작 확인 — 디자인 패스 이후 전 화면 기능 회귀 점검 (일정 CRUD, 날짜 스코프
  todo, 4명 시드/렌더, 모달 흐름, 알림 등) 실기기 동작 검증.

## App Store v1.0.0 출시 (ADR-005 / 계획: .omc/plans/ralplan-ios-launch.md)

> 결정 확정: 개인 계정 · 스토어명 "아마따" · 아이폰 전용(iPad v1.1) · iCloud 제거 ·
> 약관 웹호스팅 · 생산성/4+ · SVG patch-package · 시스템알림 토글 실제 연결.
> 의존성 순서. [BLOCKER] = 다음 단계/제출 차단.

- [ ] **P0** 결정+Apple 개인 계정 가입(1~14일, day1 시작) + App Store Connect 앱 레코드 `[BLOCKER]`
- [ ] **P1a** 무료 dev-client 빌드로 실기기 검증(가입과 병렬): SVG 렌더(patch-package) + 로컬 알림 실발화
- [ ] **P1b** EAS production 빌드 인프라(eas.json) `[P0 gated]` — 프로덕션 번들 SVG 확인
- [ ] **P2** Privacy Manifest(PrivacyInfo.xcprivacy, filesystem) + ITSAppUsesNonExemptEncryption=false + App Privacy "수집안함" 신고 + **iCloud 3표면 제거**(usesIcloudStorage/entitlements/NSUbiquitousContainers) `[BLOCKER]`
- [ ] **P3.1** [NOTIF-PERSIST] 전역 알림설정 SQLite app_settings 영구저장 + 부팅 재수화 `[BLOCKER]`
- [ ] **P3.2** 64알림 캡: rescheduleAll 가까운 순 ≤60 truncation + 인디케이터 `[BLOCKER]`
- [ ] **P3.3** 백업 정합: db-export 7테이블 확장 or 복원약속 축소 + 카테고리==카운트 테스트 `[BLOCKER]`
- [ ] **P3.4** 시스템알림 토글 실제 연결(Q9-a) + 부팅 재arm + 권한거부 graceful
- [ ] **P4** 실기기 QA 스윕 (CRUD/날짜스코프todo/4명/모달/알림 ≥65 guard/백업복원) `[BLOCKER]`
- [ ] **P5** 에셋 교체(1024 아이콘·스플래시·adaptive·블롭·빈상태) + App Store 스크린샷(6.9"+6.5") `[BLOCKER]`
- [x] **PREP-RECUR** ✅ 완료 (ADR-006, 마이그레이션 v6, jest 399 green) — 준비물 반복 vs 당일 귀속 분리 + 회차별 완료 로그(`checklist_completion`). J1-A 채택, 항목별 반복 토글(기본 OFF/당일, EditSheet는 반복 기본), 알림 본문 Option A. 실기기 검증은 Phase 4b. 아래는 원 이슈 기록:
- [~] ~~**PREP-RECUR** ⚠️출시 전 수정 — 준비물/할일 반복 vs 당일 귀속 분리. 현재 준비물은
  스케줄(템플릿) 레벨 + done이 단일 플래그라, 반복 일정에서 한 번 체크하면 매 발생일에
  완료로 남고 안 풀림. 모델: 목록은 반복(occurrence_date NULL) + **당일 항목(occurrence_date)**
  추가, **완료는 회차별 로그**(픽업 완료 패턴). 당일 항목은 그날 맥락(일정 상세/일간 준비물)
  진입점 필요. ADR-002 보완 + 마이그레이션 v6. ralplan 권장. (qa 2차 논의)~~
- [ ] **A-ICONS** amatta 커스텀 SVG 아이콘 재도입(홈/설정 nav·종류 4종·온보딩 블롭) — `docs/design/amatta-icons/`. ⚠️ react-native-svg가 **Expo Go SDK54에선 로드 자체가 크래시**(Circle/Defs "component config 없음"). 현재는 @expo/vector-icons 폴백.
  - **2026-06-30 발견**: 코드 구현은 끝(커밋 `eb71a99`, 11개 SVG → RN-SVG 포팅, jest green)이나 **현재 dev 빌드에도 RNSVG 네이티브(Fabric)가 등록 안 됨** → 같은 "component config 없음" 크래시. `scripts/fix-react-native-svg-manifest.js` postinstall 패치는 **Metro JS 해석만** 교정(`react-native` 필드 → `lib/module/index.js`), 네이티브 codegen은 별개. → 되돌림(vector-icons 유지).
  - **풀려면**: RNSVG Fabric이 바이너리에 포함되도록 빌드 정비 후 **새 dev/prod 빌드** 필요. codegen이 패치된 manifest를 EAS install→prebuild 순서에서 보는지 확인(필요 시 `expo prebuild` 재생성 / `react-native-svg` 업그레이드 검토). 빌드되면 `eb71a99` 재적용+검증. **P1b production 빌드와 함께 처리 권장.**
- [ ] **UI-POLISH** 출시 전 UI 폴리시 1패스 (한 번에 몰아서) — PREP-RECUR 반복 토글 행 시안화, 빈상태, 간격/토큰 정합, amatta-v1 fidelity 재점검 등. 기능 동작은 OK, 비주얼만. (2026-06-30 사용자 deferred)
- [ ] **P6** 약관/개인정보 본문 확정 + 공개 https URL 호스팅 + 메타데이터(설명·키워드·생산성·4+) `[BLOCKER]`
- [ ] **P7** version 1.0.0 + ios.buildNumber 추가/autoIncrement + app.json에 아마따/supportsTablet:false 반영
- [ ] **P8** TestFlight 내부베타 → 심사 제출(리뷰어 노트: 로컬전용/계정없음) → 리뷰 대응 `[FINAL]`

## Play Store (Android) — iOS 이후 (코드 ~95% 공유)

> Expo 크로스플랫폼이라 로직/UI/아이콘(dual-path SVG)/알림/백업 전부 재사용.
> iOS 자산(방침 URL·스토어 문구·QA 체크리스트) 재활용. 아래는 Android 전용 델타만.

- [x] **A-PKG** `android.package = io.starzip.schedulapp` (app.json) — 완료
- [ ] **A-ACCT** Google Play 개발자 계정($25 1회) + 신원 확인 `[BLOCKER]`
- [ ] **A-TEST** ⚠️ 신규 **개인** 계정이면 프로덕션 전 closed testing **12~20명 × 14일** 의무 — 가장 큰 일정 허들 (법인은 면제) `[BLOCKER]`
- [ ] **A-ALARM** Android 12+ 정시 알림 정밀도 점검(SCHEDULE_EXACT_ALARM 필요 여부) — 기본으로 충분한지 실기기 확인
- [ ] **A-NOTIF13** Android 13+ POST_NOTIFICATIONS 런타임 권한 흐름 확인(expo-notifications 처리)
- [ ] **A-BUILD** `eas build --profile production --platform android`(.aab) + 키스토어(EAS 자동) → `eas submit`
- [ ] **A-ASSET** 아이콘 512×512 + **피처 그래픽 1024×500**(Play 필수) + 안드로이드 스크린샷
- [ ] **A-LISTING** Play Console 등록: 설명(iOS 문구 재사용) + **Data safety 폼**("수집 안 함") + 콘텐츠 등급(IARC) + 개인정보처리방침 URL(iOS와 동일)
- [ ] **A-TARGET** Play target API level 요건 충족(SDK54 기본 충족 여부 확인)
- [ ] **A-QA** iOS QA 체크리스트(docs/launch/qa-checklist.md) Android 실기기 재실행(알림·아이콘·블롭 등)
