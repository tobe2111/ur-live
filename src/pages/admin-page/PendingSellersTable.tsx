import { useTranslation } from 'react-i18next'
import { Users, CheckCircle, XCircle } from 'lucide-react'
import { formatKST } from '@/utils/date'
import type { Seller } from './types'

interface Props {
  pendingSellers: Seller[]
  onApprove: (id: number) => void
  onReject: (s: Seller) => void
}

/**
 * 어드민 승인 대기 셀러 테이블.
 * 🛡️ TD-006 추출 (2026-05-06).
 */
export default function PendingSellersTable({ pendingSellers, onApprove, onReject }: Props) {
  const { t } = useTranslation()
  if (pendingSellers.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-amber-100 bg-amber-50 flex items-center gap-2">
        <Users className="w-4 h-4 text-amber-600" />
        <h2 className="text-sm font-semibold text-gray-900">{t('admin.dashboard.k034', { defaultValue: '승인 대기 판매자' })}</h2>
        <span className="ml-auto text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
          {pendingSellers.length}명
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              {[t('admin.dashboard.k035', { defaultValue: '신청일시' }), t('admin.dashboard.k036', { defaultValue: '이름' }), t('admin.dashboard.k037', { defaultValue: '이메일' }), t('admin.dashboard.k038', { defaultValue: '연락처' }), t('admin.dashboard.k039', { defaultValue: '상호명' }), t('admin.dashboard.k040', { defaultValue: '사업자번호' }), t('admin.dashboard.k041', { defaultValue: '승인 관리' })].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pendingSellers.map(seller => (
              <tr key={seller.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-xs text-gray-500">{formatKST(seller.created_at)}</td>
                <td className="px-4 py-3">
                  <p className="text-xs font-medium text-gray-900">{seller.name || '-'}</p>
                  <p className="text-xs text-gray-400">{seller.username}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{seller.email}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{seller.phone || '-'}</td>
                <td className="px-4 py-3 text-xs text-gray-900">{seller.business_name || seller.company_name || '-'}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{seller.business_number || '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => onApprove(seller.id)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700">
                      <CheckCircle className="w-3 h-3" /> 승인
                    </button>
                    <button onClick={() => onReject(seller)} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700">
                      <XCircle className="w-3 h-3" /> 거부
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
