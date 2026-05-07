import { useTranslation } from 'react-i18next'
import { Loader2, Truck, CheckCircle, XCircle, Clock } from 'lucide-react'
import { formatKSTDate } from '@/utils/date'
import type { SampleRequest } from './types'

interface Props {
  loading: boolean
  sampleRequests: SampleRequest[]
  adminMemoMap: Record<number, string>
  setAdminMemoMap: (fn: (prev: Record<number, string>) => Record<number, string>) => void
  actionLoading: number | null
  onAction: (id: number, action: 'approve' | 'reject') => void
}

export default function SampleRequestsTab({
  loading, sampleRequests, adminMemoMap, setAdminMemoMap, actionLoading, onAction,
}: Props) {
  const { t } = useTranslation()

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
        </div>
      ) : sampleRequests.length === 0 ? (
        <div className="py-20 text-center">
          <Truck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">{t('admin.products.k032', { defaultValue: '샘플 신청 내역이 없습니다.' })}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {sampleRequests.map(req => (
            <div key={req.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {req.status === 'PENDING' && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-50 text-yellow-700"><Clock className="w-3 h-3" /> {t('admin.products.k033', { defaultValue: '대기중' })}</span>}
                    {req.status === 'APPROVED' && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700"><CheckCircle className="w-3 h-3" /> {t('admin.products.k034', { defaultValue: '승인됨' })}</span>}
                    {req.status === 'REJECTED' && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-600"><XCircle className="w-3 h-3" /> {t('admin.products.k035', { defaultValue: '거부됨' })}</span>}
                    <span className="text-xs text-gray-400">{formatKSTDate(req.created_at)}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{req.product_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t('admin.products.sampleSeller', { defaultValue: '셀러' })}: <span className="font-medium">{req.seller_name || req.seller_email}</span>
                    &nbsp;·&nbsp; {t('admin.products.sampleRetailPrice', { defaultValue: '판매가' })} {req.retail_price?.toLocaleString()}{t('common.won', { defaultValue: '원' })}
                    &nbsp;·&nbsp; {t('admin.products.sampleSupplyPrice', { defaultValue: '공급가' })} <span className="text-purple-600 font-medium">{req.supply_price?.toLocaleString()}{t('common.won', { defaultValue: '원' })}</span>
                  </p>
                  {req.seller_memo && (
                    <p className="mt-1 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">{t('admin.products.sellerMemo', { defaultValue: '셀러 메모' })}: {req.seller_memo}</p>
                  )}
                  {req.admin_memo && req.status !== 'PENDING' && (
                    <p className="mt-1 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">{t('admin.products.adminMemo', { defaultValue: '어드민 메모' })}: {req.admin_memo}</p>
                  )}
                </div>
                {req.status === 'PENDING' && (
                  <div className="flex-shrink-0 flex flex-col gap-2 w-48">
                    <textarea
                      placeholder={t('admin.products.k036', { defaultValue: '어드민 메모 (선택)' })}
                      value={adminMemoMap[req.id] || ''}
                      onChange={e => setAdminMemoMap(prev => ({ ...prev, [req.id]: e.target.value }))}
                      rows={2}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => onAction(req.id, 'approve')}
                        disabled={actionLoading === req.id}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {actionLoading === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        {t('admin.products.approve', { defaultValue: '승인' })}
                      </button>
                      <button
                        onClick={() => onAction(req.id, 'reject')}
                        disabled={actionLoading === req.id}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                      >
                        <XCircle className="w-3 h-3" /> {t('admin.products.reject', { defaultValue: '거부' })}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
