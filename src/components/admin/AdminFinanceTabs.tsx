import { Link, useLocation } from 'react-router-dom'

/**
 * 🧭 2026-06-09 IA 정리: 정산 4페이지(개별/일괄/Ledger/추천 출금) 상단 공유 탭.
 *
 * 배경: 정산 플로우가 4개 라우트로 흩어져 nav 를 오가며 찾아야 했음 ("복잡하다" 체감 원인).
 * 각 페이지는 라우트/코드 그대로 두고(북마크·딥링크 안전) 상단 링크 탭으로만 묶음 —
 * nav 에는 '정산 센터' 1항목만 노출.
 */
const TABS = [
  { path: '/admin/payout-center', label: '🏦 지급 센터' },
  { path: '/admin/settlement', label: '개별 정산' },
  { path: '/admin/settlements-bulk', label: '일괄 정산' },
  { path: '/admin/payouts', label: '통합 정산 (Ledger)' },
  { path: '/admin/commission-withdrawals', label: '추천 출금 승인' },
] as const

export default function AdminFinanceTabs() {
  const { pathname } = useLocation()
  return (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit max-w-full overflow-x-auto">
      {TABS.map(({ path, label }) => {
        const active = pathname === path || pathname.startsWith(path + '/')
        return (
          <Link
            key={path}
            to={path}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
