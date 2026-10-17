/**
 * ⚡ 2026-10-17 이용권 상세 설명이 숫자를 Intl 없이 찍는다.
 *
 * 라이브 `/pass/2919` 를 CPU 4배·느린 4G 로 프로파일하니 `passDetailDescription` 한 함수가 첫 렌더에서
 * 64ms(로컬 재생 56~95ms)를 혼자 썼다 — `toLocaleString('ko-KR')` 가 Intl 로캘 데이터를 처음 적재하는 비용이다.
 * 같은 이유로 2026-10-13 에 `formatNumber` 에 정수 빠른 길을 넣었는데 이 SSOT 만 그 길 밖에 있었다.
 *
 * ⚠️ 못 보는 것: 몇 ms 빨라지는지(브라우저가 판정한다) · 다른 파일의 toLocaleString.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { passDetailDescription } from '@/shared/seo/detail-description'

describe('이용권 상세 설명 — Intl 없이 숫자를 찍는다', () => {
  it('소스에 toLocaleString 이 없고 formatNumber 를 쓴다', () => {
    const src = readCode('src/shared/seo/detail-description.ts')
    expect(src).not.toMatch(/toLocaleString\s*\(/)
    expect(src).toMatch(/formatNumber\(price\)/)
    expect(src).toMatch(/formatNumber\(pd\.originalPrice\)/)
  })
  it('출력은 Intl 로 찍은 것과 같다', () => {
    const d = { name: '닭도리탕', restaurant_name: '달빛한스푼', price: 1234567, original_price: 2345678, current_discount_pct: 0 }
    const out = passDetailDescription(d as any)
    expect(out).toContain(`${(1234567).toLocaleString('ko-KR')}원`)
    expect(out).toContain(`정가 ${(2345678).toLocaleString('ko-KR')}원`)
  })
})
