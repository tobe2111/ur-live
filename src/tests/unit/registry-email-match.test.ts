/**
 * 🔗 레지스트리 이메일 이식 — **오귀속(엉뚱한 회사 이메일 부착) 방지 게이트** 유닛 테스트.
 *   이 기능의 유일한 리스크가 허위 부착이므로, 판정 순수함수를 불변식으로 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { normalizeCompanyName, addressAgrees, isConfidentMatch } from '@/features/marketing/api/registry-email-match'

describe('normalizeCompanyName — 양쪽에 같은 지문을 만든다', () => {
  it('법인격 표기·공백·기호를 털어 같은 상호를 같은 값으로', () => {
    expect(normalizeCompanyName('(주)로운팩토리')).toBe('로운팩토리')
    expect(normalizeCompanyName('주식회사 로운팩토리')).toBe('로운팩토리')
    expect(normalizeCompanyName('㈜ 로운 팩토리')).toBe('로운팩토리')
    expect(normalizeCompanyName('로운팩토리(주)')).toBe('로운팩토리')
  })
  it('다른 상호는 다른 값으로 유지', () => {
    expect(normalizeCompanyName('로운팩토리')).not.toBe(normalizeCompanyName('로운팩토리스'))
  })
})

describe('addressAgrees — 같은 곳인지', () => {
  it('행정구역+번지 토큰이 2개 이상 겹치면 합의', () => {
    expect(addressAgrees('서울특별시 금천구 가산디지털1로 171', '서울 금천구 가산디지털1로 171 8층')).toBe(true)
  })
  it('다른 지역이면 불일치', () => {
    expect(addressAgrees('서울특별시 금천구 가산디지털1로 171', '부산광역시 해운대구 센텀로 55')).toBe(false)
  })
  it('한쪽이 비면 합의로 보지 않는다', () => {
    expect(addressAgrees('서울 금천구 가산디지털1로 171', '')).toBe(false)
  })
})

describe('isConfidentMatch — 확신할 때만 이식(허위 0)', () => {
  const reg = { name: '(주)로운팩토리', address: '서울 금천구 가산디지털1로 171' }

  it('유일 매칭 + 주소 합의 → 이식', () => {
    const v = isConfidentMatch({ name: '로운팩토리', address: '서울특별시 금천구 가산디지털1로 171 811호' }, reg, true)
    expect(v.ok).toBe(true)
  })

  it('❌ 동명 다수(ambiguous)면 절대 이식 안 함 — 이름·주소가 맞아도', () => {
    const v = isConfidentMatch({ name: '로운팩토리', address: '서울 금천구 가산디지털1로 171' }, reg, false)
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('ambiguous')
  })

  it('❌ 주소가 서로 충돌하면 이식 안 함 — 같은 상호라도 다른 업체', () => {
    const v = isConfidentMatch({ name: '로운팩토리', address: '부산광역시 해운대구 센텀로 55' }, reg, true)
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('address_conflict')
  })

  it('❌ 짧은 상호는 식별력 부족 → 이식 안 함', () => {
    const v = isConfidentMatch({ name: '씽굿', address: null }, { name: '씽굿', address: null }, true)
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('name_too_short')
  })

  it('❌ 일반명사 단독 상호는 유일해도 이식 안 함', () => {
    const v = isConfidentMatch({ name: '마케팅', address: null }, { name: '마케팅', address: null }, true)
    expect(v.ok).toBe(false)
  })

  it('주소가 한쪽이라도 없으면 매우 식별력 높은 이름(6자+)일 때만 허용', () => {
    expect(isConfidentMatch({ name: '로운팩토리컴퍼니', address: null }, { name: '로운팩토리컴퍼니', address: null }, true).ok).toBe(true)
    expect(isConfidentMatch({ name: '로운팩토', address: null }, { name: '로운팩토', address: null }, true).ok).toBe(false)
  })

  it('❌ 정규화 후 상호가 다르면 이식 안 함', () => {
    const v = isConfidentMatch({ name: '로운팩토리스', address: '서울 금천구 가산디지털1로 171' }, reg, true)
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('name_mismatch')
  })
})
