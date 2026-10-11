# 2026-10-11 — 도매몰(유통스타트) 철거

**[E2]** (작성됨 + 검증됨 — tsc 0 · 가드 21 + 주입 8 되돌려-검증 · pre-push 게이트 가드 100 + 시험 277.
E3 는 머지·배포 후. PR **#1710**(draft) — ⚠️ **업로드 413 수리와 같은 브랜치**라 머지하면 둘이 함께 들어간다.)

대표 지시: **"도매몰 잔해들은 아예 다 삭제해줘"** (그 앞 지시: *"도매 제조사는 뭐야? 도매몰 안한다니까"*)

## 1. 다음 세션의 첫 액션

1. **대표 판단 대기 셋** — 코드 밖이라 세션이 못 한다:
   - `role='wholesale'` 어드민 계정 **4개** (철거 후 빈 콘솔을 본다) → 비활성화할지
   - `utongstart.com` 도메인 — **두 Pages 프로젝트 어디에도 안 붙어 있다**(실측). 레지스트라 쪽 정리
   - `ur-wholesale` Pages 프로젝트 삭제
2. **DB 테이블은 존치**(계획 §3 — 회계 증빙). 지우는 것은 회계·세무 판단이 끝난 뒤 별건.
3. **공구 서비스(운영자 몰)는 손대지 않았다** — 대표가 *"공구는 유어딜에서 제품 공구 서비스 확장할 때
   필요하려나?"* 로 되물어 **결정 대기**. 실측·권고는 아래 §5.

## 2. 머니 게이트 — 실측으로 닫혔다 (삭제의 유일한 선행)

계획서 §4 가 *"예치금·미확인 충전·미지급 정산·plus 가 전부 0 임을 확인한 뒤"* 로 못 박았고, 재 봤다:

| 항목 | 값 | 판정 |
|---|---|---|
| `wholesale_deposits` | 172,800원 (seller 5·13) | 🟢 **그 두 셀러가 존재하지 않는다**(`sellers WHERE id IN (5,13)` → 0행) |
| `wholesale_deposit_requests` | 2건 **전부 confirmed** | 🟢 미확인 0 |
| `supplier_settlements` | pending 1건 10,000원 | 🟢 테스트 주문 2건과 **같은 시각**(2026-06-29 05:20:5x) |
| 판매사(`is_distributor=1`) | **0명** | 🟢 |
| 도매 주문 | 2건, 마지막 2026-06-29 | 🟢 |

⇒ 남의 돈이 아니라 **테스트 한 번의 잔재**. 대표 2026-08-03 *"아예 사업을 안했거든"* 과 일치한다.

🩸 **단, 계획서는 그걸 "예치금이 애초에 발생하지 않았다" 고 적어 뒀는데 DB 에는 행이 있다** — 문장이
틀린 게 아니라 *행이 있어도 주인이 없다* 가 정확하다. 재 보지 않고 문서만 믿었으면 "남의 돈 있음" 으로
오판해 멈췄거나, 반대로 확인 없이 지웠을 것이다.

## 3. 한 일 (삭제 **177파일** · −37,367줄 — `ebd463c6` 실측)

| 범위 | 내용 |
|---|---|
| 라우트 | `mount-wholesale.ts` 삭제 + `worker/index.ts` 의 `__INCLUDE_WHOLESALE__` 마운트 블록 제거 |
| `features/supply` | 도매 라우트 **50파일** 삭제 (68 → 19) |
| 화면 | `pages/Wholesale*`·`Supplier*`·`wholesale-catalog/`·`wholesale/`·`supplier-dashboard/`·`components/wholesale/` |
| 어드민 | 도매 페이지 20 · nav 밴드 3 · `admin.routes.tsx` Route 블록 21 · `AdminProductsPage` 도매 탭 2 |
| 앱 | `App.tsx` 1,112 → **982줄**(lazy 27 · 라우트 42줄 · 도매 로더 · utongstart SPA 가드) |
| 빌드 | `build-worker.js` 의 `WHOLESALE_BUNDLE` env → **상수 false**(define 자체는 남긴다 — 아래 ⚠️) |
| 테스트 | 주체가 사라진 8개 삭제 · 계약 3개 재조준 · 머니 불변식 재조준 · 고아 주입 1 제거 |

⚠️ **`__INCLUDE_WHOLESALE__` define 은 지우지 말 것** — `worker/index.ts` 가 `declare const` 로 쓰고 있고,
define 을 빼면 esbuild 가 식별자를 남겨 **런타임 ReferenceError** 다. 게다가 그 식별자가 **cron no-op
게이트의 항**이고 극성이 걸려 있다("`=== true` 만 no-op, 느슨하면 소비자 cron 사망"). 게이트는 무접촉.

## 4. 🔴 남긴 것 — 지우면 소비자가 깨진다

가드 `src/tests/unit/wholesale-teardown-2026-10-11.test.ts` (21건, 주입 8)가 **양방향**을 고정한다.

| 남긴 것 | 왜 (실측 호출부) |
|---|---|
| `supply-settlement.ts` | `order-commissions.ts`(주문확정) · `order-refund.ts`(환불) · `daily-lane.ts` |
| `supply-visibility.ts` | `cache-prewarm.ts` · `admin-products.routes` · `seller-orders.routes` |
| `wholesale-deposit-core.ts` · `supplier-withdrawal-core.ts` | `scheduled.ts` 매시간 |
| `wholesale-helpers.ts` (`computeWholesaleOnly`) | `/api/seller/surface` — **겸업 lock-out 방어선** |
| `wholesale-settlement.ts` (`loadPlatformCommissionPct`) | 소비자 어드민 상품 |
| buyer 풀 6 · maker 풀 4 | `scheduled.ts` cron · **`worker-ads/index.ts`**(유어애즈가 쓴다) |
| 몰 인프라(`wholesale-malls*`·`features/mall`) | 🏪 **공구 서비스** — 이름만 wholesale 이다 |

🏭 **`maker-pool` 은 유어애즈 밴드로 이사시켰다** — 종전엔 `mount-wholesale`(도매 번들)에만 마운트돼
**소비자 배포에선 이미 죽은 링크**였다. worker-ads 가 `ad_company_leads` 를 계속 수집하는데 볼 화면이
도매 밴드와 함께 사라지면 "수집은 돌고 아무도 모르는" 상태가 된다 ⇒ `/api/admin/maker-pool` 을
`worker/index.ts` 에 마운트 + nav 를 `buyer-pool` 옆으로.

## 5. 🏪 공구 서비스 — 대표 질문에 대한 실측 답 (결정 대기)

대표: *"공구는 유어딜에서 제품 공구 서비스 확장할 때 필요하려나?"*

**이 레포엔 "공구" 가 둘이고 그게 답을 가른다**:

| | 무엇 | 규모 | 상태 |
|---|---|---|---|
| ① 유어딜 자체 공동구매·이용권 | `/pass/:id` · 동네딜 · 결제·정산 | **41파일 13,135줄** | 본진 |
| ② 공구 서비스(운영자 몰) | 업주가 `urdeal.kr/{슬러그}` 에 자기 간판 | **3,256줄** | 몰 3개 중 열린 건 `test` 하나 = **운영자 0명** |

- *"유어딜이 제품(배송형) 공동구매를 판다"* → ① 을 넓히는 일. ② **불필요**
- *"업주마다 자기 이름의 몰에서 판다"* → ② 가 **정확히 그것**. 재작성하면 멀티테넌시 격리 규칙
  (예약어 표 · `consumer_path=0` fail-closed · 서버가 몰을 확정해 IDOR 파라미터 자체를 없앤 설계)까지 다시 설계해야 한다

**권고: 남긴다.** 런타임 비용이 **0** 이다 — 소비자 실제 라우트는 전부 `RESERVED_SLUGS` 에 있고 CI 가
`라우트 ⊆ 예약어` 를 강제하므로 **기존 소비자 트래픽은 몰 DB 조회를 한 번도 타지 않는다**. 게다가
`consumer_path=0` 이 기본이라 열린 손님용 몰도 없다. 삭제는 1분, 재작성은 며칠(비대칭).

## 6. 🩸 이번에 내가 틀린 것 **다섯** (ⓐ~ⓔ — 전부 가드가 잡았다)

### ⓐ 이름으로 분류했다 — 유어딜 화면을 지웠다
`SellerRegisterSupplierPage.tsx` 를 "Supplier" 라는 이름만 보고 도매로 분류해 삭제했다. 실제로는
**유어딜 사업자 유저 가입**(사업자등록 → 판매 승인) 화면이고, 이름은 옛 라우트 `/seller/register/supplier`
에서 온 것이다. 파일 머리말 자체가 *"단위 시험이 아직 참조해 남긴다"* 고 적어 뒀다.
**주입 앵커 검사(`check-stale-mutation-anchors`)가 잡았다** — 그게 없었으면 유어딜 가입 가드 9건이
조용히 사라졌다. 복원했고 같은 오판 방지 단언을 가드에 넣었다.

> 🧭 **반대 방향도 같다**: `wholesale-malls.ts` 는 이름이 도매인데 **공구 서비스**다.
> 이 철거에서 분류 기준은 **이름이 아니라 호출부**다.

### ⓑ 측정기가 자기 자신을 셌다
커밋이 끝났는지 보려고 `pgrep -f '.git/hooks/pre-commit'` 를 썼는데 **그 패턴을 담은 내 모니터 프로세스**에
걸려서 몇 분 동안 "훅 진행 중" 으로 오판했다(커밋은 이미 끝나 있었다). 같은 날 깊이 계산기도
자기닫는 `<Route />` 를 열림으로 세서 가짜 불균형을 보고했다.
> 🧭 **측정값이 이상하면 먼저 측정기를 의심할 것** — 이 레포가 반복해 당하는 클래스다.

### ⓓ 한 줄에 여러 `<Route>` — 결재함 라우트 셋을 삼켰다
`admin.routes.tsx` 에 `} /><Route .../><Route .../>` 로 **세 라우트가 한 줄에** 있어서 블록 끝 탐지가
무너졌고, 도매 라우트를 지우며 `/admin/decisions`(결재함) · `/admin/platform-model` · `/admin/proposals`
를 함께 삼켰다. **`admin-nav-classification` R3 이 잡았다.** 복원 + 그 자리에 경고 주석을 남겼고,
`6f839da0` 대비 **라우트 셋 전수 대조**로 다른 손실이 0 임을 확인했다.
> 🧭 **한 줄에 `<Route>` 를 여러 개 두지 말 것** — 사람이 읽기도 어렵고, 줄 단위로 도는 도구가
> 전부 오작동한다(이 레포의 가드·코드모드는 거의 다 줄 단위다).

### ⓔ 감싸는 div 까지 지웠다 — 그리고 **pre-push 게이트는 타입체크를 안 한다**
`AdminOrdersPage.tsx` 의 도매 링크를 지우며 **레이아웃 컨테이너 `<div>` 까지** 지워 `</div>` 가 고아가 됐다.
**pre-commit tsc** 가 잡았다.
> 🔴 **중요**: 그때 **pre-push 게이트는 초록이었다**(가드 100 + 시험 277 통과). 게이트는 **타입체크를 안 한다.**
> 둘은 짝이다 — **커밋이 tsc, 푸시가 가드.** 게이트만 돌려 보고 "안전하다" 고 판단하지 말 것.

### ⓒ 그리고 가드가 지키는 척하는 것도 주입이 잡았다
내 새 가드가 `computeWholesaleOnly` 를 **이름으로만** 찾아서, 같은 이름의 지역 상수로 바꿔도 통과했다.
지키려던 것은 이름이 아니라 **import 배선**이라 경로로 재조준했다.

## 7. 검증

- `tsc` **0** · 신규 가드 21 + 주입 8 **전부 빨간불 확인** · 앵커 2,893건 실재
- 재조준 가드 전부 통과: `admin-nav-wholesale-teardown` 13 · `wholesale-invariants` 3 · 계약 3파일 11
- `check-platform-model-sync` GREEN(두 SSOT 문서 동반 갱신)

⚠️ **E4 는 배포 후**: `/wholesale` · `/supplier` 가 404(또는 SPA NotFound)인지 · 어드민 nav 에 도매 항목 0 ·
소비자 결제 1건이 정상인지(정산 엔진이 남아 있으므로 회귀 가능성은 낮지만 그게 이 철거의 유일한 위험이다).

## 7-b. 🔀 머지 충돌 — main 의 새 에이전시 콘솔과 겹쳤다

푸시 뒤 PR 이 **`mergeable_state: dirty`** 였다. 그 상태면 GitHub 이 머지 커밋을 못 만들어
**`pull_request` 워크플로가 디스패치조차 되지 않는다** — Verify 가 실패가 아니라 **부재**가 되고
PR 화면엔 `Cloudflare Pages ✅` 하나만 남아 훑어보면 통과처럼 보인다(CLAUDE.md 방어선 표의 그 항목).

충돌 3건, 전부 해소:
1. `src/routes/admin.routes.tsx` — main 이 도매 화면 **넷**(`AdminWholesaleActivityPage` ·
   `AdminWholesaleOrdersPage` · `AdminWholesaleProposalsPage` · `AdminWholesaleProductsPage`)과
   **비도매 신규** `AdminAgencyAccountsPage`(`/admin/agencies` — 유어딜 중개사 콘솔, 옛 `agencies`
   2026-09-04 일몰과 **다른 것**)를 **같은 hunk 에** 더했다. ⇒ 도매 넷은 철거, 에이전시는 남겼다.
   **나란히 왔다고 같은 서비스가 아니다** — §6-ⓐ 와 같은 클래스의 함정이다.
2. `docs/proposals/00-service-overview-and-coverage.md` — 집계 숫자표. **양쪽 숫자가 모두 낡았으므로**
   손으로 고르지 않고 `node scripts/generate-proposal-refs.mjs` 로 재생성.
3. `src/features/guides/api/auto-reference.ts` — 생성물. `npm run generate:guide-refs`(`wholesale: 0 pages`).

⚠️ **main 이 움직일 때마다 다시 난다**(이 레포는 세션이 여러 개 동시에 돈다).
푸시 전 `node scripts/check-github-side-merge.mjs` 로 사전판정할 것 — `git merge-tree` 가 clean 이라고
해도 **GitHub 이 clean 이라는 뜻이 아니다**(커스텀 머지 드라이버는 로컬에만 먹는다).

## 8. ⏭️ 남은 잔해 — **머니 코드 수술이라 별건으로 남겼다**

`features/supply/api/wholesale-settlement.ts`(385줄)의 export 9개 중 **살아 있는 호출부는 둘뿐**이다:

| export | 살아 있는 호출부 |
|---|---|
| `loadPlatformCommissionPct` | `admin-products.routes.ts` |
| `splitWholesaleUnit` | `lib/distributor-pricing.ts` |
| 나머지 **7개**(`creditSupplierOnWholesaleOrder`·`reverseSupplierOnWholesaleRefund`·`holdWholesaleSettlements`·`reconcileWholesaleHolds`·`wholesaleSettlementAvailableAt`·`mallCommissionPctOverride`·`loadMallCommissionPct`) | **없음** (테스트만 참조) |

그리고 `lib/distributor-pricing.ts` 는 `worker/cron/wholesale-grade-eval.ts`(도매 등급 평가 **cron**)가
아직 참조한다 — 그 cron 이 등록돼 있는지 **확인하지 않았다.**

**왜 지금 안 했나**: 머니 경로 수술이고, 긴 세션 끝에 하면 오늘 내가 이미 한 오분류
(`SellerRegisterSupplierPage`)를 또 만든다. 다음 세션이 **단독으로** 할 것:
① `wholesale-grade-eval` cron 이 실제로 도는지(`cron_hb:` 하트비트 확인) ② 죽은 export 7개와
그 테스트 정리(살아 있는 둘은 작은 모듈로 추출) ③ `wholesale_claims` 를 `KNOWN_TABLES_EXTRA` 에
등록했는데(이번 커밋), 그 테이블을 읽는 코드가 ②에서 사라지면 **그 등록도 함께 빼라**.

## 9. 머니 불변식 재조준 — 종전보다 강해졌다

`wholesale-invariants.test.ts` 의 *"정산 성숙은 소비자 cron 에서만"* 이 **한 파일 하드코딩**
(`wholesale.routes.ts`)이라 그 파일이 사라지며 ENOENT 로 터졌다 — 그 테스트 자신의 주석이
*"경로 하드코딩 클래스"* 를 경고하고 있었다(두 번째다). ⇒ 트리를 훑어 **`*.routes.ts` 전수**에서
`matureSupplierSettlements` 호출을 센다(허용목록 밖이면 빨간불, 0건이면 통과가 아니라 고장).
