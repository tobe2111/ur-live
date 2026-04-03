import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingBag, Package, DollarSign,
  Bell, Image, Monitor, LogOut, Menu, X, Store, ClipboardList
} from 'lucide-react'
import { clearAuthData } from '@/utils/auth'
import DashboardNotificationBell from './DashboardNotificationBell'

const NAV_ITEMS = [
  { path: '/admin',               label: '대시보드',    icon: LayoutDashboard, exact: true },
  { path: '/admin/orders',        label: '주문 관리',   icon: ShoppingBag },
  { path: '/admin/products',      label: '상품 관리',   icon: Package },
  { path: '/admin/banners',       label: '배너 관리',   icon: Image },
  { path: '/admin/settlement',    label: '정산',        icon: DollarSign },
  { path: '/admin/alimtalk',      label: '브랜드메시지', icon: Bell },
  { path: '/admin/kv-monitoring', label: 'KV 모니터링', icon: Monitor },
  { path: '/admin/sample-requests', label: '샘플 신청', icon: ClipboardList },
  { path: '/admin/cafe24',       label: 'Cafe24 연동', icon: Store },
]

interface AdminLayoutProps {
  title: string
  children: React.ReactNode
  headerRight?: React.ReactNode
  pendingCount?: number
}

export default function AdminLayout({ title, children, headerRight, pendingCount = 0 }: AdminLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const adminName = localStorage.getItem('admin_name') || localStorage.getItem('admin_email') || '관리자'

  function logout() {
    clearAuthData('admin')
    navigate('/admin/login')
  }

  function isActive(path: string, exact?: boolean) {
    return exact ? location.pathname === path : location.pathname.startsWith(path)
  }

  const Sidebar = () => (
    <aside className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="px-4 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
            {adminName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">워크스페이스</p>
            <p className="text-sm font-semibold text-gray-800 truncate">관리자</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ path, label, icon: Icon, exact }) => {
          const active = isActive(path, exact)
          return (
            <Link
              key={path}
              to={path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {label === '주문 관리' && pendingCount > 0 && (
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  active ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                }`}>
                  {pendingCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={logout}
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
          <div className="flex items-center gap-2">
            <DashboardNotificationBell tokenKey="admin_token" />
            {headerRight}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 space-y-5">
          {children}
        </main>
      </div>
    </div>
  )
}
