# P2 — Privacy / 암호화 / 컴플라이언스 (iOS 제출용)

> 앱은 **로컬 전용**: 서버·계정·로그인·클라우드 동기화·애널리틱스·추적 전부 없음. 모든 데이터는 기기 SQLite에만 존재.
> 이 문서 = App Store Connect 신고값 + 심사 리뷰어 노트의 단일 출처. 코드 측 선언은 `app.json` → `ios.privacyManifests` / `ios.infoPlist`.

## 1. App Privacy (ASC "앱 개인정보 보호" 폼) = **Data Not Collected**
- 모든 데이터 카테고리에 대해 **"이 앱은 데이터를 수집하지 않습니다"** 선택.
- 근거: 네트워크 송신 0, 계정 0, 서드파티 SDK(분석/광고/크래시) 0. 일정·자녀·준비물 데이터는 기기 밖으로 나가지 않음.
- 개인정보처리방침 URL: P6에서 공개 https 호스팅 후 ASC에 입력 (`docs/legal/privacy-policy.html`).

## 2. 암호화 (Export Compliance)
- `app.json` → `ios.infoPlist.ITSAppUsesNonExemptEncryption = false` (선언 완료).
- 근거: 앱은 **비면제(non-exempt) 암호화를 사용하지 않음**. HTTPS도 안 씀(네트워크 자체가 없음). ASC에서 추가 암호화 서류 불필요.

## 3. Privacy Manifest (`PrivacyInfo.xcprivacy`) — required-reason API
`app.json` → `ios.privacyManifests`로 선언 (빌드 시 `PrivacyInfo.xcprivacy` 생성). 선언 내용:
- `NSPrivacyTracking: false`, `NSPrivacyTrackingDomains: []`, `NSPrivacyCollectedDataTypes: []` (추적·수집 없음).
- **NSPrivacyAccessedAPITypes** (Expo/RN이 전이적으로 사용 — 우리 코드 의도와 무관하게 SDK가 호출):
  | API 카테고리 | Reason | 왜 |
  |---|---|---|
  | FileTimestamp | `C617.1` | 앱 컨테이너 내부 파일 타임스탬프(expo-file-system / DB·export 파일) |
  | UserDefaults | `CA92.1` | AsyncStorage(권한 asked-flag, `src/notifications/permissions.ts`)가 NSUserDefaults 사용 — 같은 앱 내부 접근 |
  | SystemBootTime | `35F9.1` | RN/Expo 런타임의 경과시간 측정 |
  | DiskSpace | `E174.1` | export 쓰기 전 가용 공간 확인(쓰기 실패 방지) |

### ⚠️ 최종 검증 (P1b production 빌드 후 — plan M4)
선언값은 SDK54 표준 세트 기준 **사전 선언**임. production 빌드(또는 `expo prebuild`) 산출 `ios/`의 **집계된 privacy report**를 읽어 실제 사용 API와 대조해 누락/과잉을 조정할 것. 누락 시 TestFlight 처리 단계에서 수 시간 내 플래그됨 → 매니페스트 수정 후 재제출(코드 변경 아님).

## 4. iCloud — 제거 확인 ✅
- grep 게이트 통과: `usesIcloudStorage|icloud|ubiquit|CloudDocuments|NSUbiquitousContainers` → `app.json: clean` (ios/ 미prebuild). ADR-005대로 iCloud 표면 0.

## 5. 심사 리뷰어 노트 (P8 제출 시 첨부)
- **로컬 전용 앱**: 서버·계정·로그인 없음. 모든 데이터는 기기에만 저장, 네트워크 송신 없음.
- **Sign in with Apple = N/A**: 어떤 종류의 인증도 없음(서드파티/계정 로그인 부재) → 가이드라인 4.8 / 5.1.1(v) 비해당. (리뷰어가 부재를 플래그할 수 있어 명시적으로 기재.)
- **콘텐츠 권리**: 모든 콘텐츠 자체 보유, 서드파티 콘텐츠 없음.
- **연령 등급**: 4+ (부적절 콘텐츠 없음).
- 알림은 **로컬 푸시만** (원격 푸시/서버 없음).

## 체크리스트 (제출 전)
- [x] `ITSAppUsesNonExemptEncryption=false`
- [x] `ios.privacyManifests` 선언 (FileTimestamp/UserDefaults/SystemBootTime/DiskSpace)
- [x] iCloud grep clean
- [ ] P1b 빌드 산출 `ios/` privacy report와 대조 (최종 도출)
- [ ] ASC App Privacy = Data Not Collected 입력
- [ ] 개인정보처리방침 공개 URL (P6) 입력
- [ ] 리뷰어 노트(§5) 첨부
