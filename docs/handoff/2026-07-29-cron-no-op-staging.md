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
**무효 표기 완료** — 그 절을 믿고 "토큰 살아 있다" 전제하지 말고 `verify` 로 먼저 확인할 것.

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
- 🐞 **`cart.store.ts:89 clearCart` 의 호출처가 코드 전체에 0건** — 결제 **성공** 후에도 장바구니가
  안 비워진다. 현행 라이브 버그(신규 몰 무관). 실패 후 재시도가 되는 것도 같은 원인의 부작용.
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
