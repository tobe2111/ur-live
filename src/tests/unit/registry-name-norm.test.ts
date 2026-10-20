/**
 * 🔤 상호 지문(name_norm) — 원부 매칭의 **정규화 SSOT** 불변식 (2026-07-28).
 *
 *   실사고: SQL 프리필터는 `공백·(주)·주식회사` 만 지우는데 LIKE 패턴은 JS `normalizeCompanyName`
 *   (구두점·㈜·(유)·유한회사까지 제거) 결과를 썼다 — 그 함수 주석이 *"양쪽에 같은 함수를 적용해야
 *   매칭이 성립한다"* 고 못박은 불변식이 **깨진 채** 돌고 있었다. 상호에 `-`·`.`·`&` 가 있으면 조용히 미스.
 *   ⇒ 이제 저장 시 JS 함수로 계산해 컬럼에 넣고 동등비교한다. 그 함수의 계약을 여기서 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { normalizeCompanyName } from '@/features/marketing/api/registry-email-match'

describe('normalizeCompanyName — 지문 계약', () => {
  it('법인격 표기를 털어낸다(같은 업체로 수렴)', () => {
    const want = normalizeCompanyName('한울커넥티드')
    for (const v of ['주식회사 한울커넥티드', '(주)한울커넥티드', '㈜한울커넥티드', '한울커넥티드(주)', '유한회사 한울커넥티드']) {
      expect(normalizeCompanyName(v)).toBe(want)
    }
  })

  it('🔒 구두점을 털어낸다 — 예전 SQL 정규화가 놓쳐 조용히 미스하던 지점', () => {
    const want = normalizeCompanyName('에이비씨')
    for (const v of ['에이-비씨', '에이.비씨', '에이&비씨', '에이/비씨', "에이'비씨", '에이(비)씨']) {
      expect(normalizeCompanyName(v)).toBe(want)
    }
  })

  it('공백·전각공백을 무시한다', () => {
    expect(normalizeCompanyName('신한 종합기획')).toBe(normalizeCompanyName('신한종합기획'))
    expect(normalizeCompanyName('신한　종합기획')).toBe(normalizeCompanyName('신한종합기획'))
  })

  it('영문 대소문자를 무시한다', () => {
    expect(normalizeCompanyName('ABC Media')).toBe(normalizeCompanyName('abc media'))
  })

  it('서로 다른 업체는 여전히 다르다(과잉 수렴 금지)', () => {
    expect(normalizeCompanyName('가나기획')).not.toBe(normalizeCompanyName('다라기획'))
    expect(normalizeCompanyName('한울커넥티드')).not.toBe(normalizeCompanyName('한울커넥트'))
  })

  it('빈값·null 은 빈 문자열', () => {
    expect(normalizeCompanyName(null)).toBe('')
    expect(normalizeCompanyName(undefined)).toBe('')
    expect(normalizeCompanyName('   ')).toBe('')
  })

  it('멱등 — 이미 정규화된 값을 다시 넣어도 같다(저장·조회가 같은 값에 수렴)', () => {
    for (const v of ['㈜에이-비 미디어', '주식회사 가나.다', 'ABC & Partners']) {
      const once = normalizeCompanyName(v)
      expect(normalizeCompanyName(once)).toBe(once)
    }
  })
})
