/**
 * 🧭 2026-07-19 (대표 UI v2 P2 — 셀러 대시보드 심플 모드): 매장(store_owner 단독) 기본 진입 nav.
 *   홈 + 3메뉴(① QR스캔 ② 정산 ③ 내 딜)만 상단 고정, 나머지 전체 그룹은 "전체 메뉴" 접힘(부모 게이트).
 *   기능 삭제 아님 — 노출 기본값 변경. 방배 온보딩 "이 화면 하나만 기억하세요" 대응:
 *   첫 화면 액션 3개, QR스캔까지 탭 1회. 크리에이터/겸업(both)은 기존 전체 노출(isStoreOnly 게이트, 부모).
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, ScanLine, DollarSign, Ticket, PlusCircle, ChevronDown } from 'lucide-react'

interface Props {
  isActive: (path: string, exact?: boolean, also?: string[]) => boolean
  /** 항목 클릭 시(모바일 사이드바 닫기) */
  onNavigate: () => void
  fullMenuOpen: boolean
  onToggleFullMenu: () => void
}

export default function SellerSimpleNav({ isActive, onNavigate, fullMenuOpen, onToggleFullMenu }: Props) {
  const { t } = useTranslation()
  const items = [
    // 🎟️ 2026-08-23 (대표 AB테스트 — "왼쪽 카테고리에도 이용권 등록 버튼"): 심플 모드에도 상시 노출.
    { path: '/seller/meal-voucher/new', label: t('seller.registerVoucher', { defaultValue: '이용권 등록' }), icon: PlusCircle, also: undefined as string[] | undefined },
    { path: '/seller/scan', label: t('seller.simple.scan', { defaultValue: 'QR 스캔' }), icon: ScanLine, also: undefined },
    { path: '/seller/settlements', label: t('seller.simple.settlement', { defaultValue: '정산' }), icon: DollarSign, also: undefined },
    // 내 딜 = 이용권/딜 관리(승인 대기 = 대납 검토 포함 — also 로 활성 표시. meal-voucher 는 위 등록 항목이 담당)
    { path: '/seller/group-buy', label: t('seller.simple.myDeals', { defaultValue: '내 딜' }), icon: Ticket, also: ['/seller/proxy-products'] },
  ]
  return (
    <div className="mt-1">
      <Link
        to="/seller"
        onClick={onNavigate}
        className={`flex items-center gap-2.5 px-4 py-[7px] text-[12px] font-semibold transition-colors border-l-[2.5px] ${
          isActive('/seller', true) ? 'text-white border-[#9ca3af] ur-seller-nav-active' : 'text-white/55 hover:text-white border-transparent'
        }`}
      >
        <LayoutDashboard size={14} strokeWidth={2} className="flex-shrink-0" />
        <span className="flex-1 truncate">{t('seller.dashboard')}</span>
      </Link>
      {items.map(({ path, label, icon: Icon, also }) => (
        <Link
          key={path}
          to={path}
          onClick={onNavigate}
          className={`flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-bold transition-colors border-l-[2.5px] ${
            isActive(path, false, also) ? 'text-white border-[#9ca3af] ur-seller-nav-active' : 'text-white/70 hover:text-white border-transparent'
          }`}
        >
          <Icon size={16} strokeWidth={2} className="flex-shrink-0" />
          <span className="flex-1 truncate">{label}</span>
        </Link>
      ))}
      <button
        onClick={onToggleFullMenu}
        className="w-full flex items-center gap-2.5 px-4 py-2 mt-2 text-[11px] font-bold text-white/40 hover:text-white/70 transition-colors"
      >
        <ChevronDown size={13} className={`transition-transform ${fullMenuOpen ? 'rotate-180' : ''}`} />
        {t('seller.simple.fullMenu', { defaultValue: '전체 메뉴' })}
      </button>
    </div>
  )
}
