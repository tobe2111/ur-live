/**
 * 🧭 **셀러 대시보드 다섯 대분류** (2026-09-14 대표 승인 — 모바일 우선 재설계 · "그대로 모두 진행").
 *   시안: `docs/design/seller-dashboard-mobile-first-2026-09.md` — `홈 · 주문 · 이용권 · 정산 · 더보기`.
 *
 * ## 왜 다섯인가
 *   사이드바 메뉴가 14개였고 모바일에서는 그 14개가 햄버거 뒤에 숨었다. 셀러가 하는 일은 넷뿐이다 —
 *   **주문을 받고, 이용권을 만들어 팔고, 돈을 받는다**(+ 그 셋이 모이는 홈). 나머지는 가끔 가는 곳이라
 *   `더보기` 한 자리로 접는다. 폰의 하단 탭과 PC 의 사이드바가 **같은 다섯을 같은 순서로** 쓴다.
 *
 * ## 이 파일이 정하는 것 / 안 정하는 것
 *   - 정한다: 다섯 탭의 이름·착지점·아이콘·**어느 경로에서 켜지는가**(`also`).
 *   - 안 정한다: 더보기 안의 목록. 그건 `seller-nav`(`NAV_GROUPS`, 검색 색인의 원본)에서 **파생**한다 —
 *     다섯 대분류가 이미 덮는 경로를 빼고 남은 전부(`useSellerNavModel`). 손으로 두 벌 적으면 반드시 갈린다.
 *
 * ⚠️ `also` 는 `seller-tab-groups`(탭 묶음 SSOT)에서 가져온다. 탭으로 이동한 순간 하단 탭이 꺼지면
 *   사용자가 자기 위치를 잃는다(2026-09-03 사이드바 `also` 와 같은 함정) — 그래서 파생시킨다.
 */
import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react'
import { HomeIcon, ReceiptIcon, TicketStubIcon, WonCoinIcon, MoreDotsIcon } from '@/components/icons/urdeal-icons'
import { tabGroupSiblings } from './seller-tab-groups'

export type SellerPrimaryKey = 'home' | 'orders' | 'vouchers' | 'settlements' | 'more'

type TabIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'size'> & { size?: number | string; filled?: boolean } & RefAttributes<SVGSVGElement>>

export interface SellerPrimaryTab {
  key: SellerPrimaryKey
  path: string
  labelKey: string
  fallback: string
  icon: TabIcon
  /** 정확히 이 경로에서만 켜진다(홈 — 하위 경로 전부가 홈이 되면 안 된다). */
  exact?: boolean
  /** 이 접두사들에서도 켜진다(탭 묶음 형제 + 등록·수정 화면). */
  also: string[]
}

export const SELLER_PRIMARY_NAV: SellerPrimaryTab[] = [
  { key: 'home', path: '/seller', labelKey: 'seller.tab.home', fallback: '홈', icon: HomeIcon, exact: true, also: [] },
  {
    key: 'orders', path: '/seller/orders', labelKey: 'seller.tab.orders', fallback: '주문', icon: ReceiptIcon,
    // 주문 묶음(환불·리뷰) + 예약 화면들 — "손님이 산 것"을 다루는 곳은 전부 주문이다.
    also: [...tabGroupSiblings('/seller/orders'), '/seller/appointments', '/seller/stays/bookings'],
  },
  {
    key: 'vouchers', path: '/seller/group-buy', labelKey: 'seller.tab.vouchers', fallback: '이용권', icon: TicketStubIcon,
    // 이용권 묶음(사용처리·후기 인증·대행 승인) + 등록 위저드 + 수정 화면 + 숙소(같은 '파는 것').
    also: [...tabGroupSiblings('/seller/group-buy'), '/seller/meal-voucher/new', '/seller/products/', '/seller/stays', '/seller/scan'],
  },
  {
    key: 'settlements', path: '/seller/settlements', labelKey: 'seller.tab.settlements', fallback: '정산', icon: WonCoinIcon,
    // 정산 묶음(매출 분석·promo 지출) + 원장·매장 현황·실시간 현황·교환권 발송 이력 — "돈이 어떻게 됐나".
    also: [...tabGroupSiblings('/seller/settlements'), '/seller/ledger', '/seller/store-dashboard', '/seller/realtime', '/seller/voucher-orders'],
  },
  { key: 'more', path: '/seller/more', labelKey: 'seller.tab.more', fallback: '더보기', icon: MoreDotsIcon, also: [] },
]

/** 경로 하나가 다섯 중 어느 탭에 속하는가. 넷 중 아무것도 아니면 `more`(셀러 대시보드 안이면). */
export function activePrimaryKey(pathname: string): SellerPrimaryKey | null {
  for (const tab of SELLER_PRIMARY_NAV) {
    if (tab.key === 'more') continue
    if (tab.exact ? pathname === tab.path : (pathname === tab.path || pathname.startsWith(tab.path + '/'))) return tab.key
    if (tab.also.some((p) => pathname === p || pathname.startsWith(p.endsWith('/') ? p : p + '/'))) return tab.key
  }
  if (pathname === '/seller' || pathname.startsWith('/seller/')) return 'more'
  return null
}

/**
 * 사이드바 항목 하나가 다섯 대분류의 **착지점이거나 그 탭 묶음의 형제**라 더보기에 다시 적지 않아야 하는가.
 * ⚠️ `also` 의 접두사 전부를 여기서 쓰면 안 된다 — `/seller/stays`(숙소)는 이용권 탭이 *켜지는* 경로이지만
 *   이용권 화면의 탭 줄에는 없어서, 더보기에서도 빼 버리면 **어디에서도 닿을 수 없게 된다**
 *   (이 레포가 반복해 겪은 "페이지는 있는데 닿을 수 없다"). 켜짐(active)과 덮임(covered)은 다른 질문이다.
 */
export function isCoveredByPrimary(path: string): boolean {
  for (const tab of SELLER_PRIMARY_NAV) {
    if (tab.key === 'more') continue
    if (path === tab.path) return true // 홈(`/seller`)도 — 더보기에 '대시보드' 줄이 또 뜨면 안 된다(폰 실측)
    if (tab.key === 'home') continue
    if (tabGroupSiblings(tab.path).includes(path)) return true
  }
  return false
}
