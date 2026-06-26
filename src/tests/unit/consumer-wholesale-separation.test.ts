/**
 * 🧱 유어딜 소비자 쇼핑 ↔ 도매몰(유통스타트) 분리 불변식 (정적 가드)
 *
 * 2026-06-26 대표 신고: 어드민이 도매몰용으로 올린 도매 상품(is_supply_product=1, 공급가)이
 *   유어딜 소비자 쇼핑탭/검색에 누수. 원인: 소비자 상품 쿼리(/api/products)가 is_active+deal_only 만
 *   걸러 도매 마스터를 제외 안 함. 도매몰(/api/wholesale/*)은 별도 엔드포인트로 항상 is_supply_product=1.
 *
 * 불변식:
 *   ① 소비자 상품 쿼리(리스트/카운트/FTS검색 + /count 핸들러)는 도매 마스터
 *      (is_supply_product=1 AND supply_source_id 없음)를 제외한다.
 *   ② 도매몰 카탈로그는 여전히 도매 상품(is_supply_product=1)만 노출한다(반대 방향 분리).
 * 깨지면(거름망 제거/도매몰 필터 제거) CI 빨강.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const repo = readFileSync(resolve(process.cwd(), 'src/features/products/repositories/ProductRepository.ts'), 'utf8')
const routes = readFileSync(resolve(process.cwd(), 'src/features/products/api/products.routes.ts'), 'utf8')
const wholesale = readFileSync(resolve(process.cwd(), 'src/features/supply/api/wholesale.routes.ts'), 'utf8')

const norm = (s: string) => s.replace(/\s+/g, ' ')
const occ = (haystack: string, needle: string) => haystack.split(needle).length - 1

// 내가 추가한 정확한 제외 절(공백 정규화 기준).
const EXCL_BARE = 'NOT (COALESCE(is_supply_product, 0) = 1 AND COALESCE(supply_source_id, 0) = 0)'
const EXCL_P = 'NOT (COALESCE(p.is_supply_product, 0) = 1 AND COALESCE(p.supply_source_id, 0) = 0)'

describe('유어딜 소비자 쇼핑 ↔ 도매몰 분리 불변식', () => {
  it('① 소비자 상품 쿼리(리스트+카운트+FTS)가 도매 마스터를 제외한다', () => {
    const repoN = norm(repo)
    // list 쿼리 + count 쿼리 = bare alias 2회 이상, FTS = p. alias 1회 이상
    expect(occ(repoN, EXCL_BARE)).toBeGreaterThanOrEqual(2)
    expect(occ(repoN, EXCL_P)).toBeGreaterThanOrEqual(1)
  })

  it('① /api/products/count 핸들러도 도매 마스터를 제외한다', () => {
    expect(norm(routes).includes(EXCL_BARE)).toBe(true)
  })

  it('② 도매몰 카탈로그는 여전히 is_supply_product=1 만 노출한다(반대 방향)', () => {
    // 도매몰은 소비자 /api/products 와 별개 엔드포인트라 항상 도매상품만 봐야 함.
    expect(/is_supply_product\s*=\s*1/.test(wholesale)).toBe(true)
  })
})
