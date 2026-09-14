import { useState, useCallback, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Globe, Home, LogOut, Menu, MessageCircle, Radio, Search, Settings, Store, X } from 'lucide-react'
import { logoutSeller } from '@/lib/seller-auth'
import api from '@/lib/api'
import { HOSTING_HIDDEN, LIVE_COMMERCE_SUSPENDED, SELLER_STORE_ONLY_MODE } from '@/shared/feature-flags'
import { getRoleShortLabel, isStoreOwner, isStoreOnly } from '@/shared/seller-roles'
import { useTokenAutoRefresh } from '@/hooks/useTokenAutoRefresh'
import UrDealLogo from '@/components/brand/UrDealLogo'
import BrandLoader from '@/components/brand/BrandLoader'
import { applyBizFavicon, restoreDefaultFavicon } from '@/lib/biz-favicon'
import DashboardNotificationBell from './DashboardNotificationBell'
import StoreSwitcher from '@/components/seller/StoreSwitcher'
import SellerKakaoLinkBanner from './SellerKakaoLinkBanner'
import SellerSimpleNav from './seller-layout/SellerSimpleNav'
import SellerGroupTabs from './seller/SellerGroupTabs'
import { SELLER_TAB_GROUPS } from '@/components/seller/seller-tab-groups'

import { NAV_GROUPS, SELLER_SEARCH_ONLY, modesForSellerType, type SellerType, type SellerMode } from '@/components/seller/seller-nav'
import CommandPalette, { type CommandItem } from '@/components/dashboard/CommandPalette'



interface SellerLayoutProps {
  title: string
  children: React.ReactNode
  headerRight?: React.ReactNode
  pendingOrders?: number
}

export default function SellerLayout({ title, children, headerRight, pendingOrders = 0 }: SellerLayoutProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)

  // 🛡️ 2026-04-30: 만료 5분 전 자동 refresh + 탭 복귀 시 검증
  useTokenAutoRefresh('seller')

  // 🏭 2026-06-30 [서비스 분리] 도매 전용(순수 판매사)만 도매몰로 — 겸업(소비자 셀러+판매사) lock-out 방지.
  //   배경: 기존엔 localStorage.is_distributor === '1' 만으로 무조건 /wholesale 로 튕겨, 소비자 셀러가
  //   도매 가입(/become-distributor)을 한 번이라도 하면 같은 셀러 행에 is_distributor=1 이 덧붙어
  //   셀러 대시보드에서 영구 차단됐다. is_distributor 는 '도매 접근권'(capability)일 뿐 '도매 전용'이 아님.
  //   → 서버 권위 판정(GET /api/seller/surface, SSOT computeWholesaleOnly)으로 '도매 전용'일 때만 redirect.
  //   기본은 대시보드 노출(절대 lock-out 금지): 판정 false/네트워크 실패 시 셀러 화면 유지. 도매 접근권 없는
  //   셀러는 조회 자체 skip.
  //
  //   ⚡ 이상화 3가지(SellerLayout 은 50개 셀러 페이지가 각자 렌더 → 페이지 이동마다 remount):
  //     ① 세션 캐시(`ur_seller_surface`) — 겸업(dual) 판정나면 이후 페이지 이동에서 /surface 재조회 skip(세션당 1회).
  //     ② 1회만 자동이동(`ur_seller_bounced`) — 한 번 도매몰로 보낸 뒤 사용자가 직접 /seller 로 되돌아오면 존중
  //        (분류기 오분류 — 예: 홍보전용 인플루언서, 상품 0 — 이어도 영구 트랩 불가).
  //     ③ `?as=seller`(도매몰의 '셀러 대시보드' 링크 등) 명시 진입은 강제이동 영구 면제.
  const [wholesaleOnly, setWholesaleOnly] = useState(false)
  // 🚑 2026-07-10 (로딩 전수조사 — 첫 진입 오표면 플래시 제거): 판정이 필요한 조건(아래 effect 와 동일)이면
  //   서버 판정(/api/seller/surface) 이 끝날 때까지 셀러 대시보드를 그리지 않고 라이트 로더 유지.
  //   기존엔 도매전용 계정 첫 진입 시 [셀러 대시보드 풀 렌더 → /wholesale 바운스] 플래시가 세션당 1회 났음.
  //   판정 불필요(비판매사/캐시/명시진입)면 false 로 시작 = 기존과 byte-동일. fail-open 유지(로더가 셀러 화면으로 풀림).
  const [surfacePending, setSurfacePending] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      if (localStorage.getItem('is_distributor') !== '1') return false
      const sp = new URLSearchParams(window.location.search)
      if (sp.get('as') === 'seller') return false
      if (sessionStorage.getItem('ur_force_seller') === '1') return false
      if (sessionStorage.getItem('ur_seller_bounced') === '1') return false
      if (sessionStorage.getItem('ur_seller_surface') === 'seller') return false
      return true
    } catch { return false }
  })
  useEffect(() => { applyBizFavicon(); return restoreDefaultFavicon }, []) // 🎨 확정 로고: 셀러 탭=biz 파비콘(이탈 원복)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('is_distributor') !== '1') return // 도매 접근권 없으면 절대 도매 전용 아님
    try {
      const sp = new URLSearchParams(location.search)
      if (sp.get('as') === 'seller') sessionStorage.setItem('ur_force_seller', '1')
    } catch { /* noop */ }
    // 명시적 셀러 진입(?as=seller) 또는 이미 1회 자동이동된 뒤 직접 되돌아옴 → 절대 트랩 안 함.
    if (sessionStorage.getItem('ur_force_seller') === '1') return
    if (sessionStorage.getItem('ur_seller_bounced') === '1') return
    // 세션 캐시: 겸업(dual)으로 판정났으면 페이지 이동마다 재조회 안 함.
    if (sessionStorage.getItem('ur_seller_surface') === 'seller') return
    const bounce = () => {
      sessionStorage.setItem('ur_seller_surface', 'wholesale')
      sessionStorage.setItem('ur_seller_bounced', '1') // 1회만 자동이동 — 되돌아오면 존중
      setWholesaleOnly(true)
      navigate('/wholesale', { replace: true })
    }
    if (sessionStorage.getItem('ur_seller_surface') === 'wholesale') { bounce(); return }
    let alive = true
    api.get('/api/seller/surface')
      .then((r) => {
        if (!alive) return
        if ((r?.data as { wholesale_only?: boolean })?.wholesale_only) bounce()
        else {
          sessionStorage.setItem('ur_seller_surface', 'seller') // 겸업 — 이후 재조회 skip
          setSurfacePending(false) // 🚑 2026-07-10: 판정 완료 — 셀러 대시보드 렌더
        }
      })
      .catch(() => { if (alive) setSurfacePending(false) /* fail-open: 대시보드 유지(lock-out 금지) */ })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  const sellerName = localStorage.getItem('seller_name') || 'Seller'
  const sellerType = (localStorage.getItem('seller_type') || 'influencer') as SellerType

  // 🛡️ 2026-05-17: Mode 토글 — 'both' 셀러는 라이브/매장 모드 전환.
  //   localStorage 에 저장하여 페이지 이동 후에도 유지.
  const availableModes = modesForSellerType(sellerType)
  const [activeMode, setActiveMode] = useState<SellerMode>(() => {
    if (availableModes.length === 1) return availableModes[0]
    const saved = (localStorage.getItem('seller_dashboard_mode') || 'live') as SellerMode
    return availableModes.includes(saved) ? saved : availableModes[0]
  })

  // 🏭 라이브 중단 시: 다른 컴포넌트(SellerPage 의 useSellerMode 등)도 store 로 인식하도록 동기화.
  useEffect(() => {
    if (LIVE_COMMERCE_SUSPENDED && localStorage.getItem('seller_dashboard_mode') !== 'store') {
      localStorage.setItem('seller_dashboard_mode', 'store')
      try { window.dispatchEvent(new CustomEvent('seller-mode-changed', { detail: 'store' })) } catch { /* noop */ }
    }
  }, [])
  function switchMode(m: SellerMode) {
    setActiveMode(m)
    localStorage.setItem('seller_dashboard_mode', m)
    // 🛡️ 2026-05-18: 같은 탭의 다른 컴포넌트 (SellerPage 등) 가 mode 변경에 반응하도록 이벤트 발행.
    //   storage event 는 다른 탭에만 발행되므로 같은 탭 동기화는 CustomEvent 필요.
    try { window.dispatchEvent(new CustomEvent('seller-mode-changed', { detail: m })) } catch { /* noop */ }
  }

  // 🏁 2026-06-14 (사용자 승인 — 공구 중심 재편): 라이브 영구중단 후엔 live/store 모드 토글이 아니라
  //   seller_type(크리에이터/매장)으로만 분기한다. 크리에이터는 매장 POS 도구(스캔/이용권 발행)를,
  //   매장은 큐레이터 그룹(hideFor)을 안 본다. live 항목은 항상 숨김.
  //   또한 user 세션 의존 항목(공구 호스팅/소개 수익 = /host·/u/me/earnings)은 user_id 가 있을 때만
  //   노출 — 없으면 클릭 시 /login 으로 튕기던 바운스 버그 차단(카카오 셀러는 정상, 이메일 셀러는 숨김).
  const hasUserSession = typeof window !== 'undefined' && !!localStorage.getItem('user_id')
  const filteredNavGroups = NAV_GROUPS
    .filter(group => !group.hideFor?.includes(sellerType))
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (item.hideFor?.includes(sellerType)) return false
        const itemMode = item.mode || 'common'
        if (LIVE_COMMERCE_SUSPENDED) {
          if (itemMode === 'live') return false
          if (itemMode === 'store' && !isStoreOwner(sellerType)) return false
        } else if (itemMode !== 'common' && itemMode !== activeMode) {
          return false
        }
        // 🏁 2026-06-17 (HOSTING_HIDDEN): 공구 호스팅 카탈로그 진입 숨김
        if (item.path === '/host' && HOSTING_HIDDEN) return false
        // 크리에이터 user-세션 의존 항목 — user_id 없으면 숨김(바운스 방지)
        if ((item.path === '/host' || item.path === '/u/me/earnings') && !hasUserSession) return false
        return true
      }),
    }))
    .filter(group => group.items.length > 0)

  // 🏁 2026-06-14: 공구 중심 정렬 — 각 역할의 핵심(크리에이터=큐레이터/호스팅, 매장=공구/숙소)을 홈 바로 다음으로.
  //   두 그룹은 역할 배타적(curator hideFor 매장, groupbuy 는 매장 위주)이라 각 역할이 자기 핵심을 상단에서 봄.
  // 🎟️ 2026-09-03: 이용권 그룹을 홈 바로 다음으로 — '이용권 등록'(홈 그룹 끝)과 '이용권 관리'가
  //   붙어 있어야 한다. 대표가 관리 페이지를 못 찾은 이유의 절반이 이 거리였다.
  const GROUP_ORDER = ['', 'seller.layout.vouchers', 'seller.layout.curator', 'seller.layout.products', 'seller.layout.ordersCustomers', 'seller.layout.revenue', 'seller.layout.settings']
  const orderRank = (g: { labelKey?: string }) => {
    const i = GROUP_ORDER.indexOf(g.labelKey ?? '')
    return i === -1 ? GROUP_ORDER.length : i
  }
  const orderedNavGroups = [...filteredNavGroups].sort((a, b) => orderRank(a) - orderRank(b))

  /**
   * 🔎 **페이지 검색** (2026-09-03 대표 *"셀러대시보드도 어드민 대시보드처럼 페이지 검색이 필요해"*).
   * 사이드바에 보이는 항목 + `SELLER_SEARCH_ONLY`(메뉴엔 없지만 실제로 쓰는 화면)를 함께 담는다 —
   * 검색이 사이드바의 복사본이면 **못 찾던 페이지는 여전히 못 찾는다.**
   */
  const commandItems: CommandItem[] = [
    ...orderedNavGroups.flatMap((g) => g.items.map((it) => ({
      path: it.path,
      label: t(it.labelKey, { defaultValue: it.labelKey }),
      icon: it.icon,
      group: g.labelKey ? t(g.labelKey, { defaultValue: '' }) : (g.label || ''),
    }))),
    // 🧭 2026-09-03 통폐합: 사이드바에서 **탭 안으로 접힌 형제 화면들**(환불·리뷰·매출 분석·위임·
    //   운영자·후기 인증 …). 이걸 빼면 위 주석이 경고한 바로 그 일이 벌어진다 — 사이드바에서
    //   사라진 화면이 검색에서도 사라져, 통폐합이 그대로 "못 찾는 페이지 16개"가 된다.
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
  /**
   * 🎟️ 2026-09-14 (Rinda 시안): '이용권 등록'을 사이드바 **상단 파란 CTA** 로 한 번만 그린다.
   *   대표 2026-08-23 요구("왼쪽 카테고리에도 이용권 등록 버튼")를 그대로 이어받되, 같은 문구의
   *   검은 버튼이 한 화면에 셋이던 것(메뉴 + 메인 타일 + 매장 카드)을 줄인다.
   *
   *   ⚠️ **`orderedNavGroups` 에서는 빼지 않는다** — 그건 ⌘K 검색 색인의 원본이라, 빼면
   *      "이용권 등록"이 검색에서 사라진다(이 레포가 반복해 겪은 "페이지는 있는데 닿을 수 없다").
   *      화면에 그리는 목록만 따로 만든다. 역할별 노출 규칙도 자동 승계 —
   *      그 역할에게 항목이 없으면 `ctaItem` 이 undefined 라 CTA 도 안 뜬다.
   */
  const SIDEBAR_CTA_PATH = '/seller/meal-voucher/new'
  const ctaItem = orderedNavGroups.flatMap((g) => g.items).find((i) => i.path === SIDEBAR_CTA_PATH)
  const renderedNavGroups = orderedNavGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.path !== SIDEBAR_CTA_PATH) }))
    .filter((g) => g.items.length > 0)

  const [paletteOpen, setPaletteOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((o) => !o) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const simpleMode = isStoreOnly(sellerType) // 🧭 심플 모드(SellerSimpleNav): 매장 단독 기본 3메뉴 + 전체 메뉴 접힘
  const [fullMenuOpen, setFullMenuOpen] = useState(() => { try { return localStorage.getItem('ur_seller_full_menu') === '1' } catch { return false } })
  const toggleFullMenu = () => setFullMenuOpen(v => { try { localStorage.setItem('ur_seller_full_menu', v ? '0' : '1') } catch { /* noop */ } return !v })

  /**
   * 🏳️ 2026-08-31: 국기 이모지 제거. 두 가지 이유 —
   *   ① **국기는 언어가 아니다.** 🇺🇸 로 영어를, 🇨🇳 로 중국어를 가리키면 그 언어를 쓰는
   *      다른 나라 사용자를 지운다(영어권은 미국만이 아니다).
   *   ② 이모지는 기기마다 다른 그림으로 렌더돼 **우리가 그 화면을 통제하지 못한다.**
   *      대시보드에서 유일하게 컬러였던 것도 이 국기였다.
   *   ⇒ 각 언어를 **그 언어 자신의 이름**으로 적는다(국제 표준 관행).
   */
  const languages = [{ code: 'ko', label: '한국어', short: 'KO' }, { code: 'en', label: 'English', short: 'EN' }, { code: 'ja', label: '日本語', short: 'JA' }, { code: 'zh', label: '中文', short: 'ZH' }, { code: 'es', label: 'Español', short: 'ES' }, { code: 'fr', label: 'Français', short: 'FR' }]

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0]

  function changeLang(code: string) {
    i18n.changeLanguage(code)
    // v25 FIX: html lang 속성도 동기화 — 스크린리더가 올바른 TTS 음성 선택
    if (typeof document !== 'undefined') {
      document.documentElement.lang = code
    }
    localStorage.setItem('i18nextLng', code)
    setLangOpen(false)
  }

  function isActive(path: string, exact?: boolean, also?: string[]) {
    if (also?.some((p) => location.pathname.startsWith(p))) return true
    return exact ? location.pathname === path : location.pathname.startsWith(path)
  }

  // 🛡️ 2026-06-04 (사용자 신고 — 영구 수정): 각 셀러 페이지가 자기 SellerLayout 을 렌더 →
  //   페이지 이동마다 사이드바 <nav> 가 unmount/remount → 스크롤이 top 으로 리셋되어
  //   하단 카테고리 클릭 시 시야가 위로 점프. 이전 fix(JSX 변수화)는 같은-페이지 re-render 만 막음.
  //   해법: <nav> 스크롤 위치를 sessionStorage 에 보존 → remount 시 동기 복원.
  //   sidebar JSX 가 데스크톱+모바일 2번 렌더되므로 ref 콜백으로 각 인스턴스 개별 처리
  //   (단일 ref 객체는 마지막=숨겨진 모바일만 잡힘). display:none 인 쪽은 scrollTop 무시되어 안전.
  const navScrollRef = useCallback((el: HTMLElement | null) => {
    if (!el) return
    const saved = sessionStorage.getItem('seller_nav_scroll')
    if (saved) el.scrollTop = parseInt(saved, 10) || 0
    el.addEventListener('scroll', () => {
      try { sessionStorage.setItem('seller_nav_scroll', String(el.scrollTop)) } catch { /* quota */ }
    }, { passive: true })
  }, [])

  // 🛡️ 2026-05-21 Phase D-5: getRoleShortLabel helper 사용 (직접 비교 금지).
  const sellerTypeLabel = getRoleShortLabel(sellerType)

  // 🛡️ 사이드바를 함수 컴포넌트가 아닌 JSX 변수로 정의 — 부모 re-render 시 함수 참조가
  // 매번 새로 만들어져 React 가 unmount/remount → <nav> 의 scroll 위치가 reset 되던 버그.
  const sidebar = (
    // 🧭 2026-09-14 (대표 Rinda 시안 — docs/design/dashboard-rinda-2026-09.md):
    //   어두운 면(#0A0A0B) → **흰 면 + 헤어라인**. 대표 지적 "UI가 불편해 · 셀러들 모두 헷갈릴거야"의
    //   절반이 여기였다 — 검은 사이드바는 도구를 '관리자용'으로 읽히게 하고, 그 위의 9px 회색 라벨은
    //   사실상 읽히지 않았다. 폭도 232 → 260 으로: 글자를 12 → 13px 로 올려야 했기 때문이다.
    <aside className="w-[260px] flex-shrink-0 flex flex-col h-full bg-white border-r border-rule">
      {/* Branding */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <UrDealLogo size={15} />
          <span className="font-bold uppercase text-[9px] tracking-[0.08em] text-gray-400">
            SELLER STUDIO
          </span>
        </div>
      </div>

      {/* 🏪 워크스페이스 카드 — Rinda 의 `워크스페이스 / 유어팀` 자리. 종전엔 아바타 + 9px 역할 라벨이라
          "내가 무슨 자격으로 로그인해 있나"가 안 읽혔다. 테두리 박스로 올려 준다. */}
      <div className="px-4 pb-3">
        <div className="rounded-xl border border-rule px-3 py-2.5">
          <p className="text-[10px] font-semibold text-gray-400">{t('seller.layout.workspace', { defaultValue: '내 계정' })}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-gray-900">{sellerName}</p>
            <span className="shrink-0 rounded-md bg-brand-tint px-1.5 py-0.5 text-[10px] font-bold text-brand-text">
              {sellerTypeLabel}
            </span>
          </div>
        </div>
      </div>

      {/* 🛡️ 2026-05-17: Mode 토글 — 'both' 셀러만 표시 (라이브 ↔ 매장 모드 전환).
            mode 별로 nav 항목이 동적 필터링되어 인지 부담 감소. */}
      {availableModes.length > 1 && (
        <div className="px-4 py-2 border-y border-rule bg-gray-50">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-full">
            <button
              type="button"
              onClick={() => switchMode('live')}
              className={`flex-1 py-1.5 px-2 rounded-full text-[10px] font-bold transition-colors ${
                activeMode === 'live'
                  ? 'bg-red-500 text-white shadow'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              aria-pressed={activeMode === 'live'}
            >
              <Radio className="w-3 h-3 inline-block align-[-1px] mr-1" aria-hidden="true" />라이브 모드
            </button>
            <button
              type="button"
              onClick={() => switchMode('store')}
              className={`flex-1 py-1.5 px-2 rounded-full text-[10px] font-bold transition-colors ${
                activeMode === 'store'
                  ? 'bg-amber-500 text-white shadow'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              aria-pressed={activeMode === 'store'}
            >
              <Store className="w-3 h-3 inline-block align-[-1px] mr-1" aria-hidden="true" />매장 모드
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 px-1">
            {activeMode === 'live'
              ? '라이브 송출 + 일반 상품 메뉴만 표시'
              : '매장 운영 + 이용권 발행 메뉴만 표시'}
          </p>
        </div>
      )}

      {/* 🔎 페이지 검색 — 메뉴에 없는 화면까지 이름으로 바로 간다(⌘K / Ctrl+K). */}
      <button
        type="button"
        onClick={() => { setPaletteOpen(true); setSidebarOpen(false) }}
        className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-left transition-colors hover:bg-gray-100"
      >
        <Search size={13} className="flex-shrink-0 text-gray-400" />
        <span className="flex-1 text-[12px] text-gray-400">{t('seller.pageSearch', { defaultValue: '페이지 검색' })}</span>
        <kbd className="rounded bg-white px-1 py-0.5 text-[9px] font-bold text-gray-400 border border-rule">⌘K</kbd>
      </button>

      {/* 🎟️ 주 행동 — Rinda 사이드바의 파란 CTA 자리. 메뉴가 아니라 '할 일'이라 모양이 다르다. */}
      {ctaItem && (
        <Link
          to={ctaItem.path}
          onClick={() => setSidebarOpen(false)}
          className="mx-4 mb-3 flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-brand-dark"
        >
          <ctaItem.icon size={16} strokeWidth={2.4} />
          {t(ctaItem.labelKey)}
        </Link>
      )}

      {/* Grouped navigation — 🧭 심플 모드(매장 단독): 홈+3메뉴 상단 고정, 나머지는 "전체 메뉴" 접힘 */}
      <nav ref={navScrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-hide pb-2">
        {simpleMode && (
          <SellerSimpleNav isActive={isActive} onNavigate={() => setSidebarOpen(false)} fullMenuOpen={fullMenuOpen} onToggleFullMenu={toggleFullMenu} />
        )}
        {/* 🧭 2026-09-14 (Rinda 시안 §4-3): **그룹 라벨 제거 → 헤어라인 구분선.**
            종전엔 9px 라벨 4개(이용권/설정/판매/성장)에 항목이 1~3개씩 붙어 있었다 —
            분류가 주는 도움보다 읽히지도 않는 글자 네 줄의 부담이 컸다. Rinda 는 라벨이 0개다.
            묶음 정보는 **간격과 선**으로 남긴다(의미를 버리는 게 아니라 글자를 버린다). */}
        {(!simpleMode || fullMenuOpen) && renderedNavGroups.map((group, gi) => (
          <div key={gi} className={gi === 0 ? 'px-2' : 'mt-2 border-t border-rule px-2 pt-2'}>
            {group.items.map(({ path, labelKey, icon: Icon, ...rest }) => {
              const exact = (rest as any).exact as boolean | undefined
              const highlight = (rest as any).highlight as boolean | undefined
              const active = isActive(path, exact, (rest as any).also as string[] | undefined)
              const label = t(labelKey)
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setSidebarOpen(false)}
                  // 🛡️ 2026-05-20: inline style 제거 (CSP unsafe-inline) — 색상/border 전부 Tailwind 클래스.
                  // 🧭 2026-09-14 (Rinda 시안): 세로 막대 + 어두운 면 → **연파랑 알약**(.ur-seller-nav-active
                  //   = var(--brand-tint)). 글자 12 → 13px, 높이 7 → 9px — 대표 지적 "글자가 작다"의 자리.
                  className={`mx-0 flex items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-[13px] transition-colors ${
                    active
                      ? 'font-bold text-gray-900 ur-seller-nav-active'
                      : highlight
                      ? 'bg-red-50 font-semibold text-red-600'
                      : 'font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon size={16} strokeWidth={2} className={`flex-shrink-0 ${active ? 'text-brand-text' : highlight ? 'text-red-500' : 'text-gray-400'}`} />
                  <span className="flex-1 truncate">{label}</span>
                  {highlight && !active && <span className="ml-auto h-2 w-2 bg-red-500 rounded-full animate-pulse" />}
                  {labelKey === 'seller.orders' && pendingOrders > 0 && (
                    <span className="rounded-full bg-brand px-1.5 text-[10px] font-extrabold text-white">
                      {pendingOrders}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      {/* 🛡️ 2026-04-22 배치 126: '설정' → 셀러 프로필 편집 페이지 (이전엔 공개 프로필로 가던 UX 버그)
                                  '유저로 돌아가기' → 유저 마이페이지 (이전엔 메인 홈 — 모호한 UX) */}
      <div className="border-t border-rule px-2 py-2">
        {/* 🛡️ 2026-05-20: 사이드바 하단 버튼은 `preserveScroll: true` 로 스크롤 리셋 skip.
              사용자 요구: 하단 버튼 누르면 페이지 위로 점프하지 말고 자연스럽게 이동.
              빈 slug → /profile/ 무한 redirect 방지: 셀러 식별자 없으면 link 자체 비활성. */}
        <Link
          to="/seller/profile?tab=business"
          state={{ preserveScroll: true }}
          onClick={() => setSidebarOpen(false)}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <Settings size={14} strokeWidth={2} className="text-gray-400" />
          {t('seller.settings')}
        </Link>
        {(() => {
          // 🔗 2026-07-02 (대표 신고 — 공개 프로필 보기 워터폴): 유어샵은 /u/{handle} 로 통일됨.
          //   기존엔 /profile/{seller_username}(SellerPublicPage) 로 가서 /u/{handle}(CuratorPage) 로
          //   재라우팅 → "다른 페이지 뜬 뒤 유어샵" 워터폴. 소비자 핸들 있으면 /u/{handle} 직행.
          //   (useLinkshopPath / BottomNav 우선순위와 동일 — 셀러-only 만 /profile 폴백.)
          const handle = localStorage.getItem('user_handle')
          const goodHandle = !!handle && handle.length >= 3 && !['user', 'me', 'admin', 'seller', 'api', 'host', 'new'].includes(handle.toLowerCase())
          const sellerSlug = localStorage.getItem('seller_username') || localStorage.getItem('seller_id')
          const target = goodHandle ? `/u/${handle}` : (sellerSlug ? `/profile/${sellerSlug}` : null)
          if (!target) return null
          return (
            <Link
              to={target}
              state={{ preserveScroll: true }}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <Globe size={14} strokeWidth={2} className="text-gray-400" />
              {t('seller.viewPublicProfile', { defaultValue: '공개 프로필 보기' })}
            </Link>
          )
        })()}
        {/* 🔗 2026-07-02 (대표 지시 — 셀러 모드 영구 유지): '유저로 돌아가기' 제거.
            승인된 셀러는 하나의 계정으로 셀러 능력이 상시 켜진 상태 유지(유저→사업자 유저=레이어 추가).
            소비자 화면으로의 출구는 위 '공개 프로필 보기'(→ /u/{handle} 유어샵)가 담당. */}
        <button
          onClick={() => logoutSeller(navigate)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <LogOut size={14} strokeWidth={2} className="text-gray-400" />
          {t('common.logout')}
        </button>
      </div>
    </aside>
  )

  // 🏭 도매 전용(순수 판매사) → /wholesale 리다이렉트 중에는 셀러 대시보드 렌더 X (깜빡임 방지).
  //   ⚠️ is_distributor 직접 비교 금지(겸업 lock-out) — 서버 권위 판정 결과(wholesaleOnly)로만 차단.
  if (wholesaleOnly) return null
  // 🚑 2026-07-10 (로딩 전수조사): 표면 판정 대기 중엔 라이트 로더 — 도매전용 계정 첫 진입 시
  //   [셀러 대시보드 풀 렌더 → /wholesale 바운스] 오표면 플래시 제거. 판정/실패 시 즉시 해제(fail-open).
  if (surfacePending) {
    return (
      <div className="seller-light-theme bg-warm">
        <BrandLoader fullScreen forceLight />
      </div>
    )
  }

  return (
    <div className="seller-light-theme flex h-[100dvh] overflow-hidden bg-warm text-gray-900">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 🛡️ 2026-05-14: 태블릿+ (md=768px) 부터 sidebar 표시 — iPad 사용 셀러 UX 향상 */}
      <div className="hidden md:flex">
        {sidebar}
      </div>

      <div className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {sidebar}
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-rule bg-white px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              aria-label={sidebarOpen ? t('common.closeSidebar', { defaultValue: '사이드바 닫기' }) : t('common.openSidebar', { defaultValue: '사이드바 열기' })}
              aria-expanded={sidebarOpen}
              className="md:hidden p-1.5 rounded-lg hover:bg-gray-100"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="text-[15px] font-bold text-gray-900">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* 🏪 2026-08-19 매장 전환 — 운영 매장이 2곳 이상일 때만 스스로 렌더한다(store-operator-model.md). */}
            <StoreSwitcher />
            {/* 🏠 2026-07-16 (대표 요청 — 셀러 대시보드에서 메인 서비스로 이동 버튼): 유어딜 소비자 홈(/)으로. */}
            <Link
              to="/"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600 text-xs font-semibold"
              aria-label={t('seller.goMainService', { defaultValue: '유어딜 메인 서비스로 이동' })}
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">{t('seller.mainService', { defaultValue: '유어딜 홈' })}</span>
            </Link>
            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                <Globe className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">{currentLang.label}</span>
                <span className="text-xs font-semibold sm:hidden">{currentLang.short}</span>
              </button>
              {langOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
                  <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
                    {languages.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => changeLang(lang.code)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                          i18n.language === lang.code ? 'font-semibold text-blue-600 bg-blue-50' : 'text-gray-700'
                        }`}
                      >
                        <span className="text-[11px] font-semibold text-gray-400 w-5 shrink-0">{lang.short}</span>
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <DashboardNotificationBell tokenKey="seller_token" />
            {headerRight}
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-3 sm:space-y-5">
          {/* 🔗 카카오 미연동 이메일 셀러 → 연동 권유 (dismissible, 1회 status 조회) */}
          <SellerKakaoLinkBanner />
          {/* 🧭 2026-09-03 (대표 승인 "전부"): 묶음 안의 탭 줄. **여기 한 곳에서** 그린다 —
              대상 24개 화면 중 6개가 `DashboardPageHeader` 를 안 써서, 헤더에 붙였으면 그 여섯에서
              탭이 사라진다. 그중 `/seller/stores` 는 묶음의 착지점이라 위임·운영자로 갈 길이
              통째로 없어졌을 것이다(오늘 고친 "페이지는 있는데 닿을 수 없다"의 재발). */}
          <SellerGroupTabs />
          {children}
        </main>
      </div>

      {/* 카카오 채널 상담 플로팅 버튼
          🛡️ 2026-04-30: 모바일에서 '라이브 시작' FAB 와 겹침 방지 — 모바일은 bottom-24 로 위로 stack */}
      <a
        href="http://pf.kakao.com/_AITdn/chat"
        target="_blank" rel="noopener noreferrer"
        className="fixed bottom-24 lg:bottom-4 right-4 z-[35] flex items-center justify-center w-10 h-10 rounded-full bg-brand hover:bg-[#1557C8] text-white shadow-md hover:shadow-lg transition-all duration-200 opacity-70 hover:opacity-100"
        title={t('seller.kakaoChat')}
      >
        <MessageCircle className="w-4 h-4" />
      </a>

      {/* 🏭 2026-06-04 (사용자 요청): 모바일 '라이브 시작' FAB 제거 — 셀러 대시보드 간소화. */}

      {/* 🔎 페이지 검색 — 사이드바 항목 + 메뉴에 없는 화면까지(어드민과 같은 컴포넌트). */}
      <CommandPalette items={commandItems} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
