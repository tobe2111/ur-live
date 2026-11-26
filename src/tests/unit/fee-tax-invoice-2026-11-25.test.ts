/**
 * 🧾 매장 수수료 세금계산서(정발행) 초안 · 분기 판매대행 명세 — 2026-11-25 대표 *"너가 할 수 있는거 해줘"*
 *
 * 고정하는 것:
 *   ① 금액 = 원장의 사용 분개(수수료 줄 · 부가세 줄 − 사용 취소). 부가세 별도 시작 전 건은 받은 수수료를 부가세 포함으로 나눈다.
 *   ② 초안은 멱등 — 다시 만들어도 한 장, 발행 완료된 건은 덮지 않는다. 발행 완료는 초안에서만(CAS).
 *   ③ 판매대행 명세는 매장·월·결제수단별, 환불은 주문 안 비율로, 매장 없는 플랫폼 상품은 빠진다.
 *   ④ 매월 1일 요약이 초안 수와 분기 명세 기한을 적는다. CSV 는 수식 인젝션을 막는다.
 *
 * ⚠️ 못 보는 것: 홈택스·발행 사업자로의 실제 발행 · 국세청 판매대행 명세 전자제출 형식(세무사 확인 대상).
 */
import { describe, it, expect } from 'vitest'
import { d1, openLiveSchema, insert, q1 } from '../helpers/live-d1'
import { recordVoucherUsedLedger, reverseVoucherUsedLedger } from '@/worker/utils/ledger'
import { buildFeeInvoiceDrafts, listFeeInvoices, markFeeInvoiceIssued, splitFee, invoiceDates, feeInvoicesCsv } from '@/worker/utils/fee-tax-invoice'
import { computeSalesAgencyReport, quarterInfo, previousKstQuarter, salesAgencyCsv } from '@/worker/utils/sales-agency-report'
import { monthlyCloseMessage, type MonthlyAccounting } from '@/worker/utils/monthly-accounting'

const thisMonth = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7)

describe('① 금액', () => {
  it('부가세 줄이 있으면 수수료 = 공급가액, 없으면 부가세 포함으로 나눈다', () => {
    expect(splitFee(1000, 100)).toEqual({ supply: 1000, vat: 100 })
    expect(splitFee(1100, 0)).toEqual({ supply: 1000, vat: 100 })
  })
  it('작성일 = 말일 · 기한 = 다음 달 10일(연말 넘어감 포함)', () => {
    expect(invoiceDates('2027-02')).toEqual({ writeDate: '2027-02-28', dueDate: '2027-03-10' })
    expect(invoiceDates('2026-12')).toEqual({ writeDate: '2026-12-31', dueDate: '2027-01-10' })
  })
})

describe('② 초안', () => {
  it('매장별로 합치고, 취소분은 빼고, 다시 만들어도 한 장 · 발행 완료는 덮지 않는다', async () => {
    const raw = openLiveSchema()
    const DB = d1(raw)
    const S = insert(raw, 'sellers', { username: 'fi-a', password_hash: '', name: '사장', email: 'a@example.test', business_name: '시험식당', business_number: '123-45-67890', status: 'approved', seller_type: 'store_owner' })
    insert(raw, 'platform_settings', { key: 'fee_vat_exclusive_from', value: '2020-01-01' })
    await recordVoucherUsedLedger(DB, { voucher_id: 1, order_amount: 10000, merchant_id: S, platform_rate: 0.1, seller_rate: 0 })
    await recordVoucherUsedLedger(DB, { voucher_id: 2, order_amount: 20000, merchant_id: S, platform_rate: 0.1, seller_rate: 0 })
    await recordVoucherUsedLedger(DB, { voucher_id: 3, order_amount: 5000, merchant_id: S, platform_rate: 0.1, seller_rate: 0 })
    await reverseVoucherUsedLedger(DB, 3, 'test') // 취소분은 빠진다
    const period = thisMonth()
    const r = await buildFeeInvoiceDrafts(DB, period)
    expect(r).toMatchObject({ drafts: 1, supply: 3000, vat: 300, missingBizNo: 0 })
    await buildFeeInvoiceDrafts(DB, period)
    const rows = await listFeeInvoices(DB, period)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ seller_id: S, supply_amount: 3000, vat_amount: 300, total_amount: 3300, buyer_biz_no: '1234567890', buyer_name: '시험식당', status: 'draft' })
    expect(await markFeeInvoiceIssued(DB, rows[0].id, 10, '20271210-41000000-12345678')).toBe(true)
    expect(await markFeeInvoiceIssued(DB, rows[0].id, 10, null)).toBe(false) // 두 번은 안 된다
    await recordVoucherUsedLedger(DB, { voucher_id: 4, order_amount: 10000, merchant_id: S, platform_rate: 0.1, seller_rate: 0 })
    await buildFeeInvoiceDrafts(DB, period)
    expect(q1<{ supply_amount: number; status: string }>(raw, 'SELECT supply_amount, status FROM fee_tax_invoices WHERE seller_id = ?', S)).toEqual({ supply_amount: 3000, status: 'issued' })
  })
  it('CSV 는 수식으로 시작하는 칸을 무력화한다', () => {
    const csv = feeInvoicesCsv([{ id: 1, seller_id: 1, period: '2027-01', write_date: '2027-01-31', supply_amount: 1, vat_amount: 0, total_amount: 1, voucher_count: 1, buyer_biz_no: null, buyer_name: '=HYPERLINK("x")', buyer_ceo: null, buyer_email: null, buyer_address: null, status: 'draft', nts_confirm_num: null, issued_at: null }])
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain('유어딜 중개수수료 (2027년 1월)')
  })
})

describe('③ 판매대행 명세', () => {
  it('분기 정보 — 4분기 기한은 다음 해 1월 15일, 1월의 지난 분기는 작년 4분기', () => {
    expect(quarterInfo('2026-Q4')).toEqual({ months: ['2026-10', '2026-11', '2026-12'], due: '2027-01-15' })
    expect(previousKstQuarter(Date.parse('2027-01-05T00:00:00Z'))).toBe('2026-Q4')
    expect(quarterInfo('2026-Q5')).toBeNull()
  })
  it('매장·결제수단별로 모으고 환불은 비율로, 매장 없는 상품은 뺀다', async () => {
    const raw = openLiveSchema()
    const DB = d1(raw)
    const A = insert(raw, 'sellers', { username: 'sa-a', password_hash: '', name: 'A', email: 'a@example.test', business_name: '가게A', representative_name: '대표A', business_number: '111-11-11111', status: 'approved', seller_type: 'store_owner' })
    const B = insert(raw, 'sellers', { username: 'sa-b', password_hash: '', name: 'B', email: 'b@example.test', business_name: '가게B', representative_name: '대표B', status: 'approved', seller_type: 'store_owner' })
    const pa = insert(raw, 'products', { name: 'A 이용권', price: 10000, seller_id: A })
    const pb = insert(raw, 'products', { name: 'B 이용권', price: 30000, seller_id: B })
    const pk = insert(raw, 'products', { name: '교환권', price: 5000 })
    const paidAt = '2026-11-10 03:00:00'
    const o1 = insert(raw, 'orders', { order_number: 'SA-1', user_id: 1, total_amount: 45000, status: 'PAID', payment_method: 'toss', paid_at: paidAt, refunded_amount: 4000 })
    insert(raw, 'order_items', { order_id: o1, product_id: pa, quantity: 1, price: 10000, subtotal: 10000 })
    insert(raw, 'order_items', { order_id: o1, product_id: pb, quantity: 1, price: 30000, subtotal: 30000 })
    insert(raw, 'order_items', { order_id: o1, product_id: pk, quantity: 1, price: 5000, subtotal: 5000 })
    const o2 = insert(raw, 'orders', { order_number: 'SA-2', user_id: 1, total_amount: 10000, status: 'PAID', payment_method: 'deal_points', paid_at: paidAt })
    insert(raw, 'order_items', { order_id: o2, product_id: pa, quantity: 1, price: 10000, subtotal: 10000 })
    const rows = await computeSalesAgencyReport(DB, '2026-Q4')
    const a = rows.filter((r) => r.sellerId === A)
    expect(a.find((r) => r.method === 'card')).toMatchObject({ orders: 1, gross: 10000, refunded: 889, net: 9111, bizNo: '1111111111', name: '가게A' })
    expect(a.find((r) => r.method === 'deal')).toMatchObject({ orders: 1, gross: 10000, refunded: 0 })
    expect(rows.find((r) => r.sellerId === B)).toMatchObject({ gross: 30000, bizNo: null })
    expect(rows.every((r) => r.sellerId === A || r.sellerId === B)).toBe(true) // 교환권(매장 없음)은 빠진다
    expect(salesAgencyCsv('2026-Q4', rows)).toContain('제출 기한 2027-01-15')
  })
})

describe('④ 월 1일 요약', () => {
  it('초안 수 · 사업자번호 없는 매장 · 분기 명세 기한을 적는다', () => {
    const a: MonthlyAccounting = { month: '2026-12', defaultRate: 5, sales: { n: 0, gmv: 0, commission: 0 }, refunds: { n: 0, refunded: 0 }, payouts: [], wht: { n: 0, gross: 0, withholding: 0, net: 0 } }
    const m = monthlyCloseMessage(a, { n: 0, total: 0 }, { feeInvoices: { drafts: 3, missingBizNo: 1 }, salesAgencyDue: '2027-01-15' })
    expect(m.message).toMatch(/매장 수수료 세금계산서 3장 준비됨 — 1월 10일까지 발행\(⚠️ 사업자번호 없는 매장 1곳\)/)
    expect(m.message).toMatch(/판매대행 명세 국세청 제출 1월 15일까지/)
  })
})

describe('⑤ 팝빌 즉시 발행', () => {
  it('링크허브 토큰 서명 — 공식 SDK(linkhub 1.8.2 TokenBuilder) 식과 같다', async () => {
    const { linkhubTokenRequest } = await import('@/worker/utils/popbill-invoice')
    const { createHash, createHmac } = await import('node:crypto')
    const secret = Buffer.from('test-secret-key-0123456789').toString('base64')
    const xDate = '2026-11-26T00:00:00Z'
    const r = await linkhubTokenRequest({ linkId: 'URDEAL', secretKey: secret, isTest: true }, '4790902930', xDate)
    expect(r.url).toBe('https://auth.linkhub.co.kr/POPBILL_TEST/Token')
    expect(JSON.parse(r.body)).toEqual({ access_id: '4790902930', scope: ['110', 'member'] })
    // SDK 와 같은 식을 node:crypto 로 따로 계산해 맞춘다(구현을 베끼지 않은 대조군).
    const bodyDigest = createHash('sha256').update(r.body).digest('base64')
    const target = 'POST\n' + bodyDigest + '\n' + xDate + '\n' + '*\n' + '2.0\n' + '/POPBILL_TEST/Token'
    const sig = createHmac('sha256', Buffer.from(secret, 'base64')).update(target).digest('base64')
    expect(r.headers.Authorization).toBe(`LINKHUB URDEAL ${sig}`)
    expect(r.headers).toMatchObject({ 'x-lh-date': xDate, 'x-lh-version': '2.0', 'x-lh-forwarded': '*', 'Content-Type': 'application/json' })
  })
  it('요청 시각은 yyyy-MM-ddTHH:mm:ssZ (밀리초 없음 — 팝빌 인증 문서)', async () => {
    const { linkhubDate } = await import('@/worker/utils/popbill-invoice')
    expect(linkhubDate(new Date('2026-11-26T03:41:17.839Z'))).toBe('2026-11-26T03:41:17Z')
    expect(linkhubDate()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  })
  it('Taxinvoice: 정과금·정발행·영수·과세 · 유어딜 → 매장 · 문서번호 UD{yyyymm}-{매장} · 금액은 문자열', async () => {
    const { popbillTaxinvoice } = await import('@/worker/utils/popbill-invoice')
    const t = popbillTaxinvoice({ id: 1, seller_id: 7, period: '2027-01', write_date: '2027-01-31', supply_amount: 3000, vat_amount: 300, total_amount: 3300, voucher_count: 2, buyer_biz_no: '1234567890', buyer_name: '시험식당', buyer_ceo: null, buyer_email: 'a@example.test', buyer_address: null, status: 'draft', nts_confirm_num: null, issued_at: null })
    expect(t).toMatchObject({ writeDate: '20270131', chargeDirection: '정과금', issueType: '정발행', purposeType: '영수', taxType: '과세', invoicerCorpNum: '4790902930', invoicerMgtKey: 'UD202701-7', invoiceeType: '사업자', invoiceeCorpNum: '1234567890', invoiceeEmail1: 'a@example.test', supplyCostTotal: '3000', taxTotal: '300', totalAmount: '3300' })
    expect(t).not.toHaveProperty('invoiceeCEOName') // 빈 값은 뺀다(SDK _stringify)
    expect((t.detailList as Array<Record<string, unknown>>)[0]).toMatchObject({ serialNum: '1', purchaseDT: '20270131', supplyCost: '3000', tax: '300' })
  })
  it('토큰 → 발행 · 성공은 issued(승인번호) · 실패는 초안 + 사유 · 이미 쓴 문서번호는 issued · 다시 보내지 않는다', async () => {
    const { sendFeeInvoicesViaPopbill } = await import('@/worker/utils/fee-tax-invoice')
    const raw = openLiveSchema()
    const DB = d1(raw)
    const A = insert(raw, 'sellers', { username: 'pb-a', password_hash: '', name: 'A', email: 'a@example.test', business_name: '가게A', representative_name: '대표A', business_number: '111-11-11111', status: 'approved', seller_type: 'store_owner' })
    const B = insert(raw, 'sellers', { username: 'pb-b', password_hash: '', name: 'B', email: 'b@example.test', business_name: '가게B', representative_name: '대표B', business_number: '222-22-22222', status: 'approved', seller_type: 'store_owner' })
    const C = insert(raw, 'sellers', { username: 'pb-c', password_hash: '', name: 'C', email: 'c@example.test', business_name: '가게C', representative_name: '대표C', business_number: '333-33-33333', status: 'approved', seller_type: 'store_owner' })
    insert(raw, 'platform_settings', { key: 'fee_vat_exclusive_from', value: '2020-01-01' })
    for (const [v, m] of [[21, A], [22, B], [23, C]] as const) await recordVoucherUsedLedger(DB, { voucher_id: v, order_amount: 10000, merchant_id: m, platform_rate: 0.1, seller_rate: 0 })
    const period = thisMonth()
    await buildFeeInvoiceDrafts(DB, period)
    const calls: Array<{ url: string; headers: Record<string, string> }> = []
    const fakeFetch = (async (url: string, init: { headers: Record<string, string>; body: string }) => {
      calls.push({ url, headers: init.headers })
      if (url.includes('/Token')) return new Response(JSON.stringify({ session_token: 'tok', expiration: '2099-01-01T00:00:00Z' }), { status: 200 })
      const corp = JSON.parse(init.body).invoiceeCorpNum
      if (corp === '1111111111') return new Response(JSON.stringify({ code: 1, message: '발행 완료', ntsConfirmNum: '20270201-41000000-00000001' }), { status: 200 })
      if (corp === '3333333333') return new Response(JSON.stringify({ code: -11000011, message: '이미 사용중인 문서번호입니다.' }), { status: 400 })
      return new Response(JSON.stringify({ code: -11000002, message: '공급받는자 이메일이 올바르지 않습니다.' }), { status: 400 })
    }) as unknown as typeof fetch
    const creds = { linkId: 'URDEAL', secretKey: Buffer.from('k').toString('base64'), isTest: true }
    const r = await sendFeeInvoicesViaPopbill(DB, creds, period, undefined, fakeFetch)
    expect(r).toMatchObject({ issued: 2, failed: 1 })
    const issue = calls.find((c) => c.url === 'https://popbill-test.linkhub.co.kr/Taxinvoice')!
    expect(issue.headers).toMatchObject({ Authorization: 'Bearer tok', 'X-HTTP-Method-Override': 'ISSUE' })
    expect(q1(raw, 'SELECT status, provider, nts_confirm_num FROM fee_tax_invoices WHERE seller_id = ?', A)).toEqual({ status: 'issued', provider: 'popbill_test', nts_confirm_num: '20270201-41000000-00000001' })
    expect(q1(raw, 'SELECT status, last_error FROM fee_tax_invoices WHERE seller_id = ?', B)).toEqual({ status: 'draft', last_error: '공급받는자 이메일이 올바르지 않습니다.' })
    expect(q1<{ status: string }>(raw, 'SELECT status FROM fee_tax_invoices WHERE seller_id = ?', C)?.status).toBe('issued')
    expect((await sendFeeInvoicesViaPopbill(DB, creds, period, undefined, fakeFetch)).issued).toBe(0)
  })
})
