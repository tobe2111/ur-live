# [LOADING_ADDITIVE] 공개 API 실제 엣지 캐시 — promo-bar · consumer-settings — 2026-11-04

- **바꾼 잠금 파일**: `src/worker/routes/public-utility.routes.ts` — `/api/promo-bar` 에 `publicCache(30)`,
  `/api/consumer-settings` 에 `publicCache(200)` 을 **더했다**. 기존 `Cache-Control`/`CDN-Cache-Control` 분리 헤더는 그대로.
- **대표 지시(그대로)**: *"데이터가 느리고, 유저가 갑자기 많이 들어오고 해도, 최적화가 잘 되어있어야 해"* → *"가장 이상적인 최적화를 해줘"*.
- **왜(라이브 실측)**: 두 응답 모두 `cf-cache-status: DYNAMIC` · `X-Cache-Status` 없음 — 같은 URL 을 세 번 불러도 매번 D1.
  `CDN-Cache-Control` 헤더는 Pages Functions 응답을 Cloudflare 가 캐시하게 만들지 않는다. promo-bar 는 **모든 페이지**가 부른다.
- **불변으로 지킨 잠금 항목**: `publicCache` 의 `useKv:false` 기본(edge-cache.ts 무수정) · 이 파일의 다른 라우트(vouchers/categories 등).
- **반영 지연**: promo-bar 띠를 켜고 끈 것이 최대 약 90초 늦게 보일 수 있다(종전 60초 브라우저 캐시 + 엣지 30초×3).
- **가드**: `src/tests/unit/public-edge-cache-real-2026-11-04.test.ts`(고친 12곳 + "헤더만 캐시" 공개 GET 신규 0).
- **E4 판정**: 배포 후 `curl -D - https://urdeal.kr/api/promo-bar` 를 몇 초 간격으로 두 번 → 두 번째에 `x-cache-status: public-HIT`.
- **롤백**: revert.
