# 2026-10-15 — 첫 로딩의 진짜 병목: D1 원본이 미국 동부, 한국 손님은 홍콩

대표: *"전혀 빨라진게 없는 것 같은데? 아직 처음 로딩이 느리고? 비용만 비싸진 거 아니야?"* →
*"가장 이상적이고 대기업들이 보통 주로 쓰는 전략으로 끝까지 개선해줘."*

## 다음 세션의 첫 액션

1. 배포 확인 후 어드민 토큰으로 `GET https://live.ur-team.com/api/_internal/d1-replica-probe`
   → `replica[].primary === false` 면 복제본이 일한다. (이 환경은 미국 동부에서 부르므로 `region` 이 ENAM 이어도 정상.
   한국 손님 기준 판정은 아래 3번.)
2. `GET /api/analytics/summary?day=YYYY-MM-DD` 에서 `LCP_TTFB / LCP_DELAY / LCP_LOAD / LCP_RENDER` 표본이 쌓이는지.
   며칠 쌓이면 **가장 큰 구간부터** 고친다(이게 다음 개선의 순서를 정한다 — 추측하지 말 것).
3. 며칠 뒤 `TTFB:colo:HKG` p50(배포 전 **1.0s**, p75 2.4s)이 내려갔는지.
4. 대표가 Cloudflare 대시보드에서 **Early Hints ON · 0-RTT ON** 을 켰는지(존 설정 API 로 읽을 수 있다 — 아래).

## 이번에 잰 사실 (Cloudflare 원장 — 추측 아님)

| 무엇 | 값 | 어떻게 쟀나 |
|---|---|---|
| D1 원본 지역 | **ENAM**(미국 동부) · `read_replication: auto` | `GET /accounts/{acc}/d1/database/{id}` |
| 한국 손님이 붙는 데이터센터 | HKG · LAX · SEA (ICN 아님) | 실사용 `TTFB:colo:*` 표본(국가 KR 필터) |
| HKG TTFB(이동 시작→첫 바이트) | p50 1.0s · p75 2.4s · p95 3.1s (10-15) | 같은 표본 |
| 원본 워커 CPU | 8일 15만 요청 · p50 ~4ms · p99 ~190ms · **한도 초과 0건** | GraphQL `pagesFunctionsInvocationsAdaptiveGroups` |
| 존 요금제 | Free Website · `early_hints off` · `0rtt off` · `http3 on` | `GET /zones/{id}/settings` |

## 한 것 (PR — 이 파일과 같은 커밋)

- **D1 읽기 복제본**: `edge-cache.ts` 캐시 미스 경로 한 줄 + `utils/d1-read-replica.ts`.
  캐시할 응답에서만(로그인 우회·쓰기·결제는 원본). 원본 하나에 래퍼 하나(WeakSet 기억 167곳 보호).
- **LCP 4구간 계측**: `web-vitals-report.ts` `lcpParts` + `analytics.routes.ts` 저장·summary.
- **SRV 계측**: 워커가 문서를 만든 시간(`Server-Timing: total`)을 실사용 폰에서 보낸다(페이지별 + `colo:XXX`).
  `TTFB:colo:HKG − SRV:colo:HKG` = 길(연결·거리). 첫 바이트가 서버 탓인지 거리 탓인지 가른다.
- **어드민 프로브**: `/api/_internal/d1-replica-probe`.
- #1872(이용권 상세 서버 렌더) 자동 머지 **다시 켬** — CPU 위험이 원장으로 기각됐다.

## 이번에 틀렸던 판단 (같은 오진 반복 금지)

1. **"무료 요금제라 CPU 10ms 에 걸린다"** — 틀렸다. 원본 워커가 이미 p99 190ms 로 오류 0건이다(9/2 Workers 유료 전환).
   그 말을 믿고 #1872 를 한 번 멈췄다. ⇒ 한도 주장은 GraphQL `status`·`cpuTimeP99` 로 먼저 잴 것.
2. **"한국 손님은 ICN 으로 붙어 cron 예열이 그 콜로를 채운다"**(`edge-cache.ts` 옛 주석) — 틀렸다. HKG·미국 서부다.
   cron 의 `caches.default` 예열은 cron 이 도는 콜로만 채운다 → 한국 손님 콜로는 비어 있기 쉽다.
   전역으로 통하는 것은 KV 시드(`SSR_KV_PATHS`)와 이번 복제본뿐이다.
3. 지금까지의 로딩 작업이 **JS·화면 쪽만** 팠다. 서버 응답(TTFB)이 1~3초인 것을 실사용 표본이 이미 말하고 있었는데
   데이터센터별로 나눠 보지 않았다.

## 남은 것 / 대표 판단

- **Early Hints · 0-RTT 켜기**(무료·되돌리기 쉬움) — 토큰이 조회 전용이라 대표가 대시보드에서:
  `urdeal.kr` → Speed → Optimization → **Early Hints ON** / Network → **0-RTT Connection Resumption ON**.
- 로그인 사용자의 읽기(잔액·내 이용권)는 아직 원본(미국)이다. 큰 회사 방식은 **세션 북마크 쿠키**로 모든 읽기를
  복제본에 보내면서 내가 쓴 것은 바로 보이게 하는 것인데, 머니 경로 읽기가 섞여 있어 **단독 세션 + staging** 으로 따로 한다.
- 한국 ICN 데이터센터로 붙게 하는 것은 요금제(엔터프라이즈) 문제라 코드로 못 바꾼다.
