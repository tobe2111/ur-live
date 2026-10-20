## 🔴 2026-07-29 — **도매 번들 cron no-op 게이트 (머니 경로, staging 검증 대기)**

대표 승인: *"gb 가격 배선보다 먼저. GMV 0 인 지금이 머니 경로를 실수해도 피해가 0 인 유일한 창이고,
8월부터는 같은 작업이 실위험 작업이 된다."*

**문제(구조)**: 소비자·도매가 **같은 entry `src/worker/index.ts` 를 두 번 빌드**하고 그 entry 가 `scheduled` 를
export → 도매 번들도 cron 핸들러를 그대로 실었다. 도매 Pages 에 cron 이 걸리면 `matureSupplierSettlements`·
예치금/출금 reconcile 이 **이중 실행 → 이중 지급**. 기존 방어는 "대시보드에서 설정 안 함" 뿐이었다.

**수정(1줄 + no-op 함수)**: `scheduled: __INCLUDE_WHOLESALE__ === true ? wholesaleCronNoop : handleCronScheduled`
**정산 로직 무접촉 — 실행 주체만 가름.**

> ⚠️ **극성이 이 변경의 전부다.** 최대 위험은 도매가 아니라 **소비자 cron 이 조용히 죽는 것**.
> `=== true`(도매 확실)일 때만 no-op, define 미치환/undefined/문자열은 **전부 실제 핸들러로 폴백**
> (최악 = 현행 동작). 느슨한 `__INCLUDE_WHOLESALE__ ?` 로 바꾸지 말 것 — 가드가 빨강.

**양방향 검증(빌드 산출물 실측)**:
- 소비자: no-op 마커 0 · 정산성숙 심볼 3 · **게이트 없음/있음 번들 바이트 동일**(`20ced382e72e0053`) → 회귀 0
- 도매: no-op 마커 1 · default export `scheduled:<no-op>` 바인딩 확인
- 되돌려-검증: 극성 반전 → 빨강 / 느슨한 truthiness → 빨강 / 복원 green

**가드**: `wholesale-cron-gate.test.ts`(극성·분기·무음금지·로직무접촉 5검사).

### ✅ staging 검증 결과 (2026-07-29, PR #829 머지 `e8e29c8` 배포 후 실측)

**① 소비자 cron 생존 — 확인됨.** 배포 감지(`/api/version` `index-Cnt2hP-3.js` → `index-DHLNQdeB.js`) 후
`/api/_healthcheck/cron` 의 `latest_heartbeat_at` 이 **04:01:54Z → 04:05:53Z 전진**, `ok=true` ·
`stale=[]` · `missing=[]`(하트비트 기록 26건). **게이트가 소비자 cron 을 죽이지 않았다.**
> ⚠️ **남은 1건**: `supplier-settlement-mature` 는 **일 1회(`0 18 * * *`)** 분기라 배포 후 아직 미발화 —
> 하트비트 목록에 없는 이유가 그것이다(**관측 밖이 아님**. `scheduled.ts:298` 에서 `safeCron` 정상 경유).
> **18:00 UTC 이후** `/api/admin/cron-heartbeats` 에서 `supplier-settlement-mature` 등장 확인이 남는다.
> ⇒ 이번에 한 번 오판했다: 목록에 없길래 "관측 밖"으로 읽었으나 실제로는 주기 문제였다.

**② 도매 cron no-op — 코드 레벨 증명 완료 / 플랫폼 부착 미검증.**
빌드 산출물을 Node 에서 직접 `scheduled()` 호출(`env.DB` = 접촉 시 throw 하는 Proxy):

| 번들 | no-op 로그 | DB 접촉 |
|---|---|---|
| 도매(`WHOLESALE_BUNDLE=1`) | `[wholesale-cron-gate] skipped cron…` | **없음** |
| 소비자(대조군) | 없음 | **있음 — `[cron:supplier-settlement-mature]`** |

⇒ 하네스가 차이를 실제로 감지(무음 통과 아님) + **게이트가 없었으면 도매에서도 정산이 돌았다는 직접 증거**.
미검증분은 *"cron trigger 부착 시 Cloudflare 가 배포된 scheduled export 를 호출하는가"* 하나 —
**우리 코드가 아니라 플랫폼 동작**이다.

**🔴 ②의 플랫폼 부착 = 보류(2026-07-29 대표 판단). 순서가 바뀌었다.**

- **CF 토큰은 이 용도로 제공하지 않는다** — 프로덕션 cron 부착은 **대표가 대시보드에서 직접** 하고 즉시 제거.
  토큰 재발급은 **D1 읽기 전용**으로 별건 유지(§B.12).
- **부착은 예치금 숫자 확보 후**. ⚠️ 이전에 세션이 *"GMV 0 이라 지금이 창"* 이라고 한 것은 **너무 넓은 논거였다** —
  cron 에는 정산 성숙만 있는 게 아니라 **매시간 분기(`0 * * * *`)에
  `wholesale-deposit-reconcile`·`wholesale-withdrawal-reconcile`** 이 있고, 그중
  `reconcileOrphanedDepositOrders` 는 조회가 아니라 **환불(`refunded`)** 을 수행한다(판매사 예치금 잔액을 실제로 씀).
  **GMV 0 은 주문에서 성숙하는 공급자 정산에만 해당**하고, 예치금은 선불로 이미 들어와 있어 GMV 와 무관하다.
  잔액을 모르는 채 부착하면 폭발반경이 미지수다.

**확정 순서**: ① 18:00 UTC 이후 `supplier-settlement-mature` 하트비트 확인 → 예치금 숫자 확보 →
② 부착(대표 직접, 즉시 제거) → **gb 가격 결제 배선**(머니 경로 → 단독 세션).

### ➡️ (이전 기록) staging 검증 계획
1. 🔴 **소비자 cron 정상 발화**(이게 훨씬 중요) — 하트비트 갱신이 가장 빠른 판정.
   `/api/admin/system-monitoring` 의 cron 하트비트가 계속 최신인지. **멈추면 즉시 롤백**(아래).
2. 도매에 cron 을 시험 삼아 걸었을 때 정산이 **안 돌고** `[wholesale-cron-gate] skipped cron` 로그만 남는지.

**롤백**: `src/worker/index.ts` 의 삼항을 `scheduled: handleCronScheduled,` 로 환원(1줄).

> ⚠️ **이번에 틀렸던 판단(기록)**: 머지 후 재검증에서 `git stash push src/worker/index.ts` 를 썼는데
> **이미 커밋된 상태라 stash 가 비었고**("No stash entries found") 같은 소스를 두 번 빌드해 비교했다 —
> 그 실행은 **무효**였다. 게이트를 실제로 제거한 소스로 다시 빌드해 재확인함. 위 sha 는 재실행 값.
> ⇒ 번들 비교 검증은 **"비교 대상이 실제로 달랐는지"를 먼저 확인**할 것.

### 🧊 픽업 공구 = **문서 동결**(2026-07-29 대표 지시)
설계는 여기서 멈춘다. **다음 작업은 `gb 가격 소비자 결제 경로 배선`(§7 순서 ①)으로 전환.**
🔴 **머니 경로 → 단독 세션 + staging 실결제 필수.** 이 세션에서 이어서 시작하지 말 것.
- 문제: `resolveGbPricing` 이 마켓플레이스 표시·어드민 조종석·셀러 저장 3곳에만 있고 **소비자 구매 경로엔 없다**
  → 공구가가 결제에 안 붙는다. 이걸 먼저 안 하면 픽업 공구를 만들어도 값이 안 실린다.
- 착수 시 §7.2 3줄 보고: (a) 어느 레일 (b) 머니 경로 접촉 (c) 롤백 방법 → **보고 후 바로 진행**(대기 X)

### ➡️ 그 전에 받을 것 — **대표가 넘길 예치금 숫자**
조회 경로는 **②로 확정**: 대표가 도매 어드민 `/admin/wholesale-overview` 의 `deposit_liability` +
`pending_charge_requests` 를 직접 확인해 전달한다(코드 0). **③ 진단 엔드포인트는 만들지 말 것**(대표 명시).
이 환경에선 CF D1 API(토큰 무효)·소비자 배포 어드민(404, 도매 라우트 DCE)·도매 호스트(프록시 차단) 전부 막혔다.
**숫자를 추정하지 말 것.** 필요: `balance>0` 계정수 · `SUM(balance)` · 최대잔액 · `pending` 충전요청수.

**숫자 받은 뒤 동결 순서(대표 확정 — 이 순서 고정)**:
`① 신규 충전요청 차단 → ② pending 전건 처리 → ③ 잔액 소진·환급 → ④ 기능 OFF`.
🔴 **게이트 선차단 금지** — ④를 먼저 하면 ②③ 경로가 같이 닫혀 **판매사 잔액이 회수 불가로 갇힌다.**

**CF 토큰**: 예치금과 **별건**. 재발급하되 **D1 읽기 전용 최소 스코프**(§B.12). CLAUDE.md 의 07-28 실측 기록은
~~**무효 표기 완료**~~ → ✅ **2026-08-02 해소**: 대표 재발급으로 토큰이 살아났다(`verify` success/active,
D1·Workers·Pages 조회 OK). 절차는 그대로 — 쓰기 전에 `verify` 로 확인할 것.

> ⚠️ **이번에 틀렸던 판단**: src 무변경 근거로 `git diff origin/main -- src/` 를 썼는데, **main 이 앞서면
> main 의 새 src 가 섞여 들어와 오염된다.** 정확한 기준은 `git diff $(git merge-base origin/main HEAD)..HEAD`.
> 결론은 같았지만 근거가 틀렸다.
>
> ⚠️ **CF 토큰 상태 정정**: CLAUDE.md "☁️ Cloudflare API 접근" 절차대로 D1 에서 꺼냈으나 **토큰이 죽어 있다.**
> 그 절의 실측 기록(워커 목록 조회 성공 등)은 07-28 시점이고 **지금은 유효하지 않다.**

---

## 📋 2026-07-29 후속 — 기획 브리프 + 릴리즈 체크리스트 (코드 무접촉)

**대표 지시 1**: 기획자 첫 산출물 3건 승인. 순서 **1(몰 브랜딩) → 3(미수령 문구) → 2(수수료 문구)**.
- 3번은 **법무 초안까지**가 기획 범위. 최종 문구는 법무 확인 후, 그 전까지 코드엔 **임시 표기**
- 2번은 **정책을 대표가 먼저 정함 — 소비자에게 수수료 비노출**. 5% 는 소비자가 아니라 운영자(merchant)
  에게서 나가는 돈이라 소비자 화면 노출 실익 없음 ⇒ 과제를 **운영자향 안내 문구**로 좁힘
- 산출물: `docs/design/operator-mall-planner-brief.md`(신설) + 갭 문서 §6 에 표시 정책 확정 기록

**대표 지시 2**: *"서비스 100% 완성 — 완료 정의부터"*. 1단계는 **릴리즈 체크리스트 산출(코드 금지)**.
완료 = "코드가 다 됐다"가 아니라 **"운영자 가입→상품 등록→소비자 구매→픽업→정산이 막힘없이 돈다"**.
- 완료 선언 조건: 체크리스트 전 항목 green **+ 대표가 실계정으로 전 여정 1회 완주**.
  그 전엔 **"완료"라는 단어 금지**.

### 🔎 체크리스트 작성 중 나온 실측 (§8-D 를 정정한다)

- **`payouts-generate.ts:48,78`** — payout 생성이 이미 `merchant:%` 를 포함하고 `merchant → payee_type
  'store_owner'` 로 매핑한다 ⇒ **운영자 정산 파이프가 이미 존재**한다(신규 개발 아님).
- **`/seller/*` 대시보드가 62페이지·128엔드포인트**로 이미 완비 — `/seller/settlements`, `/seller/orders`,
  `/seller/scan`(QR 소각), `/seller/products/new`, `/seller/store-dashboard`(`StoreOwnerDashboardPage`) 전부 존재.
  ⇒ **세션 ⑤(운영자 대시보드)는 "신규 제작"이 아니라 "몰 스코프를 씌우는 일"**에 가깝다.
  §8-D 표의 *"운영자 대시보드 = 없음"* 은 **도매 대시보드 기준 서술**이었고, 소비자 셀러 레일 기준으로는 틀리다.

⚠️ 다음 세션이 §8-D 만 읽고 "대시보드를 새로 만들어야 한다"로 가지 말 것.

### 릴리즈 체크리스트 산출 (`operator-mall-release-checklist.md`) — 1단계 완료, 승인 대기

**운영 4축 실측에서 나온 것 (다음 세션이 오판하지 말 것)**:
- 🔴 **결제 실패 시 소비자에게 가는 알림이 0건.** `sendOrderNotification`(`webhook.routes.ts:40`)은
  이름과 달리 **Discord 임베드만** 보낸다. 주문자 전화번호를 조회해놓고(`:50`) 쓰지 않는다.
- ~~`cart.store.ts:89 clearCart` 호출처 0건 → 장바구니 미정리~~ → ✅ **정정: 틀렸다. 정상 동작한다.**
  실제 장바구니는 **서버측**(`/api/cart`·`cart_items`)이고 `PaymentSuccessPage.tsx:126·271` 이
  `POST /api/cart/clear` 를 `order_number` 와 함께 호출 → 서버가 **그 주문 상품만** 삭제
  (`cart.routes.ts:565`, 2026-06-12 에 이미 "전체 → 선택 삭제"로 수정됨). `cart.store.ts` 는
  헤더 뱃지 카운트 전용 잔존 스토어. ⚠️ **심볼 호출처 0건 ≠ 기능 부재** — 그 심볼이 그 기능의
  실제 경로인지부터 확인할 것.
- 🔴 **유일하게 작동하는 셀러 문의 경로가 도매 화면 위에 있다**(`wholesale_proposal_tickets` +
  `WholesaleBoardPage`). 철거하면 사라진다 ⇒ **철거 PR 전에 대안 택일 필요**(X8).
  소비자 셀러(`/seller/*`)엔 문의 접수 UI 가 **0건** — "관리자에게 문의하세요" 안내 텍스트뿐.
- 🟢 **운영자 셀프 환불은 이미 된다** — `SellerOrdersPage.tsx:226` → `refundOrderFully(expectSellerId)`.
  몰 주문이 소비자 `orders` 라서 그대로 붙는다. ⚠️ 단 **부분환불 UI 는 없다**(API 는 있음) —
  실온 미수령 3일 후 부분환불(C7)이 이걸 요구하므로 세션 ④ 범위.
- 🟡 알림 인프라는 배선돼 있으나 **`DISCORD_WEBHOOK_URL`·`SENTRY_DSN` 미설정이면 전부 무음**.
  `/admin/system-monitoring` 은 런타임 5xx 를 **안 보여준다**(cron·발송실패 전용) — 그건 `/admin/errors`.

**⚠️ 조사 프레임 함정**: 서브에이전트는 *"신규 몰 = 예치금 도매몰"* 로 읽어 결제실패·환불이
"신규 몰에 미적용"이라고 판정했다. **대표 확정은 신규 몰 = 소비자 orders + 카드 즉시결제**라
둘 다 **적용된다**. 이 정정이 작업량을 크게 줄인다 — 같은 오독을 반복하지 말 것.

**🔴 staging 자체가 미검증**: `STAGING_CHECKLIST.md` 12항목(S1~S4·P1~P8) **전부 `⬜ 미검증`** —
2026-07-05 신설 이후 **staging 으로 게이트를 닫은 전례가 0건**. 게다가 레포 안에 모순이 있다:
`scripts/deploy-staging.sh`(ur-live-staging 존재 전제) ↔ `prod-smoke.yml:4` 주석 *"staging 이 없어…"*.
⇒ 세션 ② 착수 전 **① 프로젝트 실존 ② 별도 D1 ③ Toss 테스트 키** 3가지를 대표가 확인해야 한다.

---

## 🔴 2026-07-29 08:30Z — **ur-live cron 트리거가 `*/5` 하나뿐일 가능성** (어드민 API 실측)

`GET /api/admin/cron-heartbeats` + `/api/admin/tools/settings` 직접 조회. **추측 아님. 단, 주장 범위를 좁힌다.**

추적 시작 `cron_hb_tracking_since = 2026-07-29T03:42Z`(≈4.7h 전) — 이 창 안에서만 판정 가능하다.

| cron 식 | 기회 | ur-live 하트비트 | 판정 |
|---|---|---|---|
| `*/5 * * * *` | ~56 | **10건** | 🟢 등록됨 (= **소비자 cron 생존 확인**) |
| `*/2 * * * *` | ~140 | **0** | 🔴 미등록 (결정적) |
| `0 * * * *` | 5 | **0** (같은 시각 ur-ads 는 22건) | 🔴 ur-live 미등록 (강함) |
| 일간·주간 | **0** | 0 | ⚪ **판정 불가 — 창이 짧다. 단정 금지** |

사실이면 안 도는 것: `toss-refund-retry`·`webhook-failed-drain`·`kt-alpha-voucher-retry`·
`wholesale-{deposit,withdrawal}-reconcile`(시간) / `auto-settlement`·`expired-voucher-refund`·
`supplier-settlement-mature`·`affiliate-mature`·`ledger-{integrity-check,reconcile}`(일간) /
**`payouts-generate`(주간 정산 지급)**·**`d1-backup`(주간 백업)**.

### 🩺 왜 안 보였나 — 하트비트 감시자의 사각지대
`cron-stale-watch`/`_healthcheck/cron` 은 **한 번이라도 뛴 작업이 멈췄는가**만 본다.
**한 번도 안 뛴 작업은 목록에 없어 `missing: []`** 로 나온다(실측). ⇒ *"기대 목록 vs 실제"* 대조가 없으면
**미등록 트리거는 영원히 안 보인다.** (가드로 환원 가능 — 코드의 `cron === '...'` 식을 파싱해 기대 목록을
만들고 하트비트와 대조. 다음 세션 후보.)

### ⚠️ 이 발견이 **직전 세션의 검증 계획을 고쳤다** — 다음 세션이 반복하지 말 것
번들 cron 게이트 검증 ①을 *"18:00 UTC 에 `supplier-settlement-mature` 하트비트가 없으면 롤백"* 으로
잡아뒀었다. **그 부재는 게이트 탓이 아니라 트리거 미등록 탓일 수 있다** — 그대로 했으면 **멀쩡한 게이트를
되돌릴 뻔했다.** 소비자 cron 생존은 **`*/5` 10건**으로 이미 확인됐으니 검증 ①은 그 근거로 **대체**한다.

### 다음 판정
`0 9 * * *` 이 **09:00 UTC** 에 발화 → 이후 하트비트에 `stay-reminder`·`appointment-reminder` 등장 여부로
일간 블록 정상/비정상 확정. 최종 판정은 **대표가 CF 대시보드 ur-live → Settings → Trigger Events** 확인.

### 부수 확인
- `platform_settings.cf_api_token` **여전히 죽어 있음** — `/user/tokens/verify` → `code 1000 Invalid API Token`
  (CLAUDE.md 기재는 code 10000 이었으나 실측은 **1000**). ⇒ D1 직접 조회 불가.
- **도매 배포는 이 환경에서 도달 불가** — `utongstart.com`·`ur-wholesale.pages.dev` 둘 다 프록시 CONNECT 차단(000).
  ⇒ 예치금 4숫자(X2)는 **구조적으로 대표만 확인 가능**하다(우회로 없음을 실측으로 확인).

---

## ✅ 2026-07-29 09:10Z — cron 판정 **종결** (CF API + 하트비트 교차확인)

대표가 읽기 전용 CF 토큰(Read 4스코프, 8/9 만료)을 발급 → **직접 조회로 확정**했다.
09:00 UTC 경과 후 하트비트 재조회에서 `0 9` 블록이 **하나도 안 나타나** CF API 결과를 **런타임이 독립 확인**.

### 확정 사실

| 항목 | 결과 |
|---|---|
| `ur-live` **Worker** cron | `0 18` · `0 19` · `*/5` — **3개** (누락 7) |
| 🔴 치명 누락 | `0 0 * * 1`(**payouts-generate 주간 지급**) · `0 20 * * 0`(**d1-backup**) · `0 * * * *`(환불재시도·자가복구·감시자) |
| 🔴 **캐리어 바인딩 5개뿐** | `DB`·`FRONTEND_URL`·`LIVE_STREAM`·`RATE_LIMITER`·`SCRAPER_URL` (Pages 는 env 63개) |
| staging | **`ur-live-staging` 없음** → X1 수행 불가 확정 |
| preview D1 | **= production**(`d9530ba6`) → 프리뷰 결제는 라이브에 쓴다 |
| 알림 | `DISCORD_WEBHOOK_URL`·`SENTRY_DSN` **어디에도 없음**(`VITE_SENTRY_DSN`은 클라 전용) |
| `ur-live-cleanup-cron` | 2026-02 워커가 `*/5` 로 **존재하지 않는 엔드포인트**(`/api/cleanup/expired-reservations`, 라이브 404)를 호출만 함. D1 미사용 → **삭제 안전** |

### ⚠️ 다음 세션이 오판하지 말 것

1. **"일간 블록도 안 돈다"는 틀렸다.** `0 18`·`0 19` 는 등록돼 있어 `auto-settlement`·
   `supplier-settlement-mature`·`ledger-*`·`influencer-payout` 은 **돈다.** 하트비트에 없던 건
   추적 시작(03:42Z)이 늦어서였다 — **"판정 불가"로 남긴 판단이 맞았다.**
2. **트리거보다 바인딩이 먼저다.** 캐리어 Worker 에 키가 없어 `toss-refund-retry` 는 트리거를 켜도
   환불을 못 하고, `cache-prewarm` 의 **SSR KV 워밍(2026-07-12 작업)은 `CACHE_KV` 부재로 한 번도 안 먹혔다**.
3. **하트비트 `ok:true` 를 성공으로 읽지 말 것.** 키 부재 작업은 조용히 조기반환/삼킴 → 성공으로 기록된다.
   `scheduled-cleanup` 이 실제 결과를 남긴 건 **DB 만 쓰기 때문**이다.
4. **`ur-live` 가 정확히 3개**인 건 무료 플랜 Worker 당 상한(3)일 가능성 — **확정 아님**(구독 조회는 권한 밖).
   4번째 추가 시도로 판명된다.

수습 순서(바인딩→알림→백업→자가복구→지급)와 Plan B: `docs/design/cron-trigger-remediation.md` §F.
**쓰기는 전부 대표 몫**(CLAUDE.md 토큰 규율 축소 — 조회 한정).

---

## 🔴 2026-07-31 06:2xZ — **내 판정 2건 정정** (백업 축은 살아 있었다)

대표가 건 후속 확인(*"백업 축 첫 발화 확인"*)에서 **내가 이 문서·`cron-trigger-remediation.md` 에 적어둔
서술 2개가 틀렸음**이 드러났다. 정정한다.

### 정정 ① — `d1-backup.yml` run **0건이 아니라 7건**

| run | 트리거 | 결과 |
|---|---|---|
| 07-29 20:43Z · 07-22 20:56Z · 07-15 20:51Z | `schedule` | **3회 연속 success** |
| 07-14 (×4) | `workflow_dispatch` | 3 실패 → 1 성공(초기 세팅) |

최신 run 의 산출물 확인: artifact **`d1-backup-20260729` 23.97 MB**, 만료 2026-10-27, `expired:false`.
⇒ **초록불만이 아니라 백업 파일이 실제로 존재한다.**

**왜 틀렸나**: 워크플로 run 을 **파일명(`d1-backup.yml`)** 으로 조회해 빈 결과를 받고 그대로 단정했다.
**워크플로 ID(`311101385`)** 로 조회하니 7건이 나왔다.
> 🧠 **조회가 비면 '없다'가 아니라 '내 조회가 틀렸을 수 있다'가 먼저다.**
> 부재는 존재보다 증명이 어렵다 — 오늘 하루에 이 클래스로 두 번(`clearCart` 0-caller, 이것) 틀렸다.

### 정정 ② — 워크플로 추가 시점 **07-28 이 아니라 07-11**

`git log --diff-filter=A` 가 짚은 **머지 커밋(07-28)** 을 파일 추가 시점으로 읽었다.
GitHub API 의 `created_at` 은 **2026-07-11**, 07-14 에 수동 검증(4회), 07-15부터 주간 자동.
⇒ *"첫 발화가 오늘(07-29) 저녁"* 이라는 서술도 틀렸다 — **그때 이미 3주째였다.**

> ⚠️ 두 오류가 **같은 방향으로 겹쳐** "백업이 한 번도 안 돌았다"는 그림을 만들었다.
> 하나만 틀렸으면 다른 하나가 반증했을 텐데, 둘 다 같은 결론을 지지해 **서로를 보강**했다.

### ✅ 교차검증 — `0 18`·`0 19` 는 **런타임으로도** 돈다

`GET /api/admin/cron-heartbeats` (07-31 06:2xZ):

| cron | 어제(07-30) | 표본 |
|---|---|---|
| `0 18 * * *` | 18:00:4xZ **15개 전부 `ok:true`** | `auto-settlement` · `supplier-settlement-mature` · `ledger-reconcile` · `ledger-integrity-check` · `expired-voucher-refund` · `affiliate-mature` … |
| `0 19 * * *` | 19:00:4xZ **2개 전부 `ok:true`** | `influencer-payout` · `reconciliation` |

⇒ CF API 의 *등록* 확인이 **실행 기록으로 확증**됐다. (07-29 판정 #1 이 옳았음도 재확인.)

### ⚠️ 하트비트 읽을 때의 함정 — **두 워커가 한 테이블을 쓴다**

`0 * * * *` 로 집계되는 **33건은 전부 `ads:` 접두사** = **`ur-ads` Worker** 의 시간당 트리거다.
`ur-ads` 와 `ur-live` 가 **같은 D1** 에 하트비트를 써서 한 목록에 섞인다.
이걸 `ur-live` 의 시간당이 도는 증거로 읽으면 **오진**이다 —
**`ur-live` 시간당 작업의 하트비트는 0건**이고, CF API 의 "`0 * * * *` 미등록"과 정확히 일치한다.

> 다음 세션은 하트비트를 볼 때 **`cron` 필드가 아니라 작업 이름의 소속**으로 워커를 갈라 읽을 것.

### 👉 수습 순서에 미치는 영향 — **백업 칸이 이미 green**

대표 승인 순서(**바인딩 → 알림 env → 백업 → 자가복구 → 지급**)에서 **백업 칸은 CI 경로로 충족**됐다.
순서를 뒤집자는 제안이 아니라 **한 칸이 이미 채워졌다**는 보고다.
⇒ 워커 트리거 다음 후보는 **`0 * * * *`**(`toss-refund-retry` · `cron-stale-watch` — **아무 경로도 없는 유일한 축**,
게다가 *다음 정지를 알아챌 감시자 자신*이 여기 묶여 있다). 단 **`TOSS_SECRET_KEY` 바인딩이 먼저**라는 원칙은 불변.

**여전히 대표 몫**: `ur-live-cleanup-cron` 삭제 → 바인딩(`CACHE_KV`·`TOSS_SECRET_KEY`·`ALIGO_*`·`VAPID_*`·`KT_ALPHA_*`)
→ 알림 env(`DISCORD_WEBHOOK_URL`·`SENTRY_DSN`, Pages·Worker 양쪽) → `0 * * * *` → `0 0 * * 1`(지급, 마지막).
