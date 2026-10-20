# 로딩 두 건 — SSR KV 읽기 한정 · 지도 첫 화면 시드 (2026-10-11)

서비스: 🎟️ 유어딜(소비자) · 머니 경로 없음 · 잠금 파일(로딩 최적화) — 대표 승인 "둘 다 진행 (추천)"

## 다음 세션의 첫 액션
배포 뒤 E4 판정(익명으로 된다):
1. `curl -sI -A 'Mozilla/5.0 (iPhone)' "https://urdeal.kr/pass/2888?cb=$RANDOM"` 는 쿼리가 붙어 슬롯이 꺼질 수 있다 —
   **쿼리 없이** 두 번 연속 요청해 `Server-Timing` 에 `kv;` 항목이 **없는지** 본다(종전 `kv;dur=95~104`).
2. `curl -sI https://urdeal.kr/map` → `X-SSR-Status: MAP:edge-hit|kv-hit|self-fetch-hit` 이면 시드가 실린 것.
   본문에 `__SSR_INITIAL_MAP__` 가 있는지 확인. 그다음 `BASE=https://urdeal.kr PROXY_RELAY=1 node scripts/probe-loading.mjs /map`.

## 완료분
- ① `ssr-payload.ts` `isKvWarmedPath` — `cache-prewarm.ts` `SSR_KV_PATHS`(export) 와 같은 집합만 KV 조회.
- ② `shared/map-feed-seed.ts` SSOT · 워커 `MAP` 슬롯 · `useMapProducts` 시드 소비(같은 요청일 때만) ·
  `RestaurantMapPage` 기본 정렬 `MAP_SEED_SORT` · HOT_PATHS 무파라미터 경로 → 지도 시드로 1:1 교체 ·
  SSR_KV_PATHS +1 · 청크 표면 `map`.
- 가드 `ssr-kv-gate-and-map-seed-2026-10-11.test.ts` 9건 + 주입 9건(`scripts/mutations/ssr-kv-gate-map-seed-2026-10-11.mjs`) 전부 빨간불 확인.
- PR: (이 브랜치의 새 draft PR)

## 이번에 틀렸던 판단 / 주의
- 예열 예산이 **딱 50**(상한)이다. 다음에 HOT_PATHS 나 SSR_KV_PATHS 를 늘리려면 먼저 하나를 빼야 한다
  (`cache-prewarm-budget.test.ts` 가 막는다). 이번엔 화면이 한 번도 그대로 요청하지 않는 무파라미터
  `/api/group-buy/products` 를 뺐다(axios 가 늘 `?category=` 를 붙인다).
- HOT_PATHS 의 카테고리 4종(`status=active&category=meal_voucher` …)도 지금 화면 요청과 안 맞을 가능성이 크다
  (지도·피드 둘 다 `sort` 를 붙인다). 실측 안 했다 — 확인되면 예산을 거기서 더 돌려받을 수 있다.

## 남은 결정
없음.
