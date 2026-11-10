# ADR-012 — 데이터 가져오기 (v1.1): 백업 파일로 전부 바꾸기

- **Status**: **Accepted / 0–2단계 구현** (2026-11-10, 기기 확인 대기) — Architect·Critic 리뷰 반영(아래 *Review*). — 오너 "이제 데이터 가져오기 기능 v1.1 기능 넣자" → 방식 "전부 바꾸기", 입구 "설정 + 온보딩"
- **Source**: 디자인 캔버스(비공개) https://claude.ai/artifact/7378YLCUUr4pMf7SgDfybx — 보드 `I1`–`I4`. 계획: `.omc/plans/ralplan-data-import.md`

## Context
- 내보내기(JSON, `src/utils/db-export.ts`, envelope `schemaVersion` 5)는 v1부터 있었고, 가져오기는 "v1.1 출시 예정"으로 막혀 있었다.
- 서버·계정이 없으므로(ADR-001) 폰을 바꾸거나 앱을 지웠을 때 데이터를 되살릴 방법은 이 파일뿐이다.

## Decision
1. **전부 바꾸기(replace)**: 파일을 고르면 지금 데이터를 모두 지우고 파일 내용으로 바꾼다. 합치기(merge)는 하지 않는다. 합치기는 id 재매핑, 아이 4명 제한, 얼굴 중복 같은 규칙이 필요해서 제외했다.
2. **원자성**: 검증 → 확인 → **한 트랜잭션** 안에서 8개 표 + `app_settings`를 지우고 다시 넣는다. 중간에 실패하면 ROLLBACK해서 원래 데이터가 그대로 남는다. 그 뒤 스토어를 다시 읽고 `rescheduleAll`을 실행한다.
3. **id 보존**: 파일의 id를 그대로 넣어서 일정 ↔ 준비물 ↔ 예외 ↔ 완료 기록의 연결을 유지한다. `sqlite_sequence`는 INSERT로 따라 올라간다.
4. **버전**: `schemaVersion` 3–5는 받는다. v3의 준비물 소속 정보는 신뢰하지 않고 NULL 앵커(항상)로 넣는다. v4에는 `allDay`·`notifyEndMinutesBefore`가 없으므로 false / NULL로 넣는다. **6 이상(더 새 앱에서 만든 파일)은 거절**하고 "앱을 업데이트해 주세요"라고 안내한다. 1–2와 형식이 다른 파일은 "가져올 수 없는 파일"로 거절한다.
5. **넣지 않는 것**: `is_done`/`done_at`(FROZEN, ADR-006은 `checklist_completion`이 기준), `guardian_*` 설정(기기마다 다른 캘린더 id — 내보내기에도 없다). 아이가 4명을 넘는 파일은 거절한다.
6. **확인 창 = 아이폰 기본 알림창**(설정의 다른 위험한 확인과 같음): 백업 날짜와 개수(자녀·일정·준비물·할일)를 보여 주고 "지금 데이터는 모두 지워져요"라고 알린다.
7. **입구**:
   - 설정 > 데이터 > "파일에서 가져오기"
   - 환영 화면 "백업 파일로 시작하기"(회색 글자 버튼). 성공하면 아이 등록을 건너뛰고 마무리 단계(알림·보호자 일정)로 간다.
8. **파일 고르기** = `expo-document-picker`(새 네이티브 모듈 → 개발 빌드 필요). 그전 빌드에서는 lazy require로 "앱을 업데이트해 주세요"를 띄운다(ExpoCalendar 때와 같은 방식).

## Consequences
- 새 빌드가 있어야 가져오기를 쓸 수 있다.
- 내보내기 쪽 `EXPORT_SCHEMA_VERSION`을 올릴 때는 가져오기 쪽 변환표도 같이 고쳐야 한다(테스트로 묶는다: 내보낸 파일을 다시 가져오면 똑같아야 한다).

## Review (ralplan, 2026-11-10) — 반영 사항
- **v3가 실제 주 입력**(v1.0.0이 schemaVersion 3을 냈음): v3에는 `appSettings`가 없고(→ `[]`), 준비물 소속 정보가 없고(→ NULL 앵커 + 매번, 파일의 `recurring:false`는 mapper 기본값이라 무시), 일정 v8 필드가 없다(→ allDay false, 종료 전 알림 NULL). v1–2는 `tooOld`, 아이 0명은 `empty`로 거절.
- **배타 트랜잭션은 별도 연결** → `foreign_keys`가 꺼져 있고 BEGIN 안에서 켤 수 없다. 그래서 파일 안의 참조를 미리 검증하고, 지우기는 명시적으로 자식부터, COMMIT 전에 `PRAGMA foreign_key_check`.
- `is_done/done_at`: **todos는 실제 데이터라 복원**. checklist_items의 FROZEN 값도 그대로 되써서 왕복이 정확히 같다(완료 기준은 여전히 `checklist_completion`).
- 아이 규칙: 모르는 아바타·중복 아바타·5명 이상은 거절, 색은 아바타에서 다시 계산.
- `app_settings`: 이 기기의 `guardian_*`만 남기고 지운 뒤 파일 값을 넣는다(파일 안의 `guardian_*`는 무시).
- **안전 사본**: 설정에서 가져올 때는 바꾸기 전 데이터를 `wemoa-before-restore.json`(앱 문서 폴더, 최신 1개)로 먼저 저장한다. 이 저장이 실패하면 가져오지 않는다.
- 다시 읽기 순서: 알림 설정 → 화면 설정 → 데이터 6개 → 보호자 invalidate → UI(필터·시트) 초기화 → `rescheduleAll`.
- 화면: 설정에서 성공하면 설정 스택을 닫고 홈으로, 환영 화면에서 성공하면 마무리 단계로 간다. 마무리의 알림·보호자 스위치는 저장된 값에서 시작한다(복원한 설정을 덮지 않게). 두 번 누르기 방지.
- 파일: 문서 선택기 캐시 사본은 읽은 뒤 지운다. 5MB 넘으면 `unreadable`, 파일 이름이나 종류는 믿지 않고 내용만 검증한다.
