# App Store 2.0.0 업데이트 — 문구 초안 · 체크리스트 (iOS, 한국어)

> 1.0.0 문구(`app-store-metadata.md`)에서 바뀌는 것만 적었다. 나머지 필드는 1.0과 같다.
> 2.0.0의 큰 변화:
> - 이름 WeMoa(ADR-011), 새 아이콘
> - 홈 화면(ADR-014), 일·주·월 캘린더(ADR-007)
> - 함께하는 일정(ADR-013), 끌어서 옮기기(ADR-015)
> - 보호자 일정 = 아이폰 캘린더(ADR-008)
> - 캘린더 공유 링크(ADR-016), 백업으로 시작(ADR-012), 다크 모드(ADR-009)

## 앱 이름 (≤30자)
- **확정 (오너 2026-11-12)**: `WeMoa: 자녀 일정관리 캘린더`
- 영어(2.1, en-US): `WeMoa: ` + 짧은 영어 — 후보는 아래 "결정·확인" 참고

## 부제 (≤30자)
- 초안: `아이 일정·픽업·준비물 한 화면에` (17자)

## 프로모션 텍스트 (≤170자)
```
아이들 일정을 한 화면에 나란히. 홈에서 지금 누가 어디 있는지, 다음 픽업과 오늘 챙길 준비물을 바로 보고, 아이폰 캘린더의 내 일정도 함께 확인하세요.
```

## 이번 버전 (What's New, 2.0.0)
```
WeMoa로 새로워졌어요.
• 홈: 지금 진행 중인 일정, 다음 픽업, 오늘 챙길 준비물과 할 일을 한눈에
• 캘린더: 일·주·월 보기, 핀치로 날짜 수 조절, 길게 눌러 끌어서 일정 옮기기
• 함께하는 일정: 여러 아이와 보호자가 함께하는 일정을 한 번에
• 보호자 일정: 아이폰 캘린더의 내 일정을 함께 보고, 앱에서 바로 추가
• 캘린더 공유: 다른 보호자에게 1주 일정을 보기 전용 링크로
• 다크 모드, 백업 파일로 시작하기
의견은 amatta.help@gmail.com 으로 보내 주세요.
```

## 설명 (≤4000자) — 1.0에서 고칠 곳
1. "아마따" → "WeMoa"로 바꾼다(전체).
2. "06시부터 늦은 밤까지" → "0시부터 24시까지"로 바꾼다(ADR-007 축 변경).
3. "■ 픽업을 놓치지 않게" 문단: "화면 상단 카드" → "홈의 다음 픽업 카드".
4. "■ 주간으로도, 자녀별로도" 문단을 아래로 바꾼다.
   ```
   ■ 일·주·월, 원하는 대로
   하루는 아이별 칸으로 나란히, 한 주는 핀치로 날짜 수를 조절하며, 한 달은 달력으로. 일정을 길게 눌러 끌면 시간과 날짜를 바로 옮길 수 있어요.
   ```
5. 새 문단을 추가한다.
   ```
   ■ 함께하는 일정과 보호자 일정
   여러 아이가 함께 가는 일정은 한 번만 등록하세요. 아이폰 캘린더의 내 일정도 함께 보여 주고, 앱에서 추가한 보호자 일정은 아이폰 캘린더에 저장돼요.

   ■ 다른 보호자와 공유
   오늘부터 1주 일정을 보기 전용 링크로 보낼 수 있어요. 링크는 기기에서 암호화되고 14일 뒤 사라져요.
   ```
6. "■ 프라이버시가 기본값" 목록의 "서버 전송 없음 · 외부 수집 없음"을 아래로 바꾼다.
   - 이유: 공유 링크가 생겼으므로 "서버 전송 없음"은 더 이상 맞지 않다.
   ```
   - 회원가입·로그인 없음, 광고·분석 도구 없음
   - 모든 데이터는 기기 안에만 (직접 만든 공유 링크만 암호화해 14일 보관)
   ```

## 기타 필드에서 바뀌는 것
- **저작권**: `© 2026 WeMoa`
- **심사 메모**: 아래로 바꾼다. 1.0 메모의 "네트워크 전송 없음"은 더 이상 사실이 아니다.
  ```
  로컬 전용 앱입니다. 계정/로그인이 없어 테스트 계정이 필요 없습니다. 데이터는 기기에 저장되고 알림은 로컬 알림만 사용합니다.
  예외: 캘린더 화면의 공유 버튼으로 사용자가 직접 만드는 '보기 전용 링크'는 기기에서 AES-256-GCM으로 암호화한 내용만 서버(Vercel)에 14일 보관합니다. 복호화 키는 링크의 # 뒤에만 있어 서버로 가지 않습니다.
  캘린더 권한은 설정 > 캘린더 연동을 켤 때만 요청합니다.
  ```

## 결정·확인 필요 (오너)
- [x] **앱 이름**: `WeMoa: 자녀 일정관리 캘린더` (오너 2026-11-12)
- [ ] **영어 이름(2.1)**: `WeMoa: Kids Calendar` / `WeMoa: Family Kids Planner` / `WeMoa: Kids' Schedules` 중
- [x] **App Privacy 라벨 = 보수적으로 신고** (오너 2026-11-12)
  - ASC 입력값: **사용자 콘텐츠 > 기타 사용자 콘텐츠**, 목적 **앱 기능**, **사용자와 연결되지 않음**, **추적에 사용 안 함**. 그 밖의 항목은 모두 수집 안 함.
  - `app.json` `ios.privacyManifests.NSPrivacyCollectedDataTypes`에도 같은 항목(`NSPrivacyCollectedDataTypeOtherUserContent`, linked=false, tracking=false, purpose=AppFunctionality)을 넣어 매니페스트와 라벨을 맞춘다(출시 빌드 전에).
- (참고, 이전 메모)
  - 계속 "데이터를 수집하지 않음"으로 둘지 정해야 한다.
  - 수집이 아니라고 볼 근거: 공유 링크는 사용자가 직접 만들고, 운영자는 내용을 볼 수 없다(키가 서버로 가지 않음).
  - 보수적인 선택: "기타 사용자 콘텐츠 — 앱 기능, 사용자와 연결 안 됨, 추적 안 함"으로 신고.
- [ ] **암호화(Export Compliance)**
  - 앱이 공유 링크에 표준 AES-GCM(`@noble/ciphers`)과 HTTPS를 쓴다.
  - 표준 알고리즘만 쓰는 경우는 보통 면제 대상이라 `ITSAppUsesNonExemptEncryption=false`를 유지할 수 있지만, ASC 질문에 맞게 답했는지 한 번 확인한다.
- [ ] **개인정보처리방침 공개 페이지 갱신**
  - `npm run legal:build`로 만든 `docs/legal/*.html`을 `devlyo/amatta-legal`에 올린다.
  - 시행일은 2.0 출시일로 바꾼다(`src/legal/legal-text.ts`의 `EFFECTIVE_DATE`).
- [ ] **스크린샷**: 2.0 화면(홈·캘린더 일/주·새 일정·공유)으로 새로 찍는다. 6.9″/6.5″.
- [ ] **기기 확인 남은 것**: 함께하는 일정(ADR-013), 카톡으로 짧은 공유 링크 열기(ADR-016), 주간 보기 속도.

## 결정 (2026-11-12, 보안 검토 후)
- [x] **판매 국가에서 프랑스 제외** (오너): 표준 AES-GCM은 수출 규정상 면제 대상이지만, 프랑스는 따로 신고가 필요해서 제외해요. ASC > 가격 및 사용 가능 여부에서 직접 설정.
- [x] **공유 업로드 API는 JSON만 받음** (`web/share/public/api/share.ts`, 415). 2026-11-12 배포함.
- [ ] Vercel Firewall 요청 수 제한 + Blob 사용량 알림 (오너, 대시보드)

## 순서
1. 위 결정들
2. 개인정보 페이지 재호스팅
3. 출시용 빌드(`eas build --profile production --platform ios`) → App Store Connect 업로드(`eas submit`)
4. TestFlight로 한 번 설치해 확인
5. 메타데이터·스크린샷 입력
6. 심사 제출

## 영어(미국) 등록 문구 (2026-11-12)
> 앱 화면은 아직 한국어만(영어 = 2.1, ADR-017). 그래서 설명 끝에 "Currently available in Korean" 한 줄을 둔다 — 설명과 실제가 달라 보이지 않게.

**이름**: `WeMoa: Kids Calendar`
**부제**: `Kids' schedules, side by side`

**프로모션 텍스트**
```
All your kids' schedules on one screen. See who's where right now, the next pickup and today's supplies at a glance — plus your own iPhone calendar, side by side.
```

**설명**
```
WeMoa keeps every child's school, classes and activities on one screen, so you always know who's where and when.
No sign-up, no login, no cloud. Everything you enter stays on your phone.

■ Today at a glance
The home screen shows what's happening right now for each child, the next pickup, the supplies to pack and today's to-dos.

■ Day, week and month
See each child's day side by side in columns, browse the week, or check the whole month. Pinch to zoom. Press and drag an event to move it to another time or day.

■ Never miss a pickup
Mark events that need a pickup and WeMoa shows the next one on the home screen — and warns you when two pickups, or a pickup and your own appointment, overlap.

■ Supplies and to-dos
Add a packing list to any event. The reminder tells you what to bring, like "Sketchbook, apron". Keep simple to-dos for each day, too.

■ Shared events and your own calendar
Add one event for several kids at once — and include yourself. WeMoa also shows the events from your iPhone calendar next to the kids', and saves the ones you add there.

■ Share with other caregivers
Send grandparents or a sitter a view-only link to the week ahead. The link is encrypted on your phone and expires after 14 days.

■ Private by design
- No account, no ads, no analytics
- All data stays on your device (only a link you choose to share is stored, encrypted, for 14 days)
- Back up to a file anytime, and restore from it

Up to 4 children. Local reminders before an event starts or ends.

Currently available in Korean. English is coming soon.

Contact: amatta.help@gmail.com
```

**키워드**: `kids,family,calendar,schedule,planner,pickup,school,activities,parents,organizer,reminder,weekly`

**이 버전에서 업그레이드된 사항**
```
Amatta is now WeMoa.
• Home: what's happening now, the next pickup, today's supplies and to-dos at a glance
• Calendar: day, week and month views — pinch to zoom, press and drag to move an event
• Shared events: one event for several kids (and you) at once
• Your own calendar: see your iPhone calendar events alongside the kids', and add them from the app
• Share: send other caregivers a view-only link to the week ahead
• Dark mode, and start from a backup file
Feedback: amatta.help@gmail.com
```

**그 밖**: 지원·개인정보 URL은 한국어와 같음, 저작권 `© 2026 WeMoa`, 마케팅 URL 비움.

## 연령 등급 (2025 새 질문지)
콘텐츠 항목 전부 "없음", 웹 접근 제한 없음·사용자 생성 콘텐츠·메시지·광고·연령 확인·경품 전부 "아니요" → 4+.
