// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-08 도매몰 대시보드 셸 — 제조사(/supplier) + 유통사(/wholesale/dashboard)
//   공통 chrome. SellerLayout/AdminLayout 의 시각 언어(다크 #0A0A0B 사이드바 +
//   화이트 h-14 헤더 + #F4F5F7 콘텐츠) 를 props 기반으로 재현.
//   • tab 기반(제조사) 과 route 기반(유통사) 둘 다 NavItem.onClick 으로 구동.
//   • 라이트 고정(B2B 대시보드 계열) — dark: variant 없음.
//   • 자체 모바일 drawer 상태 보유(self-contained).
// ──────────────────────────────────────────────────────────────
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Menu, X, type LucideIcon } from 'lucide-react'
import UrDealLogo from '@/components/brand/UrDealLogo'

export interface WholesaleNavItem {
  key: string
  label: string
  icon: LucideIcon
  active: boolean
  onClick: () => void
  badge?: number
}

interface WholesaleDashboardShellProps {
  /** 사이드바 상단 워드마크 라벨 (예: 'SUPPLIER', '유통스타트'). */
  brand: string
  /** 사이드바 상단 부제 (예: 사업자명/등급). */
  brandSubtitle?: string
  navItems: WholesaleNavItem[]
  /** 헤더 좌측 제목 (보통 활성 nav 라벨). */
  title: string
  /** 헤더 우측 슬롯 (로그아웃 / 장바구니 / 등급칩 등). */
  headerRight?: ReactNode
  children: ReactNode
}

export default function WholesaleDashboardShell({
  brand,
  brandSubtitle,
  navItems,
  title,
  headerRight,
  children,
}: WholesaleDashboardShellProps) {
  const { t } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // 사이드바를 JSX 변수로 — 데스크톱 + 모바일 두 곳에서 렌더 (SellerLayout 패턴).
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
            {brand}
          </span>
        </div>
        {brandSubtitle && (
          <p className="text-white/55 mt-2 truncate" style={{ fontSize: '11px', fontWeight: 700 }}>
            {brandSubtitle}
          </p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide pb-2 mt-1">
        {navItems.map(({ key, label, icon: Icon, active, onClick, badge }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setSidebarOpen(false)
              onClick()
            }}
            aria-current={active ? 'page' : undefined}
            className={`w-full flex items-center gap-2.5 px-4 py-[9px] text-[12px] font-semibold transition-colors border-l-[2.5px] text-left ${
              active
                ? 'text-white border-[#FF0033] ur-seller-nav-active'
                : 'text-white/55 hover:text-white border-transparent'
            }`}
          >
            <Icon size={14} strokeWidth={2} className="flex-shrink-0" />
            <span className="flex-1 truncate">{label}</span>
            {typeof badge === 'number' && badge > 0 && (
              <span className="text-[9px] font-extrabold px-1.5 rounded-full bg-white/10 text-white">
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </aside>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F5F7] text-gray-900">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 데스크톱(md+) 영구 사이드바 */}
      <div className="hidden md:flex">{sidebar}</div>

      {/* 모바일 drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebar}
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 h-14 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={
                sidebarOpen
                  ? t('common.closeSidebar', { defaultValue: '사이드바 닫기' })
                  : t('common.openSidebar', { defaultValue: '사이드바 열기' })
              }
              aria-expanded={sidebarOpen}
              className="md:hidden p-1.5 rounded-lg hover:bg-gray-100"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="text-base font-semibold text-gray-900">{title}</h1>
          </div>
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="px-4 lg:px-6 py-6 max-w-5xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}
