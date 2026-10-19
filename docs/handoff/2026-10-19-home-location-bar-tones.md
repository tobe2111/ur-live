# 2026-10-19 — 홈 위치 바: 톤이 서로 새지 않게 (구조 수리)

대표: *"영구적으로 수정해볼래?"* — #1927(모바일 제목 한 줄 복구)의 근본 처방.

## 무엇이 원인이었나
`PcHomeLocationBar` 는 세 화면이 같이 쓴다(`panel` PC 필터 열 · `hero` PC 히어로 · `title` 모바일 홈 제목).
클래스를 `title ? … : hero ? … : …` **중첩 삼항으로 아홉 군데**에서 갈랐고, #1878 이 PC 열만 고치려던
조건을 `!hero` 로 써서 모바일 제목까지 세로로 쌓았다.

## 한 것
- 톤별 모양을 `LOCATION_BAR_TONES: Record<LocationBarTone, ToneStyle>` 표 한 곳에 **칸마다 따로** 적었다.
  컴포넌트는 `const t = LOCATION_BAR_TONES[tone]` 만 읽는다. 렌더 클래스는 종전과 byte-동일.
- 시험 `home-location-bar-tones-2026-10-19.test.tsx` — 실제 렌더로 ① title 한 줄 ② flex-col 은 panel 만
  ③ 컴포넌트 안 톤 분기 재유입 금지 ④ 렌더 = 표. 주입 3건 전부 빨간불 확인.
- 이전 소스 문자열 가드(`home-title-location-row-2026-10-19`)와 그 주입은 이것으로 대체해 삭제.
- `pc-home-hero-controls.test.ts` 와 인라인 주입 1건을 표 기준으로 재조준(불변식 그대로).

## 라이브 확인(#1927 배포 후, 이 PR 전)
Playwright 390·360px: `전국` 버튼 y=48 · 현 위치 버튼 y=50 — 같은 줄. E4 통과.

## 못 보는 것
실제 폭·글자 잘림(jsdom 레이아웃 없음). 같은 모양의 다른 공유 부품은 이 PR 범위 밖.

## 다음 세션 첫 액션
이 PR 머지 확인. 개선 제안 3건(①실사용 성능 SLO ②죽은 하트비트·백업 ③결재 15건) 대표 선택 대기.
