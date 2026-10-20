/**
 * 🛒 2026-06-12: 네이버쇼핑 최저가 대조 — 순수 헬퍼 단위 테스트.
 */
import { describe, it, expect } from 'vitest'
import { stripNaverTitle, normalizePriceQuery, checkNaverLowestPrice } from '../../worker/utils/naver-shopping-price'

describe('stripNaverTitle', () => {
  it('<b> 강조 태그 제거', () => {
    expect(stripNaverTitle('<b>스타벅스</b> 아메리카노 <b>기프티콘</b>')).toBe('스타벅스 아메리카노 기프티콘')
  })
  it('HTML 엔티티 복원', () => {
    expect(stripNaverTitle('A&amp;B &quot;세트&quot; &lt;신형&gt;')).toBe('A&B "세트" <신형>')
  })
})

describe('normalizePriceQuery', () => {
  it('[브랜드]/(옵션) 괄호 블록 통째 제거 + 공백 정리', () => {
    expect(normalizePriceQuery('[유어딜] 프리미엄 김 (10봉 세트)')).toBe('프리미엄 김')
  })
  it('특수문자 제거, 60자 제한', () => {
    expect(normalizePriceQuery('커피!!@@ 원두##')).toBe('커피 원두')
    expect(normalizePriceQuery('가'.repeat(100)).length).toBeLessThanOrEqual(60)
  })
})

describe('checkNaverLowestPrice — 설정/입력 가드 (네트워크 미호출 경로)', () => {
  it('키 미설정 → configured:false (UI 숨김 신호)', async () => {
    const r = await checkNaverLowestPrice(undefined, undefined, '커피')
    expect(r.configured).toBe(false)
    expect(r.ok).toBe(false)
  })
  it('검색어 2자 미만 → 에러 (호출 안 함)', async () => {
    const r = await checkNaverLowestPrice('id', 'secret', '[!] ')
    expect(r.ok).toBe(false)
    expect(r.configured).toBe(true)
  })
})
