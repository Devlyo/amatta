# ADR-003 — Pickup carousel banner supersedes the conflict-indicator pill + NOW line real-time tick

- **Date**: 2026-06-02
- **Status**: Accepted
- **Authors**: hyunsoolee (오너/제품 결정), saeboman (프로덕트 엔지니어), Claude (페어)
- **Supersedes**: ADR-002 §Decision 3 *Pickup Tracking* 의 "충돌 시각화" 항목 (`⚠ {hh:mm} 픽업 충돌` sub-bar pill)
- **Source**: amatta-v1 시안 (`docs/design/amatta-v1/app-daily-b.jsx`) 의 `PickupCarousel` + `PICKUPS` const 검토 (2026-06-02)

## Decision (2건)

### A. Pickup carousel 단일화

일간 그리드의 **픽업 정보 시각화는 상단 `PickupCarousel` 배너로 단일화한다.**

- **단일 픽업 (다음 차례 1개)**: Sunset Orange (`#FF7144`) 배경 + 시간·자녀·일정 + cartoon car 일러스트레이션 + eta caption. (시안 `PICKUPS[0]` 형태.)
- **동일/근접 시간대 픽업 ≥ 2개**: 같은 carousel에 **추가 카드** (시안 `PICKUPS[1]` = French Lavender 계열 `#D4B4FA` 배경). 카드들은 horizontal swipe로 전환, 하단에 흰 dots indicator.
- **이전 ADR-002의 `⚠ {hh:mm} 픽업 충돌` sub-bar pill은 폐기**. 사용자가 carousel 다음 카드를 swipe해서 다음 픽업을 확인하는 동작이 충돌 시각화와 충돌 해소를 동시에 처리.

ADR-002의 다른 두 픽업 표시 규칙은 변경 없이 유지:
- 일정 블록 우상단 `🚗` 아이콘으로 `needs_pickup=true` 표시 → **유지**
- 블록 오버레이·푸시 알림 추가 금지 → **유지**

### B. NOW line 실시간 갱신

일간 그리드의 NOW 라인 (라임색 `#E0E345` 가로선 + 시간 pill) 은 **분 단위로 실시간 갱신**된다.

- 갱신 주기: **매 분 (60s)**. 사용자가 8:30에 보던 화면을 그대로 두면 8:35 시점엔 pill이 `8:35`로 갱신되어야 함.
- 구현: `useEffect` + `setInterval(() => setNowMinutes(currentMinutes()), 60_000)`. 다음 분 경계에 맞추는 align (`(60 - now.getSeconds()) * 1000` 초기 delay 후 60s interval) 으로 분이 바뀌는 순간에 갱신되도록.
- AppState focus 시에도 즉시 1회 동기화 (백그라운드에서 분이 여러 개 흘렀을 가능성).
- cleanup: `clearInterval` on unmount + AppState listener teardown.
- 추가 push 알림·toast 등은 발생하지 않음. 시각 표식만.

기존 단발성(`AppState` change 시 1회 계산) 처리는 폐기.

## Decision drivers

### A 픽업 carousel

1. **시안 fidelity** — amatta-v1 디자인에 명시적으로 `PickupCarousel` (1+개 카드 + dots)이 있고, 사용자가 이 흐름을 채택. 별도 충돌 pill은 시안에 없음.
2. **정보 밀도가 더 높음** — pill은 "충돌 있다"만 알리지, "다음 픽업이 무엇인지"는 그리드를 스캔해야 함. carousel 카드는 시간·자녀·일정·eta·차량 일러스트가 한 view에 다 들어옴.
3. **알림 피로 정책 (ADR-001/002 정신)와 일관** — push surface 추가 없음, 시각 정보만, 블록 오버레이 없음.
4. **충돌 = 정상 상태** — 다자녀 워킹맘 페르소나 P1에서 동일 시간 픽업이 발생하는 건 정상이고 표준 처리(carousel 카드 분리)가 더 적절. "⚠" 마크는 불필요한 stress 신호.

### B NOW line

1. **사용자 기대치** — 시계처럼 분이 흐르면 같이 흘러야 함. 정적 표식은 시계 보조 가치 ↓.
2. **배터리 비용 무시 가능** — 60s interval × 단일 setState (number) → 폰 화면 켜져 있을 때만, JS thread 비용 무시 가능.
3. **AppState focus 동기화는 그대로 필요** — 백그라운드 ≥ 1분 후 복귀 시 갱신 필요.

## Alternatives considered (이번 결정에서)

### sub-bar `⚠ {hh:mm} 픽업 충돌` pill (ADR-002 원안)
- **Reject**: 시안에 없음. carousel 배너가 충돌 정보를 이미 더 풍부하게 노출. pill + carousel 둘 다 두면 시각 노이즈 ↑.

### 블록 오버레이로 충돌 표시
- **Reject (ADR-002와 동일)**: 시각 노이즈 ↑, alert fatigue.

### carousel 자체 X, 단일 배너만
- **Reject**: 동일 시간 픽업이 ≥ 2개일 때 어느 픽업을 보여줄지 결정 불가. carousel이 가장 자연스러운 해법.

## Consequences

### Positive
- 시안과 구현 사이 불일치 1건 제거.
- 사용자가 "다음 픽업"을 즉시 인지 (시간·자녀·일정·eta), 다음 카드 swipe로 추가 픽업 확인 — 인지 비용 낮음.
- carousel UI 자체가 amatta-v1 `PickupCarousel` JSX의 1:1 포트로 가능 (해석 여지 ↓).

### Negative
- carousel 구현은 sub-bar pill보다 무거움 (horizontal pan gesture + 카드 전환 애니메이션 + dots indicator). 다만 시안에 이미 코드가 있어 1:1 포트 가능.
- 픽업이 1개인 일반적 케이스에서 carousel dots가 숨겨져야 자연스러움 (시안 `showDots = cards.length > 1` 로 처리됨).
- 동일 시간 픽업이 3개 이상이면? 시안엔 2개 케이스만 있음. 폴리시: 최대 4개까지 표시(자녀 최대 4명), 그 이상은 첫 4개만. → ADR-004 후보.

### Neutral
- 충돌 감지 알고리즘 (`O(자녀 × 일정²)` per day) 자체는 ADR-002 그대로 유지. 출력만 sub-bar pill에서 carousel 카드 리스트로 변경.
- v1 schema의 `needs_pickup` 컬럼 사용 그대로.

## Impact on locked decisions (CLAUDE.md)

`CLAUDE.md` Locked Decisions의 "**충돌 인디케이터 (ADR-002)**" 항목을 다음으로 교체:

> **픽업 시각화 (ADR-003)**: 일간 그리드 상단 `PickupCarousel` 단일 위치. 다음 픽업 1+개를 swipe 가능 카드 (Sunset Orange / French Lavender bg) 로 표시. 블록 오버레이·푸시 둘 다 금지(ADR-002 유지). `⚠ 픽업 충돌` sub-bar pill은 폐기.

## Acceptance criteria (v0.1.0 갱신)

- [ ] [US-070] 일간 화면 상단에 `PickupCarousel` 배너가 렌더링된다 (오늘 픽업 필요 일정 ≥ 1).
- [ ] [US-071] 다음 픽업 카드: 시간 + 자녀명 + 일정명 + eta + cartoon car. Sunset Orange bg.
- [ ] [US-072] 동일/근접 시간 픽업 ≥ 2 → carousel에 추가 카드 (보라 bg). swipe 전환. dots indicator.
- [ ] [US-073] 픽업 필요 일정 0건 → carousel 영역 자체가 렌더링 안 됨 (높이 0).
- [ ] [US-080] 일간 그리드 NOW line이 분 단위로 실시간 갱신된다. 사용자가 화면을 그대로 두고 1분 경과 시 pill 시간이 1분 진행한 값으로 바뀌어야 함.
- [ ] [US-081] AppState 변경(백그라운드→active) 시 즉시 1회 동기화.

(기존 ADR-002 US-062 `⚠ 픽업 충돌 pill`은 폐기 — 이 ADR로 교체.)

## Follow-ups

- carousel UI 1:1 포트는 amatta-v1 `app-daily-b.jsx` 의 `PickupCarousel` + `PickupCard` + `CartoonCar` 컴포넌트 mechanical 변환. v2 schema 마이그레이션(needs_pickup 컬럼) 직후 작업.
- 픽업 ≥ 3개 동시 케이스 정책은 베타 사용자 피드백 후 결정 (ADR-004 후보).
