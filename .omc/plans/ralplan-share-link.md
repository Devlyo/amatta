# 캘린더 링크 공유 — 실행 계획 (ADR-016)

브랜치 `feat/share-link`. 보드 SH1–SH4.

## 0단계 — payload (순수, 테스트)
- `src/share/share-payload.ts`: `buildSharePayload({ children, schedules, exceptions, checklistByScheduleId, completion? }, { kidIds, from, weeks, includeSupplies, includePlaceNotes, now })`
  - `expandOccurrences` → 고른 아이가 멤버인 회차만, 일정·날짜마다 1개 (함께하는 일정은 멤버 목록 포함)
  - 문자열 표(titles/labels) 중복 제거, 회차 = [dayOffset, start, end, schedIdx, flags, supplyIdx[]]
  - 준비물 = `isChecklistItemVisibleOn` (그 회차에 보이는 것; 완료 여부는 안 담음)
  - 반복 요약 = `repeatSummary`
- `encodeShare(payload)` / `decodeShare(str)` (lz-string). 왕복 테스트, 4주·4명 크기 테스트(< 4KB).
- 의존성: `lz-string` (순수 JS, 네이티브 아님 → 빌드 불필요).

## 1단계 — 앱 화면
- `app/share.tsx` (formSheet/modal, ADR-004): 아이 체크, 기간 세그먼트, 두 스위치, 안내, 버튼 → `Share.share({ url/message })`.
- 캘린더 상단 공유 아이콘(검색 옆).
- legal 화면에 공유 링크 문단.

## 2단계 — 웹 보기
- `web/share/index.html` (단일 파일, 인라인 JS/CSS, lz-string CDN 고정 버전) + `web/share/avatars/*.png` + `vercel.json`(`/s` → index.html, 캐시 헤더, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`).
- 주간 그리드(0–24시, 처음 위치 = 첫 일정), 4/7일 전환, 주 넘기기, 아이 필터, 상세 시트, 기준 날짜/만료 안내, 깨진 링크 화면, 라이트/다크.
- payload 디코더는 앱 `decodeShare`와 같은 형식(버전 1); 웹용 사본을 테스트로 묶음(같은 샘플 문자열을 둘 다 풀어 비교).

## 3단계 — 배포·마무리
- Vercel 배포(오너 계정, 프로젝트 `wemoa-share`), 주소 확정 → 앱 상수.
- 기기 확인: 공유 → 카톡/메시지로 보내 열기.
- ADR-016 Accepted, CLAUDE.md.
