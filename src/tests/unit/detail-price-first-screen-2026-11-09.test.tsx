/**
 * 💰 상세 첫 화면이 별점 줄·가격까지 그린다 (2026-11-09 — 폰 흉내: 사진·제목 1.5초 · 가격 3.5초).
 *   서버 문자열과 `PassHeadCard` 가 그리는 DOM 이 **같아야** 마운트 때 안 밀린다 — 실제 렌더를 대조한다.
 *   거리(per-user)는 서버가 안 그린다.
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { buildDetailFirstScreen } from '@/worker/utils/detail-ssr-body'
import PassHeadCard from '@/pages/group-buy/PassHeadCard'
import { derivePricing } from '@/pages/group-buy/pricing'

const d = {
  id: 2919, name: '닭도리탕', restaurant_name: '달빛한스푼', category: 'meal_voucher', image_url: 'https://media.ur-team.com/a.jpg',
  price: 31000, original_price: 35000, current_discount_pct: 0, avg_rating: 4.7, review_count: 10, sold_count: 12,
}
const LOADER = '<div style="min-height:100dvh">urdeal.</div>'

function serverCard(seed = d): HTMLElement {
  const html = buildDetailFirstScreen(JSON.stringify({ data: seed }), LOADER)
  const box = document.createElement('div'); box.innerHTML = html
  return box.querySelector('h1')!.parentElement as HTMLElement
}
function clientCard(seed = d, distKm: string | null = null): HTMLElement {
  const p = derivePricing(seed)
  const { container } = render(<PassHeadCard merchant={seed.restaurant_name} category={seed.category} isPrelaunch={false} name={seed.name}
    distKm={distKm} buyers={seed.sold_count} rating={seed.avg_rating} reviewCount={seed.review_count}
    unitPrice={p.unitPrice} refPrice={p.refPrice} discountPct={p.displayDiscountPct} />)
  return container.firstElementChild as HTMLElement
}
const norm = (el: HTMLElement) => {
  const c = el.cloneNode(true) as HTMLElement
  for (const n of [c, ...Array.from(c.querySelectorAll<HTMLElement>('[style]'))]) { const v = n.getAttribute('style'); if (v != null) { n.removeAttribute('style'); n.style.cssText = v } }
  return c.outerHTML
}

describe('상세 첫 화면 가격', () => {
  it('가격과 별점 줄이 서버 첫 화면에 있다', () => {
    const t = serverCard().textContent || ''
    expect(t).toContain('31,000원')
    expect(t).toContain('35,000원')
    expect(t).toContain('11%')
    expect(t).toContain('12명 구매')
  })
  it('서버 머리 카드 = 화면 머리 카드(글자 하나 안 다르다)', () => {
    expect(norm(serverCard())).toBe(norm(clientCard()))
  })
  it('리뷰·구매가 없어도 같다', () => {
    const s = { ...d, avg_rating: 0, review_count: 0, sold_count: 0 }
    expect(norm(serverCard(s))).toBe(norm(clientCard(s)))
  })
  it('거리는 서버가 안 그린다(같은 줄 오른쪽에 나중에 붙는다)', () => {
    expect(serverCard().textContent).not.toMatch(/km/)
    const c = clientCard(d, '1.2')
    expect(c.querySelector('.mt-2')?.lastElementChild?.textContent).toBe('1.2km')
  })
})
