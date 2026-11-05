# [LOADING_ADDITIVE] 2026-11-05 — 홈 LCP(지역 사진)를 응답 헤더로

- 파일: `src/worker/index.ts`(HTMLRewriter SSR 블록 — 홈 줄 한 줄) · `src/worker/utils/home-first-screen.ts` · `src/worker/utils/lcp-image-link.ts`
- 대표: *"여전히 첫 화면 로딩은 최적화가 상당히 필요하겠어"*(2026-11-05) · 잠금 허가 2026-11-04
- 실측(라이브 urdeal.kr · iPhone 13 · CPU×4 · 3회): LCP 요소 = `IMG /assets/region-hero/national-v1.webp`(48KB) **매번**.
  첫 그림 → LCP = 2.0s · 0.2s · 1.2s. 이 사진은 본문 `<img>` 라 늦게 발견되고 우선순위 표시가 없어 JS 25개와 회선을 나눴다.
  응답 헤더 preload 는 10-19 판 그대로 **배너**만 당기고 있었다(11-02 지역 사진이 맨 위에 생기면서 LCP 가 바뀐 것을 안 따라왔다).
- 무엇: ① `homeHeroLcpImage(cookie)` — 서버 첫 화면과 같은 함수(`regionHeroFromCookieHeader`)로 주소를 얻어 **배너보다 먼저** Link 헤더에 싣는다(byte-일치)
  ② 서버 첫 화면 지역 사진 `<img>` 에 `fetchpriority="high"`.
- 시험: `lcp-image-link-2026-10-19` 3건 추가 + 재조준 · 주입 1건 추가·1건 재조준(6건 전부 빨간불).
- ⚠️ 못 보는 것: 한국 회선에서의 실제 LCP 변화(배포 후 RUM `vitals:…:LCP` p75 로 판정).
