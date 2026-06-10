import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/**
 * 🧭 2026-06-09 IA 정리: 상품 관리 3페이지(내 상품/묶음/재고) 상단 공유 탭.
 *
 * 배경: nav 에 상품/묶음/재고가 별개 항목으로 흩어져 셀러 사이드바 과밀 ("복잡하다" 체감).
 * 각 페이지는 라우트/코드 그대로(딥링크 안전), nav 는 '상품 관리' 1항목 + 페이지 내 탭 이동.
 */
const TABS = [
  { path: '/seller/products', key: 'seller.nav.products', fallback: '상품 관리' },
  { path: '/seller/bundles', key: 'seller.nav.bundles', fallback: '묶음 상품' },
  { path: '/seller/inventory', key: 'seller.inventory', fallback: '재고' },
] as const

export default function SellerProductTabs() {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  return (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit max-w-full overflow-x-auto">
      {TABS.map(({ path, key, fallback }) => {
        const active = pathname === path || pathname.startsWith(path + '/')
        return (
          <Link
            key={path}
            to={path}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t(key, { defaultValue: fallback })}
          </Link>
        )
      })}
    </div>
  )
}
