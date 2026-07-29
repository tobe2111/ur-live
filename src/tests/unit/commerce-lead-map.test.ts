/**
 * 🛒 통신판매 원부 → 리드 매핑 (2026-07-29).
 *
 *   이 레인이 풀의 76%(13만 행)를 만든다 — 여기서 필드를 하나 버리면 13만 건의 정보가 함께 사라진다.
 *   실제로 **이메일이 있으면 도메인을 버리고** 있었다: 원래 의도는 "크롤이 필요 없으면 저장 안 함"이었지만
 *   두 크롤 선정 쿼리 모두 `email IS NULL` 을 요구하므로 도메인 저장은 **크롤 비용 0**이고,
 *   대표는 전화·메일로 직접 접촉하므로 회사 사이트는 그 자체로 값이다.
 */
import { describe, it, expect } from 'vitest'
import { mapCommerceLead } from '@/features/marketing/api/commerce-notify-collect'

const base = { bzmnNm: '테스트상회', rnAddr: '서울특별시 강남구 테헤란로 1', brno: '1234567890' }

describe('mapCommerceLead', () => {
  it('🔒 이메일이 있어도 도메인을 버리지 않는다(정보 무단 폐기 회귀 테스트)', () => {
    const l = mapCommerceLead({ ...base, rprsvEmladr: 'ceo@shop.co.kr', dmnNm: 'shop.co.kr' })
    expect(l.email).toBe('ceo@shop.co.kr')
    expect(l.website).toBe('http://shop.co.kr')
  })

  it('이메일이 없어도 도메인은 그대로 저장(크롤 관문)', () => {
    const l = mapCommerceLead({ ...base, dmnNm: 'https://shop.co.kr' })
    expect(l.email).toBeNull()
    expect(l.website).toBe('https://shop.co.kr')
  })

  it('마스킹된 대표자 이메일은 저장하지 않는다 — 발송 불가한 주소로 숫자를 부풀리지 않는다', () => {
    const l = mapCommerceLead({ ...base, rprsvEmladr: 'dduki0**@naver.com' })
    expect(l.email).toBeNull()
  })

  it('관공서 처리부서 전화는 업체 전화가 아니다 — 허위 연락처 0', () => {
    const l = mapCommerceLead({ ...base, chrgDeptTelno: '02-1234-5678' })
    expect(l.phone).toBeNull()
  })

  it('통신판매는 온라인판매 tier4 — 대행사(tier1) 보강 슬롯을 뺏지 않는다', () => {
    const l = mapCommerceLead({ ...base })
    expect(l.category).toBe('온라인판매')
    expect(l.tier).toBe(4)
  })

  it('이메일이 있을 때만 통신판매 출처로 기록(전화 출처는 보강이 기록)', () => {
    expect(mapCommerceLead({ ...base, rprsvEmladr: 'a@b.co.kr' }).contact_source).toBe('commerce')
    expect(mapCommerceLead({ ...base }).contact_source).toBeNull()
  })
})
