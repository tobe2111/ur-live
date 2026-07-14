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
- **Phase C — Service Binding 프록시 (게이트드 컷오버)**: 메인에 `ADS` 서비스바인딩 추가 + `ADS_WORKER_ENABLED`
  env 게이트로 `/api/ads/*`·`/l/*` 를 `env.ADS.fetch()` 위임. **기본 OFF = 현행 100% 동일.** staging 에서 ON → 검증.
- **Phase D — 메인에서 유어애즈 코드 제거**: 컷오버 검증 후 메인 `index.ts` 의 marketing import/route 제거 →
  `_worker.js` gzip 대폭 감소(용량 회복 달성). CI gzip 게이트 원복(1,015,000 이하로).
- **Phase E — 유어애즈 확장**: ur-ads 의 3MB 여유에서 자동수집 cron · 인스타/틱톡 제공사 어댑터 자유 추가.

각 Phase 는 **롤백 1스텝**(게이트 OFF 또는 PR revert)로 즉시 원복 가능.

## 5. 대표 Cloudflare 체크리스트 (Phase B — 대표만 가능)

1. **Workers & Pages → Create → Worker** → 이름 `ur-ads` (또는 `urteam-ads`).
2. **Settings → Bindings**:
   - **D1**: 바인딩명 `DB` → 데이터베이스 `toss-live-commerce-db` (**id `d9530ba6-7a26-4c02-9295-3ce5aef112a3`** — 메인과 동일해야 데이터 공유).
   - **KV**(있으면): `RATE_LIMIT_KV` · `SESSION_KV` · `CACHE_KV` → 메인과 동일 namespace.
3. **Settings → Variables and Secrets** (메인과 동일 값):
   - `JWT_SECRET` (**반드시 메인과 동일** — 토큰 호환)
   - `YOUTUBE_API_KEY` · `NAVER_SEARCH_CLIENT_ID/SECRET`(또는 `NAVER_CLIENT_ID/SECRET`) · `DATA_ENCRYPTION_KEY` · `ANTHROPIC_API_KEY` · `ADS_*` 플래그 · `RESEND_*`(선택) 등 유어애즈가 쓰는 것.
4. **메인 Pages(ur-live) → Settings → Functions → Service bindings**: 바인딩명 `ADS` → Worker `ur-ads`.
5. 완료되면 알려주기 → Phase C 게이트 ON 후 staging 검증.

> ⚠️ **2026-04-22 사고 교훈(wrangler.toml)**: Worker 가 Custom Domain 을 가로채면 시크릿 없이 동작 → 장애.
> ur-ads Worker 에는 **Custom Domain 을 붙이지 않는다**(Service Binding 으로만 접근). `live.ur-team.com` 은 계속 Pages(ur-live) 전용.

## 6. 리스크 & 완화

- **토큰 불일치**: `JWT_SECRET` 다르면 로그인 깨짐 → §5-3 동일값 필수 + Phase C staging 검증.
- **D1 다른 DB 바인딩**: 데이터 안 보임 → §5-2 동일 `database_id` 필수.
- **컷오버 회귀**: `ADS_WORKER_ENABLED` 게이트 OFF 기본 → 검증 후에만 ON, 문제 시 즉시 OFF.
- **CI**: ur-ads 는 별도 `wrangler deploy` 스텝(메인 Pages 배포와 독립). 메인 CLAUDE.md "Pages 단일배포" 룰은 *메인*에 한정 — ads Worker 의 `wrangler deploy` 는 예외로 허용(본 문서가 근거).

## 7. 구현 로그
- (Phase A~) 착수 시 commit hash 기록.
