import { describe, it, expect } from 'vitest'
import { resolveDetailDisplay, DETAIL_PREVIEW_LEN } from '@/pages/product-detail/detail-display'

/**
 * 🧭 2026-06-22: 상품 상세 '펼쳐보기' 노출 결정 단위 테스트.
 *
 * 검증 (사용자 권장 ② 자동화 — 이전 dead 버튼 회귀 방지):
 *   - 접힘: 첫 이미지 1장 + 설명 200자 + (더 있으면) 펼치기 버튼 노출
 *   - 펼침: 전체 이미지 + 설명 전문 + 펼치기 버튼 숨김
 */
const longDesc = 'x'.repeat(DETAIL_PREVIEW_LEN + 50) // 250자
const shortDesc = 'x'.repeat(DETAIL_PREVIEW_LEN - 10) // 190자
const imgs = ['a.jpg', 'b.jpg', 'c.jpg']

describe('resolveDetailDisplay', () => {
  it('접힘: 첫 이미지 1장만 노출', () => {
    expect(resolveDetailDisplay(imgs, shortDesc, false).images).toEqual(['a.jpg'])
  })

  it('펼침: 전체 이미지 노출', () => {
    expect(resolveDetailDisplay(imgs, shortDesc, true).images).toEqual(imgs)
  })

  it('접힘 + 긴 설명: 200자로 잘리고 truncated=true', () => {
    const d = resolveDetailDisplay([], longDesc, false)
    expect(d.text).toHaveLength(DETAIL_PREVIEW_LEN)
    expect(d.truncated).toBe(true)
  })

  it('펼침 + 긴 설명: 전문 + truncated=false', () => {
    const d = resolveDetailDisplay([], longDesc, true)
    expect(d.text).toBe(longDesc)
    expect(d.truncated).toBe(false)
  })

  it('canExpand: 이미지 2장+ 또는 설명 200자 초과면 true', () => {
    expect(resolveDetailDisplay(imgs, '', false).canExpand).toBe(true)        // 이미지 다수
    expect(resolveDetailDisplay(['a.jpg'], longDesc, false).canExpand).toBe(true) // 긴 설명
  })

  it('canExpand: 이미지 1장 + 짧은 설명이면 false (펼치기 버튼 불필요)', () => {
    expect(resolveDetailDisplay(['a.jpg'], shortDesc, false).canExpand).toBe(false)
  })

  it('설명 정확히 200자면 truncated/canExpand 모두 false', () => {
    const exact = 'x'.repeat(DETAIL_PREVIEW_LEN)
    const d = resolveDetailDisplay(['a.jpg'], exact, false)
    expect(d.truncated).toBe(false)
    expect(d.canExpand).toBe(false)
  })

  it('이미지 없음 + 설명 없음: 빈 노출 + canExpand=false', () => {
    const d = resolveDetailDisplay([], null, false)
    expect(d.images).toEqual([])
    expect(d.text).toBe('')
    expect(d.canExpand).toBe(false)
    expect(d.truncated).toBe(false)
  })

  it('펼침 상태에서도 truncated 는 항상 false', () => {
    expect(resolveDetailDisplay(imgs, longDesc, true).truncated).toBe(false)
  })
})
