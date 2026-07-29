# 🧨 도매몰 전면 종료 — 철거 계획

> **결정(대표 2026-07-29)**: 도매몰(**유통스타트 id=1 · 메디스타트 id=2**)을 **하지 않는다.**
> 몰 인프라(`wholesale_malls` 멀티테넌시)는 **운영자 SaaS 로 전용**한다.
> **선행 문서**: [operator-mall-saas-gap.md](./operator-mall-saas-gap.md) · [wholesale-separate-deploy.md](./wholesale-separate-deploy.md)
> **상태**: 계획 · **코드 변경 0** · 착수 전 머니 게이트(§4) 통과 필요

---

## 0. 이 문서가 존재하는 이유 — 가장 큰 함정 하나

> 🔴 **`src/features/supply/**` 를 통째로 지우면 소비자 결제가 깨진다.**

디렉터리 이름이 `supply` 라서 "도매 전용"으로 보이지만 **아니다.** 55개 파일 중 상당수가
**소비자 worker 가 직접 import** 하거나 **도매와 무관한 별개 사업**이다.

소비자 결제·환불·cron 이 부르는 것들:

| 호출부 (소비자) | 부르는 파일 | 언제 |
|---|---|---|
| `worker/utils/order-commissions.ts:128·297` | `supply-settlement` (`creditSupplierOnOrder`) | **주문 확정 시** |
| `worker/utils/order-refund.ts:77` | `supply-settlement` (`reverseSupplierOnRefund`) | **환불 시** |
| `worker/scheduled.ts:299` | `supply-settlement` (`matureSupplierSettlements`) | cron |
| `worker/scheduled.ts:233` | `wholesale-deposit-core` (`reconcileOrphanedDepositOrders`) | cron(매시간) |
| `worker/scheduled.ts:238` | `supplier-withdrawal-core` (`reconcileWithdrawalLedgers`) | cron(매시간) |
| `worker/cron/cache-prewarm.ts:27` | `supply-visibility` (`normalizeSupplyProductData`) | cron |
| `worker/cron/wholesale-settle-tick.ts` | `supply-settlement` | cron |

⇒ **삭제 대상은 "도매 라우트·화면"이지 `features/supply` 디렉터리가 아니다.**

---

## 1. 🔴 지우면 안 되는 것 (잔류)

### (a) 소비자 결제 경로가 부르는 정산 엔진

`supply-settlement.ts` · `supply-visibility.ts` · `wholesale-deposit-core.ts` · `supplier-withdrawal-core.ts`

도매 상품이 0 이 되면 이 함수들은 **자연히 no-op** 이 된다(대상 행이 없음). 굳이 걷어낼 이유가 없고,
걷어내면 소비자 결제·환불·cron 을 동시에 수술해야 한다. **그대로 둔다.**

### (b) 도매와 무관한 별개 사업 — 이름만 `supply` 안에 있다

| 묶음 | 내용 | 현재 쓰임 |
|---|---|---|
| `buyer-*`(7파일) | 해외 수출 바이어 파이프라인 | `scheduled.ts:419` cron + 어드민 `/admin/buyer-pool` |
| `maker-*`(4파일) | 제조사·판매사 후보 풀 | 어드민 `/admin/maker-pool` |

⚠️ `worker/index.ts:1645·1647` 이 **소비자 번들에서도** buyer/maker 어드민 라우트를 마운트한다
(주석: *"도매 워커가 미배포라 임시"*). 도매 마운트를 걷어내도 **이쪽은 살아 있어야 한다.**

### (c) 몰 인프라 — 운영자 SaaS 로 **전용**

`wholesale_malls` 테이블 · `wholesale-malls-admin.routes.ts`(생성 CRUD) · `wholesale-malls.ts`(컨텍스트 해석) ·
배너/게시판. 이게 이 결정의 **가장 큰 이득**이다 — "자기 이름의 판"을 주는 인프라를 새로 안 만든다.

---

## 2. 🟢 지워도 되는 것

### 라우트 (`mount-wholesale.ts` 마운트 해제)

`/api/wholesale/*` · `/api/supplier/*` · `/api/admin/wholesale-*` · `/api/admin/distributor*` ·
`/api/admin/suppliers` · 오픈마켓 연동(naver/coupang) · 견적/PO · 클레임/RMA · 채팅 · 예치금 · plus

> ⚠️ 단 `/api/admin/buyer-pool` · `/api/admin/maker-pool` 은 §1(b) — **함께 걷어내지 말 것.**

### 화면 (`src/pages/`)

`Wholesale*`(카탈로그·대시보드·체크아웃·장바구니·예치금·문서) · `Supplier*`(로그인·가입·대시보드·주문) ·
`AdminWholesale*` · `AdminDistributorGradesPage` · `AdminSuppliersPage` · `SellerRegisterSupplierPage`

> ⚠️ **소비자 몰 화면으로 포크하지 말 것.** `WholesaleCatalogPage`(813줄)는 등급 공급가·`seller_token`
> 인증분기·예치금 체크아웃이 뼈대에 박혀 있다. 포크하면 매입가 인접 개념이 소비자 노출면으로 넘어와
> **불변식 ④** 와 부딪히고, 대표 확정 *"신규 몰 예치금 무접촉"* 도 깨진다.
> 소비자 몰은 `GbMarketplacePage`·`GroupBuyDetailPage` 에 몰 스코프(`mall_id`)+브랜딩을 얹어 만든다.

### 배포

`ur-wholesale` Pages 프로젝트 · `utongstart.com` 도메인 · `WHOLESALE_BUNDLE` 빌드 분기 ·
도매 번들 cron no-op 게이트(번들이 사라지면 불필요 — 단 **게이트 제거는 맨 마지막**)

---

## 3. 데이터 — **테이블은 지우지 않는다**

라이브 스키마 무접촉 원칙 유지. `wholesale_orders`·`wholesale_deposits`·`supplier_settlements` 등은
**남겨둔다**(정산 이력·회계 증빙). 노출만 끊는다. 삭제는 회계·세무 판단이 끝난 뒤의 별건이다.

`wholesale_malls` 는 지우지 않고 **재사용**한다 — id=1·2 는 비활성(`active=0`)으로 두고 신규 운영자 몰은
**id ≥ 3**(현행 AUTOINCREMENT 그대로, `mall-id-isolation.test.ts` 가 고정).

---

## 4. 🔴 머니 게이트 — 철거 전 유일한 선행

**남의 돈이 걸려 있을 수 있다.**

| 항목 | 테이블 | 왜 |
|---|---|---|
| 판매사 예치금 | `wholesale_deposits.balance` | **선불로 받은 돈**. 화면·API 가 사라지면 돌려줄 경로도 사라진다 |
| 미확인 충전요청 | `wholesale_deposit_requests(status='pending')` | 입금은 됐는데 미확인 |
| 공급자 미지급 정산금 | `supplier_settlements` | 지급 의무 |
| plus 활성 구독 | (예치금 차감 멤버십) | 잔여 기간 처리 |

> 대표가 정한 동결 순서는 *"게이트 선차단 금지 — 기능 OFF 를 먼저 하면 잔액이 회수 불가로 갇힌다"* 였다.
> **철거는 그 '기능 OFF' 보다 강한 조치다.** ⇒ 위 4개가 **전부 0 임을 확인한 뒤**에 §2 를 실행한다.
> 0 이 아니면 환급·소진이 먼저다.

**확인 경로**: 대표가 도매 어드민 `/admin/wholesale-overview`(`deposit_liability`·`pending_charge_requests`)에서 직접.

---

## 5. 순서

| # | 단계 | 되돌릴 수 있나 |
|---|---|---|
| 1 | **머니 게이트 4항목 확인**(§4) | — |
| 2 | 잔액 환급·소진(0 아니면) | — |
| 3 | 라우트 마운트 해제 + 화면 삭제(§2) | ✅ revert |
| 4 | 도매 배포(`ur-wholesale`)·도메인 정리 | ✅ 재배포 |
| 5 | 몰 인프라를 운영자 SaaS 로 전용 | — |
| 6 | (맨 마지막) 번들 cron no-op 게이트 제거 | ✅ revert |

3~4 는 git revert 로 되돌아간다. **되돌릴 수 없는 것은 1~2 를 건너뛰는 것뿐이다.**

---

## 6. 덤 — §8-C 가 해소된다

`operator-mall-saas-gap.md` §8-C 는 *"`mall_id=1` 이 본진과 유통스타트 두 의미를 겸한다"* 를 열린 항목으로
남기고 A/B/C 마이그레이션을 보류했다. **유통스타트를 안 쓰면 그 겸용이 사라진다** — `mall_id=1` 은
본진 하나만 뜻하게 되고, 보류했던 결정이 **아예 불필요해진다.**

⇒ §8-C 는 "철거 완료 시 자동 해소"로 갱신할 것. 단 **판별자와 `id ≥ 3` 전제는 그대로 유지**한다
(비활성이어도 id=1·2 행은 남으므로).

---

## 7. 규율 → 테스트 환원 판정

| 규율 | 환원 | 방법 |
|---|---|---|
| **`features/supply` 통째 삭제 금지**(소비자 결제 파손) | ✅ **가능·필요** | 소비자 호출부(`order-commissions`·`order-refund`·`scheduled`·`cache-prewarm`)가 참조하는 supply 파일이 **존재**하는지 검사. 지우면 즉시 빨강 |
| buyer/maker 를 도매와 함께 걷어내지 않기 | ✅ 가능 | `worker/index.ts` 의 buyer-pool·maker-pool 마운트 존재 검사 |
| 도매 화면을 소비자 몰로 포크 금지 | 🟡 부분 | 소비자 디렉터리에 `distributor_price`·`seller_token` 유입 검사(불변식 ④ 래칫과 같은 방식) |
| 신규 몰 id ≥ 3 | ✅ **이미 있음** | `mall-id-isolation.test.ts` |
| 신규 몰 코드 경로 예치금 참조 0 | ✅ 가능 | 세션 ③ 지시대로 래칫 |

> **1번은 철거 착수와 같은 커밋에 넣을 것.** 이 문서가 경고하는 사고가 정확히 그것이고,
> 문서만으로는 다음 세션이 `rm -rf features/supply` 를 막지 못한다.
