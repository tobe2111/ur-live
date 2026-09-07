import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { isStoreOwner, type SellerRole } from '@/shared/seller-roles'
import { LIVE_COMMERCE_SUSPENDED } from '@/shared/feature-flags'
import { findSellerTabGroup } from './seller-tab-groups'

/**
 * 🧭 **묶음 안의 탭 줄** — `SellerLayout` 이 한 곳에서 그린다(2026-09-03 대표 승인 "전부").
 *
 * 사이드바에는 묶음의 착지점 하나만 나오고, 형제 화면은 여기서 오간다. 정의는
 * `seller-tab-groups`(SSOT) 하나뿐이라 사이드바와 탭이 갈릴 수 없다.
 *
 * ⚠️ **페이지가 아니라 레이아웃에서 그리는 이유**: 대상 24개 화면 중 6개가 `DashboardPageHeader` 를
 *   안 쓴다. 헤더에 붙였으면 그 여섯에서 탭이 사라지고, 그중 `/seller/stores` 는 묶음의 착지점이라
 *   **위임·운영자로 갈 길이 통째로 없어진다** — 오늘 고친 "페이지는 있는데 닿을 수 없다"의 재발이다.
 *
 * 역할 필터는 사이드바와 같은 규칙을 쓴다(매장 전용 탭이 크리에이터에게 보이면 눌러 봐야 403).
 */
export default function SellerGroupTabs() {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const group = findSellerTabGroup(pathname)
  if (!group) return null

  const sellerType = (typeof window !== 'undefined' ? localStorage.getItem('seller_type') : null) as SellerRole | null
  const visible = group.tabs.filter(tab => {
    if (tab.hideFor?.includes(sellerType as never)) return false
    const mode = tab.mode || 'common'
    if (LIVE_COMMERCE_SUSPENDED) {
      if (mode === 'live') return false
      if (mode === 'store' && !isStoreOwner(sellerType)) return false
    }
    return true
  })
  // 남는 탭이 하나면 줄을 그리지 않는다 — 고를 게 없는 탭 줄은 자리만 먹는다.
  if (visible.length < 2) return null

  return (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit max-w-full overflow-x-auto">
      {visible.map(({ path, labelKey, fallback }) => {
        const active = pathname === path || pathname.startsWith(path + '/')
        return (
          <Link
            key={path}
            to={path}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t(labelKey, { defaultValue: fallback })}
          </Link>
        )
      })}
    </div>
  )
}
