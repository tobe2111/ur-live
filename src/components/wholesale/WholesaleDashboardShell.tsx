// ──────────────────────────────────────────────────────────────
// 🏭 도매몰 대시보드 셸 — 제조사(/supplier) + 판매사(/wholesale/dashboard) 공통 chrome.
//   2026-06-16 (사용자 지적): 기존 셀러/어드민 다크 사이드바 복제 → UTONG START 라이트 대시보드로 재구성.
//   상단 헤더(로고 + 브레드크럼) + 흰색 좌측 메뉴(오렌지 활성/배지) + 라이트 본문(#F4F5F7).
//   • tab 기반(제조사) 과 route 기반(판매사) 둘 다 NavItem.onClick 으로 구동. 자체 모바일 drawer.
//   • 라이트 고정(B2B 대시보드) — dark: variant 없음. 이 셸 한 곳만 바꾸면 전 대시보드 페이지 반영.
// ──────────────────────────────────────────────────────────────
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Menu, X, ChevronRight, type LucideIcon } from 'lucide-react'
import { WholesaleWordmark } from '../../pages/wholesale-catalog/WholesaleLogo'
import { WT } from '../../pages/wholesale/wholesale-theme'

export interface WholesaleNavItem {
  key: string
  label: string
  icon: LucideIcon
  active: boolean
  onClick: () => void
  badge?: number
}

interface WholesaleDashboardShellProps {
  /** 사이드바 상단 역할명 (예: '제조사 센터', '판매사 센터'). */
  brand: string
  /** 역할 아이콘 (제조사=Factory, 판매사=Store 등) — 한눈에 역할 구분. */
  roleIcon?: LucideIcon
  /** 사이드바 상단 부제 (예: 사업자명/등급). */
  brandSubtitle?: string
  navItems: WholesaleNavItem[]
  /** 헤더 좌측 제목 (보통 활성 nav 라벨). */
  title: string
  /** 헤더 우측 슬롯 (로그아웃 / 장바구니 / 등급칩 등). */
  headerRight?: ReactNode
  /** 헤더 로고 클릭 핸들러 (예: 카탈로그 /wholesale 로 이동). 없으면 비클릭. */
  onLogoClick?: () => void
  children: ReactNode
}

export default function WholesaleDashboardShell({
  brand,
  roleIcon: RoleIcon,
  brandSubtitle,
  navItems,
  title,
  headerRight,
  onLogoClick,
  children,
}: WholesaleDashboardShellProps) {
  const { t } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // 흰색 좌측 메뉴 (데스크톱 + 모바일 drawer 공용).
  const sidebar = (
    <aside className="w-[214px] flex-shrink-0 flex flex-col h-full bg-white" style={{ borderRight: '1px solid ' + WT.line }}>
      {/* 역할 헤더 — 아이콘 + 역할명(제조사/판매사 센터) + 사업자명 */}
      <div className="px-4 pt-4 pb-4" style={{ borderBottom: '1px solid ' + WT.line }}>
        <div className="flex items-center gap-2">
          {RoleIcon && (
            <span className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0" style={{ background: WT.brandSoft }}>
              <RoleIcon size={15} strokeWidth={2.2} style={{ color: WT.brand }} />
            </span>
          )}
          {brand && <span className="font-extrabold truncate" style={{ fontSize: '14px', letterSpacing: '-0.01em', color: WT.ink }}>{brand}</span>}
        </div>
        {brandSubtitle && <p className="mt-2 truncate font-semibold" style={{ fontSize: '12px', color: WT.ink3 }}>{brandSubtitle}</p>}
      </div>
      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide py-2.5 px-2.5">
        {navItems.map(({ key, label, icon: Icon, active, onClick, badge }) => (
          <button
            key={key}
            type="button"
            onClick={() => { setSidebarOpen(false); onClick() }}
            aria-current={active ? 'page' : undefined}
            className="w-full flex items-center gap-2.5 px-3 py-[10px] rounded-[9px] text-[13px] font-semibold transition-colors text-left mb-0.5"
            style={active ? { background: WT.brandSoft, color: WT.brand } : { color: WT.ink2 }}
          >
            <Icon size={15} strokeWidth={2} className="flex-shrink-0" style={{ color: active ? WT.brand : WT.ink3 }} />
            <span className="flex-1 truncate">{label}</span>
            {typeof badge === 'number' && badge > 0 && (
              <span className="text-[10px] font-extrabold px-1.5 min-w-[18px] h-[18px] rounded-full text-white flex items-center justify-center" style={{ background: WT.brand }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </aside>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: WT.fill, color: WT.ink }}>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 데스크톱(md+) 영구 사이드바 */}
      <div className="hidden md:flex">{sidebar}</div>

      {/* 모바일 drawer */}
      <div className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebar}
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white px-4 lg:px-6 h-14 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid ' + WT.line }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              aria-label={sidebarOpen ? t('common.closeSidebar', { defaultValue: '사이드바 닫기' }) : t('common.openSidebar', { defaultValue: '사이드바 열기' })}
              aria-expanded={sidebarOpen}
              className="md:hidden p-1.5 rounded-lg hover:bg-gray-100"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            {onLogoClick ? (
              <button type="button" onClick={onLogoClick} aria-label="도매몰 홈" className="shrink-0 rounded-md hover:opacity-80 transition-opacity">
                <WholesaleWordmark height={22} />
              </button>
            ) : (
              <WholesaleWordmark height={22} />
            )}
            <ChevronRight className="w-4 h-4 hidden sm:block shrink-0" style={{ color: WT.ink4 }} />
            <h1 className="text-[15px] font-bold truncate hidden sm:block" style={{ color: WT.ink }}>{title}</h1>
          </div>
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="px-4 lg:px-6 py-6 max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}
