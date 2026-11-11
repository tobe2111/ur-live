# 2026-11-11 [LOADING_ADDITIVE] `/videos` 목록 preload + `/my-store` 서버 301

- **무엇**: `src/worker/index.ts` — `/videos` 문서 응답에 `Link: </api/urshorts?all=1>; rel=preload; as=fetch; crossorigin` 추가(기존 LCP Link 줄 끝에 이어 붙임, 줄 수 불변). `consumer-redirects.ts` `ALIAS_EXACT` 에 `/my-store → /user/profile`.
- **왜**: 입구 주소 훑기 실측(폰 4G·CPU 4배) — `/videos` 는 목록 요청이 3.3초에 출발해 LCP 3.0~3.2s, `/my-store` 는 앱이 켜진 뒤에야 넘겨 1.6s.
- **성격**: 추가만. 기존 SSR 주입·캐시 헤더·HOT_PATHS 무변경.
- **주소 SSOT**: `src/shared/urshorts-list-cache.ts` `SHORTS_ALL_PATH` — 화면 fetch 와 워커 Link 가 같은 상수를 쓴다.
- **가드**: `videos-list-preload-2026-11-11.test.ts` + 주입 4건(빨간불 확인).
- **롤백**: 그 한 줄(조건부 append) 제거.
- **못 보는 것**: 브라우저가 preload 응답을 fetch 에 실제로 재사용하는지(자격 모드가 어긋나면 두 번 받는다) — 배포 뒤 요청 수로 판정.
