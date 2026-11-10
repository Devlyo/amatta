# 데이터 가져오기 (v1.1) — 실행 계획

ADR-012 (Proposed). 보드 I1–I4. 결정: 전부 바꾸기 / 설정 + 온보딩.

## 0단계 — 네이티브 모듈 (빌드 1회)
- `npx expo install expo-document-picker`
- `src/utils/pick-json.ts`: `requireOptionalNativeModule('ExpoDocumentPicker')`로 lazy 로드, 없으면 `'unavailable'`.
- EAS development 빌드 → 설치 확인.

## 1단계 — 순수 로직 (`src/utils/db-import.ts`)
- `parseBackup(json: string)`: JSON 파싱, envelope 모양·필수 배열·타입 검증, `schemaVersion` 3–5 정규화, 6 이상이면 `'newer'`, 그 외 `'invalid'`. 결과: `{ envelope, summary: { exportedAt, kids, schedules, checklist, todos } }`.
- `importDb(db, envelope)`: `withExclusiveTransactionAsync` 안에서 자식 → 부모 순으로 DELETE, 부모 → 자식 순으로 INSERT(id 보존), `app_settings`는 `guardian_*` 제외 키만. 실패하면 throw(롤백).
- 테스트(in-memory SQLite):
  - 왕복: 내보내기 → 가져오기 → 내보내기가 같은지
  - v3/v4 파일 변환
  - v6 파일 거절, 깨진 JSON·빈 객체·아이 5명 거절
  - 중간 실패 시 원래 데이터 유지
  - FK 연결 유지

## 2단계 — 화면
- `src/state/restore.ts`: `restoreFromBackup()` = 고르기 → parse → 알림창 확인 → `importDb` → 스토어 다시 읽기(`resetAllData`처럼) + `display-store` 적용 + `rescheduleAll`.
- 설정 > 데이터: "파일에서 가져오기" 버튼 + 안내 문구(보드 I1). 성공하면 홈으로 간다.
- 환영 화면: "백업 파일로 시작하기"(보드 I4). 성공하면 `/onboarding/finish`로 간다.
- 오류 알림창(보드 I3): 형식 오류 / 새 버전 / 모듈 없음.

## 3단계 — 마무리
- 테스트, tsc, lint, 기기 확인(내보내기 → 앱 초기화 → 가져오기).
- ADR-012 Accepted, CLAUDE.md 갱신, `data.tsx`의 "v1.1 출시 예정" 문구와 그 테스트 정리.
