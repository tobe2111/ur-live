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
