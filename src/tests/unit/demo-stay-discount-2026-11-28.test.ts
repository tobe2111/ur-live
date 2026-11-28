/**
 * 🏷️ 데모 숙소 할인율이 한 숫자(23%)로 몰리지 않는다 (2026-11-28)
 * 숙소 사장님이 "숙소가 다 23%" 를 보고 신생 플랫폼이냐고 물었다 — 원인은 시드의 `× 1.3` 정가.
 * 못 보는 것: 이미 라이브에 있는 행(치유는 어드민 `POST /api/admin/stays/seed-demo {count:0}` 로 돈다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { demoStayDiscountPct, demoStayOriginalPrice, isLegacyDemoStayOriginal, DEMO_STAY_DISCOUNT_PCTS } from '@/features/admin/api/admin-stays/demo-stay-discount'

const pct = (price: number, orig: number) => Math.round(100 * (orig - price) / orig)

describe('데모 숙소 할인율', () => {
  it('연속 id 20개가 최소 5가지 할인율로 퍼진다', () => {
    const set = new Set(Array.from({ length: 20 }, (_, i) => demoStayDiscountPct(2944 + i)))
    expect(set.size).toBeGreaterThanOrEqual(5)
  })
  it('23% 는 목록에 없다', () => {
    expect(DEMO_STAY_DISCOUNT_PCTS).not.toContain(23)
  })
  it('정가는 천 원 단위이고 판매가 이상이며 표시 할인율이 목록 근처다', () => {
    for (const [price, id] of [[189000, 2944], [69000, 2991], [129000, 3012]] as const) {
      const o = demoStayOriginalPrice(price, id)
      expect(o % 1000).toBe(0)
      expect(o).toBeGreaterThanOrEqual(price)
      expect(Math.abs(pct(price, o) - demoStayDiscountPct(id))).toBeLessThanOrEqual(1)
    }
  })
  it('같은 seed 는 같은 값(멱등)', () => {
    expect(demoStayOriginalPrice(149000, 2949)).toBe(demoStayOriginalPrice(149000, 2949))
  })
  it('옛 × 1.3 정가를 알아본다', () => {
    expect(isLegacyDemoStayOriginal(189000, 246000)).toBe(true)
    expect(isLegacyDemoStayOriginal(149000, 272000)).toBe(false)
  })
  it('시드 코드에 × 1.3 정가 공식이 다시 들어오지 않는다', () => {
    const src = readFileSync('src/features/admin/api/admin-stays.routes.ts', 'utf8')
    expect(src).not.toMatch(/\* 1\.3 \/ 1000\) \* 1000/)
    expect(src.match(/demoStayOriginalPrice\(/g)?.length).toBe(3)
    expect(src).toContain('healDemoStayDiscounts(DB)')
  })
})
