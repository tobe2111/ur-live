import { useTranslation } from 'react-i18next'
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { formatKSTDate } from '@/utils/date'
import type { Seller } from './types'

const Skel = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className || ''}`} />
)

interface Props {
  sellers: Seller[]
  loading: boolean
  onRefresh: () => void
  onUpdateCommission: (id: number, current: number) => void
  onTogglePermission: (id: number, current: number) => void
  onOpenBizInfo: (s: Seller) => void
  onApprove: (id: number) => void
  onSuspend: (id: number) => void
}

/**
 * 어드민 셀러 관리 테이블.
 * 🛡️ TD-006 추출 (2026-05-06).
 */
export default function SellersTable({
  sellers, loading, onRefresh, onUpdateCommission, onTogglePermission,
  onOpenBizInfo, onApprove, onSuspend
}: Props) {
  const { t } = useTranslation()
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{t('admin.dashboard.k042', { defaultValue: '판매자 관리' })}</h2>
        <button onClick={onRefresh} aria-label={t('admin.dashboard.k043', { defaultValue: '데이터 새로고침' })} className="p-1.5 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              {['ID', t('admin.dashboard.k037', { defaultValue: '이메일' }), t('admin.dashboard.k044', { defaultValue: '회사명' }), t('admin.dashboard.k045', { defaultValue: '수수료율' }), t('admin.dashboard.k046', { defaultValue: '특수권한' }), t('admin.dashboard.k047', { defaultValue: '상태' }), t('admin.dashboard.k048', { defaultValue: '가입일' }), t('admin.dashboard.k049', { defaultValue: '액션' })].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && sellers.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={`skel-${i}`}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><Skel className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : sellers.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">{t('admin.dashboard.k050', { defaultValue: '등록된 판매자가 없습니다' })}</td></tr>
            ) : sellers.map(seller => (
              <tr key={seller.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-xs text-gray-500">
                  {seller.id}
                  {seller.linked_user_id && (
                    <span className="ml-1 inline-flex items-center px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded text-[9px] font-bold" title={t('admin.dashboard.k051', { defaultValue: '카카오 계정 연동됨' })}>
                      💬
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-900">{seller.email}</td>
                <td className="px-4 py-3 text-xs text-gray-900">{seller.business_name || seller.company_name || '-'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => onUpdateCommission(seller.id, seller.commission_rate ?? 10)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    {seller.commission_rate != null ? `${seller.commission_rate.toFixed(2)}%` : '-'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onTogglePermission(seller.id, seller.can_manipulate_stats || 0)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                      seller.can_manipulate_stats ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {seller.can_manipulate_stats ? <><CheckCircle className="w-3 h-3" />{t('admin.dashboard.k052', { defaultValue: '승인됨' })}</> : <><XCircle className="w-3 h-3" />{t('admin.dashboard.k053', { defaultValue: '미승인' })}</>}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                    seller.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                    seller.status === 'suspended' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {seller.status === 'approved' ? t('admin.dashboard.k052', { defaultValue: '승인됨' }) : seller.status === 'suspended' ? t('admin.dashboard.k054', { defaultValue: '정지됨' }) : t('admin.dashboard.k055', { defaultValue: '대기중' })}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{formatKSTDate(seller.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => onOpenBizInfo(seller)} className="text-xs text-purple-600 hover:text-purple-800 font-medium">{t('admin.dashboard.k056', { defaultValue: '사업자정보' })}</button>
                    {seller.status !== 'approved' && (
                      <button onClick={() => onApprove(seller.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">{t('admin.dashboard.k016', { defaultValue: '승인' })}</button>
                    )}
                    {seller.status !== 'suspended' && (
                      <button onClick={() => onSuspend(seller.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">{t('admin.dashboard.k057', { defaultValue: '정지' })}</button>
                    )}
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
