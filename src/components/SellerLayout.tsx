import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingBag, Package, Truck, Play, DollarSign,
  Bell, Building2, Settings, LogOut, Menu, X, Heart, MessageCircle, BarChart3, Radio, TrendingUp
} from 'lucide-react'
import { logoutSeller } from '@/lib/seller-auth'

const NAV_ITEMS = [
  { path: '/seller/live',          label: '라이브 방송',   icon: Radio, highlight: true },
  { path: '/seller',              label: '대시보드',     icon: LayoutDashboard, exact: true },
  { path: '/seller/orders',       label: '주문 관리',    icon: ShoppingBag },
  { path: '/seller/settlements',  label: '매출·정산',    icon: DollarSign },
  { path: '/seller/products',     label: '상품 관리',    icon: Package },
  { path: '/seller/inventory',    label: '재고 관리',    icon: BarChart3 },
  { path: '/seller/supply',       label: '공급 상품',    icon: Truck },
  { path: '/seller/donations',   label: '후원 내역',    icon: Heart },
  { path: '/seller/youtube-growth',label: '구독자 늘리기', icon: TrendingUp },
  { path: '/seller/alimtalk',     label: '브랜드메시지',  icon: Bell },
  { path: '/seller/business-info',label: '사업자 정보',   icon: Building2 },
]

interface SellerLayoutProps {
  title: string
  children: React.ReactNode
  headerRight?: React.ReactNode
  pendingOrders?: number
}

export default function SellerLayout({ title, children, headerRight, pendingOrders = 0 }: SellerLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const sellerName = localStorage.getItem('seller_name') || '셀러'

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
            <p className="text-xs text-gray-400">워크스페이스</p>
            <p className="text-sm font-semibold text-gray-800 truncate">{sellerName}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ path, label, icon: Icon, exact, highlight }) => {
          const active = isActive(path, exact)
          return (
            <Link
              key={path}
              to={path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
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
              {label === '주문 관리' && pendingOrders > 0 && (
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  active ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                }`}>
                  {pendingOrders}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-0.5">
        <Link
          to="/seller/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <Settings className="w-4 h-4" />
          설정
        </Link>
        <button
          onClick={() => logoutSeller(navigate)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F5F7]">
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
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
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
        title="카카오 채널 상담"
      >
        <MessageCircle className="w-4 h-4" />
      </a>
    </div>
  )
}
