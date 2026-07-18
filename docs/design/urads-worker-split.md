# 유어애즈 — 독립 Worker 분리 설계 (SSOT)

> 2026-07-14 대표 결정: "무료 분리" (Workers Paid 대신 유어애즈를 별도 Worker로 분리).
> 목적: 메인 `_worker.js`(Cloudflare Pages Functions)가 Free 플랜 **gzip 1MB 천장**에 도달 →
> 유어애즈를 독립 Worker(Free 3MB)로 떼어내 ① 메인 용량 회복 ② 유어애즈 자체 확장여력 확보.
> **핵심 제약: 라이브 결제 시스템이므로 컷오버 전까지 라이브 경로(`/api/ads/*`)를 건드리지 않는다.**

## 1. 왜 유어애즈가 분리에 최적인가

유어애즈는 **이미 구조적으로 디커플드**:
- 자체 계정 `ad_accounts` · 자체 토큰 `ads_token` · 자체 테이블 `ad_*` (전부 접두사 격리)
- 유어딜/도매의 결제·주문·정산 테이블을 **읽지도 쓰지도 않음** (CLAUDE.md "3서비스 철저 분리" 룰)
- 공유하는 것은 **인프라뿐**: 같은 D1 · `JWT_SECRET` · 몇몇 오픈API 키

→ 유어딜·도매는 테이블을 깊게 공유하므로 메인 Worker에 함께 두고, **유어애즈만** 떼어낸다.

## 2. 아키텍처

```
live.ur-team.com  ──▶  [메인 Pages Worker: 유어딜 + 도매]
                          │  app.all('/api/ads/*')  ──(Service Binding: env.ADS)──▶  [ur-ads Worker]
                          │  app.all('/l/*')        ──(동일)────────────────────────▶     · marketing.routes
                          └  나머지 전부 기존대로                                          · admin-ads.routes
                                                                                          · short-links / influencers …
        둘 다 같은 D1 (database_id d9530ba6-7a26-4c02-9295-3ce5aef112a3) 바인딩
        둘 다 같은 JWT_SECRET → ads_token 호환
```

- **연결 유지의 본질 = 같은 D1**: ur-ads Worker가 **동일 `database_id`** 를 바인딩 → 데이터는 하나. 끊김 0.
- **라우팅**: 메인 Worker가 `/api/ads/*` · `/api/admin/ads/*` · `/l/*` 를 **Service Binding**(`env.ADS.fetch(req)`)으로 위임. 사용자 URL·화면 그대로(체감 0).
- **인증**: 같은 `JWT_SECRET` → 메인/ads 어디서 발급한 `ads_token` 도 상호 검증.
- **프론트엔드**: `/ads/*` 대시보드는 **React SPA(클라이언트 번들)** 라 `_worker.js` 와 무관 — **이동 불필요**, 그대로 둔다.

## 3. 무엇을 옮기고 / 안 옮기나

| 이동 (ur-ads Worker) | 잔류 (메인) |
|---|---|
| `src/features/marketing/**` (marketing.routes·admin-ads·short-links·influencer-discovery·routes/*) | 유어딜·도매 전부 |
| 마운트: `/api/ads/*` · `/api/admin/ads/*` · `/l/*` | 프론트 SPA `/ads/*`(클라 번들) |
| 유어애즈 cron(자동수집 등, 신설 예정) | 기존 cron(kt-alpha·payouts·cache-prewarm…) |

## 4. 단계 (staged — 각 단계 독립 PR + CI + staging 검증)

- **Phase A — 스캐폴드 (additive, 라이브 영향 0)**: `workers/ur-ads/` 신설(자체 `wrangler.toml` + `index.ts`가
  기존 marketing 코드를 import 해 fetch 핸들러 export). 메인 `_worker.js`·라이브 경로 **무변경**. tsc/CI 격리 주의.
- **Phase B — 대표 Cloudflare 셋업 (아래 §5 체크리스트)**: ur-ads Worker 생성·같은 D1/KV 바인딩·시크릿 설정·배포.
- **Phase C — Service Binding 프록시 (게이트드 컷오버)** ✅ 코드 완료(2026-07-14): 메인 `index.ts` 에 `app.use('*')`
  프록시 미들웨어 + Env 에 `ADS`(서비스바인딩)·`ADS_WORKER_ENABLED` 게이트. `ADS_WORKER_ENABLED==='true'` +
  `env.ADS` 바인딩 있으면 `/api/ads/*`·`/l/*` 를 `env.ADS.fetch(req)` 위임(위임 실패 시 로컬 폴백=안전망).
  `/api/admin/ads/*` 는 위임 안 함(메인 어드민 JWT). **기본 OFF/미바인딩 = 현행 byte-동일.** 컷오버 절차 §8.
- **Phase D — 메인에서 유어애즈 코드 제거**: ⚠️ **Phase C 게이트를 prod 에서 ON 하고 검증한 뒤에만** 메인
  `index.ts` 의 marketing import/route(로컬 폴백)를 제거 → `_worker.js` gzip 대폭 감소(용량 회복). 순서 역전 금지
  (폴백을 먼저 지우면 게이트 OFF 상태에서 유어애즈 다운). CI gzip 게이트 원복(1,015,000 이하로).
- **Phase E — 유어애즈 확장**: ur-ads 의 3MB 여유에서 자동수집 cron · 인스타/틱톡 제공사 어댑터 자유 추가.

각 Phase 는 **롤백 1스텝**(게이트 OFF 또는 PR revert)로 즉시 원복 가능.

## 5. 대표 Cloudflare 체크리스트 (Phase B — 대표만 가능)

1. **Workers & Pages → Create → Worker** → 이름 `ur-ads` (또는 `urteam-ads`).
2. **Settings → Bindings**:
   - **D1**: 바인딩명 `DB` → 데이터베이스 `toss-live-commerce-db` (**id `d9530ba6-7a26-4c02-9295-3ce5aef112a3`** — 메인과 동일해야 데이터 공유).
   - **KV**(있으면): `RATE_LIMIT_KV` · `SESSION_KV` · `CACHE_KV` → 메인과 동일 namespace.
3. **Settings → Variables and Secrets**:
   - `JWT_SECRET` — ⚠️ **메인 값이 분실(Cloudflare 시크릿은 쓰기전용·복구불가)** 되어 ur-ads 는 **자체 새 값**을 사용.
     결과: `ads_token` 은 **ur-ads 안에서만** 발급·검증되므로 문제없음. 단 **컷오버(게이트 ON) 시점에 기존 유어애즈
     베타 로그인 사용자는 1회 재로그인** 필요(그전 토큰은 메인 JWT 로 서명됨). `/api/admin/ads/*` 는 메인 어드민 JWT
     라 무관.
   - `YOUTUBE_API_KEY` · `NAVER_SEARCH_CLIENT_ID/SECRET`(또는 `NAVER_CLIENT_ID/SECRET`) · `DATA_ENCRYPTION_KEY` · `ANTHROPIC_API_KEY` · `ADS_*` 플래그 · `RESEND_*`(선택) 등 유어애즈가 쓰는 것.
4. **메인 Pages(ur-live) → Settings → Functions → Service bindings**: 바인딩명 `ADS` → Worker `ur-ads`.
   ⚠️ 이 바인딩은 **ur-ads 가 아니라 *메인 ur-live Pages* 프로젝트**에 만든다(ur-ads 의 Bindings 탭엔 안 보임).
5. **메인 Pages(ur-live) → Settings → Variables**: `ADS_WORKER_ENABLED` = `true`(컷오버). 미설정/기타값이면 OFF(현행).
   ⚠️ Pages 는 env 변경 후 **재배포**해야 반영.
6. 완료되면 알려주기 → Phase C 게이트 ON 후 staging/prod 검증 → Phase D(코드 제거).

> ⚠️ **2026-04-22 사고 교훈(wrangler.toml)**: Worker 가 Custom Domain 을 가로채면 시크릿 없이 동작 → 장애.
> ur-ads Worker 에는 **Custom Domain 을 붙이지 않는다**(Service Binding 으로만 접근). `live.ur-team.com` 은 계속 Pages(ur-live) 전용.

## 6. 리스크 & 완화

- **토큰 재로그인**: ur-ads 는 자체 `JWT_SECRET`(메인값 분실) → 컷오버 시 기존 베타 사용자 1회 재로그인(§5-3). 신규는 무관.
- **D1 다른 DB 바인딩**: 데이터 안 보임 → §5-2 동일 `database_id` 필수.
- **컷오버 회귀**: `ADS_WORKER_ENABLED` 게이트 OFF 기본 + 위임 실패 시 로컬 폴백 → 검증 후에만 ON, 문제 시 즉시 OFF.
- **Phase D 순서**: 로컬 폴백(메인의 marketing 마운트)을 게이트 검증 전에 지우면 OFF 상태에서 유어애즈 다운 → §4 순서 엄수.
- **CI**: ur-ads 는 별도 `wrangler deploy` 스텝(메인 Pages 배포와 독립). 메인 CLAUDE.md "Pages 단일배포" 룰은 *메인*에 한정 — ads Worker 의 `wrangler deploy` 는 예외로 허용(본 문서가 근거).

> ⚠️ **Pages 는 바인딩/env 변경 후 "새 배포"부터 적용** — 서비스바인딩(`ADS`)이나 `ADS_WORKER_ENABLED` 를
> 설정해도 *그 시점 이전에 만들어진 활성 배포*엔 안 실린다. 설정 후 반드시 **새 배포를 트리거**(push/재배포)해야 켜짐.

## 8. 컷오버 절차 (Phase C 게이트 ON — 대표 + 검증)
1. **사전**: `deploy-ads.yml` 로 ur-ads 최신 코드 배포됨(✅ run 성공) + §5-2 D1 바인딩 + §5-3 시크릿 완료.
2. **메인 Pages 서비스바인딩**: §5-4 `ADS` → `ur-ads` (메인 ur-live Pages 에서).
3. **게이트 ON**: 메인 Pages env `ADS_WORKER_ENABLED=true` → **재배포**(env 반영).
4. **검증**: `curl -I https://live.ur-team.com/l/<code>`(리다이렉트 정상) + 유어애즈 대시보드 로그인/발굴 동작 +
   `/__ads/health`(ur-ads 직접은 서비스바인딩 전용이라 메인 경유 경로로) 확인. 기존 베타 사용자 재로그인 안내.
5. **문제 시 롤백**: `ADS_WORKER_ENABLED` 제거/false → 재배포 → 메인 로컬 처리로 즉시 복귀(위임 실패 폴백도 있음).
6. **안정 후**: Phase D(메인 marketing 코드 제거)로 `_worker.js` 용량 회복.

### 8-1. 컷오버 검증 방법 (외부에서 확정)
ur-ads 응답엔 `X-Served-By: ur-ads` 헤더가 실림(메인 로컬 폴백엔 없음). 위임 실패 시 폴백이 200을 반환하므로
기능 테스트만으론 구분 불가 → **헤더로 확정**:
```
curl -s -D - -o /dev/null https://live.ur-team.com/api/ads/ping | grep -i x-served-by
```
- `x-served-by: ur-ads` 있으면 → **ur-ads 경유 확정(컷오버 성공)**.
- 없으면 → 아직 메인 로컬 처리. 점검: ① `ADS_WORKER_ENABLED=true`(Production 환경, 오타 없이) ② `ADS`
  서비스바인딩 존재 ③ **설정 후 새 배포를 만들었는지**(Pages 는 재배포 전엔 미적용). 셋 확인 후 재배포.

## 7. 구현 로그
- Phase A (스캐폴드): commit `e227c1e3` — 설계 + `src/worker-ads/index.ts` 엔트리(라이브 영향 0).
- Phase B (배포 파이프라인): commit `2324c0da` — `build-worker-ads.js` + `deploy-ads.yml`(ur-ads `wrangler deploy`).
  대표 Cloudflare 셋업(ur-ads Worker + D1 바인딩 + 시크릿) 완료 → 첫 배포 성공(Actions run "success").
- Phase C (게이트드 프록시): commit `<이 커밋>` — 메인 `index.ts` `app.use('*')` 위임 미들웨어 + Env `ADS`/`ADS_WORKER_ENABLED`. 기본 OFF = 라이브 byte-동일.
- **Phase D (메인 폴백 제거)**: 2026-07-16 — 사전 검증: prod `curl /api/ads/ping` → **`x-served-by: ur-ads` 확인(컷오버 ON 상태)** → §4 순서 충족. 메인 `index.ts` 에서 `marketingRoutes`(/api/ads)·`shortLinkRedirectRoutes`(/l) import+mount 제거(주석 보존, 재도입=원복). **잔류**: ① `/api/admin/ads`(`adminAdsRoutes` + ads-account/entitlements/media-gateway/ad-services/reviews/short-links 서브그래프 ~81KB 소스) — 프록시 비위임 설계(메인 어드민 JWT) 유지 ② `scheduled.ts` ads-* cron 5종(autobid/price-monitor/rank-tracker/metrics-history/alerts ~53KB+전이) — 현행 라이브 동작 보존, ur-ads 이전은 Phase E. ⚠️ 이후 `ADS_WORKER_ENABLED`/`ADS` 바인딩은 **끄면 유어애즈 404**(폴백 없음) — 롤백은 이 커밋 revert.
