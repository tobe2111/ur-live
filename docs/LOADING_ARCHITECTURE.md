# 로딩 아키텍처 & 비용(유료전환) 분석

**작성**: 2026-05-31 (코드 ground-truth 검증 기반)
**제약**: Cloudflare **free-tier 유지** (유료전환 금지) — 사용자 명시 요구

## 0. 결론 한 줄
공개/유저 대면 로딩은 **이미 이상적**이고, 비용은 **설계로 free-tier에 고정**돼 있다. 이번 세션에 마지막 공개 캐시 공백(curator)을 닫음. 남은 부채(231p 데이터페칭)는 로딩 레버가 아니라 **유지보수성** 이슈.

---

## 1. 💰 유료전환(비용) 안전성 — 안전

| 비용 surface | 상태 | 근거 (파일:라인) |
|---|---|---|
| **KV write** (월 한도 초과 시 과금) | ✅ 거의 0 | `edge-cache.ts:96` `useKv` 기본 **false**. `publicCacheKv`(useKv:true) **코드 어디서도 미사용**. KV write = feature-flags 변경(어드민, 희소)뿐 (`feature-flags.ts:138,158`) |
| **per-request rate limit** | ✅ 안전 | 구 "모든 `/api/*`마다 `KV.put`" 제거(`rate-limiter.ts:6`). 현재 브루트포스 방어 = **D1 기반** per-route `rateLimit()` |
| **edge 캐시** | ✅ 무료 | `caches.default` (플랜 내 무제한). worker SSR inject도 `caches.default.match` 직접 read (`index.ts:507`). KV 2차 레이어 의존 0 |
| **cron** | ✅ 한도 내 | 40 task가 5min/hourly/daily 버킷 분산 (`scheduled.ts`) — invocation 단위 과금이라 여유 |
| **번들** | ✅ | App.tsx eager page import 1개(MainHomePage 잠금)뿐, 나머지 lazy + `manualChunks` |

> 🔒 잠금: `edge-cache.ts` `useKv:false` 기본은 CLAUDE.md 로딩 잠금 항목. **절대 true 로 바꾸지 말 것** (월 $2-5 발생).

---

## 2. ✅ 이상적으로 잘 된 부분
- **SSR inject 8슬롯** (`index.ts:456-486`): MAIN/VOUCHERS/BROWSE/LIVE/PRODUCT/DETAIL/SELLER/CURATOR. `caches.default` edge-hit(~5ms) + miss 시 self-fetch(1500-2000ms budget) → fresh inject.
- **3중 캐시**: 브라우저 `max-age=60` / edge `CDN-Cache-Control=900` / `stale-while-revalidate=120`.
- **이미지**: `cf-image` 변환 + `dominant_color` placeholder + lazy/`fetchPriority`(above-fold eager).
- **유저 대면 데이터**: React Query 공유 훅(`useMyData`/`useUserProfile`/`useSellerPublic`/`useGroupBuyProduct`) — dedup + 캐시 일관성 + SSR initial data 즉시 사용.
- **idle prefetch + Speculation Rules prerender** (`index.html`, `App.tsx`).
- **공개 엔드포인트 캐시 패리티**: group-buy/products/public-utility/streams(30s)/sellers-public(60s 미들웨어) 모두 캐시.

---

## 3. 🔧 남은 로딩 부채 (리팩토링 관점)

| 항목 | 로딩 영향 | 비고 |
|---|---|---|
| ~~curator 캐시 누락~~ | ✅ 수정 | `3d63b23` — 유일했던 공개 SSR 슬롯 캐시 공백 (edge + SSR inject 패리티) |
| **231 수동 fetch 페이지** | 🟡 낮음 | **대부분 admin/agency 내부(트래픽 적음)**. 유저 대면은 이미 RQ. → **로딩 레버 아님(velocity 부채)**. `useApiQuery` 인프라 + AdminAbusePage 착수(`c49f224`) |
| **SSR 미적용 페이지** | 🟡 | `/cart`,`/checkout`,`/my-*` 등 **로그인 후** 페이지 — 동적·인증이라 우선순위 낮음. 공개 진입점은 8슬롯 커버 |
| **cold 첫 사용자** | 🟢 | self-fetch 1.5-2s. `cache-prewarm` cron이 HOT_PATHS 워밍. curator는 per-user라 워밍 불가하나 edge-cache로 2번째부터 빠름 |
| **God 파일 chunk** | 🟢 | youtube-live(3368)/ReelCard 등 — 해당 라우트 chunk만 큼, 메인 critical path 무관 |

---

## 4. 권장 (cost-safe)
로딩 자체는 충분. 더 짜낼 여지는 marginal. 가치 큰 작업은:
1. **#2 데이터페칭 통합** — 로딩보다 **유지보수성**. `useApiQuery` 로 배치 마이그레이션(admin/agency, 페이지당 3줄).
2. **라이브 송출 검토** — 미감사 영역(WebRTC/OME/YouTube).

**금지**: KV 기반 캐시 활성화(useKv:true), per-request KV write, edge TTL 약화. 모두 비용/회귀 직결.

## 🏁 첫 페인트 표준 (First-Paint Doctrine — 2026-06-10 확정)

**원칙: 모든 사용자 대면 페이지는 "로드되자마자 콘텐츠가 보여야" 한다. 스피너만 보이는 첫 화면 금지.**

페이지 유형별 필수 적용 (새 페이지 만들 때 이 표 따라갈 것):

| 상황 | 표준 장치 | 예 |
|---|---|---|
| hard-load (URL 직접 진입) | worker SSR 슬롯 (`__SSR_INITIAL_<SLOT>__`) + HOT_PATHS prewarm | 홈/vouchers/browse/group-buy/wholesale/상세/셀러/큐레이터 |
| SPA 탭 전환 | RQ gcTime 캐시 + pointerdown/hover 데이터 워밍 + 모듈 메모리 캐시 | 동네딜(warmGroupBuyList)/링크샵(warmCurator) |
| 개인화 데이터(가격/잔액) | **공유 데이터로 골격 즉시(placeholderData) + 개인화 값만 fetch 후 교체** — 개인화를 이유로 전체를 기다리게 하지 말 것 | 도매 카탈로그 (guest SSR → 로그인 placeholder + 가격 스켈레톤) |
| 서버 응답 | 독립 쿼리 Promise.all / 존재체크·ensure 메모이즈 / 같은-키 응답은 등급·세그먼트 단위 엣지캐시 | /api/wholesale/catalog (9 RTT→1~3) |
| 이미지 | above-fold 4개 eager+fetchPriority high, 나머지 lazy + dominant_color placeholder | 모든 카드 그리드 |
| 부가 데이터 | 첫 페인트와 경쟁 금지 — requestIdleCallback 이후 enabled (헤더 필수값만 즉시) | 도매 월통계/재주문 레일 |
| 다음 행동 | idle 에 다음 페이지 chunk + 상세 데이터 prefetch | 카드 hover/viewport prefetch |

| 하드로드 청크 | **라우트 청크 modulepreload** — `scripts/generate-route-chunk-map.mjs` ROUTES + `worker/index.ts` chunkSurface 에 표면 등재(가드가 양쪽 동기 강제) | 홈/상세/링크샵/교환권/쇼핑 7표면 (2026-07-12) |

**위반 신호**: 페이지 진입 → 스피너/스켈레톤만 1초+ → 콘텐츠. 이러면 위 표에서 빠진 장치를 찾을 것.
**현재 준수**: 홈/교환권/쇼핑/동네딜/라이브/상세 3종/셀러/큐레이터/도매 카탈로그.
**잔여 (가벼운 페이지 — 후순위)**: /wholesale/board(공지 prewarm 적용)·wishlist·딜내역 — 단일 목록이라 1-fetch, 필요 시 동일 표준 적용.


## ✅ 새 페이지 로딩 체크리스트 (2026-07-12 확정 — 대표 "앞으로 만들 페이지들도 로딩은 이상적이어야 해")

**새 소비자 페이지는 만들 때부터 아래를 전부 충족해야 한다. 사후 감사로 잡지 말고 처음부터.**

1. **로더는 BrandLoader 하나** — 풀스크린은 `<BrandLoader fullScreen/>`(첫 페인트 전용), 인라인은 `<BrandLoader/>`.
   ad-hoc 스피너/텍스트/자체 keyframes 금지(위상동기 깨짐 = "로딩 두 번" 체감). 라이트 고정 표면은 `forceLight`, 다크 고정은 `forceDark`.
2. **데이터 시드는 useState 초기값에서 동기 소비** — SSR 슬롯/RQ 프리페치/서버 동봉 prop 이 있으면
   `useState(() => seed ?? null)` + `loading = seed == null`. useEffect(페인트 후) 소비는 로더 1프레임 낭비.
   시드엔 반드시 **정체성(id) 일치 검증**(잔존 시드 오소비 방지 — `pickSeedDetail`/`readSellerSeed` 패턴).
3. **목록 → 상세 프리페치는 상세와 같은 세계** — 같은 엔드포인트 + 같은 RQ 키(**String(id) 정규화**).
   상세는 `qc.fetchQuery`(in-flight 이어받기)로. (다르면 프리페치 100% 낭비 — 2026-07-10 실사고 2건.)
4. **하드로드 진입점이면 두 곳 등재**:
   - (트래픽 큰 공개 페이지) `worker/index.ts` SSR 슬롯 + `cache-prewarm HOT_PATHS`
   - (모든 하드로드 진입점) `scripts/generate-route-chunk-map.mjs` ROUTES + `worker/index.ts` chunkSurface — 청크가 엔트리와 병렬 다운로드. **한쪽만 넣으면 loader-continuity 가드가 차단.**
5. **쿼리 파라미터 변경은 제자리 갱신** — 페이지가 searchParams 를 반응형으로 처리(effect deps). 리마운트 유발 금지(App.tsx key 는 pathname — 가드 고정).
6. **검증은 실측** — `node scripts/probe-loading.mjs /new-page` (원격 세션은 `PROXY_RELAY=1`). 기준: 풀스크린 로더 1회만(재등장=⚠️), warm 콘텐츠 ≤ ~1.5s. 추측으로 "빠르겠지" 금지.

이 체크리스트의 기계화 가능한 부분(로더 위상·pathname key·prefetch 정합·시드·청크 표면 동기)은 `scripts/check-loader-continuity.mjs` 가 pre-commit + CI 에서 강제한다.
