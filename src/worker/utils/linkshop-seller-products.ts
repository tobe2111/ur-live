/**
 * 🚀 유어샵(`/u/:handle`) 사업자 — **셀러 상품을 curator 응답에 동봉** (2026-09-02 대표 "유어샵도 이상적인 판정을 받게").
 *
 * 라이브 워터폴 실측: 07-11 에 셀러 페이로드를 동봉해 1-RTT 로 만든 뒤에도 `/api/products?seller_id=N&limit=100` 이
 * JS 실행 후(≈750ms)에야 나가 그게 콘텐츠 완성 시각(0.9~1.6s)을 정했다. 같은 서비스(`ProductService.getProducts` —
 * `/api/products` 핸들러와 같은 필터·컬럼)라 드리프트 0. **실패 시 null** → 클라가 기존 fetch 로 폴백.
 * 소유자 응답은 no-store 라 늘 신선하고, 익명은 기존 셀러 페이로드와 같은 엣지 TTL 을 탄다.
 *
 * 별도 파일인 이유: `curator.routes.ts` 는 파일 크기 래칫(1,397줄)에 동결돼 있다.
 */
export async function loadLinkedSellerProducts(DB: D1Database, sellerId: number): Promise<unknown[] | null> {
  try {
    const { ProductService } = await import('../../features/products/services/ProductService')
    const r = await new ProductService(DB).getProducts({ sellerId }, { page: 1, limit: 100 })
    return r.data ?? []
  } catch { return null } // additive — 생략 시 클라 폴백 fetch
}
