/**
 * 🛡️ 2026-05-02: PC 라이브/쇼츠 페이지 좌측 사이드바 (TikTok 식).
 *
 * 적용 범위:
 *   - MobileAppLayout 의 data-mobile-only 페이지 (라이브, 쇼츠 등 9:16 풀스크린)
 *   - PC 에서만 표시 (xl 이상, 1280px+) — 좌우 양쪽 여백이 ≥250px 일 때만 안전하게 노출
 *   - mobile / tablet 에서는 hidden
 *
 * 디자인:
 *   - position: fixed, 화면 좌측 점령 (224px 폭)
 *   - 9:16 컨테이너 (430px 가운데 정렬) 와 충돌 없음
 *   - 메뉴: 추천/탐색/팔로잉/라이브/마이/검색
 */
import { useNavigate, Link } from 'react-router-dom'
import { Home, Compass, UserCheck, Radio, ShoppingBag, Search, User } from 'lucide-react'
import UrDealLogo from '@/components/brand/UrDealLogo'

interface NavItem {
  label: string
  icon: React.ComponentType<{ className?: string }>
  path: string
  active?: (pathname: string) => boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: '추천',   icon: Home,       path: '/',          active: (p) => p === '/' },
  { label: '탐색',   icon: Compass,    path: '/browse',    active: (p) => p.startsWith('/browse') },
  { label: '팔로잉', icon: UserCheck,  path: '/following', active: (p) => p.startsWith('/following') },
  { label: '라이브', icon: Radio,      path: '/live',      active: (p) => p.startsWith('/live') },
  { label: '쇼핑',   icon: ShoppingBag, path: '/cart',     active: (p) => p === '/cart' },
  { label: '검색',   icon: Search,     path: '/search',    active: (p) => p === '/search' },
  { label: '프로필', icon: User,       path: '/user/profile', active: (p) => p.startsWith('/user/profile') },
]

export default function DesktopLiveSidebar() {
  const navigate = useNavigate()
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'

  return (
    <aside
      className="hidden xl:flex fixed left-0 top-0 bottom-0 w-56 z-40 flex-col py-6 px-3 bg-white dark:bg-[#020202] border-r border-white/[0.06]"
      aria-label="PC 메인 메뉴"
    >
      {/* 로고 */}
      <Link to="/" className="flex items-center px-3 mb-6">
        <UrDealLogo size={20} />
      </Link>

      <nav className="flex-1 flex flex-col gap-1">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const isActive = item.active?.(pathname) ?? false
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                isActive
                  ? 'bg-gray-100 dark:bg-white/[0.08] text-gray-900 dark:text-white font-bold'
                  : 'text-gray-700 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[14px]">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <p className="text-[10px] text-gray-900 dark:text-white/30 px-3 mt-auto">
        © 2026 UR·DEAL
      </p>
    </aside>
  )
}
