/**
 * 🔎 정산 안전장치 3종 — 2026-11-25 대표 *"응 모두 해줘"*
 *   ① 토스 입금 대사: 우리 카드 결제 ↔ 토스 정산(읽기) — 토스에 없는 결제·금액 불일치를 잡는다
 *   ② 주민번호 미등록 개인 소개자는 현금 지급에서 뺀다(cron 대기 · 어드민 지급 둘 다)
 *   ③ 정산 생성 때 사장님에게 "목요일 N원 입금 예정" (송금 완료 알림은 기존 `payout-sent-notify`)
 * ⚠️ 못 보는 것: 토스 실응답(가짜 fetch 로 형식만) · 은행 실이체.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { d1, openLiveSchema, insert, q1 } from '../helpers/live-d1'
import { reconcile, reconWindow, runTossSettlementRecon } from '@/worker/utils/toss-settlement-recon'

const read = (p: string) => readFileSync(p, 'utf8')

describe('① 토스 입금 대사', () => {
  it('대상일은 3일 전(KST) · 조회는 그 전날부터 어제까지', () => {
    expect(reconWindow(Date.parse('2026-11-25T03:00:00Z'))).toEqual({ day: '2026-11-22', start: '2026-11-21', end: '2026-11-24' })
  })
  it('토스에 없는 결제 · 금액 불일치 · 환불 섞인 건은 확인 필요 · 토스에만 있는 건은 정보', () => {
    const r = reconcile('2026-11-22', [
      { paymentKey: 'a', orderId: 'O-A', amount: 10000, payOutAmount: 9725, approvedAt: '2026-11-22T10:00:00+09:00', fees: [{ fee: 275 }] },
      { paymentKey: 'b', orderId: 'O-B', amount: 9000, approvedAt: '2026-11-22T11:00:00+09:00' },
      { paymentKey: 'c', orderId: 'O-C', amount: 5000, approvedAt: '2026-11-22T12:00:00+09:00' },
      { paymentKey: 'z', orderId: 'GIFT-1', amount: 3000, approvedAt: '2026-11-22T13:00:00+09:00' },
      { paymentKey: 'y', orderId: 'OTHER', amount: 1000, approvedAt: '2026-11-21T13:00:00+09:00' }, // 다른 날 — 제외
    ], [
      { paymentKey: 'a', orderNumber: 'O-A', expected: 10000, refunded: 0 },
      { paymentKey: 'b', orderNumber: 'O-B', expected: 10000, refunded: 0 },
      { paymentKey: 'c', orderNumber: 'O-C', expected: 6000, refunded: 1000 },
      { paymentKey: 'd', orderNumber: 'O-D', expected: 7000, refunded: 0 },
      { paymentKey: 'e', orderNumber: 'O-E', expected: 7000, refunded: 7000 }, // 전액 환불 — 토스에 없어도 문제 아님
    ])
    expect(r.missingInToss).toEqual([{ orderNumber: 'O-D', expected: 7000 }])
    expect(r.mismatched).toEqual([{ orderNumber: 'O-B', expected: 10000, toss: 9000 }])
    expect(r.needsCheck).toHaveLength(1)
    expect(r.unmatchedToss).toEqual([{ orderId: 'GIFT-1', amount: 3000 }])
    expect(r).toMatchObject({ tossAmount: 27000, payOut: 9725, fee: 275 })
  })
  it('키 없으면 건너뛴다 · 하루 한 번 · 불일치면 어드민 알림 · 조회 실패는 기록하지 않는다', async () => {
    const raw = openLiveSchema()
    const DB = d1(raw)
    expect(await runTossSettlementRecon(DB, undefined)).toEqual({ skipped: 'no_key' })
    insert(raw, 'orders', { order_number: 'R-1', user_id: 1, total_amount: 10000, status: 'PAID', payment_method: 'toss', payment_key: 'pk1', paid_at: '2026-11-22 03:00:00' })
    const now = Date.parse('2026-11-25T03:00:00Z')
    const broken = (async () => new Response('err', { status: 500 })) as unknown as typeof fetch
    await expect(runTossSettlementRecon(DB, 'test_sk_x', now, broken)).rejects.toThrow(/HTTP 500/)
    const empty = (async () => new Response('[]', { status: 200 })) as unknown as typeof fetch
    const r = await runTossSettlementRecon(DB, 'test_sk_x', now, empty)
    expect(r.result?.missingInToss).toEqual([{ orderNumber: 'R-1', expected: 10000 }])
    expect(q1<{ n: number }>(raw, "SELECT COUNT(*) n FROM dashboard_notifications WHERE type = 'toss_settlement_mismatch'")?.n).toBe(1)
    expect(await runTossSettlementRecon(DB, 'test_sk_x', now, empty)).toEqual({ skipped: 'already_done' })
  })
  it('매일 도는 cron 이 부른다 · 결제 잠금 파일은 안 건드린다', () => {
    expect(read('src/worker/cron/influencer-payout.ts')).toMatch(/runTossSettlementRecon\(DB, env\.TOSS_SECRET_KEY\)/)
    expect(read('src/worker/utils/toss-gateway.ts')).not.toMatch(/settlements/)
  })
})

describe('② 주민번호 미등록 개인은 현금 지급에서 뺀다', () => {
  it('cron 송금 대기 · 어드민 지급 둘 다', () => {
    const cron = read('src/worker/cron/influencer-payout.ts')
    expect(cron).toMatch(/if \(withholding > 0 && !String\(inf\.business_number \|\| ''\)\.trim\(\)\) \{[\s\S]{0,400}getTaxIdStatus\(DB, 'influencer'/)
    expect(cron).toMatch(/missingTaxId\.push/)
    const proc = read('src/features/group-buy/api/marketing/payouts.ts')
    const i = proc.indexOf("code: 'PAYOUT_NO_TAX_ID'"), j = proc.indexOf('이중 지급 차단 CAS')
    expect(i).toBeGreaterThan(0)
    expect(i).toBeLessThan(j) // 잔액을 0 으로 밀기 전에 막는다
  })
})

describe('③ 입금 예정 알림', () => {
  it('정산 건이 생길 때 매장에 목요일 입금 예정', () => {
    const src = read('src/worker/cron/payouts-generate.ts')
    expect(src).toMatch(/'payout_scheduled'/)
    expect(src.indexOf("'payout_scheduled'")).toBeGreaterThan(src.indexOf('INSERT OR IGNORE INTO payouts'))
  })
})
