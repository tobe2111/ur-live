import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import api from '@/lib/api'
import {
  LayoutDashboard, Users, ShoppingBag, Play, BarChart2, LogOut, Menu, X
} from 'lucide-react'

const NAV_GROUPS = [
  {
    label: '',
    items: [
      { path: '/agency', label: '대시보드', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: '관리',
    items: [
      { path: '/agency/sellers', label: '셀러 관리',  icon: Users, exact: false },
      { path: '/agency/orders',  label: '주문 현황',  icon: ShoppingBag, exact: false },
      { path: '/agency/streams', label: '라이브 현황', icon: Play, exact: false },
    ],
  },
  {
    label: '분석',
    items: [
      { path: '/agency/stats', label: '통계 분석', icon: BarChart2, exact: false },
    ],
  },
]

interface AgencyLayoutProps {
  title: string
  children: React.ReactNode
  headerRight?: React.ReactNode
}

export default function AgencyLayout({ title, children, headerRight }: AgencyLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [agencyName, setAgencyName] = useState(localStorage.getItem('agency_name') || '에이전시')

  useEffect(() => {
    const token = localStorage.getItem('agency_token')
    if (!token) return
    api.get('/api/agency/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        const name = r.data?.data?.name
        if (name) {
          setAgencyName(name)
          localStorage.setItem('agency_name', name)
        }
      })
      .catch(() => {})
  }, [])

  function logout() {
    ['agency_token', 'agency_id', 'agency_name', 'agency_email'].forEach(k => localStorage.removeItem(k))
    navigate('/agency/login')
  }

  function isActive(path: string, exact?: boolean) {
    return exact ? location.pathname === path : location.pathname.startsWith(path)
  }

  const Sidebar = () => (
    <aside className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="px-4 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
            {agencyName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">에이전시</p>
            <p className="text-sm font-semibold text-gray-800 truncate">{agencyName}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
            {group.label && (
              <p className="px-3 mb-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ path, label, icon: Icon, exact }) => {
                const active = isActive(path, exact)
                return (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
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
    <div className="agency-light-theme flex h-screen overflow-hidden bg-[#F4F5F7] text-gray-900">
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
    </div>
  )
}
