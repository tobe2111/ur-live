# [LOADING_ADDITIVE] 2026-11-05 — 로그인 화면 데이터를 HTML 도착과 동시에 출발

- 파일: `src/worker/index.ts`(HTMLRewriter 체인 한 줄 — 기존 4페이지 SSR inject 불변) · 신규 `src/worker/utils/early-data.ts` · `src/lib/http-client.ts`
- 대표: *"여전히 이용권 불러오거나, 첫 페이지 로딩 등 최적화할게 많아"* · 잠금 허가 2026-11-04
- 실측: 실사용 마이 LCP p75 ≈2.5s(8일) — 주요 화면 중 최악. 로그인 화면은 서버 첫 화면이 없어 [앱 JS → 로그인 확인 → 데이터] 가 차례로 간다.
- 무엇: 세션 쿠키(`ur_session`)가 있는 `/user/profile`·`/my-vouchers` HTML `<head>` 맨 앞에 쿠키 인증 GET 들을 바로 출발시키는 스크립트(nonce).
  앱 요청 계층(`dispatch`)이 같은 주소의 첫 GET 에서 한 번만 꺼내 쓴다. 인증 헤더 요청 · 15초 경과 · 2xx 아님이면 종전대로 다시 요청.
- 시험: `early-data-2026-11-05`(주소가 화면 코드와 글자까지 같은지 포함).
- ⚠️ 못 보는 것: 실제 폰 절약 시간 — 배포 후 RUM `/user/profile` LCP p75.
