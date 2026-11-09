# [LOADING_ADDITIVE] 2026-11-09 부품 파일(/assets/*)을 워커 없이 Pages 정적으로

- 대표: 하루 5만 명 비용 질문 → *"부품 파일 바로 내보내게 진행해줘"* → 위험(배포 순간 SPA HTML 이 부품 자리에 캐시) 설명 뒤 *"그래도 지금 진행"*.
- 실측: 첫 방문 워커 요청 ~93건 중 ~60건이 /assets. 2026-07-20 의 '신규 존 정적 404' 는 오늘 재현 안 됨
  (/static·/locales·아이콘 exclude 경로 전부 200).
- 바꾼 것: `public/_routes.json` exclude 에 /assets/* · `public/_headers` /assets/* 에 `!` 세 줄(맨 위 no-store 떼기) +
  `Cloudflare-CDN-Cache-Control: max-age=300` · `index.html` 부트가드 `bustReload` 와 `src/utils/chunk-error.ts`
  `reloadWithCacheBust` 가 이동 전에 부품을 `cache:'reload'` 로 다시 받음.
- 잠금 항목(preload crossOrigin·speculation rules·preconnect)은 건드리지 않았다. 워커 `/assets/*` 핸들러는 남겨 둔다(되돌리기 = exclude 한 줄).
- 가드: `assets-static-2026-11-09.test.ts` + 주입 2건.
- 배포 뒤 확인: `/assets/*.js` 응답이 `public, max-age=31536000, immutable`(no-store 없음)이고 `server-timing` 이 없어야(워커 안 탐).
