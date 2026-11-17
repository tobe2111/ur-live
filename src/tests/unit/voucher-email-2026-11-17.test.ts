/**
 * 🧪 2026-11-17 외국인 손님 이용권 이메일(`shared/voucher-email.ts` · `worker/utils/voucher-email-send.ts`).
 *
 * ① 언어: ko·ja·zh 는 그대로, 그 밖(en·es·fr·모름)은 영어.
 * ② 내용: 코드·`/v/:code` 링크·매장 한국어 원문·유효기간(KST 날짜)·12개월 안내가 들어 있다. 이상한 코드·꺾쇠는 새지 않는다.
 * ③ 발송 문: 설정 `voucher_email_enabled` 가 꺼져 있으면 보내지 않는다(발송은 결재 C) · 같은 주문 두 번 보내지 않는다(선점).
 * ⚠️ 못 보는 것: 실제 메일 클라이언트(Gmail·Outlook)에서의 모양 — 그건 미리보기 그림으로 본다. 결제 레일 배선(아직 없음).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { buildVoucherIssuedEmail, voucherEmailLang, voucherEmailDate } from '@/shared/voucher-email'

const base = { productName: '참치김밥 2줄', storeName: '김밥천국 홍대점', storeAddress: '서울 마포구 와우산로 21', codes: ['UD7K2Q9M'], expiresAt: '2027-11-16 20:00:00' }

describe('이용권 이메일', () => {
  it('① 언어 고르기', () => {
    expect(voucherEmailLang('ja-JP')).toBe('ja')
    expect(voucherEmailLang('zh')).toBe('zh')
    expect(voucherEmailLang('ko')).toBe('ko')
    for (const l of ['en', 'es', 'fr', '', null, undefined]) expect(voucherEmailLang(l)).toBe('en')
  })
  it('② 유효기간은 한국 날짜(UTC 20시 → 다음날)', () => {
    expect(voucherEmailDate('2027-11-16 20:00:00')).toBe('2027-11-17')
    expect(voucherEmailDate('2027-03-31')).toBe('2027-03-31')
    expect(voucherEmailDate(null)).toBe('')
  })
  it('② 영어 메일 — 코드·링크·매장 원문·12개월', () => {
    const m = buildVoucherIssuedEmail({ ...base, lang: 'en' })
    expect(m.lang).toBe('en')
    expect(m.subject).toContain('참치김밥 2줄')
    expect(m.html).toContain('https://urdeal.kr/v/UD7K2Q9M')
    expect(m.html).toContain('UD7K2Q9M')
    expect(m.html).toContain('김밥천국 홍대점')
    expect(m.html).toContain('서울 마포구 와우산로 21')
    expect(m.html).toContain('2027-11-17')
    expect(m.html).toContain('12 months')
    expect(m.html).toContain('Open voucher')
  })
  it('② 일본어·중국어·한국어 문구', () => {
    expect(buildVoucherIssuedEmail({ ...base, lang: 'ja' }).html).toContain('利用券を開く')
    expect(buildVoucherIssuedEmail({ ...base, lang: 'zh' }).html).toContain('打开使用券')
    expect(buildVoucherIssuedEmail({ ...base, lang: 'ko' }).html).toContain('이용권 열기')
  })
  it('② 이상한 코드·꺾쇠는 새지 않는다', () => {
    const m = buildVoucherIssuedEmail({ ...base, productName: '<script>x</script>', codes: ['UD7K2Q9M', '"><img src=x>'] })
    expect(m.html).not.toContain('<script>x')
    expect(m.html).not.toContain('<img src=x>')
    expect(m.html.match(/\/v\//g)?.length).toBe(1)
  })
  it('③ 발송 문: 기본 꺼짐 + 주문 단위 선점', () => {
    const src = readCode('src/worker/utils/voucher-email-send.ts')
    expect(src).toMatch(/if \(!\(await voucherEmailEnabled\(DB\)\)\) return \{ sent: false, reason: 'disabled' \}/)
    expect(src).toMatch(/key = 'voucher_email_enabled'/)
    expect(src).toMatch(/=== 'true'/)
    expect(src).toMatch(/INSERT OR IGNORE INTO order_voucher_email/)
    expect(src).toMatch(/if \(!claim\?\.meta\?\.changes\) return \{ sent: false, reason: 'already' \}/)
  })
})
