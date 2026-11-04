# [UNLOCK_LOADING] 공개 캐시 stale-if-error — 원본 실패 때 마지막 성공 응답 — 2026-11-04

- **바꾼 잠금 파일**: `src/worker/middleware/edge-cache.ts` `makeCacheMiddleware` — MISS 경로에 예비 사본(24시간) 저장과
  원본 실패(5xx·예외) 시 그 사본 반환을 **더했다**. 잠긴 항목(`publicCache` 의 `useKv:false` 기본 · `CDN-Cache-Control` 분리)은 **불변**.
- **대표 승인(그대로)**: *"잠금파일도 모두 허가해줄게"* · 지시 *"대기업급 안정성을 보여주는 최적화가 필요해"*.
- **왜**: 2026-09-01 D1 일일 읽기 한도(7500)에 닿자 소비자 API 가 통째로 500 이 됐다. 캐시가 만료된 순간 원본이 실패하면
  손님 화면은 그대로 오류였다. 이제 마지막 성공 응답을 `X-Cache-Status: *-STALE`(브라우저 15초)로 낸다.
- **범위**: `publicCache`·`edgeCache`(로그인 우회분 제외)를 쓰는 모든 공개 GET. 4xx 는 사본으로 덮지 않는다.
- **비용**: MISS 마다 Cache API put 1회 추가(무료 · KV 아님).
- **⚠️ 못 하는 것**: 200 인데 `success:false` 로 실패를 숨기는 핸들러는 실패로 못 본다.
- **가드**: `src/tests/unit/stale-if-error-2026-11-04.test.ts`(5건 — 성공 시 사본 · 500 · 예외 · 사본 없음 · 4xx).
- **E4 판정**: 라이브에서 장애를 일부러 낼 수는 없다 — 배포 뒤 `__ur_stale=1` 키에 사본이 쌓이는지(`curl ...?__ur_stale=1` 이 HIT) 확인.
- **롤백**: revert.
