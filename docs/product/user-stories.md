# User Stories — schedul-app MVP

형식: `As a <role>, I want <capability>, so that <outcome>.`
ID는 `US-NNN`. 우선순위 P0(필수)/P1(중요)/P2(나중).

## 자녀 관리
- **US-001 (P0)** As a parent, I want 자녀를 이름·색상으로 등록할 수 있다, so that 그리드에서 자녀들을 시각적으로 구분할 수 있다.
- **US-002 (P0)** As a parent, I want 자녀를 최대 4명까지만 등록할 수 있다, so that 그리드 컬럼이 폭주하지 않는다.
- **US-003 (P1)** As a parent, I want 자녀 정보를 수정·삭제할 수 있다, so that 자녀가 컸거나 구성이 바뀌었을 때 반영할 수 있다.

## 일정 등록·관리
- **US-010 (P0)** As a parent, I want 자녀별로 학원/학교 일정을 등록할 수 있다 (제목, 타입, 시간, 요일 반복), so that 반복 패턴을 매번 입력하지 않아도 된다.
- **US-011 (P0)** As a parent, I want 일정에 위치·메모를 선택적으로 적을 수 있다, so that 학원 위치를 빨리 떠올릴 수 있다.
- **US-012 (P0)** As a parent, I want 특정 날짜의 일정 1회를 취소(휴강)할 수 있다, so that 방학·공휴일을 반영할 수 있다.
- **US-013 (P1)** As a parent, I want 특정 날짜의 일정 시간을 1회만 변경할 수 있다, so that 일시 보강·변경을 반영할 수 있다.
- **US-014 (P0)** As a parent, I want 일정을 "이 회차만" 또는 "전체" 선택해 삭제할 수 있다, so that 잘못된 변경이 전체에 영향을 주지 않는다.

## 표시·탐색
- **US-020 (P0)** As a parent, I want 메인 화면에서 일간 그리드(자녀×시간)를 본다, so that 자녀들의 일정을 한눈에 비교할 수 있다.
- **US-021 (P0)** As a parent, I want 좌우 스와이프로 전일/익일을 본다, so that 빠르게 다른 날을 확인할 수 있다.
- **US-022 (P0)** As a parent, I want 자녀 헤더를 탭하면 그 자녀의 주간 캘린더로 들어간다, so that 한 자녀의 주 패턴을 볼 수 있다.
- **US-023 (P1)** As a parent, I want 그리드의 빈 슬롯을 탭하면 일정 추가 시트가 열린다, so that 빠르게 등록할 수 있다.

## 알림
- **US-030 (P0)** As a parent, I want 일정 시작 N분 전에 로컬 푸시 알림을 받는다, so that 픽업·이동을 놓치지 않는다.
- **US-031 (P0)** As a parent, I want 자녀별로 알림 분 수를 설정할 수 있다, so that 동선에 맞는 마진을 잡을 수 있다.
- **US-032 (P1)** As a parent, I want 일정을 삭제하면 해당 알림도 자동 정리된다, so that 유령 알림이 안 뜬다.

## 백업·이전
- **US-040 (P1)** As a parent, I want 설정에서 모든 데이터를 JSON으로 내보낼 수 있다, so that 기기변경 시 안전망이 있다.
- **US-041 (P2)** As a parent, I want OS 자동 백업(iCloud/Android Auto Backup)으로 복원할 수 있다, so that 별도 작업 없이 폰을 바꿔도 데이터가 유지된다.

## 비-목표 (확인용)
- ❌ 가족 다중 사용자 공유
- ❌ Google Calendar 양방향 연동
- ❌ 위젯·Live Activity
- ❌ 학원비·출결 체크인
