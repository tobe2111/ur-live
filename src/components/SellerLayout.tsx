import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Globe, Home, LogOut, MessageCircle, Search, Settings } from 'lucide-react'
import { logoutSeller } from '@/lib/seller-auth'
import api from '@/lib/api'
import { getRoleShortLabel } from '@/shared/seller-roles'
import { useTokenAutoRefresh } from '@/hooks/useTokenAutoRefresh'
import UrDealLogo from '@/components/brand/UrDealLogo'
import BrandLoader from '@/components/brand/BrandLoader'
import { applyBizFavicon, restoreDefaultFavicon } from '@/lib/biz-favicon'
import DashboardNotificationBell from './DashboardNotificationBell'
import StoreSwitcher from '@/components/seller/StoreSwitcher'
import SellerKakaoLinkBanner from './SellerKakaoLinkBanner'
import SellerGroupTabs from './seller/SellerGroupTabs'
import SellerBottomTabs, { SELLER_TABBAR_H } from './seller-layout/SellerBottomTabs'
import { useSellerNavModel } from './seller-layout/useSellerNavModel'
import CommandPalette from '@/components/dashboard/CommandPalette'

interface SellerLayoutProps {
  title: string
  children: React.ReactNode
  headerRight?: React.ReactNode
  pendingOrders?: number
}

/** 사이드바 한 줄 — 다섯 대분류와 더보기 항목이 **같은 그림**이어야 한다(활성 = 연파랑 알약). */
const ROW = 'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] transition-colors'
const ROW_ON = 'font-bold text-gray-900 ur-seller-nav-active'
const ROW_OFF = 'font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900'

/**
 * 🧭 **셀러 대시보드 껍데기** (2026-09-14 대표 승인 — 모바일 우선 재설계 "그대로 모두 진행").
 *   시안: `docs/design/seller-dashboard-mobile-first-2026-09.md`.
 *
 *   - 폰: 상단바 + 본문 + **하단 탭 5개**(홈·주문·이용권·정산·더보기). 햄버거·서랍 메뉴는 없앴다 —
 *     14개 메뉴가 서랍 뒤에 숨는 구조가 "헷갈린다"의 절반이었고, 남은 메뉴는 `/seller/more` 가 받는다.
 *   - PC(md+): 흰 사이드바(Rinda 시안, `dashboard-rinda-2026-09.md`)가 **같은 다섯을 세로로** 그리고,
 *     헤어라인 아래에 더보기 항목을 펼친다. 폰과 PC 가 같은 순서·같은 부품.
 *   목록 계산은 전부 `useSellerNavModel`(SSOT) — 여기서는 그리기만 한다.
 */
export default function SellerLayout({ title, children, headerRight, pendingOrders = 0 }: SellerLayoutProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [langOpen, setLangOpen] = useState(false)

  // 🛡️ 2026-04-30: 만료 5분 전 자동 refresh + 탭 복귀 시 검증
  useTokenAutoRefresh('seller')

  // 🏭 2026-06-30 [서비스 분리] 도매 전용(순수 판매사)만 도매몰로 — 겸업(소비자 셀러+판매사) lock-out 방지.
  //   is_distributor 는 '도매 접근권'(capability)일 뿐 '도매 전용'이 아님 → 서버 권위 판정(GET /api/seller/surface,
  //   SSOT computeWholesaleOnly)으로 '도매 전용'일 때만 redirect. 기본은 대시보드 노출(절대 lock-out 금지).
  //   ① 세션 캐시(`ur_seller_surface`) ② 1회만 자동이동(`ur_seller_bounced`) ③ `?as=seller` 명시 진입은 영구 면제.
  const [wholesaleOnly, setWholesaleOnly] = useState(false)
  // 🚑 2026-07-10: 판정이 필요한 조건이면 판정이 끝날 때까지 라이트 로더 — 오표면 플래시 제거. fail-open.
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
    if (sessionStorage.getItem('ur_force_seller') === '1') return
    if (sessionStorage.getItem('ur_seller_bounced') === '1') return
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
          setSurfacePending(false)
        }
      })
      .catch(() => { if (alive) setSurfacePending(false) /* fail-open: 대시보드 유지(lock-out 금지) */ })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  const sellerName = localStorage.getItem('seller_name') || 'Seller'
  const { sellerType, primary, moreGroups, ctaItem, commandItems, isActive } = useSellerNavModel()

  // 🏭 라이브 중단 시: 다른 컴포넌트가 store 로 인식하도록 동기화(모드 토글 UI 는 2026-09-14 에 제거 — 라이브 영구 중단 뒤
  //   가능한 모드가 'store' 하나뿐이라 토글이 그려질 조건이 없었다).
  useEffect(() => {
    if (localStorage.getItem('seller_dashboard_mode') !== 'store') {
      localStorage.setItem('seller_dashboard_mode', 'store')
      try { window.dispatchEvent(new CustomEvent('seller-mode-changed', { detail: 'store' })) } catch { /* noop */ }
    }
  }, [])

  const [paletteOpen, setPaletteOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((o) => !o) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 🏳️ 2026-08-31: 국기 이모지 없이 각 언어를 그 언어 자신의 이름으로.
  const languages = [{ code: 'ko', label: '한국어', short: 'KO' }, { code: 'en', label: 'English', short: 'EN' }, { code: 'ja', label: '日本語', short: 'JA' }, { code: 'zh', label: '中文', short: 'ZH' }, { code: 'es', label: 'Español', short: 'ES' }, { code: 'fr', label: 'Français', short: 'FR' }]
  const currentLang = languages.find(l => l.code === i18n.language) || languages[0]
  function changeLang(code: string) {
    i18n.changeLanguage(code)
    if (typeof document !== 'undefined') document.documentElement.lang = code
    localStorage.setItem('i18nextLng', code)
    setLangOpen(false)
  }

  // 🛡️ 2026-05-21 Phase D-5: getRoleShortLabel helper 사용 (직접 비교 금지).
  const sellerTypeLabel = getRoleShortLabel(sellerType)

  // 🔗 2026-07-02: 유어샵은 /u/{handle} 로 통일 — 소비자 핸들 있으면 직행, 셀러-only 만 /profile 폴백.
  const handle = localStorage.getItem('user_handle')
  const goodHandle = !!handle && handle.length >= 3 && !['user', 'me', 'admin', 'seller', 'api', 'host', 'new'].includes(handle.toLowerCase())
  const sellerSlug = localStorage.getItem('seller_username') || localStorage.getItem('seller_id')
  const publicTarget = goodHandle ? `/u/${handle}` : (sellerSlug ? `/profile/${sellerSlug}` : null)

  // 🛡️ 사이드바를 JSX 변수로 — 함수 컴포넌트로 두면 부모 re-render 마다 remount 된다.
  const sidebar = (
    // 🧭 2026-09-14 (Rinda 시안): 어두운 면 → **흰 면 + 헤어라인**. 🧮 2026-09-15 D3: 224px · 글자 12.5px(밀도).
    <aside className="w-[224px] flex-shrink-0 flex flex-col h-full bg-white border-r border-rule">
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <UrDealLogo size={15} />
          <span className="font-bold uppercase text-[9px] tracking-[0.08em] text-gray-400">SELLER STUDIO</span>
        </div>
      </div>

      {/* 🏪 워크스페이스 카드 — "내가 무슨 자격으로 로그인해 있나". */}
      <div className="px-4 pb-3">
        <div className="rounded-lg border border-rule px-3 py-2">
          <p className="text-[10px] font-semibold text-gray-400">{t('seller.layout.workspace', { defaultValue: '내 계정' })}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-gray-900">{sellerName}</p>
            <span className="shrink-0 rounded-md bg-brand-tint px-1.5 py-0.5 text-[10px] font-bold text-brand-text">{sellerTypeLabel}</span>
          </div>
        </div>
      </div>

      {/* 🔎 페이지 검색 — 메뉴에 없는 화면까지 이름으로 바로 간다(⌘K / Ctrl+K). */}
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-left transition-colors hover:bg-gray-100"
      >
        <Search size={13} className="flex-shrink-0 text-gray-400" />
        <span className="flex-1 text-[12px] text-gray-400">{t('seller.pageSearch', { defaultValue: '페이지 검색' })}</span>
        <kbd className="rounded bg-white px-1 py-0.5 text-[9px] font-bold text-gray-400 border border-rule">⌘K</kbd>
      </button>

      {/* 🎟️ 주 행동 — '이용권 등록'은 여기 한 자리에서만 파란 버튼으로 그린다(메뉴·타일·매장 카드에 흩어졌던 것). */}
      {ctaItem && (
        <Link
          to={ctaItem.path}
          className="mx-4 mb-3 flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-brand-dark"
        >
          <ctaItem.icon size={16} strokeWidth={2.4} />
          {t(ctaItem.labelKey)}
        </Link>
      )}

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-hide pb-2">
        {/* ── 다섯 대분류 중 넷(더보기는 PC 에선 아래 목록 자체다) ── */}
        <div className="px-2">
          {primary.filter((p) => p.key !== 'more').map(({ key, path, label, icon: Icon, active }) => (
            <Link key={key} to={path} className={`${ROW} ${active ? ROW_ON : ROW_OFF}`}>
              <Icon size={17} filled={active} className={`flex-shrink-0 ${active ? 'text-brand-text' : 'text-gray-400'}`} />
              <span className="flex-1 truncate">{label}</span>
              {key === 'orders' && pendingOrders > 0 && (
                <span className="rounded-full bg-brand px-1.5 text-[10px] font-extrabold text-white">{pendingOrders}</span>
              )}
            </Link>
          ))}
        </div>
        {/* ── 더보기 — 다섯이 덮지 않는 나머지. 그룹 라벨 없이 헤어라인으로만 묶는다(Rinda 는 라벨이 0개다). ── */}
        {moreGroups.map((group, gi) => (
          <div key={gi} className="mt-2 border-t border-rule px-2 pt-2">
            {group.items.map(({ path, labelKey, icon: Icon, ...rest }) => {
              const active = isActive(path, (rest as { exact?: boolean }).exact, (rest as { also?: string[] }).also)
              return (
                <Link key={path} to={path} className={`${ROW} ${active ? ROW_ON : ROW_OFF}`}>
                  <Icon size={16} strokeWidth={2} className={`flex-shrink-0 ${active ? 'text-brand-text' : 'text-gray-400'}`} />
                  <span className="flex-1 truncate">{t(labelKey)}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-rule px-2 py-2">
        <Link to="/seller/profile?tab=business" state={{ preserveScroll: true }} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900">
          <Settings size={14} strokeWidth={2} className="text-gray-400" />
          {t('seller.settings')}
        </Link>
        {publicTarget && (
          <Link to={publicTarget} state={{ preserveScroll: true }} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900">
            <Globe size={14} strokeWidth={2} className="text-gray-400" />
            {t('seller.viewPublicProfile', { defaultValue: '공개 프로필 보기' })}
          </Link>
        )}
        <button onClick={() => logoutSeller(navigate)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900">
          <LogOut size={14} strokeWidth={2} className="text-gray-400" />
          {t('common.logout')}
        </button>
      </div>
    </aside>
  )

  // 🏭 도매 전용(순수 판매사) → /wholesale 리다이렉트 중에는 렌더 X. is_distributor 직접 비교 금지(겸업 lock-out).
  if (wholesaleOnly) return null
  if (surfacePending) {
    return (
      <div className="seller-light-theme bg-warm">
        <BrandLoader fullScreen forceLight />
      </div>
    )
  }

  return (
    <div className="seller-light-theme flex h-[100dvh] overflow-hidden bg-warm text-gray-900">
      {/* 🛡️ 2026-05-14: 태블릿+ (md=768px) 부터 사이드바 — 폰은 하단 탭이 같은 다섯을 맡는다. */}
      <div className="hidden md:flex">{sidebar}</div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 🏷️ 2026-09-15 A2 "매장이 제목" + 🧮 D3 (대표 확정). 폰: 헤더 제목 자리 = 매장(전환 겸용), 페이지 제목은 아래 한 줄.
            PC: 브레드크럼 `매장 / 제목` — 페이지 제목(h1)은 본문의 DashboardPageHeader 가 17px 로 그린다. */}
        <header className="flex h-14 md:h-12 flex-shrink-0 items-center justify-between border-b border-rule bg-white px-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <StoreSwitcher variant="title" />
          </div>
          <div className="hidden min-w-0 items-center gap-1.5 text-[13px] md:flex">
            <span className="truncate font-semibold text-gray-500">{sellerName}</span>
            <span className="text-gray-300">/</span>
            <h1 className="truncate text-[13px] font-bold text-gray-900">{title}</h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* 🏪 2026-08-19 매장 전환 — PC 는 우측 드롭다운(2곳 이상일 때만), 폰은 위 제목형이 맡는다. */}
            <div className="hidden md:block"><StoreSwitcher /></div>
            <button type="button" onClick={() => setPaletteOpen(true)} aria-label={t('seller.pageSearch', { defaultValue: '페이지 검색' })} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 md:hidden">
              <Search size={18} />
            </button>
            {/* 🏠 2026-07-16 (대표): 셀러 대시보드에서 유어딜 소비자 홈(/)으로. */}
            <Link
              to="/"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rule hover:bg-gray-50 transition-colors text-gray-600 text-xs font-semibold"
              aria-label={t('seller.goMainService', { defaultValue: '유어딜 메인 서비스로 이동' })}
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">{t('seller.mainService', { defaultValue: '유어딜 홈' })}</span>
            </Link>
            <div className="relative hidden md:block">
              <button onClick={() => setLangOpen(!langOpen)} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
                <Globe className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">{currentLang.label}</span>
                <span className="text-xs font-semibold sm:hidden">{currentLang.short}</span>
              </button>
              {langOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
                  <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-rule z-50 py-1">
                    {languages.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => changeLang(lang.code)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${i18n.language === lang.code ? 'font-semibold text-brand-text bg-brand-tint' : 'text-gray-700'}`}
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

        {/* 📱 폰: 하단 탭 높이만큼 본문 끝을 비운다(고정 탭이 마지막 줄을 가리지 않게). PC 는 탭이 없다. */}
        <main
          className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-3 sm:space-y-5 md:!pb-5"
          style={{ paddingBottom: `calc(${SELLER_TABBAR_H}px + env(safe-area-inset-bottom) + 12px)` }}
        >
          {/* 📱 A2: 폰의 페이지 제목 줄 — 헤더는 매장이 차지했으므로 제목은 여기 한 번만(공용 DashboardPageHeader 의 h1 은 폰에서 숨긴다). */}
          <div className="dash-phone-title flex items-center justify-between gap-2 px-1 md:hidden">
            <h2 className="truncate text-[17px] font-extrabold tracking-tight text-gray-900">{title}</h2>
          </div>
          {/* 🔗 카카오 미연동 이메일 셀러 → 연동 권유 (dismissible, 1회 status 조회) */}
          <SellerKakaoLinkBanner />
          {/* 🧭 2026-09-03: 묶음 안의 탭 줄 — 레이아웃 한 곳에서 그린다(페이지마다 붙이면 안 붙인 페이지가 생긴다). */}
          <SellerGroupTabs />
          {children}
        </main>
      </div>

      <SellerBottomTabs pendingOrders={pendingOrders} />

      {/* 카카오 채널 상담 — 폰에선 하단 탭 위로 올린다. */}
      <a
        href="http://pf.kakao.com/_AITdn/chat"
        target="_blank" rel="noopener noreferrer"
        className="fixed bottom-24 md:bottom-4 right-4 z-[35] flex items-center justify-center w-10 h-10 rounded-full bg-brand hover:bg-[#1557C8] text-white shadow-md hover:shadow-lg transition-all duration-200 opacity-70 hover:opacity-100"
        title={t('seller.kakaoChat')}
      >
        <MessageCircle className="w-4 h-4" />
      </a>

      {/* 🔎 페이지 검색 — 사이드바 항목 + 메뉴에 없는 화면까지(어드민과 같은 컴포넌트). */}
      <CommandPalette items={commandItems} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
