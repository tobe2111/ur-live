/**
 * 💸 **원장 계정 ↔ 지급 대상(payee) 규칙 SSOT** (2026-10-01).
 *
 * 결재: `docs/decisions/2026-09-30-voucher-credit-double-rail.md` (대표 2026-10-01 *"최대한 이상적으로 다 해줘"*).
 *
 * ## 무엇이 깨져 있었나 (라이브 실측 2026-09-30)
 *
 * 이용권 한 장에 매장 적립이 **두 번** 일어났다 — 구매 시점에 `seller:N`, 사용 시점에 `merchant:N`.
 * `payouts-generate` 는 계정 **문자열**로 GROUP BY 하므로 그 둘이 서로 다른 payee 가 되어 **양쪽 다** 지급된다:
 *
 * ```
 * merchant:14 → 900      (사용 시점)
 * seller:14   → 950      (구매 시점)
 * 가게 14 지급 합계 1,850원  = 1,000원 판매의 185%
 * ```
 *
 * ## 고친 방법 — 이름을 바꾸지 않고 **집계에서 접는다**
 *
 * 결재문이 제안한 안 1 은 `merchant:N` 을 `seller:N` 으로 **리네임**하는 것이었는데, 실측하니
 * 그 이름을 읽는 곳이 결재문이 센 5곳보다 많았다:
 *
 * | 읽는 곳 | 무엇 |
 * |---|---|
 * | `seller-analytics.routes.ts` | 셀러 대시보드 '매출' 카드가 `credit_account = 'merchant:N'` 을 직접 본다 |
 * | `weekly-metrics-summary.ts` | 이중레일 경보가 `payouts.payee_type = 'store_owner'` 를 본다 |
 * | `owner-promo.ts` · `payout-use-gate.ts` | 매장 몫 = `merchant:N` 이라는 **의미**에 기대고 있다 |
 *
 * ⇒ 리네임하면 그 넷이 조용히 0을 세기 시작한다(에러 없음 — 이 레포가 반복해 당한 클래스).
 * 그래서 **이름은 그대로 두고 지급 집계에서만 한 payee 로 접는다.** `merchant:` 는 *사용 시점의
 * 매장 몫*이라는 뜻을 유지하고, 지급은 "같은 가게에 두 번 보내지 않는다" 만 지킨다.
 *
 * ## 불변식 (가드가 확인한다)
 *
 * 1. `merchant:N` 과 `seller:N` 은 지급 집계에서 **같은 payee** 다 ⇒ `seller:N` 에 걸린 차감
 *    (인플루언서 커미션 · 중개사 몫 · 부분환불)이 `merchant:N` 의 적립에서 **빠진다.**
 * 2. 구매 시점 적립은 **매장에 가지 않는다** — 매장 상품은 `platform:escrow` 로 들어가 사용 시점
 *    분개가 꺼낸다. ⇒ 미사용·환불된 이용권이 매장에 지급되지 않는다.
 * 3. 플랫폼 상품(`seller_id` 없음 — 교환권·KT)은 종전대로 `platform:revenue` 다. escrow 에 담으면
 *    사용 시점 적립이 없어(merchant 없음) **영원히 안 빠진다.**
 * 4. `seller:null` 같은 오염 계정을 **만들지 않는다**(2026-09-07 라이브에 실재했던 1,800원 행).
 */

import { isStoreOwner } from '../../shared/seller-roles'

/** 지급 대상 한 명. `kind` 는 조회할 테이블을, `id` 는 그 행을 가리킨다. */
export type CanonicalPayee = { kind: 'seller' | 'agency' | 'user'; id: string }

/** 지급 집계가 보는 계정 접두어. `platform:*` 은 여기 없다 — 지급 대상이 아니다. */
export const PAYOUT_ACCOUNT_PREFIXES = ['merchant:', 'seller:', 'agency:', 'user:'] as const

/**
 * 🏦 **구매 시점 적립 목적지.**
 *
 * 매장 상품은 `platform:escrow` — 손님이 **실제로 쓸 때** 매장에 넘어간다
 * (`recordVoucherUsedLedger` 의 세 분개가 escrow 에서 꺼낸다). 대표가 켜 둔
 * `payout_requires_voucher_use` 와 `cron/auto-settlement.ts` 의 `WHERE v.status='used'` 와 같은 원칙이다.
 *
 * 플랫폼 상품(판매자 없음)은 사용 시점 분개가 아예 없으므로 **그때 바로 수익**으로 인식한다.
 *
 * @returns `carriesFee` — 그 적립에 `fee_amount`(플랫폼 수수료)를 실어야 하는가.
 *   escrow 는 **총액을 그대로** 담는다(수수료는 사용 시점 3번째 분개가 인식한다). 플랫폼 상품은 종전과 같다.
 */
export function purchaseCreditAccount(
  sellerId: number | string | null | undefined,
): { account: string; carriesFee: boolean } {
  const id = Number(sellerId)
  return Number.isFinite(id) && id > 0
    ? { account: 'platform:escrow', carriesFee: false }
    : { account: 'platform:revenue', carriesFee: true }
}

/**
 * 원장 계정 문자열 → 지급 대상. 지급 대상이 아니거나 id 가 숫자가 아니면 `null`.
 *
 * 🔐 id 숫자 검사가 여기 있는 이유: `'seller:null'` 은 `split(':')` 이 `id='null'`(truthy)을 내므로
 *   가드 없는 호출부를 통과해 **계좌 없는 유령 payout** 을 만든다(2026-09-07 실측).
 */
export function canonicalPayee(account: string | null | undefined): CanonicalPayee | null {
  if (!account) return null
  const i = account.indexOf(':')
  if (i <= 0) return null
  const prefix = account.slice(0, i)
  const id = account.slice(i + 1)
  if (!/^\d+$/.test(id)) return null
  // 🔑 merchant(사용 시점 매장 몫) 과 seller(구매·커미션) 은 **같은 가게**다 — 한 payee 로 접는다.
  if (prefix === 'merchant' || prefix === 'seller') return { kind: 'seller', id }
  if (prefix === 'agency') return { kind: 'agency', id }
  if (prefix === 'user') return { kind: 'user', id }
  return null
}

/** `payouts` 행(payee_type/payee_id) → 같은 규칙의 payee. 이미 지급된 금액을 맞춰 빼려면 양쪽 키가 같아야 한다. */
export function canonicalPaidPayee(
  payeeType: string | null | undefined,
  payeeId: string | number | null | undefined,
): CanonicalPayee | null {
  const id = String(payeeId ?? '')
  if (!/^\d+$/.test(id)) return null
  if (payeeType === 'store_owner' || payeeType === 'seller') return { kind: 'seller', id }
  if (payeeType === 'agency') return { kind: 'agency', id }
  if (payeeType === 'user') return { kind: 'user', id }
  return null
}

/** payee → 집계 키 문자열. */
export function payeeKey(p: CanonicalPayee): string {
  return `${p.kind}:${p.id}`
}

/**
 * 위 `canonicalPayee` 와 **같은 규칙의 SQL**. 집계 SQL 이 셋(cron · 어드민 표시 · 어드민 수동 생성)이라
 * 조각을 공유하지 않으면 반드시 갈린다 — 갈리면 화면이 보여 준 금액과 실제 생성되는 payout 이 달라진다.
 *
 * `'merchant:'` 는 9글자이므로 `substr(col, 10)` 이 id 다.
 */
export function canonicalPayeeSql(col: string): string {
  return `CASE WHEN ${col} LIKE 'merchant:%' THEN 'seller:' || substr(${col}, 10) ELSE ${col} END`
}

/** `payouts` 쪽 같은 규칙. `store_owner` 를 `seller` 로 접는다. */
export function canonicalPaidPayeeSql(typeCol: string, idCol: string): string {
  return `(CASE WHEN ${typeCol} = 'store_owner' THEN 'seller' ELSE ${typeCol} END) || ':' || ${idCol}`
}

/**
 * 💰 **지급 대기 순액 집계 SQL** — `payouts-generate` cron 이 쓰는 문장 그대로.
 *
 * 여기로 뺀 이유는 `expired-voucher-refund-sql.ts` 와 같다: 이 문장이 혼자 *"누가 얼마를 받는가"* 를
 * 결정하는데, 인라인으로 두면 가드가 **문자열 비교밖에 못 하고 SQL 의미를 못 본다.**
 * 2026-09-30 에 깨진 것이 정확히 의미였다(계정 문자열로 GROUP BY 해서 한 가게에 두 번 지급).
 * ⇒ 여기 있으면 가드가 **실제 sqlite 에 돌려** 행과 금액으로 판정할 수 있다.
 *
 * 순액 = Σ(credit − fee_amount) − Σ(debit). `getLedgerReceivable` · 어드민 화면과 같은 공식이다.
 *
 * @param holdSql 유보 조건(`payout-hold.ts`). **credit 에만** 걸린다 — 차감(환불 역전)을 미루면 과다지급이다.
 */
export function payoutCreditsSql(holdSql: string): string {
  return `
      SELECT account, SUM(net) as total FROM (
        SELECT ${canonicalPayeeSql('credit_account')} AS account, amount - COALESCE(fee_amount, 0) AS net
          FROM ledger_entries
         WHERE (credit_account LIKE 'merchant:%' OR credit_account LIKE 'seller:%' OR credit_account LIKE 'agency:%' OR credit_account LIKE 'user:%')
           ${holdSql}
        UNION ALL
        SELECT ${canonicalPayeeSql('debit_account')} AS account, -amount AS net
          FROM ledger_entries
         WHERE debit_account LIKE 'merchant:%' OR debit_account LIKE 'seller:%' OR debit_account LIKE 'agency:%' OR debit_account LIKE 'user:%'
      )
      GROUP BY account
    `
}

/** 이미 생성된 payout 합계. credit 과 **같은 payee 키**로 접어야 맞춰 빠진다. */
export function payoutPaidSql(): string {
  return `
      SELECT ${canonicalPaidPayeeSql('payee_type', 'payee_id')} as account, SUM(amount) as total
        FROM payouts
       WHERE status IN ('pending','approved','sent')
       GROUP BY account
    `
}

/**
 * 🏷️ **`payouts.payee_type` 결정** — 계정 접두어가 아니라 **셀러 역할**에서 나온다.
 *
 * 🩸 왜 함수로 뺐나: 종전엔 호출부가 `type === 'merchant' ? 'store_owner' : type` 로 **접두어**를 보고
 *   정했다. 그래서 같은 가게가 `merchant:` 로 적힌 몫은 `store_owner`, `seller:` 로 적힌 몫은 `seller`
 *   가 되어 **payout 이 두 행**으로 갈렸다(이번 결함). 접은 뒤엔 접두어가 사라지므로 라벨의 근거가
 *   필요하고, 그 근거는 `sellers.seller_type` 이다.
 *
 * 🔴 **라벨을 지우면 안 되는 이유**: `weekly-metrics-summary` 의 정산 이중레일 경보가
 *   `payouts.payee_type = 'store_owner'` 를 본다. 전부 `seller` 로 통일하면 그 경보가 **조용히 0을 센다.**
 *
 * ⚠️ 이 함수는 **문자열 모양이 아니라 동작**으로 고정된다(가드가 호출해서 판정한다) — 앞선 판에서
 *   "접두어 삼항이 없는가" 만 보는 시험을 썼더니, 다른 모양의 하드코딩(`kind === 'seller' ? 'store_owner'`)
 *   을 주입해도 통과했다. 주입 러너가 그걸 잡았다.
 */
export function payoutPayeeType(
  kind: CanonicalPayee['kind'],
  sellerType?: string | null,
): 'store_owner' | 'seller' | 'agency' | 'user' {
  if (kind !== 'seller') return kind
  return isStoreOwner(sellerType) ? 'store_owner' : 'seller'
}
