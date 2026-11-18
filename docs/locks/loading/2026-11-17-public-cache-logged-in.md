# 2026-11-17 [LOADING_ADDITIVE] 누구에게나 같은 응답 4곳을 publicCache 로 — 로그인 손님도 캐시

- **잠금 파일 변경 없음**: `src/worker/middleware/edge-cache.ts` 는 손대지 않았다(`publicCache` 는 원래 있던 함수). `src/worker/index.ts` 의 SSR 주입 블록도 그대로.
- **대표 승인**: 결재 `docs/decisions/2026-11-17-traffic-surge-readiness.md` 5번 — *"모두 다 해줘 가장 이상적이고 영구적으로"*.
- **무엇**: `edgeCache` 는 로그인 쿠키·Authorization 이 있으면 캐시를 비켜 매번 DB 로 갔다. 사람마다 다르지 않은
  `/api/sections`(홈 섹션) · `/api/urshorts`(숏폼 레일) · `/api/side-banners` · `/api/brands/*` 를 `publicCache` 로 옮겼다.
- **전제(가드)**: 그 핸들러들이 요청자 신원을 읽지 않는다 — `public-cache-logged-in-2026-11-17.test.ts` + 주입 2.
  유어샵 `/api/curator/:handle` 은 주인 응답이 달라 **의도적으로 `edgeCache` 그대로**.
- **쿠키**: GET 응답엔 `Set-Cookie` 가 붙지 않는다(`recentWriteMarker` 는 GET·HEAD 를 건너뛴다) — 캐시된 응답에 남의 쿠키가 실릴 길이 없다.
- 롤백: 이 커밋 revert.
