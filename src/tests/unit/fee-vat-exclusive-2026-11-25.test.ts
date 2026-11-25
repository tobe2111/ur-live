/**
 * 🧾 수수료 부가세 별도 — 2026-11-25 대표 *"1번 부가세 별도로 하자. 그렇게 구현도 해줘"*
 *   결재 `docs/decisions/2026-11-25-fee-vat-exclusive.md`
 *
 * 고정하는 것:
 *   ① 규칙(순수): 시작일(KST) 이상이면 수수료 × 10% · 비우면 2027-01-01 · `off` 면 끔.
 *   ② 사용 시점 분개: 부가세가 매장 몫에서 빠져 `platform:vat_payable` 에 쌓이고(유어딜 수익 줄은 그대로),
 *      매장이 받을 돈이 정확히 그만큼 준다. 사용 취소는 그 줄도 뒤집는다. 시작일 전이면 종전과 같다.
 *   ③ 사전 안내: 시작일 전 승인 매장마다 한 번, 시작 뒤엔 0.
 *   ④ 월 회계 요약에 부가세 예수금이 따로 잡힌다.
 *   ⑤ 대외 문구(약관·FAQ·셀러 가이드)가 부가세 별도를 말하고, 매장에 역발행을 안내하지 않는다.
 *
 * ⚠️ 못 보는 것: 실제 세금계산서 발행(발행 사업자 연동 전) · 간이·면세 매장의 공제 여부(세무 사실).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { d1, openLiveSchema, insert, q, q1 } from '../helpers/live-d1'
import { resolveFeeVatFrom, feeVatApplies, feeVatAmount, feePctWithVat, DEFAULT_FEE_VAT_FROM, FEE_VAT_ACCOUNT } from '@/shared/fee-vat'
import { recordVoucherUsedLedger, reverseVoucherUsedLedger, getLedgerReceivable } from '@/worker/utils/ledger'
import { sendFeeVatNotices } from '@/worker/utils/fee-vat-notice'
import { computeMonthlyAccounting } from '@/worker/utils/monthly-accounting'

const read = (p: string) => readFileSync(p, 'utf8')

describe('① 규칙', () => {
  it('시작일 해석 — 비었거나 형식이 틀리면 기본값, off 면 끔', () => {
    expect(resolveFeeVatFrom(undefined)).toBe(DEFAULT_FEE_VAT_FROM)
    expect(resolveFeeVatFrom('bogus')).toBe('2027-01-01')
    expect(resolveFeeVatFrom('2027-02-01')).toBe('2027-02-01')
    expect(resolveFeeVatFrom('OFF')).toBeNull()
  })
  it('KST 날짜로 판정 — 2026-12-31 15:00Z = 2027-01-01 00시 KST', () => {
    expect(feeVatApplies(Date.parse('2026-12-31T14:59:00Z'), '2027-01-01')).toBe(false)
    expect(feeVatApplies(Date.parse('2026-12-31T15:00:00Z'), '2027-01-01')).toBe(true)
    expect(feeVatApplies(Date.now(), null)).toBe(false)
  })
  it('금액 — 수수료의 10%, 반올림 · 이상값 0 · 표시 % 는 ×1.1', () => {
    expect(feeVatAmount(1000)).toBe(100)
    expect(feeVatAmount(555)).toBe(56)
    expect(feeVatAmount(-5)).toBe(0)
    expect(feePctWithVat(10, true)).toBe(11)
    expect(feePctWithVat(5, true)).toBe(5.5)
    expect(feePctWithVat(10, false)).toBe(10)
  })
})

function setup(from: string | null) {
  const raw = openLiveSchema()
  const DB = d1(raw)
  if (from !== null) insert(raw, 'platform_settings', { key: 'fee_vat_exclusive_from', value: from })
  return { raw, DB }
}

describe('② 사용 시점 분개', () => {
  it('적용 중이면 매장 몫에서 수수료 부가세가 빠져 예수금으로 간다', async () => {
    const { raw, DB } = setup('2020-01-01')
    const r = await recordVoucherUsedLedger(DB, { voucher_id: 901, order_amount: 10000, merchant_id: 77, platform_rate: 0.1, seller_rate: 0 })
    expect(r).toMatchObject({ merchant_amount: 8900, platform_amount: 1000, vat_amount: 100 })
    const rows = q<{ amount: number; credit_account: string }>(raw, "SELECT amount, credit_account FROM ledger_entries WHERE reference_id = 'voucher:901' AND event_type = 'voucher_used' ORDER BY id")
    expect(rows.find((x) => x.credit_account === 'platform:revenue')?.amount).toBe(1000) // 유어딜 수익은 수수료(공급가액) 그대로
    expect(rows.find((x) => x.credit_account === FEE_VAT_ACCOUNT)?.amount).toBe(100)
    expect(rows.reduce((s, x) => s + x.amount, 0)).toBe(10000) // 보관금에서 정확히 결제액만큼 나간다
    expect(await getLedgerReceivable(DB, 'merchant:77')).toBe(8900)
    // 사용 취소 → 부가세 줄도 뒤집힌다
    await reverseVoucherUsedLedger(DB, 901, 'test')
    expect(await getLedgerReceivable(DB, 'merchant:77')).toBe(0)
    const vat = q1<{ v: number }>(raw, `SELECT COALESCE(SUM(CASE WHEN credit_account = ? THEN amount ELSE 0 END),0) - COALESCE(SUM(CASE WHEN debit_account = ? THEN amount ELSE 0 END),0) AS v FROM ledger_entries`, FEE_VAT_ACCOUNT, FEE_VAT_ACCOUNT)
    expect(vat?.v).toBe(0)
  })
  it('시작일 전(기본 2027-01-01, 오늘 2026) · off 면 종전과 같다', async () => {
    for (const from of [null, 'off']) {
      const { raw, DB } = setup(from)
      const r = await recordVoucherUsedLedger(DB, { voucher_id: 902, order_amount: 10000, merchant_id: 78, platform_rate: 0.1, seller_rate: 0 })
      if (from === null && feeVatApplies(Date.now(), DEFAULT_FEE_VAT_FROM)) continue // 2027 이후 실행이면 기본값이 켜져 있는 게 맞다
      expect(r.vat_amount).toBe(0)
      expect(r.merchant_amount).toBe(9000)
      expect(q(raw, 'SELECT 1 FROM ledger_entries WHERE credit_account = ?', FEE_VAT_ACCOUNT)).toHaveLength(0)
    }
  })
  it('쇼핑 적립도 같은 함수로 부가세를 함께 뗀다(역전은 amount − fee_amount 대칭)', () => {
    const src = read('src/worker/utils/order-ledger-credit.ts')
    expect(src).toMatch(/feeVatFor\(DB, platformFee\)/)
    expect(src).toMatch(/fee_amount: platformFee \+ promoFee \+ feeVat/)
  })
})

describe('③ 사전 안내', () => {
  it('시작 전엔 승인 매장마다 한 번 · 다시 돌려도 한 장 · 시작 뒤엔 0', async () => {
    const { raw, DB } = setup('2099-01-01')
    const a = insert(raw, 'sellers', { username: 'vat-a', password_hash: '', name: 'A', email: 'a@example.test', status: 'approved', seller_type: 'store_owner' })
    insert(raw, 'sellers', { username: 'vat-b', password_hash: '', name: 'B', email: 'b@example.test', status: 'pending', seller_type: 'store_owner' })
    expect((await sendFeeVatNotices(DB)).sent).toBe(1)
    expect((await sendFeeVatNotices(DB)).sent).toBe(0)
    const n = q<{ recipient_id: string; type: string; title: string }>(raw, "SELECT recipient_id, type, title FROM dashboard_notifications WHERE type = 'fee_vat_notice'")
    expect(n).toHaveLength(1)
    expect(n[0].recipient_id).toBe(String(a))
    expect(n[0].title).toMatch(/2099년 1월 1일부터 수수료는 부가세 별도/)
    const started = setup('2020-01-01')
    insert(started.raw, 'sellers', { username: 'vat-c', password_hash: '', name: 'C', email: 'c@example.test', status: 'approved', seller_type: 'store_owner' })
    expect(await sendFeeVatNotices(started.DB)).toEqual({ sent: 0, skipped: 'started' })
  })
  it('매일 도는 정산 cron 이 부른다', () => {
    expect(read('src/worker/cron/influencer-payout.ts')).toMatch(/sendFeeVatNotices\(DB\)/)
  })
})

describe('④ 월 회계 요약', () => {
  it('부가세 예수금이 수수료 수익과 따로 잡힌다', async () => {
    const { DB } = setup('2020-01-01')
    await recordVoucherUsedLedger(DB, { voucher_id: 903, order_amount: 20000, merchant_id: 79, platform_rate: 0.1, seller_rate: 0 })
    const month = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7)
    expect((await computeMonthlyAccounting(DB, month)).feeVat).toBe(200)
  })
})

describe('⑤ 대외 문구', () => {
  it('약관 · FAQ · 셀러 가이드가 부가세 별도를 말한다', () => {
    expect(read('src/pages/terms/seller-terms-content.ts')).toMatch(/수수료율에는 부가가치세가 포함되어 있지 않으며/)
    expect(read('src/shared/landing-faq.ts')).toMatch(/F\.feeVatNote/)
    const guide = read('src/features/guides/api/guide-seed-settlement.ts')
    expect(guide).toMatch(/수수료 부가세\(수수료의 10%/)
    expect(guide).not.toMatch(/세금계산서 역발행 \(사업자 유저 — 직접 발행 불필요\)/) // 중개 구조 — 매장에 역발행을 안내하지 않는다
  })
  it('실수령 화면은 서버가 준 적용 여부로 ×1.1 을 계산한다', () => {
    expect(read('src/features/seller/api/seller-stores.routes.ts')).toMatch(/feeVatContext\(c\.env\.DB\)/)
    expect(read('src/pages/seller-meal-voucher/NetProceedsCard.tsx')).toMatch(/feePctWithVat\(fee\.platform_fee_pct, vatOn\)/)
    expect(read('src/pages/store-new/FirstVoucherPage.tsx')).toMatch(/feePctWithVat\(feePct, feeVat\)/)
  })
})
