/**
 * 🧭 `/products/:id` 가 이용권·교환권·숙소면 서버가 정본 상세로 바로 넘긴다 (2026-11-11 대표 *"아직 개선할 게 많다니까. 계속 최적화 해 대기업급으로"*).
 *
 * ## 무엇이 문제였나 (라이브 실측 · 폰 4G·CPU 4배)
 *   `/products/2919`(이용권) 를 열면 서버는 쇼핑 상세 껍데기를 내주고, 앱이 켜지고 상품을 읽은 **뒤에야** `ProductDetailPage` 가
 *   `/pass/2919` 로 다시 보냈다 — 누름 → 첫 글자 **2.0s**(같은 상품을 `/pass/2919` 로 바로 열면 0.7s). 핀 공유의 폴백·옛 링크·
 *   종류를 모르는 호출부가 이 주소로 온다.
 *
 * ## 처방
 *   워커는 이 주소의 상품 시드(`/api/products/:id`)를 **이미 받아 들고 있다** — 그 시드로 화면과 **같은 판정**(`mallRedirectPathFor` 가 있으면
 *   손대지 않고, 아니면 `canonicalDetailPath`)을 해서 정본이 다르면 302 를 돌려준다. 새 조회 0.
 *
 * ## 🔴 쿼리가 붙은 주소는 손대지 않는다
 *   `/products/:id?ref=…` 는 `ProductDetailPage` 가 **넘기기 전에** 소개자(`ref`)를 기기에 적는다(귀속). 서버가 먼저 넘기면 그 줄이 안 돈다.
 *   귀속은 머니 경로에 닿으므로 종전 동작(앱이 적고 넘긴다)을 그대로 둔다 — 호출부가 `url.search` 가 빌 때만 이 함수를 부른다.
 *
 * ⚠️ 못 보는 것: 시드가 없을 때(마감·실패)는 종전대로 앱이 넘긴다 · 몰 상품은 앱의 몰 경로 판정에 맡긴다.
 */
import { canonicalDetailPath } from '../../shared/product-flow'
import { mallRedirectPathFor } from '../../shared/mall/resolve'

type SeedProduct = { id?: number | string | null; deal_only?: number | string | null; category?: string | null; mall_id?: number | null; mall_slug?: string | null }

/** 정본 상세 경로(쇼핑 상품이면 null — 이 주소가 정본이다). */
export function productCanonicalRedirect(ssrPayload: string | null | undefined, pathname: string): string | null {
  try {
    if (!ssrPayload) return null
    const parsed = JSON.parse(ssrPayload) as { success?: boolean; data?: SeedProduct }
    const p = parsed?.data
    if (!p || p.id == null) return null
    const m = /^\/products\/(\d+)\/?$/.exec(pathname)
    if (!m || String(p.id) !== m[1]) return null // 시드가 이 주소의 상품이 아니면(정체성) 넘기지 않는다
    if (mallRedirectPathFor(p)) return null // 몰 상품 — 앱의 판정 순서(몰 먼저)를 건드리지 않는다
    const dest = canonicalDetailPath({ id: p.id as string | number, deal_only: p.deal_only, category: p.category })
    return dest && dest !== `/products/${m[1]}` ? dest : null
  } catch { return null }
}
