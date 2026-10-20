/**
 * ⚡ 셀러 라우트 표를 `/seller/*` 아래에서만 맞춘다 (2026-10-13, 어드민 표 2026-10-12 와 같은 처방).
 * 근거: `src/routes/seller.routes.tsx` 의 `SellerRouteTree` 머리말.
 *
 *   ① 원래 표의 `/seller…` 경로가 **하나도 빠짐없이** 하위 Routes 에서 맞는다
 *   ② 표 밖 경로(`/s/:id`·`/profile/:id`)는 손님 Routes 에 그대로 남는다
 *   ③ 표에 없는 셀러 경로는 404(빈 화면 금지) · App 은 표를 펼치지 않는다
 *   ④ 실제 손님 라우터 아래에서 깊은 셀러 경로가 그 페이지에 닿는다
 * ⚠️ 못 막는 것: 보호 라우트의 실제 판정(표가 그대로라 종전과 같다) · 소요 ms(재생으로만 잰다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRoutesFromChildren, matchRoutes, MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { render } from '@testing-library/react'
import { SellerRoutes, SellerRouteTree, sellerTopLevelRoutes } from '@/routes/seller.routes'

const original: string[] = []
for (const r of ([] as unknown[]).concat(SellerRoutes().props.children)) {
  const p = (r as { props?: { path?: string } })?.props?.path
  if (typeof p === 'string') original.push(p)
}
const sellerOnly = original.filter((p) => p === '/seller' || p.startsWith('/seller/'))
const treeRoutes = createRoutesFromChildren(SellerRouteTree().props.children)
const topRoutes = createRoutesFromChildren(sellerTopLevelRoutes())

describe('⚡ 셀러 라우트 표 — /seller/* 아래 하위 Routes', () => {
  it('원래 표가 비어 있지 않다(0이면 아래가 전부 헛돈다)', () => {
    expect(sellerOnly.length).toBeGreaterThan(50)
  })

  it('① 모든 /seller 경로가 접두를 뗀 채 그대로 맞는다', () => {
    for (const p of sellerOnly) {
      const rest = p.slice('/seller'.length) || '/'
      const sample = rest.replace(/:[A-Za-z_]+/g, '123')
      const m = matchRoutes(treeRoutes, sample)
      expect(m, p).not.toBeNull()
      expect(m![m!.length - 1].route.path, p).toBe(rest)
    }
  })

  it('② 표 밖 경로(공개 가게 둘)는 부팅 묶음의 손님 Routes 에 — 표 안엔 /seller 경로뿐', () => {
    // ⚡ 2026-10-18: 공개 가게 두 줄은 `seller-public.routes.tsx`(부팅) 로 옮겼다 — 표는 /seller/* 에서만 받는다.
    expect(original.filter((p) => !sellerOnly.includes(p)), '표 안에 /seller 밖 경로가 생기면 그 경로는 표가 lazy 라 하드로드에서 안 맞는다').toEqual([])
    expect(topRoutes.map((r) => r.path).sort()).toEqual(['/profile/:sellerId', '/s/:sellerId'])
  })

  it('③ 없는 셀러 경로는 404 · App 은 /seller/* 한 줄', () => {
    const m = matchRoutes(treeRoutes, '/no-such-tool-xyz')
    expect(m![m!.length - 1].route.path).toBe('*')
    const app = readFileSync('src/App.tsx', 'utf8')
    expect(app).not.toMatch(/\{SellerRoutes\(\)\}/)
    expect(app).toMatch(/<Route path="\/seller\/\*" element=\{<SellerRouteTree \/>\} \/>/)
    expect(app).toMatch(/\{sellerTopLevelRoutes\(\)\}/)
    // ⚡ 2026-10-18 표는 lazy — 정적 import 하면 손님 첫 방문에 raw 28KB 가 다시 실린다.
    expect(app).toMatch(/const SellerRouteTree = lazy\(\(\) => import\('\.\/routes\/seller\.routes'\)\)/)
    expect(app).not.toMatch(/import \{[^}]*\} from '\.\/routes\/seller\.routes'/)
    expect(app).toMatch(/import \{ sellerTopLevelRoutes \} from '\.\/routes\/seller-public\.routes'/)
  })

  it('④ 실제 손님 라우터 아래에서 렌더하면 깊은 셀러 경로가 그 화면에 닿는다', () => {
    let at = ''
    function Probe() { const l = useLocation(); at = l.pathname + l.search; return null }
    render(
      <MemoryRouter initialEntries={['/seller/register?from=x']}>
        <Routes>
          {sellerTopLevelRoutes()}
          <Route path="/seller/*" element={<SellerRouteTree />} />
          <Route path="/store/new" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(at).toBe('/store/new?from=x')
  })
})
