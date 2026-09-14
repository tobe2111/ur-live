/**
 * 🧭 2026-07-19 (대표 UI v2 P2 — 셀러 대시보드 심플 모드): 매장(store_owner 단독) 기본 진입 nav.
 *   홈 + 3메뉴(① QR스캔 ② 정산 ③ 내 딜)만 상단 고정, 나머지 전체 그룹은 "전체 메뉴" 접힘(부모 게이트).
 *   기능 삭제 아님 — 노출 기본값 변경. 방배 온보딩 "이 화면 하나만 기억하세요" 대응:
 *   첫 화면 액션 3개, QR스캔까지 탭 1회. 크리에이터/겸업(both)은 기존 전체 노출(isStoreOnly 게이트, 부모).
 *
 * 🎨 2026-09-14 (대표 Rinda 시안 — docs/design/dashboard-rinda-2026-09.md): 어두운 면 → 흰 면 +
 *   연파랑 알약. **'이용권 등록'은 여기서 뺐다** — 부모(SellerLayout)가 사이드바 상단에 파란 CTA 로
 *   한 번만 그린다(2026-08-23 대표 "왼쪽 카테고리에도 이용권 등록 버튼" 요구는 그 CTA 가 이어받는다).
 *   같은 문구의 검은 버튼이 한 화면에 셋이던 것을 줄이는 작업의 일부.
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, ScanLine, DollarSign, Ticket, ChevronDown } from 'lucide-react'

interface Props {
  isActive: (path: string, exact?: boolean, also?: string[]) => boolean
  /** 항목 클릭 시(모바일 사이드바 닫기) */
  onNavigate: () => void
  fullMenuOpen: boolean
  onToggleFullMenu: () => void
}

/** 활성/비활성 공통 클래스 — 부모 SellerLayout 의 일반 nav 항목과 **같은 그림**이어야 한다. */
const ROW = 'flex items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-[13px] transition-colors'

export default function SellerSimpleNav({ isActive, onNavigate, fullMenuOpen, onToggleFullMenu }: Props) {
  const { t } = useTranslation()
  const items = [
    // 🎟️ 2026-09-03 대표 신고 — 이름이 **"내 딜"** 이라 대표가 "이용권 관리"를 못 찾았다.
    //   하는 일 그대로 쓴다. `also` 에 수정 화면(`/seller/products/:id/edit`)도 넣어 편집 중에도 여기가 켜진다.
    { path: '/seller/group-buy', label: t('seller.nav.voucherManage', { defaultValue: '이용권 관리' }), icon: Ticket, also: ['/seller/proxy-products', '/seller/products/'] },
    { path: '/seller/scan', label: t('seller.simple.scan', { defaultValue: 'QR 스캔' }), icon: ScanLine, also: undefined as string[] | undefined },
    { path: '/seller/settlements', label: t('seller.simple.settlement', { defaultValue: '정산' }), icon: DollarSign, also: undefined },
  ]
  const homeActive = isActive('/seller', true)
  return (
    <div className="px-2">
      <Link
        to="/seller"
        onClick={onNavigate}
        className={`${ROW} ${homeActive ? 'font-bold text-gray-900 ur-seller-nav-active' : 'font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
      >
        <LayoutDashboard size={16} strokeWidth={2} className={`flex-shrink-0 ${homeActive ? 'text-brand-text' : 'text-gray-400'}`} />
        <span className="flex-1 truncate">{t('seller.dashboard')}</span>
      </Link>
      {items.map(({ path, label, icon: Icon, also }) => {
        const active = isActive(path, false, also)
        return (
          <Link
            key={path}
            to={path}
            onClick={onNavigate}
            className={`${ROW} ${active ? 'font-bold text-gray-900 ur-seller-nav-active' : 'font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <Icon size={16} strokeWidth={2} className={`flex-shrink-0 ${active ? 'text-brand-text' : 'text-gray-400'}`} />
            <span className="flex-1 truncate">{label}</span>
          </Link>
        )
      })}
      <button
        onClick={onToggleFullMenu}
        className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
      >
        <ChevronDown size={14} className={`transition-transform ${fullMenuOpen ? 'rotate-180' : ''}`} />
        {t('seller.simple.fullMenu', { defaultValue: '전체 메뉴' })}
      </button>
    </div>
  )
}
