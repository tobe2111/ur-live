/**
 * 🏪 사업자 공개 가게(`/s/:sellerId`·`/profile/:sellerId`) — 손님 화면이라 **부팅 묶음**에 남는 셀러 경로 둘.
 *
 * ⚡ 2026-10-18 (대표 *"다 이상적으로 해줘"* — 첫 방문 화면 코드 무게): 셀러 대시보드 라우트 표
 * (`seller.routes.tsx`, raw 28KB)가 이 두 줄 때문에 **모든 손님의 첫 방문**에 실려 왔다. 표 밖 경로를 이
 * 파일로 떼고 표는 `/seller/*` 에 들어갈 때만 받는다(어드민 표 2026-10-12 와 같은 처방).
 * 사업자 유어샵 부팅 로더 등록도 여기로 옮겼다 — 표가 lazy 가 되면 그 등록이 부팅 때 안 돈다.
 */
import type { ReactElement } from 'react'
import { Route } from 'react-router-dom'
import { SellerPublicPage } from '@/pages/seller-public/lazy-seller-public'
import { registerBootPage } from '@/lib/boot-page'; import { isCuratorShopPath } from '@/shared/route-surface'
import { registerRoutePreload } from '@/lib/route-preload'

registerBootPage('linkshop', () => (isCuratorShopPath(location.pathname) ? Promise.resolve() : SellerPublicPage.load())); registerRoutePreload('sellerPublic', SellerPublicPage.load) // 🚀 2026-10-15 CuratorPage 와 같은 래퍼(lib/boot-page)

/** 손님 `<Routes>` 에 그대로 두는 셀러 표 밖 경로. */
export function sellerTopLevelRoutes(): ReactElement[] {
  return [
    <Route path="/s/:sellerId" key="/s/:sellerId" element={<SellerPublicPage />} />,
    <Route path="/profile/:sellerId" key="/profile/:sellerId" element={<SellerPublicPage />} />,
  ]
}
