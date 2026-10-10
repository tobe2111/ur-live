/**
 * 🏦 **지급 대상의 계좌 스냅샷 SSOT** (2026-10-10 감사)
 *
 * ## 무엇이 깨져 있었나
 * payout 행을 만드는 곳이 셋인데(주간 cron `payouts-generate` · 어드민 수동 생성 · 손바뀜 마감) 각자
 * 계좌를 따로 읽었고, 셋 다 같은 실수를 했다:
 *   - `sellers.bank_name` 을 **안 읽었다** → payout 행의 `bank_name` 이 항상 NULL
 *     → `isTransferable`(은행·번호·예금주 셋 다 필요)이 거짓 → **cron 이 만든 정산이 전부
 *     은행 일괄이체 CSV 에서 빠졌다**(X-Skipped-Count 로만 보였다).
 *   - 예금주에 `sellers.account_holder` 가 아니라 `business_name`(상호)을 적었다. 상호와 예금주가
 *     다르면 은행이 그 이체를 반려하고, 같은 파일의 다른 이체까지 반려하는 은행도 있다.
 *   - 어드민 수동 생성은 `bankName` 변수를 선언만 하고 **한 번도 채우지 않았다.**
 *
 * ⇒ 계좌 조회를 이 함수 하나로 모은다. 생성 경로가 늘어나도 **계좌 규칙은 갈라질 수 없다.**
 *
 * ## 이 함수가 돌려주는 것
 *   - 계좌 3종(은행·번호·예금주) — 예금주는 `account_holder` 우선, 비었을 때만 상호로 폴백
 *   - `eligible` — 돈을 보내도 되는 매장인가(`isPayoutEligibleSellerStatus`, 사람이 승인한 매장만)
 *   - `accountVerified` — 셀러가 계좌를 바꾼 뒤 어드민이 재확인했는가(`sellers.is_verified`).
 *     계좌 변경은 `seller-profile.routes` 가 `is_verified=0` 으로 내리고, 어드민의
 *     `POST /sellers/:id/verify-account` 가 1 로 되돌린다. **컬럼이 없거나 NULL 이면 검증된 것으로**
 *     본다 — 출금 게이트(`seller-settlements.routes`)의 `COALESCE(is_verified, 1)` 과 같은 규칙이다.
 *
 * ⚠️ 이 함수는 **읽기만** 한다. 미검증이어도 payout 을 만들지 말라는 뜻이 아니다 — 받을 돈은 실재한다.
 *   막는 곳은 송금 직전(`payout-sent.ts` `checkPayeeAccountCurrent`)이다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { isPayoutEligibleSellerStatus } from '../../shared/seller-status'
import { payoutPayeeType, type CanonicalPayee } from './payout-account'

export interface PayeeAccountSnapshot {
  payeeType: 'store_owner' | 'seller' | 'agency' | 'user'
  bankName: string | null
  accountNumber: string | null
  accountHolder: string | null
  /** 돈을 보내도 되는 상태인가 — 셀러는 승인 매장만, 그 외는 true. */
  eligible: boolean
  /** 셀러 status 원문(로그용). 셀러가 아니면 null. */
  sellerStatus: string | null
  /** 계좌 변경 후 어드민 재확인 완료(또는 게이트 없음). */
  accountVerified: boolean
}

const clean = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim()
  return s ? s : null
}

/** 예금주 — 계좌에 적힌 이름이 먼저다. 상호는 비어 있을 때만. */
export function pickAccountHolder(accountHolder: unknown, businessName: unknown): string | null {
  return clean(accountHolder) ?? clean(businessName)
}

type SellerAcctRow = {
  bank_name: string | null; bank_account: string | null; account_holder: string | null
  business_name: string | null; status: string | null; seller_type: string | null; is_verified?: number | null
}

export async function resolvePayeeAccount(DB: D1Database, payee: CanonicalPayee): Promise<PayeeAccountSnapshot> {
  const base: PayeeAccountSnapshot = {
    payeeType: payoutPayeeType(payee.kind), bankName: null, accountNumber: null, accountHolder: null,
    eligible: payee.kind !== 'seller', sellerStatus: null, accountVerified: true,
  }
  if (payee.kind === 'seller') {
    // `is_verified` 는 repair-schema 가 보장하지만 구 env 엔 없을 수 있다 — 없으면 빼고 다시 읽는다.
    let row = await DB.prepare(
      `SELECT bank_name, bank_account, account_holder, business_name, status, seller_type, is_verified
         FROM sellers WHERE id = ?`,
    ).bind(payee.id).first<SellerAcctRow>().catch(() => undefined)
    if (row === undefined) {
      row = await DB.prepare(
        `SELECT bank_name, bank_account, account_holder, business_name, status, seller_type
           FROM sellers WHERE id = ?`,
      ).bind(payee.id).first<SellerAcctRow>().catch(() => null)
    }
    if (!row) return base
    return {
      payeeType: payoutPayeeType(payee.kind, row.seller_type),
      bankName: clean(row.bank_name),
      accountNumber: clean(row.bank_account),
      accountHolder: pickAccountHolder(row.account_holder, row.business_name),
      eligible: isPayoutEligibleSellerStatus(row.status),
      sellerStatus: row.status ?? null,
      accountVerified: Number(row.is_verified ?? 1) !== 0,
    }
  }
  if (payee.kind === 'user') {
    type UserAcctRow = { bank_name?: string | null; bank_account: string | null; account_holder: string | null; business_name: string | null }
    let row = await DB.prepare(
      'SELECT bank_name, bank_account, account_holder, business_name FROM users WHERE id = ?',
    ).bind(payee.id).first<UserAcctRow>().catch(() => undefined)
    if (row === undefined) {
      // 종전 cron 의 SELECT 그대로(bank_name 컬럼이 없는 구 env).
      row = await DB.prepare('SELECT bank_account, account_holder, business_name FROM users WHERE id = ?')
        .bind(payee.id).first<UserAcctRow>().catch(() => null)
    }
    if (!row) return base
    return {
      ...base,
      bankName: clean(row.bank_name),
      accountNumber: clean(row.bank_account),
      accountHolder: pickAccountHolder(row.account_holder, row.business_name),
    }
  }
  // agency — 계좌 컬럼이 없다(종전과 같다: 이름만). 송금 완료는 PAYOUT_NO_ACCOUNT 가 막는다.
  const row = await DB.prepare('SELECT name FROM agencies WHERE id = ?').bind(payee.id)
    .first<{ name: string | null }>().catch(() => null)
  return { ...base, accountHolder: clean(row?.name) }
}
