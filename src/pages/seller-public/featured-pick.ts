/**
 * 🏪 2026-10-18 — 사업자 유어샵의 '이번 주 픽' 고르기 (대표 신고: 현정 님 유어샵).
 *
 * 종전 규칙은 `vouchers[0] || shopProducts[0]` 하나였고, 그 결과 세 가지가 함께 틀렸다:
 *   ① 첫 이용권에 사진이 없으면 큰 카드가 **남색 빈 판**이 됐다(사진 자리에 색만 칠한다).
 *   ② 이용권이 1개면 그게 히어로로 올라가 '이용권' 구역이 사라지는데, 위의 [이용권] 칩은 남아
 *      눌러도 아무 데도 안 갔다.
 *   ③ 히어로 링크가 언제나 `/products/:id` 라 이용권도 쇼핑 상세를 한 번 거쳐 돌아갔다.
 *
 * 규칙:
 *   - **사진이 있는 것만** 히어로가 된다. 이용권 우선(2026-08-26 대표 확정 "유어샵의 주인공은 이용권")
 *     → 사진 있는 이용권 → 사진 있는 상품 → 없으면 **히어로를 안 그린다**(전부 아래 목록 카드로 간다.
 *     목록 카드는 사진이 없을 때의 모양이 따로 있다). 빈 판을 큰 자리에 세우는 것보다 낫다.
 *   - 사진은 대표 사진, 없으면 갤러리 첫 장.
 *   - 히어로로 뽑힌 것은 자기 목록에서 빠진다(중복 방지 — 종전과 같다).
 *   - 칩은 **두 목록이 다 실제로 그려질 때만** 낸다 — 칩은 목록으로 가는 손잡이다.
 */
import type { Product } from './types'

export function photoOf(p: Pick<Product, 'image_url' | 'images'>): string | null {
  const main = typeof p.image_url === 'string' ? p.image_url.trim() : ''
  if (main) return main
  let list: unknown = p.images
  if (typeof list === 'string') { try { list = JSON.parse(list) } catch { list = [] } }
  if (Array.isArray(list)) {
    const first = list.find((x) => typeof x === 'string' && x.trim())
    if (typeof first === 'string') return first.trim()
  }
  return null
}

export function pickFeatured(vouchers: Product[], shopProducts: Product[]) {
  const featured = vouchers.find((p) => photoOf(p)) ?? shopProducts.find((p) => photoOf(p)) ?? null
  const gridVouchers = vouchers.filter((p) => p !== featured)
  const gridProducts = shopProducts.filter((p) => p !== featured)
  return { featured, gridVouchers, gridProducts, showChips: gridVouchers.length > 0 && gridProducts.length > 0 }
}
