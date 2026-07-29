/**
 * 🏪 무인매장 발굴(카카오 로컬) — 키워드 그리드 계약 (2026-07-28 대표 "아이스크림 할인점, 무인판매점").
 *
 *   커서가 이 배열의 **순서와 길이**에 의존한다(회전 순회). 순서가 흔들리면 커서가 가리키는 곳이
 *   달라져 일부 지역이 영영 조회되지 않는다 — 그래서 계약을 여기서 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { buildUnmannedKeywords, UNMANNED_TRADES } from '@/features/marketing/api/store-kakao-collect'
import { S2_REGIONS } from '@/features/marketing/api/company-keyword-grid'

describe('buildUnmannedKeywords — 그리드 계약', () => {
  const rows = buildUnmannedKeywords()

  it('전국 지역 × 업태 전량을 만든다', () => {
    expect(rows.length).toBe(S2_REGIONS.length * UNMANNED_TRADES.length)
    expect(rows.length).toBeGreaterThan(500) // 235개 시군구 × 4업태 규모
  })

  it('🔒 대표가 요청한 두 업태가 모두 들어있다', () => {
    const kws = UNMANNED_TRADES.map(t => t.kw).join(' ')
    expect(kws).toContain('아이스크림 할인점')
    expect(kws).toContain('무인판매점')
  })

  it('키워드는 "지역 업태" 형태 — 카카오 키워드 검색이 지역을 이해하는 형식', () => {
    const r = rows[0]
    expect(r.q).toBe(`${S2_REGIONS[0]} ${UNMANNED_TRADES[0].kw}`)
    expect(r.region).toBe(S2_REGIONS[0])
  })

  it('🔒 순서가 결정적이다 — 커서가 이 순서에 의존한다', () => {
    const again = buildUnmannedKeywords()
    expect(again.map(r => r.q)).toEqual(rows.map(r => r.q))
  })

  it('중복 키워드가 없다(같은 곳을 두 번 조회하지 않는다)', () => {
    expect(new Set(rows.map(r => r.q)).size).toBe(rows.length)
  })

  it('category 는 store_prospects 표시값 — 업태별로 채워져 있다', () => {
    for (const r of rows.slice(0, 20)) expect(r.category).toBeTruthy()
  })
})
