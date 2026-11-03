/**
 * 💸 토스 지급대행 — 2026-11-03 대표 *"1번 일단 해주고"* (게이트 기본 OFF)
 *   결재 `docs/decisions/2026-11-03-settlement-structure.md` · SSOT `worker/utils/toss-payouts.ts`
 *
 * 고정하는 것:
 *   ① JWE 가 토스 문서 규격(alg=dir · enc=A256GCM · iat · nonce)이고 **독립 구현(jose)과 서로 풀린다**
 *      — 우리 암호화 ↔ jose 복호화, jose 암호화 ↔ 우리 복호화. 한쪽만 맞으면 토스가 못 읽는다.
 *   ② 매장 → 셀러 등록 본문: 빠진 정보는 지어내지 않고 목록으로 돌려준다 · 법인/개인사업자 판정.
 *   ③ 바로지급은 영업일 08~15시(KST)만, 그 밖은 다음 평일 예약지급.
 *   ④ 꺼짐 = 아무것도 안 함 · 매장 정산만 · 선점(UNIQUE)이 토스 호출보다 먼저 · 장부는 COMPLETED 일 때만.
 *   ⑤ 웹훅은 본문을 믿지 않고 토스에 다시 묻는다.
 *
 * ⚠️ 못 보는 것: 실제 토스 응답(라이브 키가 필요 — staging 에서 실지급으로 확인) · 공휴일 판정(토스가 거절 → FAILED → 재시도).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { compactDecrypt, CompactEncrypt } from 'jose'
import {
  encryptJwe, decryptJwe, kstIso, buildSellerBody, tossBusinessType, tossSchedule,
} from '@/worker/utils/toss-payouts'
import { BANKS, BANK_CODES, bankCodeOf } from '@/shared/banks'

const KEY = 'a'.repeat(16) + '0123456789abcdef'.repeat(3) // 64자 hex
const keyBytes = () => Uint8Array.from(KEY.match(/../g)!.map((h) => parseInt(h, 16)))
const read = (p: string) => readFileSync(p, 'utf8')

describe('① JWE — 토스 문서 규격 + 독립 구현과 상호 운용', () => {
  it('헤더가 dir · A256GCM · iat(+09:00) · nonce 이고 암호화된 키 칸이 비어 있다', async () => {
    const t = await encryptJwe({ a: 1 }, KEY, Date.parse('2026-11-03T00:00:00Z'))
    const parts = t.split('.')
    expect(parts).toHaveLength(5)
    expect(parts[1]).toBe('')
    const h = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
    expect(h).toMatchObject({ alg: 'dir', enc: 'A256GCM', iat: '2026-11-03T09:00:00+09:00' })
    expect(typeof h.nonce).toBe('string')
  })
  it('우리가 암호화 → jose 가 푼다', async () => {
    const payload = { refPayoutId: 'urdeal-p1-a1', amount: { currency: 'KRW', value: 12345 }, name: '한글 상호' }
    const t = await encryptJwe(payload, KEY)
    const { plaintext } = await compactDecrypt(t, keyBytes())
    expect(JSON.parse(Buffer.from(plaintext).toString('utf8'))).toEqual(payload)
  })
  it('jose 가 암호화 → 우리가 푼다(토스 응답 모양)', async () => {
    const body = { entityType: 'seller', entityBody: { id: 'seller-1', status: 'APPROVAL_REQUIRED' } }
    const t = await new CompactEncrypt(Uint8Array.from(Buffer.from(JSON.stringify(body))))
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM', iat: kstIso(), nonce: 'n-1' } as never)
      .encrypt(keyBytes())
    expect(await decryptJwe(t, KEY)).toEqual(body)
  })
  it('키가 64자 hex 가 아니면 거부, 위조된 본문은 복호화 실패', async () => {
    await expect(encryptJwe({}, 'abc')).rejects.toThrow(/64자 hex/)
    const t = await encryptJwe({ v: 1 }, KEY)
    const p = t.split('.')
    p[3] = p[3].slice(0, -2) + (p[3].endsWith('A') ? 'BB' : 'AA')
    await expect(decryptJwe(p.join('.'), KEY)).rejects.toBeTruthy()
  })
})

describe('② 셀러 등록 본문', () => {
  const base = {
    id: 7, name: '김밥집', email: 'a@b.kr', phone: '010-1234-5678', business_name: '김밥천국 강남점',
    business_number: '123-45-67890', representative_name: '김토스', representative_phone: null,
    tax_email: null, bank_name: '국민은행', bank_account: '123-456-789012', account_holder: '김토스',
  }
  it('정상 — 숫자만 · 은행 코드 · refSellerId', () => {
    const r = buildSellerBody(base)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.body).toMatchObject({
      refSellerId: 'urdeal-s7', businessType: 'INDIVIDUAL_BUSINESS',
      company: { businessRegistrationNumber: '1234567890', phone: '01012345678', representativeName: '김토스' },
      account: { bankCode: '004', accountNumber: '123456789012', holderName: '김토스' },
    })
  })
  it('빠진 정보는 지어내지 않고 이름으로 돌려준다', () => {
    const r = buildSellerBody({ ...base, business_number: null, bank_name: '없는은행', email: null })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.missing).toEqual(expect.arrayContaining(['사업자번호', '은행', '이메일']))
  })
  it('사업자번호 가운데 81~88 = 법인', () => {
    expect(tossBusinessType('1238112345')).toBe('CORPORATE')
    expect(tossBusinessType('1234512345')).toBe('INDIVIDUAL_BUSINESS')
  })
  it('은행 목록과 코드 표가 짝이다 · 옛 표기도 받는다', () => {
    for (const b of BANKS) expect(BANK_CODES[b]).toMatch(/^\d{3}$/)
    expect(bankCodeOf('농협')).toBe('011')
    expect(bankCodeOf('KB국민은행')).toBe('004')
    expect(bankCodeOf('토스뱅크')).toBe('092')
    expect(bankCodeOf('')).toBeNull()
  })
})

describe('③ 지급 유형', () => {
  const kst = (iso: string) => Date.parse(`${iso}+09:00`)
  it('평일 08~15시 = 바로지급', () => {
    expect(tossSchedule(kst('2026-11-03T10:00:00'))).toEqual({ scheduleType: 'EXPRESS' })
  })
  it('평일 15시 이후 = 다음날 예약, 금요일 밤·주말 = 월요일', () => {
    expect(tossSchedule(kst('2026-11-03T16:00:00'))).toEqual({ scheduleType: 'SCHEDULED', payoutDate: '2026-11-04' })
    expect(tossSchedule(kst('2026-11-06T20:00:00'))).toEqual({ scheduleType: 'SCHEDULED', payoutDate: '2026-11-09' })
    expect(tossSchedule(kst('2026-11-08T10:00:00'))).toEqual({ scheduleType: 'SCHEDULED', payoutDate: '2026-11-09' })
  })
})

describe('④ 돈 경로 불변식', () => {
  const src = read('src/worker/utils/toss-payouts.ts')
  it('게이트는 설정 + 키 둘, 셋 다 있어야 켜진다', () => {
    expect(src).toMatch(/TOSS_PAYOUTS_GATE = 'toss_payouts_enabled'/)
    expect(src).toMatch(/String\(row\?\.value\) !== 'true'/)
    expect(src).toMatch(/if \(!env\.TOSS_PAYOUT_SECRET_KEY\)/)
    expect(src).toMatch(/if \(!env\.TOSS_PAYOUT_SECURITY_KEY\)/)
  })
  it('매장 정산만 · 승인된 건만 · 계좌 재확인 가드', () => {
    const fn = src.slice(src.indexOf('export async function sendPayoutViaToss'))
    expect(fn).toMatch(/canonicalPaidPayee\(p\.payee_type, p\.payee_id\)/)
    expect(fn).toMatch(/payee\?\.kind !== 'seller'\) return/)
    expect(fn).toMatch(/p\.status !== 'approved'/)
    expect(fn).toMatch(/checkPayeeAccountCurrent\(DB, p\)/)
  })
  it('선점(INSERT OR IGNORE + 살아 있는 요청 UNIQUE)이 토스 호출보다 먼저', () => {
    const fn = src.slice(src.indexOf('export async function sendPayoutViaToss'))
    const claim = fn.indexOf('INSERT OR IGNORE INTO toss_payout_requests')
    const call = fn.indexOf("'/v2/payouts', body")
    expect(claim).toBeGreaterThan(0)
    expect(claim).toBeLessThan(call)
    expect(fn).toMatch(/if \(!claim\.meta\?\.changes\) return/)
    expect(src).toMatch(/UNIQUE INDEX IF NOT EXISTS idx_toss_payout_requests_live ON toss_payout_requests\(payout_id\) WHERE status NOT IN \('FAILED','CANCELED'\)/)
  })
  it("장부 'sent' 는 토스가 COMPLETED 일 때만, markPayoutSent SSOT 로", () => {
    expect(src).not.toMatch(/UPDATE payouts SET status = 'sent'/)
    const fn = src.slice(src.indexOf('export async function syncTossPayout'))
    expect(fn).toMatch(/if \(mapped === 'COMPLETED'\) \{\s*const sent = await markPayoutSent/)
  })
  it('결제 잠금 파일(toss-gateway)은 건드리지 않는다 — 별개 키 · 별개 파일', () => {
    expect(src).not.toMatch(/from '[^']*toss-gateway'/)
    expect(src).not.toMatch(/env\.TOSS_SECRET_KEY\b/)
  })
})

describe('⑤ 웹훅은 본문을 믿지 않는다', () => {
  const src = read('src/features/payouts/api/toss-payout-webhook.routes.ts')
  it('꺼져 있으면 무시 · payout.changed 만 · 상태는 syncTossPayout(토스에 다시 묻기)', () => {
    expect(src).toMatch(/tossPayoutsReady\(c\.env\.DB, c\.env\)/)
    expect(src).toMatch(/body\.eventType !== 'payout\.changed'/)
    expect(src).toMatch(/syncTossPayout\(c\.env\.DB, c\.env, id\)/)
    expect(src).not.toMatch(/markPayoutSent\(/)
  })
  it('워커에 마운트돼 있다', () => {
    expect(read('src/worker/index.ts')).toMatch(/app\.route\('\/api\/webhooks\/toss-payouts', tossPayoutWebhookRoutes\)/)
  })
})
