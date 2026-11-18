# [UNLOCK_LOADING] 2026-11-18 — `HOT_PATHS` 에서 `/api/home/bundle` 제거

- **승인**: 대표 *"3번은 로딩 잠금 승인해줄게"* (2026-11-18).
- **파일**: `src/worker/cron/cache-prewarm.ts` `HOT_PATHS` (잠금표 "HOT_PATHS 의 SSR key 정확 매칭 · 제거 금지").
- **왜**: 화면 코드에서 이 주소를 부르는 곳이 **0** 이다(`grep -rn "home/bundle" src` — 워커 라우트 · 예열 목록 · `lib/api.ts` 의 공용 경로 목록뿐).
  라이브 24시간 실측(메인 D1 쿼리 통계): 예열만으로 `latest` 410회·198만 행, `featured`(view_count 정렬) 291회·140만 행,
  영구 중단된 라이브커머스 쿼리 3개가 돌았다. 아무도 받지 않는 응답을 5분마다 만들었다.
- **선례**: 2026-10-11 `/api/home/categories` 를 같은 이유(호출자 0)로 뺐다 — 같은 파일 바로 아래 주석.
- **남긴 것**: 라우트·`publicCache(60)` 은 그대로(외부·옛 클라이언트 호출 대비). 예열만 멈춘다.
- **판정(배포 뒤)**: 메인 D1 쿼리 통계에서 `home/bundle` 의 `latest`·`featured` 쿼리 호출 수가 0 근처로 떨어지는지. 홈 첫 화면 측정(`measure-live-vitals.mjs /`)은 이 주소를 안 쓰므로 변화 없어야 한다.
- **가드**: `src/tests/unit/seller-tier-limits-2026-11-18.test.ts` 의 예열 항목(호출자 0 인 주소를 다시 넣으면 빨강).
