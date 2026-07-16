# 도매몰(유통스타트) 별도 배포 설계 — Worker 다이어트

> 상태: **설계 제안 (대표 승인 대기)**. 코드 변경 전. 2026-07-16.
> 배경: 유어딜 소비자 worker gzip 이 CF 무료 1MiB(게이트 ~996KB) 한도에 근접. 도매몰(`features/supply/**`)이 worker 번들의 ~25%(gzip ~260KB). 대표 지시: "별도로 배포하고 싶어 신중하게 작업해줘."

---

## 0. 핵심 발견 (이 설계를 규정하는 사실)

| # | 사실 | 출처 | 함의 |
|---|---|---|---|
| A | 도매몰 라우트는 `src/features/supply/api/**` 55파일 ~16,900 LOC. worker index.ts:1673~1744 에서 마운트 | agent map §1 | 라우트 핸들러 자체는 깨끗이 namespaced |
| B | **소비자 worker 가 `supply-settlement.ts` 를 호출** — 주문확정 `order-commissions.ts:128` `creditSupplierOnOrder`, 환불 `order-refund.ts:77` `reverseSupplierOnRefund`, cron `scheduled.ts:181/187/236` `matureSupplierSettlements`/deposit/withdrawal reconcile | 코드 확인 | **정산 엔진은 소비자 worker 에 남아야 함** — 라우트만 이전 가능 |
| C | 두 서비스가 **같은 D1** 의 같은 테이블(`products`·`sellers`·`supplier_settlements`·`order_items`)을 공유. 플래그(`is_supply_product`·`is_distributor`)로만 격리 | CLAUDE.md #2, agent §6 | **DB 분리 불가/불필요** — 별도 worker 도 같은 D1 바인딩. 데이터 마이그레이션 0, 이중쓰기 0, reconcile 0 |
| C2 | 정산 멱등키 = `order_id` (INSERT OR IGNORE). 두 worker 가 같은 `supplier_settlements` 에 써도 중복적립 구조적 차단 | supply-settlement.ts | **머니 리스크 낮음** — 로직 미변경·relocate 만 하면 |
| D | 도메인 게이트 이미 존재: `utongstart.com`(+등록 몰 호스트) → 비-도매 경로 302 `/wholesale` | index.ts:2428–2442 | 호스트 분기 인프라 완비 |
| E | 의존성 **단방향**: 소비자→supply(머니/cron/인프라). supply 는 group-buy/vouchers/community 를 import 안 함 | agent §6 reverse | supply 를 떼도 소비자 코드가 supply 를 역참조하는 곳만 처리하면 됨 |
| F | 클라이언트는 **단일 Vite SPA**(dist/client). 도매 페이지는 전부 lazy 청크. 소비자 페이지가 도매 페이지를 import 하는 곳 0 | agent §2 | 클라 번들은 크기 문제 아님(청크 분리). worker 만 1MiB 제약 |

**결론**: "깨끗한 분리"는 **라우트 핸들러 표면**(~200KB)만 가능. 정산 엔진(`supply-settlement.ts` + `supply-visibility.ts` ~700 LOC)은 소비자 worker 에 잔류. 두 worker 는 **같은 D1** 공유 → 데이터 리스크 없음, 코드 relocate 리스크만.

---

## 1. 선택지 (대표 결정 필요)

### 옵션 1 — Cloudflare Workers 유료 ($5/mo → 10MB 한도) ⭐ 리스크 최소
- **작업**: 대시보드에서 Workers Paid 전환. 코드 변경 **0**.
- **효과**: 1MiB 문제 **즉시·영구 해소**. 도매몰 다이어트 불필요.
- **머니 리스크**: **0** (코드 무변경).
- **단점**: 월 $5. 브랜드/배포는 여전히 한 프로젝트(도매·소비자 결합 유지).
- 언제: "그냥 한도만 풀면 됨"이 목적이면 최선.

### 옵션 2 — 도매몰 별도 Pages 프로젝트 (`ur-wholesale`) ← 대표 요청 방향
- **작업**: 새 worker 엔트리 `wholesale-index.ts`(도매 라우트+공유 인프라만), 새 Pages 프로젝트 생성, `utongstart.com` 이전, 같은 D1 바인딩. 소비자 worker 는 도매 라우트 마운트 제거(~200KB 회수).
- **효과**: 소비자 worker 1MiB 아래로 여유. 도매/소비자 **독립 배포·독립 blast-radius**. 브랜드 분리.
- **머니 리스크**: 중 — 정산 relocate·이중 worker 인프라 동기화. staging 실결제 검증 필수.
- **단점**: 다단계 아키텍처 작업 + 대표 대시보드 작업 여러 개 + 이 환경(npm 403) 로컬 검증 불가 → CI+staging 의존.

### 옵션 3 — 1 + 2 (유료로 먼저 한도 풀고, 별도배포는 여유있게)
- 유료 전환으로 배포 즉시 정상화(급한 불) → 별도배포는 리스크 없이 단계적으로.
- **권장**: 급한 배포 압박이 있으면 이게 가장 안전한 순서.

---

## 2. 옵션 2/3 실행 설계 (별도 배포)

### 2.1 최종 아키텍처
```
같은 레포 · 같은 D1(d9530ba6-…) · 같은 dist/client(SPA, 도매 페이지는 lazy 청크)
        │
        ├─ Pages 프로젝트 "ur-live"        → live.ur-team.com
        │     worker: consumer-index.ts    (도매 라우트 마운트 제거)
        │     ※ supply-settlement.ts + supply-visibility.ts 는 잔류(주문/환불/cron 이 호출)
        │
        └─ Pages 프로젝트 "ur-wholesale"   → utongstart.com (+ 등록 몰 호스트)
              worker: wholesale-index.ts   (도매 라우트 + 공유 인프라 + 정산 엔진)
```

- **클라이언트**: 두 프로젝트에 **동일한 dist/client 배포**. 도매 도메인은 게이트(§D)가 `/wholesale/*` 밖을 302 → 소비자 페이지 노출 0. (별도 클라 빌드 불필요 — 단순·저리스크.)
- **정산 엔진 중복**: `supply-settlement.ts` 는 **양쪽 worker 에 포함**. 소비자=주문시점 공급자 적립, 도매=B2B 정산. 같은 D1·같은 멱등키(order_id) → 중복 무해.

### 2.2 공유 인프라 (도매 worker 에 포함돼야 할 것 — agent §3)
`@/worker/utils/{safe-error,swallow,validation,toss-gateway,ledger,product-supply-meta,seller-auth,dashboard-session,wholesale-signup-meta,signup-contract}` · `@/worker/middleware/{auth,admin-security,rate-limit,require-2fa}` · `@/worker/types/env` · `@/features/notifications/api/dashboard-notifications.routes` · `@/shared/{pagination,supply-channels,wholesale-*,constants,admin-roles}` · `@/lib/distributor-pricing` · `@/services/{naver-commerce-core,barobill}`.
→ 대부분 소형 공유 유틸. esbuild 가 wholesale-index.ts 진입점에서 트리셰이크로 자동 포함.

### 2.3 소비자 worker 에서 제거할 마운트 (index.ts) — ⚠️ P3 (delicate)
`1673~1744` 의 도매 전용 `app.route`/`adminApp.route` **전부 제거**(정산 함수 import 는 유지). 구체 목록: agent map §1 표(supply/supplier/wholesale/admin.distributor·wholesale-*·suppliers). `admin-suppliers.routes.ts`(features/admin, 소비자 adminApp:1617 마운트)는 **도매 어드민 UI 전용** → 도매 worker 로 이전, 소비자에서 마운트 제거.

> 🔴 **주의(2026-07-16 조사)**: 도매 마운트 블록은 **연속(contiguous)이 아님**. 소비자 핸들러 `POST /api/auth/logout-cookies`(index.ts:1715~1739)와 edge-cache 미들웨어(1680~1686)가 도매 마운트 사이에 **끼어 있음**. 그래서 "블록 통째 제거"가 아니라 **선(先) de-interleave**(로그아웃 핸들러를 소비자 섹션으로 이동 — Hono 는 경로별 등록이라 순서 무관) 후 도매 마운트만 제거해야 함. 이 편집은 잠긴 2469줄 파일 대상 + 이 환경 로컬빌드 불가 → **P3 단독 세션 + CI 빌드 검증 + staging** 필수. 소비자 다이어트(≈200KB 회수)의 실체가 이 편집이라, 서두르지 말 것.

### 2.4 잔류 확인 (소비자 worker 가 계속 필요로 하는 supply 코드)
- `supply-settlement.ts` (creditSupplierOnOrder/reverseSupplierOnRefund/matureSupplierSettlements/payoutSupplier)
- `supply-visibility.ts` (cache-prewarm `normalizeSupplyProductData`, cron)
- `wholesale-helpers.ts` 의 `computeWholesaleOnly` (seller.routes.ts:31 — `GET /api/seller/surface` 겸업 판정. **소비자 셀러↔판매사 겸업 lock-out 가드의 SSOT** — 반드시 잔류)
- cron: `wholesale-settle-tick.ts` 등 `src/worker/cron/wholesale-*` (소비자 scheduled.ts 가 호출) — **정산 성숙은 소비자 worker cron 에 유지** OR 도매 worker cron 으로 이전(둘 중 하나만 — 이중 실행 방지). ⚠️ **결정 포인트**: cron 은 한 프로젝트에서만 돌려야 중복 성숙 방지.

### 2.5 대표 Cloudflare 대시보드 체크리스트 (코드로 불가 — 사람이 해야 함)
1. 새 Pages 프로젝트 `ur-wholesale` 생성 (또는 기존 staging 패턴 재사용). 같은 레포 연결, build command `npm run build`(P0-lite=같은 번들) — 또는 P3 후 `npm run build:wholesale`.
2. **D1 바인딩**: `ur-wholesale` → 같은 DB `DB`(`d9530ba6-7a26-4c02-9295-3ce5aef112a3`). ⚠️ 반드시 **같은** DB (별도 DB 금지 — 정산/products/sellers 데이터 공유).
3. KV/R2/Secrets 바인딩 복제: `RATE_LIMIT_KV`·`SESSION_KV`·`CACHE_KV`·`MEDIA_BUCKET`·`BACKUP_BUCKET`·`DATA_ENCRYPTION_KEY`·`JWT_SECRET`·`TOSS_*`·`KAKAO_*`·`ALIMTALK_*`·`ANTHROPIC_API_KEY`·`DISCORD_WEBHOOK_URL` 등 도매 worker 가 쓰는 것 전부. + Durable Objects(`LIVE_STREAM`·`RATE_LIMITER`) — RATE_LIMITER 는 rate-limit 미들웨어가 씀.
4. 🔴 **Cron trigger = ur-wholesale 에는 절대 설정하지 말 것 (0개).** `wrangler.toml:142-148` 의 9개 cron 은 **오직 ur-live 에서만** 돈다. 도매 worker 에도 같은 cron 이 걸리면 `scheduled.ts` 의 정산 성숙(`matureSupplierSettlements`)·예치금/출금 reconcile 이 **이중 실행 → 이중 지급**(멱등키가 2차 방어지만 1차로 반드시 차단). Pages 프로젝트는 대시보드에서 cron 을 별도 설정해야 하므로 "설정 안 함"이 곧 안전 — 확인만.
5. **커스텀 도메인 `utongstart.com` 이전**: ur-live → ur-wholesale. (다운타임 최소화: ur-wholesale 배포·검증 완료 후 도메인 스왑. TTL 낮춰 빠른 전환.) 이전 후 ur-live 는 `live.ur-team.com` 만 서빙.

### 2.6 단계적 실행 (phased — 각 단계 독립 롤백 가능)
- **P0 (준비, 코드만)**: `wholesale-index.ts` + `build-worker-wholesale.js` 작성. 소비자 worker 는 아직 도매 라우트 유지(제거 X). CI 가 두 worker 다 빌드하는지만 확인. **소비자 배포 무영향.**
- **P1 (대표 대시보드)**: `ur-wholesale` 프로젝트 생성 + 바인딩 + `ur-wholesale.pages.dev` 로 배포. **utongstart.com 은 아직 ur-live 가 서빙**(도메인 미이전) — 순수 병렬 검증.
- **P2 (staging 실결제 검증)**: `ur-wholesale.pages.dev/wholesale` 에서 도매 전 플로우 — 카탈로그·발주·예치금 충전/차감·정산 성숙·미수금·세금계산서·출금. **실 결제/실 정산 1회씩.** (머니 경로 — CLAUDE.md 단독세션 룰.)
- **P3 (도메인 스왑)**: `utongstart.com` → ur-wholesale 이전. 소비자 worker 에서 도매 라우트 마운트 제거 + cron 정리 → ur-live 재배포(gzip 회수 확인). 정산 cron 은 한쪽만.
- **P4 (관측)**: `prod-diag` 로 양 도메인 정상 + gzip 하락 실측 + 정산 이중실행 0 확인.

### 2.7 롤백
- P0~P1: 새 파일/프로젝트라 소비자 무영향 — 그냥 방치/삭제.
- P3 도메인 스왑 롤백: `utongstart.com` → ur-live 재이전 + 소비자 worker 도매 라우트 마운트 복원(git revert). 같은 D1 라 데이터 롤백 불필요.

---

## 3. 리스크 등록부

| 리스크 | 심각도 | 완화 |
|---|---|---|
| 정산 cron 이중 실행(양 worker 다 성숙) → 이중 지급 | 높음 | cron 은 한 프로젝트만. 멱등키(order_id)가 2차 방어. P4 에서 이중실행 0 확인 |
| `computeWholesaleOnly` 등 잔류 필요 코드 누락 → 겸업 lock-out/500 | 중 | §2.4 잔류 목록 가드. seller.routes.ts:31 import 유지 확인 |
| 이 환경 npm 403 → 로컬 build/tsc 불가 | 중 | CI Verify + staging 의존. P0 에서 CI 양-worker 빌드 확인 |
| 공유 인프라 변경 시 두 worker 동기화 누락 | 중(운영) | 같은 레포·같은 소스라 소스 변경은 자동 양쪽 반영(엔트리만 다름). 배포는 CI 가 둘 다 트리거 |
| 도메인 스왑 다운타임 | 낮음 | ur-wholesale 검증 후 스왑. TTL 낮춰 빠른 전환 |
| KV/Secret 바인딩 누락 → 도매 worker 런타임 실패 | 중 | §2.5 체크리스트. P2 staging 에서 전수 확인 |

---

## 4. 권장

1. **급한 배포 압박이 있으면 옵션 3**: 지금 당장은 **옵션 1(유료 $5)**로 1MiB 한도를 즉시 풀어 배포를 정상화(코드·머니 리스크 0). 이미 완료한 다이어트로도 당분간 버팀.
2. 그 다음, **여유있게 옵션 2** 를 P0→P4 로. 머니 경로라 **P2 staging 실결제/실정산 검증**을 반드시 통과한 뒤 P3 도메인 스왑.
3. 별도배포의 진짜 이득은 "1MiB 회피"보다 **독립 배포·brand·blast-radius 분리**. 그 가치가 이 복잡도를 정당화하는지 대표 판단.

> ⚠️ 이 문서의 어떤 코드 변경도 대표 승인 전 착수 금지. 특히 P3(도매 라우트 제거)는 머니 경로 — 단독 세션 + staging 검증 필수(CLAUDE.md).
