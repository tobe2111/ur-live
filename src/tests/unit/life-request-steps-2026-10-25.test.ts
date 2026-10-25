/**
 * 주소 질문 제목에 "주소"가 두 번 붙지 않는다 (2026-10-25 대표 스크린샷 — "가게 주소 주소를 알려 주세요").
 * 필드 라벨이 이미 "가게 주소"·"출발지" 처럼 그 자체로 이름이라, 제목은 라벨 + 을/를 로만 만든다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const src = stripComments(readFileSync('src/pages/life/request/AddressSheet.tsx', 'utf8'))

describe('주소 질문 제목', () => {
  it('라벨 뒤에 "주소"를 덧붙이지 않는다', () => {
    expect(src).not.toMatch(/\$\{f\.label\}\s*(상세\s*)?주소/)
  })
  it('검색·직접 입력 제목은 라벨 + 을/를', () => {
    expect((src.match(/\$\{eulReul\(f\.label\)\} 알려 주세요/g) || []).length).toBe(2)
  })
})

describe('생활 첫 화면 타일 (A안)', () => {
  it('모든 카테고리에 짧은 이름·그림이 있고, 이름은 두 줄·줄당 6자 이내', async () => {
    const { LIFE_TILES } = await import('@/pages/life/life-tiles')
    const { HOME_SERVICE_CATEGORIES } = await import('@/shared/home-service')
    for (const d of HOME_SERVICE_CATEGORIES) {
      const t = LIFE_TILES[d.key]
      expect(t, d.key).toBeTruthy()
      const lines = t[0].split('\n')
      expect(lines.length, d.key).toBeLessThanOrEqual(2)
      for (const l of lines) expect(l.length, `${d.key}: ${l}`).toBeLessThanOrEqual(6)
    }
  })
  it('첫 화면에 카테고리 설명 문장을 다시 늘어놓지 않는다', () => {
    const page = stripComments(readFileSync('src/pages/life/LifePage.tsx', 'utf8'))
    expect(page).not.toMatch(/def\.blurb/)
  })
})
