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

---

# 같은 세션 2부 — 개선 제안 셋 (대표 "알아서 가장 이상적으로")

## ① 실사용 성능 SLO — 홈 LCP p75 3.5초 (기준 2.5)
실측(10-19): 경보 원문 `/ LCP p75 3508ms · TTFB p75 614ms(직전 451)`.
실험실(라이브 HTML, 느린 4G·CPU 4배, 390px): FCP 1.5~2.3s · LCP 2.2~2.9s, **LCP 요소 = 상단 배너 사진**
(`width=1100` · 65KB). HTML 144KB(gzip 33KB) 중 첫 화면이 **132KB 지점**(앞에 첫 화면 CSS 49KB + MAIN 시드 44KB).
A/B(HTML 즉시 응답): 시드를 body 끝으로 FCP −116ms · 배너 preload 를 head 맨 앞으로 효과 없음(잡음 안).
⇒ 실험실 지렛대는 작고(≈0.1s) 실사용 3.5s 와 거리가 멀다. **고칠 곳을 고를 근거가 없다**는 것이 진짜 병목.
**한 것**: LCP 를 넷으로 쪼개 같은 보고에 싣는다(첫 바이트 · 사진 요청까지 · 사진 받기 · 그리기, 사진 여부),
`vitals:{날}:LCPB:{화면}` 에 저장, 요약 API `lcp_parts`, **SLO 경보가 LCP 줄 아래 쪼개기 한 줄**을 붙인다.
측정 정의 둘 수리: prerender 는 activationStart 부터 · 그려지기 전에 숨은 탭은 버림(web-vitals 와 같은 정의).
가드 `vitals-lcp-breakdown-2026-10-19` + 주입 3건.
**다음 세션**: 배포 7일 뒤(10-26 09:25 KST 회차) 경보의 `↳ 어디서 늦나` 줄을 읽고 가장 큰 칸부터 고친다.
보류한 후보: MAIN 시드를 body 끝으로(잠금 `worker/index.ts` — 대표 승인 필요, 실험실 FCP −0.1s).

## ② 죽은 하트비트 · 분할 백업
이미 해결돼 있었다(실측): `stale 0 · never_fired 0 · orphan 0`, 은퇴 잡은 `superseded/retired` 로 분류됨.
분할 백업은 돌고 있다 — `backup_done:main 10-16 · ads 10-17 · company 10-18`(셋이 번갈아, 하나당 약 3일 주기).

## ③ 결재함 정리
16건 전부 답이 나 있었다. 반영 커밋이 main 에 있는 5건을 `archive/` 로(rejected 1 · 반영 끝 4 —
브랜치 해시였던 3건은 main 머지 `c94ad5b4` #1913 을 덧붙임). 남은 11건은 `승인 · 구현 중`(남은 단계 있음).
