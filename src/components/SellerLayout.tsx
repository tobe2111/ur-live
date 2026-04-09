import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, ShoppingBag, Package, Truck, Play, DollarSign,
  Bell, Building2, Settings, LogOut, Menu, X, Heart, MessageCircle, BarChart3, Radio, TrendingUp, Globe, Activity, Ticket
} from 'lucide-react'
import { logoutSeller } from '@/lib/seller-auth'
import DashboardNotificationBell from './DashboardNotificationBell'

const NAV_GROUPS = [
  {
    label: '', // 홈 (그룹 라벨 없음)
    items: [
      { path: '/seller', labelKey: 'seller.dashboard', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: '방송',
    items: [
      { path: '/seller/live-broadcast', labelKey: 'seller.live', icon: Radio, highlight: true },
      { path: '/seller/shorts', labelKey: 'seller.shorts', icon: Play },
      { path: '/seller/live-analytics', labelKey: 'seller.liveAnalytics', icon: Activity },
    ],
  },
  {
    label: '판매',
    items: [
      { path: '/seller/products', labelKey: 'seller.products', icon: Package },
      { path: '/seller/group-buy', labelKey: 'seller.groupBuy', icon: Ticket },
      { path: '/seller/orders', labelKey: 'seller.orders', icon: ShoppingBag },
      { path: '/seller/inventory', labelKey: 'seller.inventory', icon: BarChart3 },
    ],
  },
  {
    label: '수익',
    items: [
      { path: '/seller/settlements', labelKey: 'seller.revenue', icon: DollarSign },
      { path: '/seller/donations', labelKey: 'seller.donations', icon: Heart },
    ],
  },
  {
    label: '설정',
    items: [
      { path: '/seller/business-info', labelKey: 'seller.businessInfo', icon: Building2 },
      { path: '/seller/alimtalk', labelKey: 'seller.brandMessage', icon: Bell },
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

  const sellerName = localStorage.getItem('seller_name') || 'Seller'

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
    localStorage.setItem('i18nextLng', code)
    setLangOpen(false)
  }

  function isActive(path: string, exact?: boolean) {
    return exact ? location.pathname === path : location.pathname.startsWith(path)
  }

  const Sidebar = () => (
    <aside className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Workspace */}
      <div className="px-4 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
            {sellerName.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">{t('seller.workspace')}</p>
            <p className="text-sm font-semibold text-gray-800 truncate">{sellerName}</p>
          </div>
        </div>
      </div>

      {/* Nav - Grouped */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
            {group.label && (
              <p className="px-3 mb-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{group.label}</p>
            )}
            <div className="space-y-0.5">
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
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : highlight && !active
                        ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${highlight && !active ? 'text-red-500' : ''}`} />
                    {label}
                    {highlight && !active && <span className="ml-auto h-2 w-2 bg-red-500 rounded-full animate-pulse" />}
                    {labelKey === 'seller.orders' && pendingOrders > 0 && (
                      <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                        active ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {pendingOrders}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-0.5">
        <Link
          to={`/s/${localStorage.getItem('seller_id') || ''}`}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <Settings className="w-4 h-4" />
          {t('seller.settings')}
        </Link>
        <button
          onClick={() => logoutSeller(navigate)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
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
        <Sidebar />
      </div>

      <div className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
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

        <main className="flex-1 overflow-y-auto p-5 space-y-5">
          {children}
        </main>
      </div>

      {/* 카카오 채널 상담 플로팅 버튼 */}
      <a
        href="http://pf.kakao.com/_AITdn/chat"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 z-[35] flex items-center justify-center w-10 h-10 rounded-full bg-[#FEE500] hover:bg-[#FDD835] text-[#3C1E1E] shadow-md hover:shadow-lg transition-all duration-200 opacity-70 hover:opacity-100"
        title={t('seller.kakaoChat')}
      >
        <MessageCircle className="w-4 h-4" />
      </a>
    </div>
  )
}
