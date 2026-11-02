/**
 * 🐢 2026-11-02 대표 *"부분적으로 느린 경우들이 많아서 유저들이 헷갈려해"* — 유어샵 `GET /api/curator/:handle` 의 왕복 물결 수.
 *
 * 주인이 자기 유어샵을 볼 때는 캐시 없이(`private, no-store`) **미국 원본 DB** 를 쓴다(편집 직후 옛 값 금지).
 * 그래서 직렬 대기 한 번이 한국에서 ~0.17초씩 그대로 쌓인다. 종전엔 사용자 → [가게·핀] → [딜%·누적구매] → 소개 스위치
 * → 머리 문구 → 셀러 페이로드 → 셀러 상품 = **직렬 7물결**이었다. 이제 사용자 → 한 물결(여섯) → 한 물결(둘) = 3.
 *
 * 이 시험은 사용자를 찾은 뒤 응답까지의 `await` 수를 센다(물결이 다시 쪼개지면 빨간불).
 * ⚠️ 못 보는 것: 함수 안쪽의 숨은 직렬(`buildSellerPublicPayload` 내부) · 실제 왕복 시간.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/worker/routes/curator.routes.ts', 'utf8')
const start = SRC.indexOf("curatorRoutes.get('/:handle', optionalAuth()")
const body = SRC.slice(SRC.indexOf('const userId = user.id', start), SRC.indexOf('    return c.json({', SRC.indexOf('const userId = user.id', start)))

describe('유어샵 주인 보기 — 직렬 대기 수', () => {
  it('사용자를 찾은 뒤 응답까지 await 는 셋뿐(여섯 읽기 한 물결 · 셀러 둘 한 물결 · 셀러 없을 때 상품 폴백)', () => {
    expect(body.length).toBeGreaterThan(500)
    expect((body.match(/\bawait\b/g) || []).length).toBe(3)
  })
  it('첫 물결에 딜%·누적구매·소개 스위치·머리 문구가 함께 있다', () => {
    const wave = body.slice(body.indexOf('await Promise.all(['), body.indexOf('    ])'))
    for (const s of ['findActiveDealPctsBySeller', 'countUShopSales', 'isAffiliateProgramEnabled', 'linkshop_headline', 'product_pins']) expect(wave).toContain(s)
  })
  it('셀러 페이로드와 셀러 상품은 나란히', () => {
    const w = body.slice(body.indexOf('const [linkedSellerPublic, linkedSellerProducts]'))
    expect(w).toMatch(/await Promise\.all\(\[\s*import\('\.\.\/utils\/seller-public-payload'\)/)
  })
})
