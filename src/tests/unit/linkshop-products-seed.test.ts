/**
 * 🚀 유어샵(/u/:handle) 0-RTT 완성 — 2026-09-02 (대표 "유어샵도 이상적인 판정을 받게").
 *
 * 라이브 워터폴 실측: 셀러 페이로드 시드(07-11) 뒤에도 `/api/products?seller_id=N&limit=100` 이
 * JS 실행 후(≈750ms)에야 나가 콘텐츠 완성(0.9~1.6s)을 정했다. 그 마지막 왕복을 서버가 동봉한다.
 *
 * 지키는 것:
 *   ① 서버 — curator GET /:handle 이 linkedSeller 있을 때 같은 서비스(ProductService.getProducts)로 상품을 동봉
 *   ② 클라 — CuratorPage 가 productsSeed 로 내려주고, SellerPublicPage 가 동기 초기값으로 소비 + fetch 생략
 *   ③ 모바일 — xl 전용 레일 둘은 뷰포트가 xl 일 때만 마운트(안 그러면 폰이 QR 82KB 를 내려받는다)
 * ⚠️ 못 막는 것: 동봉 형태와 /api/products 응답 형태가 갈리는 것 — 같은 서비스 호출이라는 문자열만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const ROUTE = readFileSync('src/worker/routes/curator.routes.ts', 'utf8')
const CURATOR = readFileSync('src/pages/CuratorPage.tsx', 'utf8')
const SELLER = readFileSync('src/pages/SellerPublicPage.tsx', 'utf8')
const LAYOUT = readFileSync('src/components/MobileAppLayout.tsx', 'utf8')
const API = readFileSync('src/features/curator/api/curator-api.ts', 'utf8')

describe('① 서버 동봉', () => {
  it('linkedSeller 있으면 ProductService.getProducts({ sellerId }) 로 상품을 동봉한다', () => {
    expect(ROUTE).toMatch(/new ProductService\(c\.env\.DB\)\.getProducts\(\{ sellerId: Number\(linkedSeller\.id\) \}, \{ page: 1, limit: 100 \}\)/)
    expect(ROUTE).toMatch(/linked_seller_products: linkedSellerProducts,/)
    expect(API).toMatch(/linked_seller_products\?: unknown\[\] \| null/)
  })
  it('limit 이 클라 요청(limit=100)과 같다 — 다르면 진열대에서 상품이 조용히 사라진다', () => {
    expect(SELLER).toMatch(/\/api\/products\?seller_id=\$\{numericId\}&limit=100/)
  })
})

describe('② 클라 소비', () => {
  it('CuratorPage → SellerPublicPage 로 productsSeed 전달', () => {
    expect(CURATOR).toMatch(/productsSeed=\{data\.linked_seller_products \?\? null\}/)
  })
  it('SellerPublicPage 는 동기 초기값으로 소비하고, 시드가 있으면 상품 fetch 를 생략한다', () => {
    expect(SELLER).toMatch(/useState<Product\[\]>\(\(\) => \(Array\.isArray\(productsSeed\) \? \(productsSeed as Product\[\]\) : \[\]\)\)/)
    const fn = SELLER.slice(SELLER.indexOf('const fetchSubData = (numericId: number) => {'))
    expect(fn.slice(0, 200)).toMatch(/if \(seededProducts\) return/)
    expect(SELLER).toMatch(/\}, \[sellerId, sellerNumericId, productsSeed\]\)/)
  })
})

describe('③ xl 전용 레일은 xl 에서만 마운트', () => {
  it('두 레일 모두 isXl 게이트', () => {
    expect(LAYOUT).toMatch(/const isXl = useMediaQuery\('\(min-width: 1280px\)'\)/)
    expect(LAYOUT).toMatch(/\{linkshopVisitor && isXl && <Suspense fallback=\{null\}><LinkshopVisitorRails \/><\/Suspense>\}/)
    expect(LAYOUT).toMatch(/\{showFrameRails && isXl && <Suspense fallback=\{null\}><ConsumerFrameRails \/><\/Suspense>\}/)
  })
})
