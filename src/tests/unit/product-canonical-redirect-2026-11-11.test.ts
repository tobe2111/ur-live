/**
 * 🧭 `/products/:id` 가 이용권·교환권·숙소면 서버가 정본 상세로 바로 302 (2026-11-11).
 *   라이브 실측: `/products/2919`(이용권) 누름 → 첫 글자 2.0s — 앱이 켜지고 상품을 읽은 뒤에야 `/pass/2919` 로 넘겼다(바로 열면 0.7s).
 *
 * 지키는 것:
 *   ① 판정이 화면(`ProductDetailPage`)과 같다 — 몰 상품이면 손대지 않고, 아니면 `canonicalDetailPath`
 *   ② 쇼핑 상품 · 시드 없음 · 깨진 시드 · **다른 상품의 시드**는 넘기지 않는다
 *   ③ 워커 배선 — PRODUCT 슬롯 · **쿼리가 없을 때만**(`?ref=` 귀속은 앱이 적고 넘긴다) · 302 · 저장 금지
 *   ④ 화면의 안전판은 남아 있다(시드가 없을 때 앱이 넘긴다)
 * ⚠️ 못 보는 것: 실제 응답(배포 뒤 `curl -I https://urdeal.kr/products/<이용권 id>`) · 귀속 원장(쿼리 있는 주소는 종전 그대로라 변화 없음).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { productCanonicalRedirect } from '@/worker/utils/product-canonical-redirect'
import { canonicalDetailPath } from '@/shared/product-flow'

const seed = (p: Record<string, unknown>) => JSON.stringify({ success: true, data: p })
const read = (f: string) => readFileSync(f, 'utf8')

describe('① 판정이 화면과 같다', () => {
  it.each([
    ['이용권', { id: 2919, category: 'meal_voucher', deal_only: 0, mall_id: 1, mall_slug: null }],
    ['교환권', { id: 2192, category: 'gifticon', deal_only: 1, mall_id: 1, mall_slug: null }],
    ['숙소', { id: 3015, category: 'stay_voucher', deal_only: 0, mall_id: 1, mall_slug: null }],
  ])('%s → canonicalDetailPath 와 같은 목적지', (_n, p) => {
    const dest = productCanonicalRedirect(seed(p), `/products/${p.id}`)
    expect(dest).toBe(canonicalDetailPath(p)); expect(dest).not.toBeNull(); expect(dest).not.toContain('/products/')
  })
  it('끝 슬래시도 같은 주소', () => { expect(productCanonicalRedirect(seed({ id: 7, category: 'beauty_voucher' }), '/products/7/')).toBe('/pass/7') })
})

describe('② 넘기지 않는 경우', () => {
  it('쇼핑 상품(정본이 이 주소다)', () => { expect(productCanonicalRedirect(seed({ id: 5, category: 'fashion', deal_only: 0 }), '/products/5')).toBeNull() })
  it('몰 상품 — 앱의 몰 경로 판정에 맡긴다', () => { expect(productCanonicalRedirect(seed({ id: 5, category: 'meal_voucher', mall_id: 7, mall_slug: 'gimbap' }), '/products/5')).toBeNull() })
  it.each([[null], [''], ['{bad'], [JSON.stringify({ success: false })], [seed({})]])('시드 없음·깨짐: %s', (s) => { expect(productCanonicalRedirect(s as string | null, '/products/5')).toBeNull() })
  it('다른 상품의 시드(정체성) · 다른 경로', () => {
    expect(productCanonicalRedirect(seed({ id: 6, category: 'meal_voucher' }), '/products/5')).toBeNull()
    expect(productCanonicalRedirect(seed({ id: 5, category: 'meal_voucher' }), '/products/5/reviews')).toBeNull()
    expect(productCanonicalRedirect(seed({ id: 5, category: 'meal_voucher' }), '/pass/5')).toBeNull()
  })
})

describe('③ 워커 배선', () => {
  const w = read('src/worker/index.ts') // raw — worker/index.ts 엔 주석 제거기를 쓰지 않는다
  it('PRODUCT 슬롯 · 쿼리가 없을 때만 · 302 · no-store', () => {
    expect(w).toContain("if (ssrSlot === 'PRODUCT' && !url.search) { const canon = productCanonicalRedirect(ssrPayload, url.pathname); if (canon) { c.res = new Response(null, { status: 302, headers: { Location: canon, 'Cache-Control': 'no-store' } }); return; } }")
    expect(w).toContain("import { productCanonicalRedirect } from './utils/product-canonical-redirect';")
  })
})

describe('④ 화면의 안전판', () => {
  it('ProductDetailPage 가 여전히 같은 순서로 넘긴다(쿼리 보존)', () => {
    const page = read('src/pages/ProductDetailPage.tsx')
    expect(page).toContain('const dest = mallRedirectPathFor(product) ?? canonicalDetailPath(product)')
    expect(page).toContain('if (dest) navigate(`${dest}${window.location.search}`, { replace: true })')
  })
})
