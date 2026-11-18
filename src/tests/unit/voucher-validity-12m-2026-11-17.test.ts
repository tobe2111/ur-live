/**
 * 🧪 2026-11-17 이용권 유효기간 상한 12개월 (토스 PG 심사 — "결제 이후 이용권의 유효기간을 12개월 이내로 명시").
 *
 * ① 계산(진짜 함수를 돌린다): 없음·초과 → 발급일 + 12개월 / 더 짧으면 그대로 / 절대 null 아님.
 * ② 배선: 이용권을 발급하는 네 레일이 전부 이 계산을 거친다(무기한 이용권이 한 레일에서 새지 않게).
 * ③ 화면: 상세 이용 안내 · 응모 안내 · 환불정책이 같은 문구 상수를 쓴다.
 * ⚠️ 못 보는 것: 라이브에서 실제 발급된 expires_at(배포 뒤 D1 로 본다) · 새로 생기는 발급 레일(INSERT INTO vouchers
 *   를 세는 ④ 가 개수로만 잡는다).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { resolveVoucherExpiresAt, voucherExpiryCap, capValidityDays, VOUCHER_VALIDITY_LABEL } from '@/shared/voucher-validity'

const NOW = new Date('2026-11-17T03:00:00Z')

describe('이용권 유효기간 상한 12개월', () => {
  it('① 상한 = 발급일 + 12개월(D1 모양)', () => {
    expect(voucherExpiryCap(NOW)).toBe('2027-11-17 03:00:00')
    expect(VOUCHER_VALIDITY_LABEL).toBe('구매일로부터 12개월')
  })
  it('① 없으면·초과면 상한, 짧으면 그대로', () => {
    expect(resolveVoucherExpiresAt(null, NOW)).toBe('2027-11-17 03:00:00')
    expect(resolveVoucherExpiresAt('', NOW)).toBe('2027-11-17 03:00:00')
    expect(resolveVoucherExpiresAt('2030-01-01', NOW)).toBe('2027-11-17 03:00:00')
    // 2026-11-18: 날짜만이면 그날 한국 23:59:59(=14:59:59 UTC) — 상한 날짜와 같은 날이면 상한 시각.
    expect(resolveVoucherExpiresAt('2027-03-31', NOW)).toBe('2027-03-31 14:59:59')
    expect(resolveVoucherExpiresAt('2027-11-17', NOW)).toBe('2027-11-17 03:00:00')
    expect(resolveVoucherExpiresAt('엉터리', NOW)).toBe('2027-11-17 03:00:00')
  })
  it('① 숙소 일수 — 0·빈 값·초과는 365, 짧으면 그대로', () => {
    expect(capValidityDays(null)).toBe(365)
    expect(capValidityDays(0)).toBe(365)
    expect(capValidityDays(900)).toBe(365)
    expect(capValidityDays(90)).toBe(90)
  })
  it('② 발급 레일 넷이 전부 상한을 거친다', () => {
    const gb = readCode('src/features/group-buy/api/group-buy.routes.ts')
    expect(gb.match(/const expiresAt = resolveVoucherExpiresAt\(product\.voucher_expiry\)/g)?.length).toBe(2)
    expect(gb).not.toMatch(/product\.voucher_expiry \|\| null/)
    expect(readCode('src/features/group-buy/api/cart-checkout.routes.ts')).toMatch(/resolveVoucherExpiresAt\(l\.voucherExpiry\)/)
    expect(readCode('src/features/group-buy/api/experience-campaign.routes.ts')).toMatch(/const expiresAt = resolveVoucherExpiresAt\(/)
    const stays = readCode('src/features/group-buy/api/stays-public.routes.ts')
    expect(stays.match(/capValidityDays\(room\.voucher_validity_days\)/g)?.length).toBe(2)
  })
  it('③ 화면 셋이 같은 문구를 쓴다', () => {
    const ug = readCode('src/pages/group-buy/UsageGuide.tsx')
    expect(ug).toContain('VOUCHER_VALIDITY_LABEL')
    expect(ug).not.toMatch(/\{expiry && \(\s*<p/)
    expect(readCode('src/pages/group-buy/DealPurchaseBox.tsx')).toMatch(/passBuy\.raffleValidity[\s\S]{0,80}VOUCHER_VALIDITY_LABEL/)
    expect(readCode('src/shared/refund-policy-content.ts')).toMatch(/이용권 유효기간[\s\S]{0,200}VOUCHER_VALIDITY_LABEL/) // ⚖️ 2026-11-18 환불 화면 문구는 이 트리에서(RefundPolicyPage 가 그린다)
  })
  it('④ 이용권 INSERT 레일이 늘면 이 시험부터 본다(개수 고정)', () => {
    const files = ['group-buy.routes', 'cart-checkout.routes', 'experience-campaign.routes']
    const n = files.map(f => (readCode(`src/features/group-buy/api/${f}.ts`).match(/INSERT INTO vouchers \(/g) || []).length).reduce((a, b) => a + b, 0)
    expect(n).toBe(4)
  })
})
