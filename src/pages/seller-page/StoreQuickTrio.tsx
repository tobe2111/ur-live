/**
 * 🧭 2026-07-19 (대표 UI v2 P2 — 셀러 심플 모드): 대시보드 첫 화면 3액션 (① QR스캔 ② 정산 ③ 내 딜).
 *   수용 기준 "신규 셀러 로그인 시 첫 화면 액션 3개, QR스캔까지 탭 1회" — 모바일(사이드바 접힘)에서도 보장.
 *   기존 🏪 스캔 안내 카드(emerald)를 대체 — 스캔 직행 CTA 는 유지·승격(primary).
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ScanLine, DollarSign, Ticket } from 'lucide-react'

export default function StoreQuickTrio() {
  const { t } = useTranslation()
  const items = [
    { to: '/seller/scan', icon: ScanLine, label: t('seller.simple.scan', { defaultValue: 'QR 스캔' }), sub: t('seller.simple.scanSub', { defaultValue: '손님 바우처 사용 처리' }), primary: true },
    { to: '/seller/settlements', icon: DollarSign, label: t('seller.simple.settlement', { defaultValue: '정산' }), sub: t('seller.simple.settlementSub', { defaultValue: '매출·지급 확인' }), primary: false },
    { to: '/seller/group-buy', icon: Ticket, label: t('seller.simple.myDeals', { defaultValue: '내 딜' }), sub: t('seller.simple.myDealsSub', { defaultValue: '승인 대기 포함' }), primary: false },
  ]
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {items.map(({ to, icon: Icon, label, sub, primary }) => (
        <Link
          key={to}
          to={to}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-4 text-center transition-transform active:scale-[0.97] ${
            primary
              ? 'bg-brand text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Icon className="w-6 h-6" strokeWidth={2.2} />
          <span className="text-[14px] font-extrabold leading-none">{label}</span>
          <span className={`text-[10.5px] leading-none ${primary ? 'text-white/75' : 'text-gray-400'}`}>{sub}</span>
        </Link>
      ))}
    </div>
  )
}
