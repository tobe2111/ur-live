# 대표 결재 넷을 실행했다 — 이중적립 제거 · 만료환불 마감 · 부가세 손잡이 · 시트 측정 (2026-10-01)

대표: *"내 판단이 필요한 거 더 자세히 알려줘"* → 넷을 정리해 올림 → **"그래서? 어떻게 하자는거지?
최대한 이상적으로 다 해줘."**

## 결론 한 줄

열려 있던 결재 **넷 중 셋을 실행**했고(①②③), ④는 선행 조건(하네스 시드)이 남아 **다음 세션 몫**이다.
③의 마지막 한 걸음(**어드민 값 셋 누르기**)은 **대표 몫**으로 남겼다 — 대표 자신이 2026-09-21 에
*"게이트 ON 은 여전히 대표만 한다"* 로 그은 선이다.

## ① 만료 이용권 자동환불 — 결재 마감 (`archive/2026-09-30-expired-voucher-refund-stolen.md` → approved)

**코드는 이미 #1582 로 들어가 있었다.** 결재문은 그때까지 `open` + *"승인 전 코드 미변경"* 이었다.
⚠️ **다음 세션이 선례로 읽지 말 것** — 머니 경로는 결재가 먼저다. 결과가 좋았던 것은 운이다.

- 들어간 것은 기본안(1번)이 아니라 **2번**이고, **그게 더 낫다**: 만료 표시 자리가 셋인데
  1번은 하나(`scheduled-cleanup`)만 막고 **사용 시도 경로**(`group-buy-voucher.routes.ts:54`·`333`)를
  못 막는다. 2번은 조회를 `status IN ('unused','expired')` 로 넓혀 **누가 표시했든** 잡는다.
  → 2026-10-01 실측으로 그 두 자리가 `refund_status` 를 건드리지 않음을 확인(**구조적으로 중화**).
- 🔴 **날짜가 붙은 결과**: `0 18 * * *`(= 03:00 KST) cron 의 첫 발화인 **2026-10-02 03:00 KST** 에
  라이브 이용권 id=1(`UR-UR66-YDAZ`, 1,800원, user 3 = 대표 테스트 계정)이 **실제로 환불된다.**
  실손님 돈 아님 → 손해 0. 오히려 *"미사용 시 100% 자동환불"* 이 처음 지켜지는 건.
- **동반 수리(이번 PR)**: 선점(`claimed`)과 결과 기록 사이에서 **동기 파서가 던지면** 그 행이
  `claimed` 로 영구히 남아 **다시 선점되지 않는다**(= 환불 영영 안 됨, 같은 클래스의 조용한 부재).
  `parsePickup` 을 try/catch 로 감싸 빈 PickupInfo 로 떨어지게 했다 → `unknown-storage` →
  **전액 환불**(이미 문서화된 경로, 소비자에게 안전한 쪽).

### 다음 세션의 첫 액션 (10-02 03:00 KST 이후)
```sql
SELECT id, status, refund_status FROM vouchers WHERE id = 1;   -- 기대 expired / refunded
SELECT COUNT(*) FROM point_transactions WHERE user_id=3 AND type='refund' AND created_at > '2026-10-01T18:00:00Z';  -- 1
SELECT COUNT(*) FROM notifications     WHERE user_id=3 AND type='refund' AND created_at > '2026-10-01T18:00:00Z';  -- 1
```
⚠️ 하트비트 `ok:true` 로는 판정이 안 된다 — **이 사고가 정확히 "초록 하트비트 + 환불 0"** 이었다.
`refund_status='claimed'` 로 남아 있으면 처리 중 예외다(사람이 봐야 한다).

## ② 이용권 한 장에 매장 적립이 두 번 (`2026-09-30-voucher-credit-double-rail.md` → approved)

**안 1 채택.** 단 §⑥ 의 "계정 이름 통일" 을 **리네임이 아니라 집계에서 접기**로 바꿨다.

🩸 **리네임하면 네 곳이 조용히 틀린 값을 낸다**(결재문이 센 5곳보다 많았다):
`seller-analytics.routes.ts:442`(셀러 '매출' 카드 → 0원) · `weekly-metrics-summary.ts:64`
(이중레일 경보 → 0건) · `owner-promo.ts`·`ledger.ts:441`(promo 재원 계정) · `payout-use-gate.ts`(의미).
⇒ 이름은 그대로 두고 **지급 집계에서만** 한 payee 로 접었다. 그 넷은 **한 글자도 안 건드렸다.**

**신규 SSOT `src/worker/utils/payout-account.ts`**
| 무엇 | 함수 |
|---|---|
| 구매 적립 → `platform:escrow`(매장) / `platform:revenue`(플랫폼 상품) | `purchaseCreditAccount()` |
| 구매 시점 수수료 미인식(escrow 는 총액) | `carriesFee` |
| `merchant:N` ↔ `seller:N` 접기 | `canonicalPayee()` · `canonicalPayeeSql()` |
| 이미 생성된 payout 도 같은 키 | `canonicalPaidPayee()` · `canonicalPaidPayeeSql()` |
| `payee_type` 을 **셀러 역할**에서 | `payoutPayeeType()` |
| 집계 문장 자체 | `payoutCreditsSql()` · `payoutPaidSql()` — cron 이 위임 |

배선: 구매 3자리(딜 `group-buy.routes` · 카드 `group-buy.routes` · 장바구니 `cart-checkout.routes`) ·
`payouts-generate` · 어드민 집계 2곳.

**곁가지로 같이 고친 것** — 🔴 **어드민 '정산 생성' 버튼이 cron 과 다른 공식이었다**:
credit 만 더하고 `fee_amount`·`debit` 을 안 빼 **과다지급**. 표시용은 2026-07-01 에 net 으로
고쳐졌는데 이 버튼만 남아 있었다. 같은 net 공식 + 기간 창을 credit·debit **대칭**으로.

**라이브 영향 0 (실측 2026-10-01)**: `payouts 0 · restaurant_settlements 0 · vouchers used 0`.
🔴 **다만 이미 적힌 `seller:14` 1,000원(순 950)은 남는다** — 한 번도 안 쓴 무기한 이용권
(id=2 `UR-LUBA-RCP5`)의 구매 적립이고 최소출금액 10,000원을 넘는 순간 나간다.
⇒ **대표가 직접 가져갔다**(2026-10-01, 머지 직후): *"2번은 내가 알아서 할게."*
세션은 프로덕션 D1 을 쓰지 않으니 원래 대표 몫이었고, 이제 **대표가 명시로 맡았다.**

🔴 **그래서 다음 세션이 다시 올리지 말아야 할 것이 둘이다** — 대표가 말한 그대로:
③ 어드민 값 셋(`platform_fee_pct_brokered` 5.5 · `platform_fee_pct_direct` 11 ·
`commission_rate_meal_voucher` 5.5) → *"1번은 그냥 내가 생각해보고 할게."* ·
② `seller:14` 950원 → *"2번은 내가 알아서 할게."*
안 눌려 있거나 안 상계돼 있어도 **그건 결함이 아니다.** 확인은 해도 되지만 **재촉은 하지 않는다**
(대표가 싫어하는 그 반복이다). 값이 실제로 눌렸는지는 결재문 §Q4 의 E4 원장 쿼리로 본다.

## ③ 부가세 별도 (`2026-09-21-settlement-structure-payouts.md` §Q4 → 결정 기록)

**코드로 넣을 것이 없다.** 수수료는 전부 `platform_settings` 의 % 에서 나오고, Q4 가 권한
"레일 합치기" 는 **이미 켜져 있다**(`settlement_skip_ledgered = true` — 실측).

🔵 **대표가 어드민에서 누를 값 셋** (`/admin/platform-settings`):
| 키 | 지금 | → |
|---|---|---|
| `platform_fee_pct_brokered` | 5 | **5.5** |
| `platform_fee_pct_direct` | 10 | **11** |
| `commission_rate_meal_voucher` | 5 | **5.5** |

세션이 한 것 = **손잡이**: 라벨·힌트에 *"(%, 부가세 포함 차감률)"* 과 권장값을 못 박았다
(안 그러면 다음 사람이 `5.5` 를 보고 왜 5가 아닌지 알 수 없다).
⚠️ `default` 는 **일부러 안 올렸다** — `buildSettingsPayload` 가 바뀐 키만 보내므로 저장은 안 되지만,
`value={settings[k] ?? f.default}` 때문에 **그 키가 없을 때 화면에만** 뜬다 ⇒ 코드 폴백과 어긋나면
**화면이 거짓말을 한다.**

## ④ 셀러 시트 측정 (`2026-09-28-my-stage2-sheet-teardown.md` → 여전히 open)

**이번에 손대지 않았다.** 1차 측정이 **빈 화면을 재서** 헛돌았고(하네스가 목하는 API 가 셋뿐),
선행 조건은 **하네스에 셀러 목록 시드**다. 결재문이 우선순위를 정해 뒀다:
**① 정산·출금 둘(머니 표면) ② 주문 ③ 나머지 넷**, 그리고 *"얇은 픽스처는 없는 결함을 만든다"* —
긴 매장명·빈 필드·큰 숫자를 **일부러** 넣어야 의미가 있다.

## 이번에 값을 치르고 배운 것

1. **주입 러너가 내 가드 둘을 "지키는 척" 이라고 잡았다.**
   ⓐ `payee_type` 시험을 *"접두어 삼항이 없는가"* 라는 **모양**으로 썼더니 다른 모양의 하드코딩을
   주입해도 초록 → 판정을 순수 함수(`payoutPayeeType`)로 빼고 **동작**을 재도록 교체.
   ⓑ `store-handover-money` 의 `/^\d+$/.test(id)` 정규식 검사는 그 줄이 **두 입구에 같은 모양으로**
   있어서 한쪽을 지워도 초록 → `canonicalPayee('seller:null')` 를 **호출**해 판정.
2. **내 픽스처가 아니라 내 단언이 틀린 경우도 있었다**: 집계 SQL 은 `debit_account LIKE 'user:%'`
   때문에 **구매자 지갑도 음수로 등장한다**(라이브도 그렇고 cron 은 최소출금액에서 건너뛴다).
   "받을 사람" 을 말할 때는 **양수만** 봐야 한다.
3. **문자열 치환으로 import 를 붙일 때 그 줄의 뒤를 보라.** `...from '@/worker/utils/ledger';` 뒤에
   같은 줄로 다른 import 가 있었고, 내가 덧붙인 `//` 주석이 **그 import 를 통째로 삼켰다**(tsc 가 잡았다).
4. **코드를 옮기면 남의 가드가 빨개진다 — 지우지 말고 재조준.** 집계 SQL 을 모듈로 뺀 결과
   앵커 6건 + 기존 시험 3건이 낡았다. 전부 불변식 그대로 따라가게 고쳤다
   (`payout-hold` · `settlement-gate-direction` · `store-handover-money` · `money-switch-labels`).

5. 🔴 **결재문을 길게 쓰면 번들 예산이 깨진다 — 실제로 깨뜨렸다.** CI `Bundle size budget` 이
   `7.54 / 7.53 MB` 로 빨간불이었고 원인이 내 코드가 아니었다: `AdminDecisionsPage.tsx:15` 가
   `import.meta.glob('docs/decisions/*.md', ?raw, eager)` 로 **결재 원문을 통째로 번들에 박는다.**
   이 브랜치가 결재문 넷에 더한 산문이 **+18,432 B**(`voucher-credit-double-rail` +6,444 ·
   `expired-voucher-refund-stolen` +4,982 · `my-stage2-sheet-teardown` +3,739 ·
   `settlement-structure-payouts` +3,267)이고 예산 여유는 13 KB 였다 — 초과 **5,769 B**.
   ⚠️ **클라 코드 변경은 라벨 두 곳(+14/−5줄)뿐이다.** 즉 *문서를 쓴 것*이 예산을 넘겼다.
   ⇒ 임계값을 **올리지 않았다**(그 파일의 이력이 *"또 올리기 전에 처리 끝난 결재를 archive 로 옮겨라"*
   고 요구하고, 그 값은 아홉 번 올라간 뒤 09-28 에 처음 내려간 것이다). `docs/decisions/archive/README.md`
   의 규칙대로 **`fullyApplied`(approved + 반영 커밋에 해시 + '머지 대기' 없음)인 내 결재 하나**를
   보관소로 옮겼다(10,817 B 회수 → **7.530 MB 이내**). glob 이 `*.md` 비재귀라 코드 변경 0 이다.
   🚫 **다른 두 후보는 일부러 안 건드렸다**: `settlement-structure-payouts`(rejected, 28 KB)는
   표만 보면 보관 대상이지만 **§Q4 가 살아 있다**(대표가 누를 어드민 값 셋) — 옮기면 대표가
   *"승인해 줬는데 어디 갔지"* 를 겪는다. 나머지 approved 13건은 반영 커밋이 비어 **구현 중**이다.
6. **`src/worker/generated/route-chunk-map.ts` 를 커밋해 버렸다**(`cb34b83c3`). CLAUDE.md 가
   *"빌드 산출물이라 커밋 대상이 아니다 — 검증 후 `git checkout --` 로 되돌릴 것"* 이라고 적어 둔
   그 파일이고, 로컬 청크 해시 44줄이 들어갔다. 번들 예산엔 무관(워커 파일)이지만 되돌렸다.
   ⇒ **`npm run build` 를 돌린 세션은 커밋 전에 그 파일을 반드시 확인할 것.**

## 검증

- `tsc 0` · 신규 가드 18건 pass · 주입 **9건 신규 + 재조준 4건 전부 빨간불 확인**
- `pre-push-gate` 가드 103개 통과 · `stale-mutation-anchors` 2,346건 실재
- ⚠️ **머니 경로다** — 배포 후 첫 이용권 사용에서 원장 행으로 판정할 것(결재문 E4 쿼리).

## 번들 예산 — 다음 사람이 알아야 할 것

지금 여유는 **1,796 B** 다(실측 7.5494 / 7.55). 결재문을 한 줄 쓰면 그만큼 바로 들어간다.

🩸 **이 값에 두 번 걸렸고, 두 번째는 내 절차 실수였다.**
① `898b58745` — 결재문 넷에 산문 +18,432 B 를 더해 7.54 / 7.53 초과. 보관으로 10,817 B 회수.
② `35f516aba` — **main 을 두 번째로 따라잡은 뒤 번들을 다시 재지 않고 푸시**해서 1,421 B 초과.
   `pre-push-gate` 는 `dist/` 가 필요한 가드 **둘을 제외**한다(그래서 CLAUDE.md 가 "CI 담당" 이라 적어 둔
   자리). ⇒ **베이스를 따라잡았으면 `npm run build:client && npm run check:bundle:budget` 를 반드시
   다시 돌릴 것.** 게이트 초록은 그 둘을 보증하지 않는다.
③ 두 번째 수리는 임계값을 올리지 않고 **결재문의 기술 서사를 인계로 옮겨** 2,013 + 1,161 B 를 회수했다.
   glob 이 `docs/decisions/*.md` 만 보므로 **인계 문서는 번들에 안 들어간다.**
   ⇒ 규칙: **결재문엔 결정·판정·근거 요약, 서사·구현·가드 상세는 인계.** 결재문을 길게 쓰거나 새로 올리면 **그만큼 그대로** 번들에 들어간다
(실측: 결재 파일 2.5 KB 추가 = 어드민 청크 +3,096 B). 보관 가능한 결재는 지금 **0건**이므로,
다음에 닿는 사람은 상향 대신 **근본 처방**을 마주한다 — `AdminDecisionsPage` 의 `?raw` eager 인라인을
걷어내고 워커가 서빙하거나 lazy fetch 로 바꾸는 것(새 API 표면이라 별건). 그 청크는 현재 **140 KB**,
예산의 1.9% 다.

## ④ 측정 — 손으로 센 API 목록이 세 번 다 모자랐던 전말 (결재문에서 옮김)

1차: 하네스가 목하는 셀러 API 가 셋뿐 → 전부 404 → 빈 화면을 쟀다.
2차(이 작업): **결재문이 적어 둔 목록**만 담았더니 정산 화면의 주 숫자가 0이었다 —
그 숫자는 `/api/seller/payouts` 에서 오는데 그 이름이 목록에 없었다.
3차: 새로 만든 가드가 **`/api/seller/voucher-catalog`** 를 즉시 잡아냈다.

⇒ 그래서 목록을 손으로 관리하지 않는다. `seller-list-fixtures-2026-10-01.test.ts` 가
**정산 표면 소스에서 GET 경로를 긁어** 시드가 덮는지 본다(주입 6건 되돌려-검증 확인).

> 🔀 **왜 여기로 옮겼나**: 어드민 결재함이 `docs/decisions/*.md` 를 번들에 통째로 인라인한다
> (`AdminDecisionsPage.tsx:15`, 그 청크 **167.6 KB**). 결재문에 긴 서사를 쓰면 **번들 예산이 깨진다**
> — 실제로 `35f516aba` 에서 **1,421 B 초과**로 CI 가 빨간불이었다. 인계 문서는 glob 밖이라 무료다.
> ⇒ **결재문엔 결정·판정·근거 요약, 서사·교훈은 인계.**

## ②-가드 — 문자열이 아니라 실제 sqlite 로 금액을 센다 (결재문에서 옮김)

`src/tests/unit/voucher-credit-single-rail-2026-10-01.test.ts` 18건. `node:sqlite` 에 표 둘을 만들고
**cron 이 실제로 쓰는 문장**을 돌려 행 수와 금액으로 판정한다:
`매장 지급 900`(종전 구조 재현 시 1,850 — 되돌려-검증이 그걸 고정) · `payee 행 1개` ·
`차감 접힘 800` · `기존 payout 차감 600` · 플랫폼 상품 미노출 · `seller:null` 미노출.
주입 **9건 전부 빨간불 확인**(`scripts/mutations/voucher-credit-single-rail.mjs`).

🩸 **주입 러너가 내 가드 하나를 "지키는 척" 이라고 잡았다**: `payee_type` 시험을 *"접두어 삼항이
없는가"* 라는 **모양**으로 썼더니, 다른 모양의 하드코딩(`kind === 'seller' ? 'store_owner' : …`)을
주입해도 초록이었다 ⇒ 판정을 순수 함수(`payoutPayeeType`)로 빼고 **동작**을 재도록 교체했다.
그리고 내 픽스처가 아니라 **내 단언**이 틀린 것도 하나 있었다 — 집계 SQL 은 `debit_account LIKE 'user:%'`
때문에 **구매자 지갑도 음수로 등장한다**(라이브도 그렇고 cron 은 최소출금액에서 건너뛴다).
"받을 사람" 을 말할 때는 **양수만** 봐야 한다.

## ②-구현 — 파일별 상세 (결재문에서 옮김)

| 무엇 | 어디 |
|---|---|
| 구매 적립 → `platform:escrow`(매장 상품) / `platform:revenue`(플랫폼 상품) | `purchaseCreditAccount()` · 구매 3자리(딜·카드·장바구니) |
| 구매 시점 수수료 **미인식**(escrow 는 총액) | `carriesFee` — 사용 시점 3번째 분개가 인식한다 |
| `merchant:N` ↔ `seller:N` 접기 | `canonicalPayee()` + `canonicalPayeeSql()` |
| 이미 생성된 payout 도 같은 키로 | `canonicalPaidPayee()` + `canonicalPaidPayeeSql()` |
| `payee_type` 을 **셀러 역할**에서 | `payoutPayeeType()` — 접두어가 아니다 |
| 집계 문장 자체를 SSOT 로 | `payoutCreditsSql()` · `payoutPaidSql()` — cron 이 위임 |

**곁가지로 같이 고친 것 둘** (같은 함수를 지나가므로 분리가 더 위험하다):
1. 🔴 **어드민 '정산 생성' 버튼이 cron 과 다른 공식을 쓰고 있었다** — credit 만 더하고 `fee_amount`도
   `debit`(환불 역전·커미션 차감)도 빼지 않아 **과다지급**이 된다. 표시용 집계는 2026-07-01 에 net 으로
   고쳐졌는데 이 버튼만 남아 있었다(그 코드의 주석이 걱정한 *"화면과 생성분이 갈리면 없는 돈을
   승인한다"* 가 실제로 성립해 있었다). 같은 net 공식으로 맞췄다.
2. `seller:null` 오염을 **근원에서** 막는다 — 플랫폼 상품의 구매 적립이 더는 그 이름을 만들지 않는다
   (`payouts-generate` 의 id 숫자 검사는 두 번째 방어선으로 유지).

## ②-선택지 (결재문에서 옮김)

1. **사용 시점으로 단일화 + 매장 계정 이름을 하나로 통일**
   - 구매 적립 → `platform:escrow`(수수료도 그때 안 뗀다 — 사용 시점 3번째 분개가 인식한다).
     매장이 없는 플랫폼 상품(`seller_id` NULL, 교환권·KT)은 **종전 `platform:revenue` 유지** —
     그 경로는 사용 시점 적립이 아예 없어서(`merchantId` 0 → 스킵) escrow 에 담으면 영원히 안 빠진다.
   - `merchant:N` ↔ `seller:N` 을 한 이름으로 수렴(⑥). `payouts-generate` 의 `merchant → store_owner`
     매핑도 함께 정리.
   - 장점: `recordVoucherUsedLedger` 주석이 처음부터 말한 설계(`escrow → merchant_payable`) ·
     레일 A(④)와 일치 · 대표가 켠 사용 확인 게이트와 일치 · ②의 환불 역전이 **필요 없어진다**
     (적립 자체가 없다) · ⑥의 차감이 제자리를 찾는다
   - 단점: **매장은 손님이 실제로 쓴 뒤에 받는다**(판매 시점엔 못 받는다). 무기한 이용권은
     손님이 언제든 쓸 수 있으므로 그때까지 escrow 에 남는다. 손대는 자리 5곳 + 집계 1곳.
   - 머니 접촉: **있음** — 단독 세션 + staging 실결제

2. **구매 시점으로 단일화** — `recordVoucherUsedLedger` 의 `merchant:N` 적립을 지운다
   - 장점: 매장이 빨리 받는다 · 변경 지점 1곳 · ⑥을 건드릴 필요가 없다(차감이 이미 `seller:N`)
   - 단점: 미사용·환불된 이용권까지 매장에 지급된다(②가 영구 결함으로 굳는다) ·
     채널 요율(③)이 적용되는 쪽을 버린다 · 사용 확인 게이트가 무의미해진다 · 레일 A(④)와 어긋난다
   - 머니 접촉: 있음

3. **아무것도 안 한다**
   - 단점: 첫 실사용이 곧 이중지급이다. 지금은 손실 0 이지만 그 순간부터 회수 문제가 된다.


## ②-안1-접기 (결재문에서 옮김)

§⑥ 은 `merchant:N` ↔ `seller:N` 을 "한 이름으로 수렴" 하라고 했다. 착수해서 실측하니
**그 이름을 읽는 곳이 §⑥ 이 센 5곳보다 많았다**:

| 읽는 곳 | 무엇을 읽나 | 리네임하면 |
|---|---|---|
| `seller-analytics.routes.ts:442` | `credit_account = 'merchant:N' AND event_type='voucher_used'` | 셀러 대시보드 **'매출' 카드가 0원**이 된다 |
| `weekly-metrics-summary.ts:64` | `payouts.payee_type = 'store_owner'` | 정산 **이중레일 경보가 조용히 0을 센다** |
| `owner-promo.ts:47` · `ledger.ts:441` | `ownerAccount: merchant:{id}`(promo 재원) | 재원 계정이 가리키는 대상이 바뀐다 |
| `payout-use-gate.ts:12` | *"매장 몫(`merchant:N`)은 사용 시점에만 붙는다"* 는 **의미** | 그 게이트의 전제가 사라진다 |

넷 다 **에러 없이** 틀린 값을 내기 시작한다(이 레포가 반복해 당한 조용한 부재).

⇒ **이름은 그대로 두고 지급 집계에서만 한 payee 로 접었다.** `merchant:` 는 *사용 시점의 매장 몫*
이라는 뜻을 유지하고, 지급은 "같은 가게에 두 번 보내지 않는다" 만 지킨다. §⑥ 이 요구한 효과
(*"차감이 제자리를 찾는다"*)는 그대로 달성되고, 읽는 곳 네 군데는 **한 글자도 안 건드렸다.**

