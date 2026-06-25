import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// 🤖 2026-06-24 회귀 방지 (대표 신고: "도매몰 어드민 메인 대시보드에서 상품승인 클릭해도 넘어가지 않네요").
//   원인: '도매 통합 현황'(AdminWholesaleOverviewPage)의 승인 큐 카드가 `/admin/products` 로 링크하는데,
//   그 경로가 도매(wholesale) nav 그룹에도 WHOLESALE_EXTRA_ALLOWED_PATHS 에도 없어서 → AdminLayout 의
//   wholesale-role RBAC 가드가 /admin/wholesale-overview 로 **바운스** → 클릭이 안 먹히는 것처럼 보임.
//   불변식: 큐 카드의 모든 목적지는 wholesale-role 어드민이 도달 가능해야 한다(정적 검사 — import 무게 없음).

const layout = readFileSync(resolve(process.cwd(), 'src/components/AdminLayout.tsx'), 'utf8')
const overview = readFileSync(resolve(process.cwd(), 'src/pages/admin/AdminWholesaleOverviewPage.tsx'), 'utf8')

/** AdminLayout 에서 wholesale-role 어드민에게 허용되는 /admin 경로 집합을 정적으로 재구성. */
function wholesaleAllowedPaths(): Set<string> {
  const allowed = new Set<string>()
  // 1) domain: 'wholesale' 그룹의 nav 경로 — domain 표식부터 다음 그룹(title:)까지가 그 그룹의 items.
  const re = /domain:\s*'wholesale'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(layout))) {
    const nextTitle = layout.indexOf('title:', m.index + 1)
    const block = layout.slice(m.index, nextTitle === -1 ? m.index + 4000 : nextTitle)
    for (const pm of block.matchAll(/path:\s*'(\/admin\/[^']+)'/g)) allowed.add(pm[1])
  }
  // 2) 명시적 추가 허용 목록(큐 카드 목적지) + 전역 허용.
  for (const name of ['WHOLESALE_EXTRA_ALLOWED_PATHS', 'ALWAYS_ALLOWED_ADMIN_PATHS']) {
    const arr = layout.match(new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]`))
    if (arr) for (const pm of arr[1].matchAll(/'(\/admin\/[^']+)'/g)) allowed.add(pm[1])
  }
  return allowed
}

/** 통합 현황 승인 큐 카드의 목적지(쿼리스트링 제거한 pathname). */
function queueDestinations(): string[] {
  return [...overview.matchAll(/\[queue\.\w+,\s*'[^']+',\s*'(\/admin\/[^']+)'\]/g)]
    .map((m) => m[1].split('?')[0])
}

describe('도매 통합 현황 승인 큐 — wholesale-role 어드민 도달 가능 불변식', () => {
  const allowed = wholesaleAllowedPaths()
  const dests = queueDestinations()

  it('큐 카드 목적지를 정상 추출했다(샘플 sanity)', () => {
    expect(dests.length).toBeGreaterThanOrEqual(5)
    expect(dests).toContain('/admin/products')        // 상품 승인 / 가격변경 목적지
    expect(dests).toContain('/admin/seller-approval')  // 판매사 승인
  })

  it('허용 경로 집합에 핵심 경로가 포함된다(추출 로직 sanity)', () => {
    expect(allowed.has('/admin/suppliers')).toBe(true)        // 도매 nav 그룹
    expect(allowed.has('/admin/products')).toBe(true)         // WHOLESALE_EXTRA_ALLOWED_PATHS
    expect(allowed.has('/admin/seller-approval')).toBe(true)  // WHOLESALE_EXTRA_ALLOWED_PATHS
  })

  it('모든 큐 카드 목적지는 wholesale-role 허용 경로여야 한다(바운스 방지)', () => {
    const unreachable = dests.filter(
      (d) => !allowed.has(d) && ![...allowed].some((p) => d.startsWith(p + '/')),
    )
    expect(unreachable).toEqual([])
  })
})

describe('AdminProductsPage — 도매 파트너 deep-link/탭 스코프 회귀 방지', () => {
  const page = readFileSync(resolve(process.cwd(), 'src/pages/AdminProductsPage.tsx'), 'utf8')

  it("URL `?tab=` 를 읽어 초기 탭을 정한다(deep-link)", () => {
    expect(page).toMatch(/useSearchParams/)
    expect(page).toMatch(/searchParams\.get\('tab'\)/)
  })
  it('wholesale-role 은 supplier-products 탭으로 스코프된다', () => {
    expect(page).toMatch(/isWholesaleAdmin/)
    expect(page).toMatch(/isWholesaleAdmin\)\s*return 'supplier-products'/)
  })
})
