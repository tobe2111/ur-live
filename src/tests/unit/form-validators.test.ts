import { describe, it, expect } from 'vitest'
import { digitsOnly, isValidKrPhone, isValidEmail } from '@/utils/form-validators'

/**
 * 🔢 2026-06-26 (대표 가입폼 시안): 미완성 전화/이메일이 가입폼을 통과하던 것 차단 — 규칙 고정.
 *   도매몰 가입폼(제조사 SupplierRegisterPage · 판매사 WholesaleJoinPage) 공유.
 */
describe('isValidKrPhone — 완성형 휴대폰만 통과 (가입폼 연락처)', () => {
  it('미완성("010"·"010-9135")은 false (대표 신고 #3·#5)', () => {
    expect(isValidKrPhone('010')).toBe(false)
    expect(isValidKrPhone('010-9135')).toBe(false)
    expect(isValidKrPhone('0109135')).toBe(false)
    expect(isValidKrPhone('')).toBe(false)
  })
  it('완성형 010-XXXX-XXXX(11자리)은 true', () => {
    expect(isValidKrPhone('010-1234-5678')).toBe(true)
    expect(isValidKrPhone('01012345678')).toBe(true)
  })
  it('구형 011/016~019 + 10자리도 true', () => {
    expect(isValidKrPhone('011-123-4567')).toBe(true)
    expect(isValidKrPhone('017-1234-5678')).toBe(true)
  })
  it('비휴대폰/오타는 false', () => {
    expect(isValidKrPhone('02-123-4567')).toBe(false)   // 지역번호
    expect(isValidKrPhone('010-1234-567')).toBe(false)  // 자리수 부족
    expect(isValidKrPhone('010-1234-56789')).toBe(false) // 자리수 초과
  })
})

describe('isValidEmail — TLD 필수 (로그인 이메일)', () => {
  it('TLD 없는 "utonggori@naver"는 false (대표 신고 #6)', () => {
    expect(isValidEmail('utonggori@naver')).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('a@b.')).toBe(false)
    expect(isValidEmail('noatsign.com')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
  it('정상 이메일은 true', () => {
    expect(isValidEmail('utonggori@naver.com')).toBe(true)
    expect(isValidEmail('name@company.co.kr')).toBe(true)
  })
})

describe('digitsOnly', () => {
  it('숫자만 추출', () => {
    expect(digitsOnly('010-1234-5678')).toBe('01012345678')
    expect(digitsOnly('a1b2')).toBe('12')
    expect(digitsOnly('')).toBe('')
  })
})
