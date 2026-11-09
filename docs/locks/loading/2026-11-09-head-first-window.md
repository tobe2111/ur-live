# [LOADING_ADDITIVE] 2026-11-09 첫 화면 앞 바이트를 첫 송신량 안으로

- 대표: *"이 화면이 꽤 오래 지속되는데?"*(폰 검은 화면 캡처) → 원인 보고 뒤 *"무료 유지 + 다듬기"*.
- 실측: 실사용 `TTFB:colo:LAX` 중간값 1.1~2.4초 · 서버 몫(SRV) 0.08초. 무료 회선 설정(HTTP/3·0-RTT·Early Hints)은 이미 전부 켜짐(CF API 조회).
- 첫 화면 앞 `<head>` 가 압축(br) 17.3KB → 첫 송신량(약 14KB)을 넘어 왕복 1회 추가. 라이브 HTML 재현 계산으로 **13.7KB**.
- 바꾼 것: `scripts/html-slim.mjs`(③ style 주석 ④ head JSON-LD·PC 글꼴 로더 → body 끝) ·
  `src/worker/utils/surface-ssr-meta.ts`·`src/worker/index.ts`(블로그) 의 JSON-LD 를 `head` → `body` 에 붙임.
- 잠금 항목(SSR inject 4페이지·edge cache·preload·speculation rules)은 건드리지 않았다.
- 가드: `head-first-window-2026-11-09.test.ts` + 주입 2건 빨간불 확인.
- ⚠️ 못 하는 것: 검은 화면(첫 바이트 전)은 회선 거리라 이걸로 안 줄어든다. 줄어드는 것은 첫 바이트 뒤 첫 그림까지 왕복 1회.
