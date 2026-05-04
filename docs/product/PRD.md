# Product Requirements — schedul-app

> 전체 합의된 spec은 `.omc/specs/deep-interview-schedul-app.md` (단일 진실).
> 이 파일은 사람이 읽기 좋은 *압축본*이며 spec과 충돌 시 spec이 우선.

## Problem
다자녀 학부모가 자녀들의 학원·학교 시간표를 한눈에 비교·관리할 수단이 마땅치 않음. 구글 캘린더는 색상 구분만 가능해 *동시 비교*가 약하고, 종이/엑셀은 알림이 없음.

## Target User
- **주 사용자**: 자녀 1–4명 둔 학부모 (한국 거주 기준 KST)
- 한 디바이스(스마트폰)에서 혼자 관리
- 가족 공유·다중 사용자는 비목표

## Core Value
- 일간 화면 = 자녀×시간 격자. **누가 언제 어디 있는지 한눈에**
- 일정 N분 전 로컬 푸시로 픽업·이동 누락 방지
- 학원 일정의 90% 패턴인 "매주 월·수·금 17:00 피아노" 같은 요일 반복을 단순하게 표현

## In Scope (MVP)
- 자녀 등록 (최대 4명, 6색 팔레트)
- 일정 등록·수정·삭제 (요일 반복 + 단일 예외)
- 일간 메인 뷰 (06:00–23:00 / 30분 슬롯 / 자녀 컬럼)
- 자녀별 주간 드릴다운
- 로컬 알림 (자녀별 minutesBefore)
- iCloud / Android Auto Backup 의존 (별도 클라우드 미구현)
- DB → JSON 수동 내보내기 버튼 (Settings, 기기변경 escape hatch)

## Out of Scope
- 회원가입·로그인·서버
- 가족 공유·멀티 디바이스 동기화
- 외부 캘린더(Google/iCloud) 양방향 연동
- 위젯·Live Activity (향후 단계)
- 다국어 (한국어 단독)
- 학원비·출결 등 부가 기능

## Success Metrics (MVP)
- 자녀 4 × 학원 8 × 14일치 시드를 30초 안에 전부 입력 가능
- 일간 그리드 첫 페인트 < 1.5s (Android API 33)
- 등록한 알림이 앱 종료 상태에서도 정확히 발생 (시뮬레이터 검증)
- 기기변경 후 `백업 → 복원` 으로 모든 일정 복구 (수동 JSON 경로 또는 OS 자동 백업)

## References
- 풀 spec: `.omc/specs/deep-interview-schedul-app.md`
- 실행 계획: `.omc/plans/ralplan-schedul-app-v2.md`
- 페르소나: `personas.md`
- 유저스토리: `user-stories.md`
