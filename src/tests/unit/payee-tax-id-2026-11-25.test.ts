/**
 * 🪪 개인 소득자 주민등록번호 + 간이지급명세서 — 2026-11-25 대표 *"나머지 다른 할 일 하고"*
 *
 * 고정하는 것:
 *   ① 형식 검사(13자리·생년월일·성별 자리) · 가림 표시
 *   ② **평문 저장 금지** — 키 없으면 저장 거부, 저장된 값은 암호문(v1:)이고 원문 숫자가 표에 없다
 *   ③ 간이지급명세서: 지급월 개인 소득자별 합계 · 3.3% → 소득세 3% / 지방 0.3% · 원문은 withIds 일 때만
 *   ④ 문: 본인 것만(requireAuth 인스턴스) · 어드민 CSV 는 2FA + 감사 로그 · 월 요약에 미등록 수
 * ⚠️ 못 보는 것: 홈택스 전자제출 양식 변환 · 실제 신고.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { d1, openLiveSchema, insert, q1 } from '../helpers/live-d1'
import { normalizeRrn, maskRrn, saveTaxId, getTaxIdStatus, TaxIdError } from '@/worker/utils/payee-tax-id'
import { computeSimplifiedStatement, splitWithholding, simplifiedStatementCsv } from '@/worker/utils/simplified-payment-statement'
import { monthlyCloseMessage, type MonthlyAccounting } from '@/worker/utils/monthly-accounting'

const KEK = 'test-kek-0123456789abcdef'
const read = (p: string) => readFileSync(p, 'utf8')

describe('① 형식', () => {
  it('13자리·월일·성별 자리를 본다', () => {
    expect(normalizeRrn('900101-1234567')).toBe('9001011234567')
    for (const bad of ['900101-123456', '901301-1234567', '900100-1234567', '900101-9234567', 'abc']) expect(normalizeRrn(bad)).toBeNull()
    expect(maskRrn('9001011234567')).toBe('900101-1******')
  })
})

describe('② 저장', () => {
  it('키 없으면 거부 · 저장값은 암호문 · 상태는 가린 값만', async () => {
    const raw = openLiveSchema()
    const DB = d1(raw)
    await expect(saveTaxId(DB, undefined, 'influencer', '7', '홍길동', '9001011234567')).rejects.toBeInstanceOf(TaxIdError)
    await saveTaxId(DB, KEK, 'influencer', '7', '홍길동', '900101-1234567')
    const row = q1<{ rrn_enc: string; rrn_masked: string }>(raw, 'SELECT rrn_enc, rrn_masked FROM payee_tax_ids WHERE payee_id = ?', '7')!
    expect(row.rrn_enc.startsWith('v1:')).toBe(true)
    expect(row.rrn_enc).not.toContain('1234567')
    expect(await getTaxIdStatus(DB, 'influencer', '7')).toMatchObject({ registered: true, legalName: '홍길동', masked: '900101-1******' })
  })
})

describe('③ 간이지급명세서', () => {
  it('지급월 합계 · 세금 분리 · 원문은 withIds 일 때만 · 미등록 표시', async () => {
    const raw = openLiveSchema()
    const DB = d1(raw)
    const { logInfluencerWithholding } = await import('@/worker/utils/influencer-withholding-log')
    const at = new Date('2026-11-10T03:00:00Z')
    await logInfluencerWithholding(DB, { influencerId: '7', gross: 100000, withholdingPct: 3.3, withholding: 3300, net: 96700, sourceId: 'p1' }, at)
    await logInfluencerWithholding(DB, { influencerId: '7', gross: 50000, withholdingPct: 3.3, withholding: 1650, net: 48350, sourceId: 'p2' }, at)
    await logInfluencerWithholding(DB, { influencerId: '8', gross: 10000, withholdingPct: 3.3, withholding: 330, net: 9670, sourceId: 'p3' }, at)
    await saveTaxId(DB, KEK, 'influencer', '7', '홍길동', '9001011234567')
    expect(splitWithholding(3300)).toEqual({ incomeTax: 3000, localTax: 300 })
    const full = await computeSimplifiedStatement(DB, KEK, '2026-11', true)
    const a = full.find((r) => r.payeeId === '7')!
    expect(a).toMatchObject({ gross: 150000, withholding: 4950, incomeTax: 4500, localTax: 450, name: '홍길동', rrn: '900101-1234567' })
    expect(full.find((r) => r.payeeId === '8')).toMatchObject({ name: null, rrn: null })
    const masked = await computeSimplifiedStatement(DB, KEK, '2026-11', false)
    expect(masked.find((r) => r.payeeId === '7')?.rrn).not.toContain('1234567')
    const csv = simplifiedStatementCsv('2026-11', full)
    expect(csv).toContain('제출 기한 2026-12-31')
    expect(csv).toContain('(미등록 #8)')
  })
  it('월 요약에 대상 수·미등록 수·기한', () => {
    const a: MonthlyAccounting = { month: '2026-11', defaultRate: 5, sales: { n: 0, gmv: 0, commission: 0 }, refunds: { n: 0, refunded: 0 }, payouts: [], wht: { n: 0, gross: 0, withholding: 0, net: 0 } }
    const m = monthlyCloseMessage(a, { n: 0, total: 0 }, { simplified: { payees: 2, missingId: 1, due: '2026-12-31' } })
    expect(m.message).toMatch(/간이지급명세서\(사업소득\) 2명 — 12월 31일까지 제출 · ⚠️ 주민번호 미등록 1명/)
  })
})

describe('④ 문', () => {
  it('본인 것만 · 어드민 CSV 는 2FA · 감사 로그', () => {
    expect(read('src/features/group-buy/api/marketing.routes.ts')).toMatch(/registerTaxIdRoutes\(influencerApp\)/)
    expect(read('src/features/group-buy/api/marketing/tax-id.ts')).toMatch(/c\.get\('user'\)\?\.id/)
    expect(read('src/features/admin/api/admin-fee-invoices.routes.ts')).toMatch(/simplified-statement', requireAdminRole\('finance'\), require2FA\(\), auditLog\(/)
  })
})

describe('⑤ 에이전시 · 처리방침', () => {
  it('개인 에이전시도 같은 표에 · 저장은 관리자만', () => {
    const src = read('src/features/agency-console/api/agency-payout.routes.ts')
    expect(src).toMatch(/app\.put\('\/tax-id', cors\(\), requireAgencyStaff\(\{ adminOnly: true \}\)/)
    expect(src).toMatch(/saveTaxId\(c\.env\.DB as D1Database, \(c\.env as \{ DATA_ENCRYPTION_KEY\?: string \}\)\.DATA_ENCRYPTION_KEY, 'agency'/)
  })
  it('개인정보 처리방침이 주민등록번호 수집·보관 기간을 적는다', () => {
    const p = read('src/pages/PrivacyPolicyPage.tsx')
    expect(p).toMatch(/필수항목: 실명, 주민등록번호, 정산 계좌/)
    expect(p).toMatch(/원천징수·지급명세서 관련 기록\(실명·주민등록번호 포함\): 5년/)
  })
})
