import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, ShoppingBag, Package, Play, DollarSign, Megaphone, Rocket,
  Bell, Building2, Settings, LogOut, Menu, X, Heart, MessageCircle, BarChart3, Radio, Globe, Activity, Ticket, Star, BarChart2, BookOpen, Wifi
} from 'lucide-react'
import { logoutSeller } from '@/lib/seller-auth'
import { toast } from '@/hooks/useToast'
import { useTokenAutoRefresh } from '@/hooks/useTokenAutoRefresh'
import UrDealLogo from '@/components/brand/UrDealLogo'
import DashboardNotificationBell from './DashboardNotificationBell'

type SellerType = 'influencer' | 'store_owner' | 'both'

const NAV_GROUPS: {
  label?: string
  labelKey?: string
  hideFor?: SellerType[]
  items: {
    path: string
    labelKey: string
    icon: any
    exact?: boolean
    highlight?: boolean
    hideFor?: SellerType[]
  }[]
}[] = [
  {
    label: '', // 홈 (그룹 라벨 없음)
    items: [
      { path: '/seller', labelKey: 'seller.dashboard', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    labelKey: 'seller.layout.broadcast',
    hideFor: ['store_owner'],
    items: [
      { path: '/seller/live-broadcast', labelKey: 'seller.live', icon: Radio, highlight: true },
      { path: '/seller/streaming-setup', labelKey: 'seller.streamingSetup', icon: Wifi },
      { path: '/seller/shorts', labelKey: 'seller.shorts', icon: Play },
      { path: '/seller/live-analytics', labelKey: 'seller.liveAnalytics', icon: Activity },
    ],
  },
  {
    labelKey: 'seller.layout.sales',
    items: [
      { path: '/seller/products', labelKey: 'seller.nav.products', icon: Package },
      { path: '/seller/bundles', labelKey: 'seller.nav.bundles', icon: Package },
      { path: '/seller/group-buy', labelKey: 'seller.nav.mealVoucher', icon: Ticket },
      { path: '/seller/orders', labelKey: 'seller.orders', icon: ShoppingBag },
      { path: '/seller/inventory', labelKey: 'seller.inventory', icon: BarChart3 },
      { path: '/seller/reviews', labelKey: 'seller.nav.reviews', icon: Star },
      { path: '/seller/coupons', labelKey: 'seller.nav.coupons', icon: Ticket },
    ],
  },
  {
    labelKey: 'seller.layout.revenue',
    items: [
      { path: '/seller/analytics', labelKey: 'seller.analytics', icon: BarChart2 },
      { path: '/seller/settlements', labelKey: 'seller.revenue', icon: DollarSign },
      { path: '/seller/donations', labelKey: 'seller.donations', icon: Heart, hideFor: ['store_owner'] },
      { path: '/seller/castings', labelKey: 'seller.nav.castings', icon: Megaphone },
      { path: '/seller/promote-boosts', labelKey: 'seller.nav.promoteBoosts', icon: Rocket },
    ],
  },
  {
    labelKey: 'seller.layout.settings',
    items: [
      { path: '/seller/business-info', labelKey: 'seller.businessInfo', icon: Building2 },
      { path: '/seller/alimtalk', labelKey: 'seller.brandMessage', icon: Bell },
      { path: '/seller/guide', labelKey: 'seller.nav.guide', icon: BookOpen },
    ],
  },
]

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

  const sellerName = localStorage.getItem('seller_name') || 'Seller'
  const sellerType = (localStorage.getItem('seller_type') || 'influencer') as SellerType

  const filteredNavGroups = NAV_GROUPS
    .filter(group => !group.hideFor?.includes(sellerType))
    .map(group => ({
      ...group,
      items: group.items.filter(item => !item.hideFor?.includes(sellerType)),
    }))
    .filter(group => group.items.length > 0)

  const languages = [
    { code: 'ko', label: '한국어', flag: '🇰🇷' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
  ]

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

  function isActive(path: string, exact?: boolean) {
    return exact ? location.pathname === path : location.pathname.startsWith(path)
  }

  const sellerTypeLabel = sellerType === 'influencer'
    ? 'Influencer'
    : sellerType === 'store_owner'
    ? 'Store Owner'
    : 'Influencer + Store'

  // 🛡️ 사이드바를 함수 컴포넌트가 아닌 JSX 변수로 정의 — 부모 re-render 시 함수 참조가
  // 매번 새로 만들어져 React 가 unmount/remount → <nav> 의 scroll 위치가 reset 되던 버그.
  const sidebar = (
    <aside className="w-[232px] flex-shrink-0 flex flex-col h-full" style={{ background: '#0A0A0B' }}>
      {/* Branding */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5">
          <UrDealLogo size={14} forceDark />
          <span
            className="font-bold uppercase"
            style={{ fontSize: '9px', letterSpacing: '0.08em', color: '#FF0033' }}
          >
            SELLER STUDIO
          </span>
        </div>
        {/* Seller profile */}
        <div className="flex items-center gap-2.5 mt-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #FF0033, #FF6B35)' }}
          >
            {sellerName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold text-white truncate">{sellerName}</p>
            <p className="text-white/50" style={{ fontSize: '9px' }}>{sellerTypeLabel}</p>
          </div>
        </div>
      </div>

      {/* Grouped navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide pb-2">
        {filteredNavGroups.map((group, gi) => (
          <div key={gi} className="mt-3 first:mt-1">
            {(group.label || group.labelKey) && (
              <div
                className="px-4 py-1.5 font-extrabold uppercase text-white/30"
                style={{ fontSize: '9px', letterSpacing: '0.12em' }}
              >
                {group.labelKey ? t(group.labelKey) : group.label}
              </div>
            )}
            {group.items.map(({ path, labelKey, icon: Icon, ...rest }) => {
              const exact = (rest as any).exact as boolean | undefined
              const highlight = (rest as any).highlight as boolean | undefined
              const active = isActive(path, exact)
              const label = t(labelKey)
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2.5 px-4 py-[7px] text-[12px] font-semibold transition-colors ${
                    highlight && !active ? 'bg-red-500/20 border-l-2 border-red-500' : ''
                  }`}
                  style={
                    active
                      ? {
                          color: '#FFFFFF',
                          borderLeft: '2.5px solid #FF0033',
                          background: 'linear-gradient(to right, rgba(255,0,51,0.15), transparent)',
                        }
                      : highlight && !active
                      ? {}
                      : {
                          color: 'rgba(255,255,255,0.55)',
                          borderLeft: '2.5px solid transparent',
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.color = '#FFFFFF'
                  }}
                  onMouseLeave={(e) => {
                    if (!active && !highlight) e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
                  }}
                >
                  <Icon size={14} strokeWidth={2} className={`flex-shrink-0 ${highlight && !active ? 'text-red-400' : ''}`} />
                  <span className={`flex-1 truncate ${highlight && !active ? 'text-red-400' : ''}`}>{label}</span>
                  {highlight && !active && <span className="ml-auto h-2 w-2 bg-red-500 rounded-full animate-pulse" />}
                  {labelKey === 'seller.orders' && pendingOrders > 0 && (
                    <span className="text-[9px] font-extrabold px-1.5 rounded-full bg-white/10 text-white">
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
      <div className="px-4 py-3 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Link
          to="/seller/profile"
          className="flex items-center gap-2.5 px-1 py-1.5 text-[11px] font-medium text-white/55 hover:text-white transition-colors"
        >
          <Settings size={13} strokeWidth={2} />
          {t('seller.settings')}
        </Link>
        <Link
          to={`/profile/${localStorage.getItem('seller_username') || localStorage.getItem('seller_id') || ''}`}
          className="flex items-center gap-2.5 px-1 py-1.5 text-[11px] font-medium text-white/55 hover:text-white transition-colors"
        >
          <Globe size={13} strokeWidth={2} />
          {t('seller.viewPublicProfile', { defaultValue: '공개 프로필 보기' })}
        </Link>
        {localStorage.getItem('user_id') && (
          <button
            onClick={() => {
              toast.success(t('seller.layout.backToUser'))
              navigate('/user/profile')
            }}
            className="w-full flex items-center gap-2.5 px-1 py-1.5 text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Globe size={13} strokeWidth={2} />
            {t('seller.layout.backToUser')}
          </button>
        )}
        <button
          onClick={() => logoutSeller(navigate)}
          className="w-full flex items-center gap-2.5 px-1 py-1.5 text-[11px] font-medium text-red-400 hover:text-red-300 transition-colors"
        >
          <LogOut size={13} strokeWidth={2} />
          {t('common.logout')}
        </button>
      </div>
    </aside>
  )

  return (
    <div className="seller-light-theme flex h-screen overflow-hidden bg-[#F4F5F7] text-gray-900">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="hidden lg:flex">
        {sidebar}
      </div>

      <div className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {sidebar}
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 h-14 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              aria-label={sidebarOpen ? t('common.closeSidebar', { defaultValue: '사이드바 닫기' }) : t('common.openSidebar', { defaultValue: '사이드바 열기' })}
              aria-expanded={sidebarOpen}
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="text-base font-semibold text-gray-900">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                <Globe className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">{currentLang.flag} {currentLang.label}</span>
                <span className="text-xs sm:hidden">{currentLang.flag}</span>
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
                        <span>{lang.flag}</span>
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

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 sm:space-y-5">
          {children}
        </main>
      </div>

      {/* 카카오 채널 상담 플로팅 버튼
          🛡️ 2026-04-30: 모바일에서 '라이브 시작' FAB 와 겹침 방지 — 모바일은 bottom-24 로 위로 stack */}
      <a
        href="http://pf.kakao.com/_AITdn/chat"
        target="_blank" rel="noopener noreferrer"
        className="fixed bottom-24 lg:bottom-4 right-4 z-[35] flex items-center justify-center w-10 h-10 rounded-full bg-[#FEE500] hover:bg-[#FDD835] text-[#3C1E1E] shadow-md hover:shadow-lg transition-all duration-200 opacity-70 hover:opacity-100"
        title={t('seller.kakaoChat')}
      >
        <MessageCircle className="w-4 h-4" />
      </a>

      {/* Mobile quick-action FAB
          🛡️ 2026-04-30: 이미 라이브 방송 페이지면 숨김 (현 페이지 navigate = no-op 인 것 처럼 보였던 사용자 신고) */}
      {!location.pathname.startsWith('/seller/live') && (
        <div className="lg:hidden fixed bottom-6 right-4 z-40">
          <button
            onClick={() => navigate('/seller/live-broadcast')}
            className="flex items-center gap-2 px-5 py-3 rounded-full text-white font-bold text-sm shadow-lg active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(90deg, #FF0033, #EC4899)', boxShadow: '0 8px 24px rgba(255,0,51,0.3)' }}
          >
            <Radio className="w-4 h-4" />
            라이브 시작
          </button>
        </div>
      )}
    </div>
  )
}
