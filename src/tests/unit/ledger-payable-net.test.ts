/**
 * 정산 원장 순 receivable 공식 — net-of-fee, net-of-debit 가드
 *
 * src/worker/utils/ledger.ts `getLedgerReceivable` + src/worker/cron/payouts-generate.ts
 * 집계 쿼리의 핵심 SQL 로직(CASE 식)을 순수 함수로 미러링해 검증.
 * (저장소 표준: 실 SQLite 대신 DB 동작을 mirror 하는 pure 시뮬레이션.)
 *
 * 배경(2026-07-01 정산 감사): 이전 payout 집계가 credit-only 라
 *   ① 공구 seller credit(amount=gross + fee_amount=수수료)에서 수수료 미차감 → gross 지급
 *   ② seller:N 의 기존 debit(환불 역전·인플루언서/추천 커미션) 무시 → 과다지급
 * 정식 공식 = Σ(credit.amount − fee_amount) − Σ(debit.amount) [− payout].
 */
import { describe, it, expect } from 'vitest'

interface LedgerEntry {
  credit_account: string
  debit_account: string
  amount: number
  fee_amount?: number
}

/** ledger.ts getLedgerReceivable 의 SQL CASE 로직을 그대로 미러링. */
function ledgerReceivable(entries: LedgerEntry[], account: string): number {
  let creditNet = 0
  let debitTotal = 0
  for (const e of entries) {
    if (e.credit_account === account) creditNet += e.amount - (e.fee_amount ?? 0)
    if (e.debit_account === account) debitTotal += e.amount
  }
  return creditNet - debitTotal
}

/** getPayablePending = receivable − 이미 지급(approved/sent) */
function payablePending(entries: LedgerEntry[], account: string, paidApprovedSent: number): number {
  return ledgerReceivable(entries, account) - paidApprovedSent
}

const SELLER = 'seller:1'

describe('ledger 순 receivable — net-of-fee', () => {
  it('공구 gross credit(amount=gross + fee_amount)은 net 으로 산출된다', () => {
    // 공구: 유저가 10,000 결제, 플랫폼 수수료 500 → 셀러 net 9,500
    const entries: LedgerEntry[] = [
      { credit_account: SELLER, debit_account: 'user:9', amount: 10_000, fee_amount: 500 },
    ]
    expect(ledgerReceivable(entries, SELLER)).toBe(9_500) // 이전 버그: 10,000(gross)
  })

  it('이용권 net credit(fee_amount=0)은 그대로 net', () => {
    const entries: LedgerEntry[] = [
      { credit_account: SELLER, debit_account: 'platform:escrow', amount: 9_500, fee_amount: 0 },
    ]
    expect(ledgerReceivable(entries, SELLER)).toBe(9_500)
  })

  it('fee_amount 미지정도 net(=amount)로 처리', () => {
    const entries: LedgerEntry[] = [
      { credit_account: SELLER, debit_account: 'platform:escrow', amount: 9_500 },
    ]
    expect(ledgerReceivable(entries, SELLER)).toBe(9_500)
  })
})

describe('ledger 순 receivable — net-of-debit', () => {
  it('환불 역전 debit 은 receivable 을 줄인다', () => {
    const entries: LedgerEntry[] = [
      { credit_account: SELLER, debit_account: 'user:9', amount: 10_000, fee_amount: 500 }, // net 9,500
      { debit_account: SELLER, credit_account: 'user:9', amount: 3_000 }, // 부분환불 역전
    ]
    expect(ledgerReceivable(entries, SELLER)).toBe(6_500) // 9,500 − 3,000
  })

  it('인플루언서/추천 커미션 debit 도 차감된다', () => {
    const entries: LedgerEntry[] = [
      { credit_account: SELLER, debit_account: 'user:9', amount: 10_000, fee_amount: 500 }, // net 9,500
      { debit_account: SELLER, credit_account: 'influencer:2', amount: 1_000 }, // 인플루언서 커미션
      { debit_account: SELLER, credit_account: 'user:9', amount: 800 }, // 추천 보너스
    ]
    expect(ledgerReceivable(entries, SELLER)).toBe(7_700) // 9,500 − 1,000 − 800
  })

  it('복합: gross credit + 커미션 + 환불 debit 전부 반영', () => {
    const entries: LedgerEntry[] = [
      { credit_account: SELLER, debit_account: 'user:9', amount: 10_000, fee_amount: 500 },
      { credit_account: SELLER, debit_account: 'user:8', amount: 20_000, fee_amount: 1_000 },
      { debit_account: SELLER, credit_account: 'influencer:2', amount: 1_500 },
      { debit_account: SELLER, credit_account: 'user:9', amount: 4_000 },
    ]
    // (10,000−500) + (20,000−1,000) − 1,500 − 4,000 = 9,500 + 19,000 − 5,500 = 23,000
    expect(ledgerReceivable(entries, SELLER)).toBe(23_000)
  })

  it('debit 이 credit 보다 크면 음수(호출부에서 floor 처리)', () => {
    const entries: LedgerEntry[] = [
      { credit_account: SELLER, debit_account: 'user:9', amount: 1_000, fee_amount: 50 }, // net 950
      { debit_account: SELLER, credit_account: 'user:9', amount: 2_000 },
    ]
    expect(ledgerReceivable(entries, SELLER)).toBe(-1_050)
  })
})

describe('getPayablePending = receivable − 지급(approved/sent)', () => {
  it('이미 지급된 금액을 제외한다', () => {
    const entries: LedgerEntry[] = [
      { credit_account: SELLER, debit_account: 'user:9', amount: 10_000, fee_amount: 500 }, // net 9,500
    ]
    expect(payablePending(entries, SELLER, 0)).toBe(9_500)
    expect(payablePending(entries, SELLER, 9_500)).toBe(0) // 전액 지급됨
    expect(payablePending(entries, SELLER, 4_500)).toBe(5_000)
  })

  it('다른 payee 의 원장은 섞이지 않는다', () => {
    const entries: LedgerEntry[] = [
      { credit_account: SELLER, debit_account: 'user:9', amount: 10_000, fee_amount: 500 },
      { credit_account: 'seller:2', debit_account: 'user:9', amount: 50_000, fee_amount: 2_500 },
    ]
    expect(ledgerReceivable(entries, SELLER)).toBe(9_500)
    expect(ledgerReceivable(entries, 'seller:2')).toBe(47_500)
  })
})
