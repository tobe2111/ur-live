import { describe, it, expect } from 'vitest'
import { redactContactInfo, REDACT_PLACEHOLDER } from '@/worker/utils/redact-contact'

describe('redactContactInfo — disintermediation 방지 마스킹', () => {
  const masked = (s: string) => redactContactInfo(s).text.includes(REDACT_PLACEHOLDER)
  const flagged = (s: string) => redactContactInfo(s).redacted

  it('휴대폰 번호(구분자 다양)를 가린다', () => {
    expect(masked('연락처 010-1234-5678 로 주세요')).toBe(true)
    expect(masked('01012345678')).toBe(true)
    expect(masked('010 1234 5678')).toBe(true)
    expect(masked('010.1234.5678')).toBe(true)
    expect(masked('+82 10 1234 5678')).toBe(true)
  })

  it('이메일 / URL 을 가린다', () => {
    expect(masked('메일 abc.def@gmail.com 으로')).toBe(true)
    expect(masked('https://open.kakao.com/o/abc 여기로')).toBe(true)
    expect(masked('www.example.com 참고')).toBe(true)
  })

  it('계좌번호 / 메신저 ID 를 가린다', () => {
    expect(masked('국민 123-45-678901 입금해주세요')).toBe(true)
    expect(masked('계좌 1002123456789')).toBe(true)
    expect(masked('카톡 abc_id123 주세요')).toBe(true)
    expect(masked('텔레그램 @trader_kim')).toBe(true)
  })

  it('가격/수량/날짜는 가리지 않는다 (오탐 방지)', () => {
    expect(flagged('단가 12,500원에 100박스 주문할게요')).toBe(false)
    expect(flagged('재고 500개 / 1,000,000원')).toBe(false)
    expect(flagged('납기 2026-06-18 까지 가능할까요')).toBe(false)
    expect(flagged('MOQ 50개, 박스당 24입')).toBe(false)
  })

  it('빈 문자열은 그대로', () => {
    expect(redactContactInfo('')).toEqual({ text: '', redacted: false })
  })
})
