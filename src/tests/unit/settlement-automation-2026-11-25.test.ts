/**
 * ✅ 정산 자동화(지급대행 없이) — 2026-11-25 대표
 *   *"알고보니 지급대행 필수가 아니었어 … 최대한 자동화하자 지급대행 안쓰는 선에서. 이후에 도입을 하더라도"*
 *   결재 `docs/decisions/2026-11-03-settlement-structure.md` (11-25 갱신)
 *
 * 고정하는 것:
 *   ① 소액 자동 승인은 기본 꺼짐(0)이고, 단건 승인과 **같은 함수**(`approvePayoutGuarded`)를 지난다 — 가드가 갈리지 않게.
 *   ② 그 함수의 가드 순서: pending → 계좌 채우기/없으면 막기 → 계좌 재확인 → 받을 돈 → CAS.
 *   ③ 월 회계 마감 요약은 세무사용 CSV 와 **같은 집계**(`computeMonthlyAccounting`)를 쓰고, 한 달에 한 번만 보낸다.
 *   ④ 서비스 문구가 "12월부터 지급대행으로 송금" 을 더 약속하지 않는다(의무 아님 · 선택).
 *
 * ⚠️ 못 보는 것: 실제 은행 이체(사람이 한다) · 자동 승인 상한 금액의 적정성(대표 결정).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolveAutoApproveMax } from '@/worker/utils/payout-approve'
import { previousKstMonthKey, monthlyCloseMessage, type MonthlyAccounting } from '@/worker/utils/monthly-accounting'

const read = (p: string) => readFileSync(p, 'utf8')

describe('① 소액 자동 승인 — 기본 꺼짐 · 같은 가드', () => {
  it('비었거나 0·음수·문자·비상식 값이면 꺼짐(0)', () => {
    for (const v of [undefined, null, '', '0', '-5', 'abc', '999999999999']) expect(resolveAutoApproveMax(v)).toBe(0)
    expect(resolveAutoApproveMax('500000')).toBe(500000)
  })
  it('자동 승인과 단건 승인 라우트가 같은 approvePayoutGuarded 를 부른다', () => {
    const util = read('src/worker/utils/payout-approve.ts')
    const fn = util.slice(util.indexOf('export async function autoApproveSmallPayouts'))
    expect(fn).toMatch(/if \(max <= 0\) return/)
    expect(fn).toMatch(/approvePayoutGuarded\(DB, Number\(r\.id\)\)/)
    expect(fn).toMatch(/kind, ''\) != 'handover_closeout'/)
    const route = read('src/features/admin/api/admin-payouts.routes.ts')
    const approve = route.slice(route.indexOf("'/admin/payouts/:id/approve'"), route.indexOf("'/admin/payouts/:id/sent'"))
    expect(approve).toMatch(/approvePayoutGuarded\(c\.env\.DB, id\)/)
    expect(approve).not.toMatch(/UPDATE payouts SET status = 'approved'/) // CAS 를 따로 두지 않는다
  })
  it('주간 정산 cron 이 생성 직후 자동 승인을 돌리고 알림에 사람 할 일을 적는다', () => {
    const src = read('src/worker/cron/payouts-generate.ts')
    expect(src.indexOf('autoApproveSmallPayouts(DB)')).toBeGreaterThan(src.indexOf('INSERT OR IGNORE INTO payouts'))
    expect(src).toMatch(/승인 대기 \$\{/)
    expect(src).toMatch(/이체할 건 \$\{/)
  })
})

describe('② 승인 가드 순서', () => {
  it('pending → 계좌 채우기 → 계좌 없음 차단 → 계좌 재확인 → 받을 돈 → CAS', () => {
    const src = read('src/worker/utils/payout-approve.ts')
    const fn = src.slice(src.indexOf('export async function approvePayoutGuarded'), src.indexOf('export function resolveAutoApproveMax'))
    const order = [
      "row.status !== 'pending'",
      'fillMissingPayoutAccount(DB, row)',
      "code: 'PAYOUT_NO_ACCOUNT'",
      'checkPayeeAccountCurrent(DB, row)',
      'checkPayoutWithinReceivable(DB, row)',
      "WHERE id = ? AND status = 'pending'",
    ].map((k) => fn.indexOf(k))
    for (const i of order) expect(i).toBeGreaterThan(0)
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1])
  })
})

describe('③ 월 회계 마감 요약', () => {
  it('지난달은 KST 기준 — 12월 1일 04시 KST 면 11월, 1월이면 지난해 12월', () => {
    expect(previousKstMonthKey(Date.parse('2026-11-30T19:00:00Z'))).toBe('2026-11')
    expect(previousKstMonthKey(Date.parse('2027-01-01T04:00:00+09:00'))).toBe('2026-12')
  })
  it('원천징수가 있으면 다음 달 10일 신고 기한을, 안 보낸 정산이 있으면 경고를 적는다', () => {
    const a: MonthlyAccounting = {
      month: '2026-11', defaultRate: 5,
      sales: { n: 3, gmv: 100000, commission: 7500 }, refunds: { n: 0, refunded: 0 },
      payouts: [{ payee_type: 'seller', n: 2, total: 80000 }], wht: { n: 1, gross: 10000, withholding: 330, net: 9670 },
    }
    const m = monthlyCloseMessage(a, { n: 1, total: 12000 })
    expect(m.title).toMatch(/2026년 11월 회계 마감 요약/)
    expect(m.message).toMatch(/원천세 신고·납부 12월 10일까지/)
    expect(m.message).toMatch(/아직 안 보낸 정산 1건 12,000원/)
    expect(monthlyCloseMessage({ ...a, wht: { n: 0, gross: 0, withholding: 0, net: 0 } }, { n: 0, total: 0 }).message).not.toMatch(/신고/)
  })
  it('세무사용 CSV 라우트와 요약이 같은 집계를 쓰고, 한 달에 한 번만(UNIQUE + INSERT OR IGNORE)', () => {
    expect(read('src/features/admin/api/admin-tax.routes.ts')).toMatch(/computeMonthlyAccounting\(DB, month\)/)
    const util = read('src/worker/utils/monthly-accounting.ts')
    expect(util).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_close_reports_month ON monthly_close_reports\(month\)/)
    expect(util).toMatch(/INSERT OR IGNORE INTO monthly_close_reports/)
    const cron = read('src/worker/cron/influencer-payout.ts')
    expect(cron).toMatch(/getUTCDate\(\) === 1\)/)
    expect(cron).toMatch(/sendMonthlyCloseSummary\(DB, Date\.now\(\), env/)
  })
})

describe('④ 지급대행은 선택 — 서비스 문구가 더 약속하지 않는다', () => {
  it.each([
    'src/features/guides/api/guide-seed-settlement.ts',
    'docs/business/urdeal-business-plan.md',
    'docs/design/urdeal-platform-model.md',
  ])('%s', (f) => {
    expect(read(f)).not.toMatch(/12월부터[^\n]{0,40}지급대행/)
  })
  it('토스 지급대행 스위치는 기본 꺼짐 그대로 남아 있다(나중 도입용)', () => {
    expect(read('src/worker/utils/toss-payouts.ts')).toMatch(/TOSS_PAYOUTS_GATE = 'toss_payouts_enabled'/)
    expect(read('src/pages/admin-platform-settings/money-switch-fields.ts')).toMatch(/key: 'toss_payouts_enabled', label: '토스 지급대행\(매장 정산 송금\)', default: 'false'/)
  })
})
