/**
 * 🧭 **셀러 네비 모델 — 사이드바·하단 탭·더보기·⌘K 검색이 전부 이 한 곳에서 파생된다** (2026-09-14).
 *
 * 종전엔 이 계산이 `SellerLayout` 안에 있었다(600줄 래칫 직전). 다섯 대분류(폰 하단 탭 = PC 사이드바)와
 * `/seller/more` 페이지가 **같은 목록**을 그려야 해서 뽑아냈다 — 두 화면이 각자 계산하면 반드시 갈린다.
 *
 * 세 층:
 *   1. `primary`   — 다섯 대분류(`seller-primary-nav`, SSOT). 폰 하단 탭과 PC 사이드바 위쪽.
 *   2. `moreGroups` — `NAV_GROUPS`(역할 필터 뒤)에서 **다섯이 이미 덮는 것을 뺀 나머지**. PC 사이드바
 *                    헤어라인 아래와 `/seller/more` 본문. 손으로 적지 않는다(파생).
 *   3. `commandItems` — ⌘K 색인. 사이드바·더보기의 복사본이 아니라 **탭 안으로 접힌 형제 + 검색 전용 화면**까지.
 *
 * ⚠️ `ctaItem`('이용권 등록')은 **색인 원본(`orderedNavGroups`)에서 빼지 않는다.** 그리는 목록(`renderedNavGroups`)만
 *   거른다 — 색인까지 거르면 그 페이지는 메뉴에도 검색에도 없어진다(이 레포가 반복해 겪은 사고. R3 가드).
 */
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { HOSTING_HIDDEN, LIVE_COMMERCE_SUSPENDED } from '@/shared/feature-flags'
import { isStoreOwner } from '@/shared/seller-roles'
import { NAV_GROUPS, SELLER_SEARCH_ONLY, type SellerType } from '@/components/seller/seller-nav'
import { SELLER_TAB_GROUPS } from '@/components/seller/seller-tab-groups'
import { readSellerStatus, shouldHideAdsDbNav } from '@/shared/seller-approval'
import { SELLER_PRIMARY_NAV, activePrimaryKey, isCoveredByPrimary, type SellerPrimaryKey } from '@/components/seller/seller-primary-nav'
import type { CommandItem } from '@/components/dashboard/CommandPalette'

/** 사이드바 상단 파란 CTA 가 가리키는 곳. 메뉴가 아니라 '할 일'이라 모양이 다르다. */
export const SIDEBAR_CTA_PATH = '/seller/meal-voucher/new'

export type NavItem = (typeof NAV_GROUPS)[number]['items'][number]
export type NavGroup = { label?: string; labelKey?: string; items: NavItem[] }

export function useSellerNavModel() {
  const { t } = useTranslation()
  const location = useLocation()

  const sellerType = ((typeof window !== 'undefined' && localStorage.getItem('seller_type')) || 'influencer') as SellerType
  // 🏁 2026-06-14: 라이브 영구중단 후엔 seller_type(크리에이터/매장)으로만 분기한다. live 항목은 항상 숨김.
  //   user 세션 의존 항목(/host·/u/me/earnings)은 user_id 가 있을 때만 — 없으면 클릭 시 /login 으로 튕긴다.
  const hasUserSession = typeof window !== 'undefined' && !!localStorage.getItem('user_id')
  const sellerStatus = readSellerStatus()
  const filteredNavGroups: NavGroup[] = NAV_GROUPS
    .filter(group => !group.hideFor?.includes(sellerType))
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (item.hideFor?.includes(sellerType)) return false
        const itemMode = item.mode || 'common'
        if (LIVE_COMMERCE_SUSPENDED) {
          if (itemMode === 'live') return false
          if (itemMode === 'store' && !isStoreOwner(sellerType)) return false
        }
        if (item.path === '/host' && HOSTING_HIDDEN) return false
        // 🔒 2026-09-16 (대표 — *"유어애즈 인플루언서 DB는 … 승인까지는 보이지 않게"*).
        //   서버가 진짜 벽이다(`ads-db-access.ts`) — 여기는 **승인 전 사장님에게 열리지 않는 문을
        //   안 보여 주는 것**뿐이다. 값은 `SellerApprovalBanner` 가 매 대시보드 진입마다 써 준다.
        //   ⚠️ 값이 **없으면 보여 준다**(fail-open). 옛 로그인 세션에는 아직 이 키가 없고,
        //      없다고 숨기면 멀쩡한 매장의 메뉴가 사라진다 — 어차피 서버가 막는다.
        if (item.path === '/seller/influencers' && shouldHideAdsDbNav(sellerStatus)) return false
        if ((item.path === '/host' || item.path === '/u/me/earnings') && !hasUserSession) return false
        return true
      }),
    }))
    .filter(group => group.items.length > 0)

  // 🎟️ 2026-09-03: 이용권 그룹이 홈 바로 다음 — 등록과 관리가 붙어 있어야 찾는다(가드가 순서를 고정).
  const GROUP_ORDER = ['', 'seller.layout.vouchers', 'seller.layout.curator', 'seller.layout.products', 'seller.layout.ordersCustomers', 'seller.layout.revenue', 'seller.layout.settings']
  const orderRank = (g: { labelKey?: string }) => {
    const i = GROUP_ORDER.indexOf(g.labelKey ?? '')
    return i === -1 ? GROUP_ORDER.length : i
  }
  const orderedNavGroups = [...filteredNavGroups].sort((a, b) => orderRank(a) - orderRank(b))

  const commandItems: CommandItem[] = [
    ...orderedNavGroups.flatMap((g) => g.items.map((it) => ({
      path: it.path,
      label: t(it.labelKey, { defaultValue: it.labelKey }),
      icon: it.icon,
      group: g.labelKey ? t(g.labelKey, { defaultValue: '' }) : (g.label || ''),
    }))),
    // 🧭 2026-09-03 통폐합: 탭 안으로 접힌 형제 화면들 — 빼면 "못 찾는 페이지 16개"가 그대로 된다.
    ...SELLER_TAB_GROUPS.flatMap((g) => g.tabs.slice(1).map((tab) => ({
      path: tab.path,
      label: `${t(g.labelKey, { defaultValue: g.fallback })} · ${t(tab.labelKey, { defaultValue: tab.fallback })}`,
      icon: g.icon,
      group: t(g.labelKey, { defaultValue: g.fallback }),
    }))),
    ...SELLER_SEARCH_ONLY.map((it) => ({
      path: it.path,
      label: t(it.labelKey, { defaultValue: it.fallback }),
      icon: it.icon,
      group: it.group,
    })),
  ]

  // 역할별 노출 규칙 승계 — 그 역할에게 항목이 없으면 ctaItem 이 undefined 라 CTA 도 안 뜬다.
  const ctaItem = orderedNavGroups.flatMap((g) => g.items).find((i) => i.path === SIDEBAR_CTA_PATH)
  /**
   * 더보기 = 다섯 대분류가 덮지 않는 나머지 전부. CTA 도 뺀다(사이드바 상단 파란 버튼이 한 번 그린다).
   * `isCoveredByPrimary` 는 착지점·탭 형제만 덮는다 — 숙소처럼 이용권 탭이 *켜지지만* 그 탭 줄엔 없는
   * 화면은 여기 남는다(안 그러면 어디에서도 닿을 수 없다).
   */
  const renderedNavGroups = orderedNavGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.path !== SIDEBAR_CTA_PATH && !isCoveredByPrimary(i.path)) }))
    .filter((g) => g.items.length > 0)

  const activeKey: SellerPrimaryKey | null = activePrimaryKey(location.pathname)
  const primary = SELLER_PRIMARY_NAV.map((tab) => ({ ...tab, label: t(tab.labelKey, { defaultValue: tab.fallback }), active: activeKey === tab.key }))

  function isActive(path: string, exact?: boolean, also?: string[]) {
    if (also?.some((p) => location.pathname.startsWith(p))) return true
    return exact ? location.pathname === path : location.pathname.startsWith(path)
  }

  return { sellerType, primary, activeKey, moreGroups: renderedNavGroups, ctaItem, commandItems, isActive }
}
