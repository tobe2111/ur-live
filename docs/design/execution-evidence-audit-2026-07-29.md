# 🔬 실행 증거 감사 — 방배 파일럿 전 건강검진 (2026-07-29)

> **대표 지시**: *"오늘 발견 2건(gb 미배선·cron 미등록)의 공통 클래스 = 코드는 있으나 연결·등록·실행되지
> 않음. 원인은 '코드 존재'를 완료로 판정한 것. 이번 감사는 코드가 아니라 **실행 증거**(하트비트·로그·원장
> 기록)로 판정한다. 코드를 읽고 '있음'으로 판정하는 것 금지."*
>
> **코드 변경 0.** 라이브 어드민 API·GitHub Actions 로그·빌드 산출물 실측만.

---

## 0. 판정 규칙

| 판정 | 뜻 | 근거의 형태 |
|---|---|---|
| 🟢 **실행 증거 있음** | 그 경로가 **실제로 돌아간 흔적**이 라이브에 남아 있다 | 하트비트 행 · DB 부수효과 행 · 응답 헤더 · CI 로그 |
| 🔴 **실행 증거 없음** | 돌 기회가 충분했는데 흔적이 0 | 기회 대비 0건(결정적) |
| ⚪ **판정 불가** | 아직 돌 기회가 없었거나 관측 수단 자체가 없다 | — (무엇이 있어야 판정되는지 명기) |

> ⚠️ **"코드가 있다"는 세 판정 중 어디에도 해당하지 않는다.** 이 문서에서 코드는 *어디를 봐야 하는지*를
> 알려줄 뿐, 판정 근거가 아니다.

**관측 창의 한계**: cron 하트비트 저장은 **2026-07-29 03:42 UTC** 에 배포됐다. 그 이전 실행은 하트비트에
안 보인다 → 일간/주간 블록은 **부수효과 행**(에러로그·원장·payouts)으로 따로 판정했다.

---

## 1. 🔴 최상위 원인 — 등록 갭은 "대시보드를 안 만졌다"가 아니라 **CI 가 매번 거부당하고 성공이라 보고**한다

`worker-deploy.yml` 로그 실측 (run `30432231821`, 2026-07-29 07:37 UTC):

```
Uploaded ur-live (42.41 sec)
✘ [ERROR] A request to the Cloudflare API (/accounts/***/workers/scripts/ur-live/schedules) failed.
  invalid cron string: 0 20 * * 0 [code: 10100]
##[warning]스크립트는 업로드됐으나 스케줄 동기화 실패(기존 스케줄 원자적 보존).
```
→ job conclusion **success**. 최근 30 run 전부 success.

**세 가지가 겹쳐 있다:**

1. **스케줄 PUT 은 원자적** — `0 20 * * 0` 하나가 거부되면 **9개 전부** 안 올라간다.
2. 워크플로가 이 실패를 **의도적으로 성공 처리**한다(`worker-deploy.yml:68-72`). 설계 의도는
   "스크립트는 올라갔으니 코드 동기화는 성공"이지만, 결과적으로 **스케줄이 한 번도 반영된 적 없다는
   사실이 초록불 뒤에 숨는다.**
3. 그래서 **실제 등록 상태 = 대시보드에 과거 수동 설정된 것 그대로**이고, `wrangler.toml` 의
   `crons = [...]` 는 **선언일 뿐 사실이 아니다.**

> 🔴 이것이 오늘 발견된 "cron 미등록"의 기계적 원인이다. 대시보드를 고치기 전에 **이 파이프라인부터**
> 고쳐야 같은 상태로 되돌아가지 않는다. `0 20 * * 0` 이 왜 거부되는지는 추측하지 않는다 —
> **CF 가 그 문자열을 거부한다는 것만이 실측 사실**이고, 대체 표기는 CI 에서 한 번 돌려 확인해야 한다.

---

## 2. B. 등록 갭 — cron 블록별 기대 vs 실등록

`scheduled.ts` 에서 추출한 기대 명부: **9개 cron 식 / 69개 작업**.

| cron 식 | 기대 작업 | 관측 기회 | 실행 증거 | 판정 |
|---|---|---|---|---|
| `*/5 * * * *` | **9**<sup>†</sup> | ~64회 | 하트비트 **9/9** (08:40·09:02 재확인) | 🟢 **등록됨** |
| `*/2 * * * *` | 1 (`bulk-email-drain`) | ~160회 | 0건 | 🔴 **미등록** |
| `0 * * * *` | 20 | 5회+ | 0건 — **같은 시각 `ads:*` 은 23건 기록** | 🔴 **미등록** |
| `0 9 * * *` | 8 | **1회(09:00 실측)** | **0건** | 🔴 **미등록(결정적)** |
| `0 18 * * *` | 15 | 창 밖 | `frontend_errors` 의 `ledger_mismatch` **07-22·23·24·26·28** | 🟢 **등록됨 — 단 결측일 있음** |
| `0 3 * * *` | 5 | 창 밖 | 부수효과 저장 없음 | ⚪ 판정 불가 |
| `0 19 * * *` | 2 | 창 밖 | 부수효과 저장 없음 | ⚪ 판정 불가 |
| `0 20 * * 0` | 1 (`d1-backup`) | 창 밖 | 0 + **CF 가 이 문자열을 거부** + `BACKUP_BUCKET` **미바인딩** | 🔴 **삼중 불가** |
| `0 0 * * 1` | 7 (`payouts-generate`) | 07-27 1회 | **`payouts` 테이블 전건 0** | 🔴 **미등록(강함)** |

<sup>†</sup> 명부상 10이나 `ads-autobid` 는 ur-ads 이관으로 주석 처리 → 실기대 9. **9 기대 = 9 관측**이라
명부 추출이 정확함을 스스로 증명한다.

**⇒ 69개 작업 중 실행 증거가 있는 것은 9개(13%).**

### 2.1 `0 18` 의 결측일이 말하는 것

`ledger-integrity-check` 는 불일치가 있으면 **조건 없이·중복억제 없이** `frontend_errors` 에 1행 쓴다
(`ledger-integrity-check.ts:158`). 불일치 수는 7일 내내 동일하게 `4` 였다. 그런데:

```
07-22 18:00:50  ✅   07-23 18:00:01  ✅   07-24 18:00:01  ✅
07-25           ❌   07-26 18:00:51  ✅   07-27           ❌   07-28 18:00:59  ✅
```

⇒ **등록은 돼 있지만 7일 중 2일 발화하지 않았다.** "등록/미등록" 이분법으로는 안 잡히는 세 번째 상태다.
정산 성숙(`supplier-settlement-mature`)·`auto-settlement` 이 이 블록에 있으므로 **돈이 이 간헐성 위에 있다.**

> 🩺 덤으로: **`user_points_balance_mismatch: 4` 가 최소 7일간 동일하게 방치**돼 있다. 매일 어드민 벨이
> 울렸지만 아무도 손대지 않았다 — 파일럿 전에 원인 규명이 필요하다(이번 감사 범위 밖).

### 2.2 코드 밖 의존 — env/바인딩 실측

`GET /api/health/env-readiness` (production, 2026-07-29 08:49 UTC):

| 그룹 | 결과 |
|---|---|
| blocking | ✅ JWT_SECRET · FRONTEND_URL |
| security | ✅ RATE_LIMIT_KV · TURNSTILE_SECRET / ❌ **DATA_ENCRYPTION_KEY** · ❌ **INTERNAL_API_TOKEN** |
| perf | ✅ SESSION_KV · ✅ **CACHE_KV** |
| infra | ✅ MEDIA_BUCKET · PUBLIC_R2_URL · LIVE_STREAM / ❌ **BACKUP_BUCKET** · ❌ ANALYTICS_KV · ❌ RATE_LIMITER |
| payments | ✅ TOSS_SECRET_KEY · TOSS_CLIENT_KEY · TOSS_WEBHOOK_SECRET |
| optional | ✅ KAKAO · ALIGO 3종 · NAVER · UCANSIGN / ❌ **ANTHROPIC_API_KEY** · ❌ **SENTRY_DSN** |

읽어야 할 것:

- **`DATA_ENCRYPTION_KEY` 부재** = 카카오/외부 토큰이 **평문 저장**(CLAUDE.md 카카오 룰 위반). 🔴 파일럿 전 처리.
- **`BACKUP_BUCKET` 부재** = 주간 백업이 **트리거와 무관하게** 애초에 불가. 재해복구 0.
  (`d1-backup.yml` GitHub Actions 가 **수요일 20:00 UTC** 에 artifact 로 별도 백업 → 여기가 실질 백업선이다.)
- **`SENTRY_DSN` 부재** = X7 절반은 **미설정 확정**.
- **`CACHE_KV` 는 바인딩돼 있다** — 2026-07-12 인계의 *"대시보드 1스텝 필요"* 는 이미 해소됨.
- `RATE_LIMIT_KV` 는 헤더로도 동작 확인(`x-ratelimit-limit: 300`, `remaining: 299`).

### 2.2-b 🔴 **같은 이름의 두 런타임** — env-readiness 가 재는 곳과 cron 이 도는 곳이 다르다 (2026-07-29 대표 화면 확인)

대표가 CF 대시보드를 열어 확인한 결과, **`ur-live` 는 두 개**다.

| | Pages `ur-live` | Workers `ur-live` |
|---|---|---|
| 무엇을 하나 | **HTTP 요청 전부**(소비자·어드민 API) | **cron 전부**(`scheduled`) |
| 시크릿 | **전부 있음**(JWT/Toss/ALIGO/KAKAO…) | **0개** — Plaintext `FRONTEND_URL`·`SCRAPER_URL` 뿐 |
| 바인딩 | CACHE_KV·SESSION_KV·RATE_LIMIT_KV·DB·MEDIA_BUCKET·LIVE_STREAM·ADS | **DB·LIVE_STREAM·RATE_LIMITER 뿐**(`wrangler.toml` 이 선언하는 것만 — KV·R2 는 전부 주석 처리 `YOUR_..._ID`) |
| Compatibility date | Sep 25, 2024 | Dec 1, 2025 (레포와 일치) |

> 🔴 **`GET /api/health/env-readiness` 는 HTTP 엔드포인트라 Pages 런타임을 잰다.**
> 그 결과가 `TOSS_SECRET_KEY ✅ · ALIGO ✅ · CACHE_KV ✅` 였던 것은 **Pages 이야기**이고,
> **cron 이 그것을 쓸 수 있다는 뜻이 전혀 아니다.** 이 문서가 §2.2 에서 그 표를 실었을 때
> 그 구분을 안 했다 — **판정의 범위를 잘못 잡았다.**
> ⇒ 이 감사 자체의 교훈("같은 함수를 쓴다 ≠ 같은 게이트 뒤다")이 런타임 층에서 반복된 사례다.

**그래서 실제로 무엇이 죽어 있나** — cron 이 **DB 만 쓰는 일은 정상, 바깥과 말하는 일은 전부 무음 skip**:

| 작업(등록된 블록) | 상태 | 근거 |
|---|---|---|
| 정산 성숙 · 원장 정합 · 스키마 수리 | 🟢 동작 | DB 만 씀 — `ledger_mismatch` 기록이 그 증거 |
| **`cache-prewarm` 의 SSR KV 전역 워밍** | 🔴 **한 번도 안 돎** | `cache-prewarm.ts:159` `if (… && env.CACHE_KV …)` → Worker 에 CACHE_KV 없음. **2026-07-12 기능이 무효** |
| 알림톡 계열(리마인더·재시도) | 🔴 무음 skip | `!!(env.ALIGO_API_KEY && …)` 게이트 |
| `daily-self-diagnostic` | 🔴 도달 0 | Discord 키 없음 — *"누락 시크릿"* 경보를 만들어도 **갈 곳이 없다** |
| 교환권 만료 **카드** 환불 | 🔴 실패 | `TOSS_SECRET_KEY` 없음 (딜포인트 환불은 DB 라 동작 — 8/22 건은 안전) |

⚠️ **하트비트는 이걸 못 잡는다** — 전부 `ok=true` 다. 예외가 안 나고 **조용히 아무것도 안 하기** 때문이고,
이게 CLAUDE.md 가 하트비트를 만든 이유였던 바로 그 클래스다. **하트비트는 "돌았다"를 증명하지 "했다"를 증명하지 않는다.**

**고치는 법**: cron 을 Pages 로 옮길 수 없다(Pages Functions 는 cron 미지원) ⇒ **Worker 쪽에 필요한 것을 채우는 수밖에 없다.**
바인딩(KV·R2)은 `wrangler.toml` 주석을 풀면 배포가 자동으로 붙일 수 있으나 **네임스페이스 ID 가 필요**하고,
시크릿은 `wrangler.toml` 에 두면 안 되므로 **대시보드 또는 `wrangler secret put`** 이다.

### 2.3 그 밖의 코드 밖 의존

| 항목 | 판정 | 무엇이 있어야 판정되나 |
|---|---|---|
| **Toss webhook 등록** | ⚪ 판정 불가 | `TOSS_WEBHOOK_SECRET` 은 설정돼 있으나 **등록 자체는 Toss 개발자센터**. ① 대표가 콘솔의 웹훅 URL 목록(`/api/payments/webhook`) 확인 ② 또는 실결제 1건 후 `webhook_events` 행 생성 확인 |
| **`DISCORD_WEBHOOK_URL`** | ⚪ 판정 불가 | 코드가 **28곳**에서 읽는데 **어느 readiness 목록에도 없다** → 관측 수단 자체가 없다. 대표 확인 필요 |
| **알림톡 발송** | 🔴 없음 | `alimtalk/statistics` = `total_sent: 0`, `active_accounts: 0`. ALIGO 3종은 설정돼 있으나 **발송 이력 0** |
| **`ALIMTALK_API_KEY`/`ALIMTALK_SENDER_KEY`** | ⚪ 판정 불가 | `ALIGO_*` 와 **별개 네이밍**을 쓰는 경로가 있다(`admin-sellers.routes.ts:729` 매장 사장님 알림톡 · district). readiness 목록 밖 |
| **staging 실존** | ⚪ 판정 불가 | #856 §1.1 그대로 미해결. 이번 감사로 좁혀지지 않음 |

---

## 3. A. 배선 갭 — 방배 8월 경로 판정표

| # | 단계 | 실행 증거 | 판정 | 막고 있는 것 |
|---|---|---|---|---|
| 1 | **매장 온보딩** | `sellers` 10건 · 최근 승인 2026-06-25 · `pending_sellers: 0` · 온보딩 헬스 7/8 | 🟢 있음 | (AI OCR 바인딩만 선택 미설정) |
| 2 | **공구 개설·노출** | `GET /api/gb-marketplace` → **`gb_engine: false`** · `platform_settings` 153키에 `gb_engine_enabled` **부재** · 클라 `GB_ENGINE_ENABLED = false` | 🔴 **없음** | **표시 게이트가 서버·클라 양쪽 OFF**(결제 단가는 게이트 밖 — §3.2) |
| 3 | **소비자 결제 — 공구가** | main 에서 `resolveGbPricing` 소비처 = `gb-marketplace.routes.ts`(**표시**) 뿐 | 🔴 **없음** | PR #844 미머지 + staging(X1) |
| 4 | **소비자 결제 — 일반** | 마지막 `DONE` **2026-03-31** · 마지막 `PAID` 2026-05-24(수단 `deal_points`) · `orders_24h: 0` · 최신 주문 #88 = `FAILED` | 🔴 없음(최근) | 트래픽 0 — **카드 결제 성공 기록은 4개월 전** |
| 5 | **QR 사용확인(픽업)** | `voucher_transactions` **총 1건** · `used_at` 비어 있음 · 소각 **0건** | 🔴 **없음** | 픽업 분기 자체가 세션 ④ 미착수 |
| 6 | **promo 커미션** | `promo_funding_source = platform`(기본) · `commission_budget_enabled = false` · `fee_breakdown.count = 0` · `invariant_44` 전 항목 0 | 🔴 **없음** | 게이트 OFF(의도적) |
| 7 | **정산** | **`payouts` 전건 0**(status=all) · `settlement_records` 전건 `pending`/`settled_at: null` · `tools/settlements/pending` = [] | 🔴 **없음** | `0 0 * * 1` 미등록(§2) |
| 8 | **환불** | `status=REFUNDED` 주문 **0건** · `/api/admin/returns` 404 | 🔴 없음 | 되는지 여부는 코드상 붙어 있으나 **실행된 적 없음** |
| 9 | **주문/픽업 알림** | 알림톡 `total_sent: 0` · 발송실패 큐도 0 | 🔴 없음 | §2.3 |

> 🔎 **경로 전체에서 실행 증거가 있는 단계는 1번 하나다.** 2~9 는 전부 "코드는 있는데 돈 적이 없다".
> 이 표가 곧 대표 지시의 그 클래스이고, 방배가 8월에 밟을 순서 그대로다.

### 3.1 이번에 밝혀진 새 배선 갭 — **공구 엔진 게이트**

`gb 가격이 결제에 안 붙는다`(PR #844)는 **두 겹 중 안쪽 하나**였다. 바깥에 게이트가 하나 더 있다:

```
GET /api/gb-marketplace  →  { "success": true, "data": [], "gb_engine": false }
platform_settings 153키  →  gb_engine_enabled 키 자체가 없음
src/shared/feature-flags.ts:73  →  export const GB_ENGINE_ENABLED = false
```

게다가 `gb_engine_enabled` 는 `OPS_GATES`(게이트 현황판 명부)에 **등재돼 있지 않아** 화면에서도 안 보인다.

> 이건 #856 이 O5 를 *"🟢 엔진 있음"* 으로 판정한 것에 대한 정정이다. 엔진은 있지만 **꺼져 있고**,
> 켜는 절차가 어느 체크리스트에도 없다.

### 3.2 ⚠️ 위 판정의 정정 — 게이트는 **노출**만 막는다 (2026-07-29 재확인)

처음 이 문서는 *"게이트가 OFF 인 한 공구가는 **어디에도** 적용되지 않는다"* 고 적었다. **틀렸다.**
#844 가 결제에 붙인 `loadGbOrderPricing`(`worker/utils/gb-order-pricing.ts`)은 `gb_engine_enabled` 를
**조회하지 않는다** — 세션 데이터(`product_supply_meta` 의 `gb_mode`/`gb_price`)만 읽는다.

| 경로 | 게이트 | 게이트 OFF 일 때 |
|---|---|---|
| 마켓플레이스 목록 (`gb-marketplace.routes`) | `gb_engine_enabled` | 빈 목록 |
| 소비자 공구 UI 표면 | 클라 `GB_ENGINE_ENABLED` | 미노출 |
| **결제 단가** (`order.routes` → `loadGbOrderPricing`) | **없음** | **세션이 열려 있으면 공구가로 결제** |

⇒ 정확한 서술은 **"게이트 2겹은 표시 경로 전용이고, 결제 범위를 정하는 것은 세션 데이터"** 다.
PR #872(프로덕션 실결제 절차서)가 *"이 배선에는 env 플래그가 없다 — 범위를 정하는 건 데이터"* 라고 한 것이 맞다.

**왜 틀렸나**: `resolveGbPricing` 의 *소비처*를 세었을 때 마켓플레이스 라우트가 게이트 뒤에 있는 것을 보고
**같은 함수를 쓰는 결제 경로도 같은 게이트 뒤일 것으로 추정**했다. #844 는 그 함수를 게이트 없는 새 헬퍼로
감싸 호출한다. ⇒ **"같은 함수를 쓴다"가 "같은 게이트 뒤다"를 뜻하지 않는다.** 호출 체인마다 확인할 것.

> 🟢 방향은 안전하다 — `validateGbSession`/`resolveGbPricing` 이 **가격을 낮추기만** 한다(과금 위험 0).
> 다만 *"게이트가 꺼져 있으니 아무 일도 안 일어난다"* 는 전제로 세션을 열어 두면 **그 상품은 결제에서
> 공구가가 붙는다.** 범위 통제는 세션 개폐로 한다.

---

## 4. C. 감시 갭 — "한 번도 안 뛴 것"을 못 보는 구조

| # | 감시 | 기대 목록 대조 | 실측 | 전환 가능성 |
|---|---|---|---|---|
| C1 | `/api/_healthcheck/cron` 의 `missing` | ❌ **기록된 하트비트에서만 파생** | 실측 `missing: []` — 60개가 안 도는데 | 🟢 **가능** — PR #858 이 명부 기반 `never_ran` 으로 이미 구현 |
| C2 | `cron-stale-watch` | ❌ 같은 이유 + **자신이 `0 * * * *` 블록**(§2 미등록) | 하트비트 0건 = **감시자가 안 돈다** | 🟡 명부 대조는 가능하나, **감시자를 도는 블록으로 옮기지 않으면 무의미** |
| C3 | 디스패처 자체 | ✅ **해소(2026-07-31)** — `cron-unmatched` 하트비트 신설 | 이전엔 등록됐는데 문자열이 다른 경우와 미등록이 **구분 불가**였다 | 🟢 완료 — 매칭 실패 시 1행. 정합은 `cron-dispatch.test.ts` 가 강제 |
| C4 | 게이트 현황판(`ops-status`) | — | 🔴 **중복 라우트로 죽어 있다**(아래) | 🟢 가능 — 마운트 정리 |
| C5 | env 기대 목록 | ❌ **3종이 서로 다르다** | `/api/version` 15 · env-readiness 25 · `daily-self-diagnostic` 5(**폐기된 `FIREBASE_PRIVATE_KEY` 를 아직 요구**). 코드가 읽는 env **171개 중 135개는 어느 목록에도 없음** | 🟢 가능 — 단일 SPEC 으로 통합 |
| C6 | `uptime.yml`(외부 dead-man) | 부분 | `*/10` 선언이나 **실제 ~1시간 간격**(GitHub 스로틀). 06:19 이슈 #845 개설 후 **2.5시간 무재점검** | 🟡 |

### 4.1 🔴 C4 — 게이트 현황판이 중복 라우트로 죽어 있다

`GET /api/admin/ops-status` 가 **두 곳에 등록**돼 있다:

| 파일 | 마운트 | 응답 |
|---|---|---|
| `internal-admin-tools.routes.ts:1102` | `index.ts:1152` (**먼저**) | `{ last_schema_repair, active_products, orders_24h, recent_errors, kt_alpha_24h }` |
| `admin-system-monitoring.routes.ts:243` | `index.ts:1806` (adminApp) | `{ gates, cron_health, heartbeats, checklist_doc }` ← **화면이 기대하는 것** |

Hono 는 먼저 등록된 쪽을 매칭한다. 라이브 응답은 실제로 **앞쪽**이다(실측).

`OpsStatusTab.tsx:74` 의 `select` 는 `r.success` 가 true 면 `r.data` 를 그대로 넘긴다 — 라이브 응답도
`success: true` 라 **EMPTY 폴백을 타지 않고** 잘못된 모양이 그대로 들어간다. 그 다음 줄
`const { gates, ... } = data` → `gates` 는 `undefined` → `activeGates = gates.filter(...)` 에서 **TypeError**.

⇒ **`STAGING_CHECKLIST.md` 가 "어떤 게이트가 켜져 있는지 보는 곳"으로 지목한 화면이 열리지 않는다.**
게이트 12항목이 전부 `⬜ 미검증`인 것과 이것은 무관하지 않다 — **볼 화면이 없었다.**

> 이건 CLAUDE.md 가 `check-duplicate-routes`(App.tsx 라우트)로 이미 막고 있는 클래스인데, **API 라우트에는
> 같은 가드가 없다.** 자동 스캔으로 서버 라우트 충돌은 이 1건만 확인됐다(나머지 3건은 오탐 — 클라 훅 문자열,
> `/tools` 프리픽스로 실제 경로가 다름).

---

## 5. #856 릴리즈 체크리스트 — 이 감사로 갱신되는 판정

### 5.1 정정 (기존 서술이 틀렸거나 좁았던 것)

| 항목 | #856 의 서술 | 실측 정정 |
|---|---|---|
| **§1.2 X9** | *"`*/5` 하나뿐일 가능성"* | ❌ **틀렸다.** `0 18` 은 등록돼 있다(`ledger_mismatch` 5일치). 다만 **7일 중 2일 결측**. 옳은 서술은 *"`*/5`+`0 18` 만 확인되고, `*/2`·`0 * * * *`·`0 9` 는 실행 증거 0"* |
| **§1.2 판정 시점** | *"`0 9` 가 09:00 에 발화하면 일간 블록 정상"* | ✅ **09:00 UTC 실측 완료 — 0건.** `0 9` 는 미등록으로 확정. ⚪→🔴 |
| **O5 공구 개설** | *"🟢 엔진 있음 (`gb_mode`/`gb_price`)"* | 🔴 **엔진이 꺼져 있다.** `gb_engine: false` + `platform_settings` 키 부재 + 클라 플래그 false. **켜는 절차가 체크리스트에 없다**(§3.1) |
| **O8 정산** | *"🟢 파이프 있음(`payouts-generate`)"* | 🔴 파이프의 **실행 증거 0** — `payouts` 전건 0. 코드가 아니라 트리거가 막는다는 §1.2 의 추정이 **payouts 테이블로 확증됨** |
| **X7 알림 env** | *"두 env 설정 여부 확인 필요"* | 🔴 **`SENTRY_DSN` 미설정 확정.** `DISCORD_WEBHOOK_URL` 은 여전히 판정 불가 — **어느 readiness 목록에도 없어 관측 수단이 없다**(이게 진짜 문제) |
| **A3 장애 인지** | *"env 확인이 전제"* | 🔴 그 전에 **`/admin/system-monitoring` 게이트 탭이 열리지 않는다**(§4.1). 장애를 보는 화면부터 고장 |

### 5.2 추가되어야 할 코드 밖 의존

| # | 항목 | 막는 것 | 푸는 사람 |
|---|---|---|---|
| **X10** | 🔴 **`worker-deploy.yml` 스케줄 PUT 이 매번 거부** (`invalid cron string: 0 20 * * 0`) — 초록불 뒤에 숨음 | **cron 등록 전체.** X9 를 대시보드에서 고쳐도 이걸 두면 원인이 남는다 | 🤖 세션(표기 수정) + 👤 대표(대시보드 대조) |
| **X11** | 🔴 **`gb_engine_enabled` 활성 절차 부재** — `platform_settings` 키 없음 + 클라 플래그 하드코딩 false + `OPS_GATES` 미등재 | **O5·C3·세션 ①의 실효** | 🤖 세션(게이트 등재) + 👤 대표(활성 결정) |
| **X12** | 🔴 **`DATA_ENCRYPTION_KEY` 미설정** — 카카오 토큰 평문 저장 | 보안(파일럿 전 필수) | 👤 대표 |
| **X13** | 🟡 **`BACKUP_BUCKET` 미바인딩** — 워커 주간 백업 불가(현재 실질 백업은 `d1-backup.yml` GitHub Actions 수요일分) | 재해복구 | 👤 대표 |

### 5.3 완료 판정 기준 자체에 넣을 규칙

> **각 여정 단계의 green 조건에 "실행 증거의 형태"를 함께 적는다.** 지금 체크리스트는 *누가 판정하는가*는
> 적었지만 *무엇이 남아야 통과인가*는 안 적었다. 예:
> - O7 픽업 → *"`voucher_transactions.used_at` 이 채워진 행 1건 이상"* (현재 0)
> - O8 정산 → *"`payouts` 에 `status='sent'` 행 1건 이상"* (현재 전건 0)
> - C4 결제 → *"`orders.status='DONE'` 이 당일자로 1건"* (현재 최신 2026-03-31)
>
> 이렇게 적으면 다음 세션이 **화면을 안 열어도** 같은 판정을 재현할 수 있고, "코드가 있으니 됐다"로
> 미끄러지지 않는다.

---

## 5.4 후속 실측 (2026-07-31)

감사 이틀 뒤 같은 방법(하트비트 + 부수효과 행)으로 재측정한 결과. **판정이 바뀐 것과 새로 보인 것만** 적는다.

| 항목 | 07-29 판정 | 07-31 실측 | 변화 |
|---|---|---|---|
| `0 18` 결측 | 원인 미규명·관측 유지 | **07-29·30 연속 정상**(하트비트 15작업 + `ledger_mismatch` 행 양쪽) | 격상 사유 소멸. 원인은 여전히 미규명 |
| `0 19` | ⚪ 등록됐으나 미측정 | `reconciliation`·`influencer-payout` 07-30 19:00 `ok` | 실행 증거 확보 |
| 등록 목록 | 대표 화면 1회 | 하트비트 `cron` 필드가 **독립 확인** — 정확히 3개 | 확정 |
| env/바인딩 | `security_missing` 2 · `infra_missing` 3 | **동일**(대시보드 작업 미착수) | 변화 없음 |
| 주문 | `orders_24h = 0` | 동일 | 변화 없음 |

### 새로 보인 것 두 가지 (둘 다 오픈 차단 아님)

**① `/admin/login` 부팅 실패 6건 — 07-30 16:15~16:16 UTC(KST 07-31 01:15), 약 1분 창**

`[boot-stuck] reason=entry-stalled chunkSeen=false entryRan=n t=13010~22865ms`. 첫 건은
`?error=session_superseded`, 이후 3건은 `__cb=`(청크 자가복구가 캐시버스트 재시도를 했다는 뜻) — **재시도해도 안 풀렸다.**

- 배포 경합 아님: 그 시각 전후 배포 없음(마지막 main 배포 07-29 17:43).
- 청크 유실 아님: 지금 `/admin/login` 이 참조하는 **18개 자산 전부 200**, HTML 은 `cache-control: no-cache`.
- ⇒ **판정 불가.** 서버측 원인의 증거가 없다. 무엇이 판정하는가: **다음 발생 시 `lastErr` 값과 브라우저/네트워크.**
  1분 창에서 자체 종료됐고 14시간째 재발 없어 지금 팔 근거가 없다. **재발하면 그때가 조사 시점이다.**

**② 유어애즈 레인 대량 실패 — 07-31 00:00~06:00 에 14개 레인 `err=Error`**

`ads:collect*`·`ads:enrich*`·`ads:maintenance(merge/reextract/quality/reclassify)`·`ads:sheets-sync`·`ads:match-registry`.
07-29 에는 같은 레인들이 `ok` 였다. **별도 `ur-ads` 워커**라 방배 오픈 경로와 무관하고, 이 감사의 범위 밖이다.
다만 `ok=false` 만 있고 **예외 원문이 하트비트에 안 남아** 여기서는 원인을 못 짚는다 —
Observability Logs 가 꺼져 있는 것이 여기서도 같은 방식으로 발목을 잡는다.

---

## 6. 다음 세션의 첫 액션 (순서 고정)

> ✅ 1·2·3①·4 는 처리됐다(아래 취소선). 남은 것만 보면 된다.

1. ~~`wrangler.toml` 의 `0 20 * * 0` 표기 교정~~ → **0단계로 처리(2026-07-31)**: 선언을 실측 등록분 3개와
   일치시켜 거부 문자열을 제거했다. **발화 목록은 안 바뀐다**(같은 값을 PUT). 남은 판정은 하나 —
   **`worker-deploy` 실행 로그에 `✅ 완전 성공 (스크립트 + 스케줄)` 이 뜨는가.** 이게 뜨기 전까지
   이후 단계는 전부 추정 위에 있다. 뜬 뒤에야 1단계(백업) 점화.
2. ~~`worker-deploy.yml` 의 "스케줄 실패도 성공" 분기~~ → **실패로 전환 완료**(수동 실행 시
   `allow_schedule_drift` 로만 우회 가능).
3. ~~① Trigger Events 목록 원문~~ **수령·확정**(3개). 남은 것: ② `DISCORD_WEBHOOK_URL` 등록 ③ Toss 웹훅 URL 목록.
4. ~~`ops-status` 중복 라우트 정리~~ → 완료(`ops-snapshot` 으로 분리 + `admin-route-collision.test.ts`).
5. **여기부터가 남은 것**: 대표 대시보드 세션(키 2개 + 웹훅 + 버킷 바인딩 + Observability Logs) →
   `env-readiness` 로 확인 → 세션 ①(#844) staging.

---

## 7. 이번 감사에서 내가 틀렸던 판단 (다음 세션이 반복하지 말 것)

1. **`*/5` 하나뿐이라고 먼저 결론지을 뻔했다.** 하트비트만 보면 그렇게 보인다. `frontend_errors` 의
   `ledger_mismatch` 타임스탬프가 `0 18` 의 발화를 증명했다 — **하트비트 창이 짧으면 부수효과 행이 더 긴
   역사를 갖고 있다.** 관측 도구가 없으면 *그 작업이 남기는 흔적*을 찾아라.
2. **`payouts: []` 를 처음에 "정산 0"으로 읽었는데, 그 엔드포인트의 기본 필터가 `status=pending` 이었다.**
   `?status=all` 로 다시 물어야 "전건 0"이 된다. **빈 배열을 보면 필터부터 확인할 것.**
3. **서버 라우트 충돌 자동 스캔이 4건을 뱉었지만 3건이 오탐**이었다(클라 훅의 URL 문자열, `/tools` 프리픽스로
   실제 경로가 다른 것). **마운트 프리픽스를 안 세면 이 스캔은 거짓말을 한다.**

---

## 구현 로그

- 2026-07-29 신설 — 대표 지시 *"실행 증거로 판정"* 감사 결과. **코드 변경 0.**
  근거: 라이브 어드민 API(`cron-heartbeats`·`ops-status`·`env-readiness`·`payouts`·`settlement`·
  `vouchers/transactions`·`_errors/recent`·`alimtalk`) · GitHub Actions 로그(`worker-deploy` job 90511842898) ·
  09:00 UTC 실시간 하트비트 스냅샷.
