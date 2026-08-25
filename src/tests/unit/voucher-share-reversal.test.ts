import { describe, it, expect } from 'vitest'
import { reverseVoucherCommissionShares } from '../../worker/utils/ledger'

/**
 * 💸 [머니 룰 #2] 이용권 커미션 셰어의 **적립-역전 대칭**.
 *
 * 🩸 2026-08-25 실측: `voucher:N:agency` / `voucher:N:intro-inf` 원장 엔트리를 되돌리는 코드가
 *   **어디에도 없었다**(clawbackVoucherCommission 은 influencer_balances 만, recordVoucherRefundLedger
 *   는 호출부 0). 설계 문서엔 "역전이 debit_account 를 읽어 복원한다"고 적혀 있었지만 그런 코드는
 *   없었다 — **문서를 믿고 넘어가면 안 되는 클래스**라 테스트로 박는다.
 *
 * ⚠️ 이 테스트가 못 막는 것: 딜포인트로 지급된 분(비사업자)의 회수. 그건 원장이 아니라
 *   point_transactions 경로이고 별건이다.
 */
function fakeDb(rows: Array<Record<string, unknown>>) {
  const written: Array<Record<string, unknown>> = []
  return {
    written,
    prepare(sql: string) {
      const args: unknown[] = []
      const self = {
        bind: (...a: unknown[]) => { args.push(...a); return self },
        async first<T>() {
          if (/SELECT amount, debit_account, credit_account/.test(sql)) {
            return (rows.find((r) => r.reference_id === args[0]) ?? null) as T | null
          }
          if (/SELECT id FROM ledger_entries WHERE reference_id/.test(sql)) {
            return (written.find((w) => w.reference_id === args[0]) ? { id: 1 } : null) as T | null
          }
          return null as T | null
        },
        async run() {
          if (/INSERT INTO ledger_entries/.test(sql)) {
            written.push({ reference_id: args[1], amount: args[2], debit_account: args[3], credit_account: args[4] })
          }
          return { meta: { changes: 1 } }
        },
        async all<T>() { return { results: [] as T[] } },
      }
      return self
    },
  } as never
}

describe('[머니 룰 #2] 이용권 셰어 역전', () => {
  it('🔑 debit/credit 을 뒤집어 되돌린다 (flip 상태와 무관하게 대칭)', async () => {
    const db = fakeDb([
      { reference_id: 'voucher:7:agency', amount: 300, debit_account: 'merchant:9', credit_account: 'agency:2' },
      { reference_id: 'voucher:7:intro-inf', amount: 200, debit_account: 'platform:revenue', credit_account: 'user:5' },
    ])
    const r = await reverseVoucherCommissionShares(db, 7, 'refund')
    expect(r.reversed).toBe(2)
    const w = (db as unknown as { written: Array<Record<string, unknown>> }).written
    const agency = w.find((x) => x.reference_id === 'voucher:7:agency:reversal')!
    // 매장 부담이었으면 매장으로 되돌아가야 한다 — 여기가 틀리면 매장이 환불분을 영구 부담한다.
    expect(agency.debit_account).toBe('agency:2')
    expect(agency.credit_account).toBe('merchant:9')
    const intro = w.find((x) => x.reference_id === 'voucher:7:intro-inf:reversal')!
    expect(intro.credit_account).toBe('platform:revenue')
  })

  it('멱등 — 두 번 불러도 역전은 1회뿐', async () => {
    const db = fakeDb([
      { reference_id: 'voucher:8:agency', amount: 100, debit_account: 'platform:revenue', credit_account: 'agency:1' },
    ])
    await reverseVoucherCommissionShares(db, 8, 'refund')
    const second = await reverseVoucherCommissionShares(db, 8, 'refund')
    expect(second.reversed).toBe(0)
    expect((db as unknown as { written: unknown[] }).written.length).toBe(1)
  })

  it('적립이 없으면 no-op (환불만 있는 주문에서 유령 엔트리를 만들지 않는다)', async () => {
    const db = fakeDb([])
    expect((await reverseVoucherCommissionShares(db, 9, 'refund')).reversed).toBe(0)
    expect((db as unknown as { written: unknown[] }).written.length).toBe(0)
  })
})
