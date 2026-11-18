# [UNLOCK_LOADING] 2026-11-18 — KV 첫 화면 데이터의 지역 복사본 · 교환권 카테고리 KV 수명

- **승인**: 대표 `AskUserQuestion` 두 문항 모두 "해줘 (추천)" (2026-11-18).

## ① `src/worker/utils/ssr-payload.ts` — KV 에서 읽은 첫 화면 데이터를 지역 캐시에 1분 복사
- **실측(전)**: 홈·숙소 `X-SSR-Status: MAIN:kv-hit` 매번 · TTFB 0.22~0.49초. 지역 캐시(`edge-hit`)인 상세·이용권·검색은 0.18~0.23초.
- **바꾼 것**: edge miss → **`/__ssr-kv-copy{path}` 지역 복사본** → KV → (stale) → self-fetch. KV 적중이면 응답 뒤 복사본을 남긴다(60초).
- **안 바꾼 것**: API 캐시 키(`${origin}${path}`)·`caches.default.match` 직접 read·self-fetch 타임아웃·HTMLRewriter inject·`useKv:false`·HOT_PATHS. 복사본은 **다른 키**라 publicCache 의 API 응답·헤더와 섞이지 않는다.
- **판정(배포 뒤)**: 홈 연속 요청에서 `X-SSR-Status: MAIN:kv-copy-hit` 가 보이고 TTFB 가 상세 수준으로.
- 가드 `ssr-kv-edge-copy-2026-11-18.test.ts` · 주입 2.

## ② `src/worker/routes/public-utility.routes.ts` — 교환권 카테고리 SESSION_KV 수명 300초 → 6시간
- **실측(전)**: 하루 151회 재계산(1회 7,016줄·74ms) · KV 쓰기 최대 288회/일(무료 1천의 29%). 목록은 KT 동기화 때만 바뀐다.
- **바꾼 것**: KV `expirationTtl` 만 · KT 동기화 성공(`afterCatalogSync`, synced>0) 시 그 키 삭제. 키·수명 SSOT `utils/voucher-categories-cache.ts`.
- **안 바꾼 것**: `Cache-Control: public, max-age=300, stale-while-revalidate=120`(잠금 항목) — 브라우저·엣지 신선도는 종전과 같다.
- **한계**: KT 밖에서 교환권을 손으로 바꾸면 카테고리 개수·브랜드 칸이 최대 6시간 늦게 보인다.
- 가드 `voucher-categories-cache-2026-11-18.test.ts` · 주입 2.
