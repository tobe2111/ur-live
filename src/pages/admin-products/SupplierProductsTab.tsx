/**
 * 🛡️ 2026-06-01 도매몰 INC-4: 공급자가 직접 등록한 공급상품 승인 큐 (어드민).
 *   GET /api/admin/supplier-products?status=... · PATCH /api/admin/supplier-products/:id
 */
import { useTranslation } from 'react-i18next'
import { Loader2, Boxes, CheckCircle, XCircle, Clock } from 'lucide-react'
import { formatKSTDate } from '@/utils/date'

export interface SupplierProductRow {
  id: number
  name: string
  description: string | null
  retail_price: number
  supply_price: number
  stock: number
  category: string | null
  approval_status: string
  supplier_id: number
  supplier_name: string | null
  supplier_email: string | null
  admin_memo: string | null
  created_at: string
}

interface Props {
  loading: boolean
  items: SupplierProductRow[]
  statusFilter: string
  setStatusFilter: (s: string) => void
  adminMemoMap: Record<number, string>
  setAdminMemoMap: (fn: (prev: Record<number, string>) => Record<number, string>) => void
  actionLoading: number | null
  onAction: (id: number, action: 'approve' | 'reject') => void
}

const FILTERS = [
  { key: 'pending', labelKey: 'admin.products.spPending', label: '승인 대기' },
  { key: 'approved', labelKey: 'admin.products.spApproved', label: '승인됨' },
  { key: 'rejected', labelKey: 'admin.products.spRejected', label: '거부됨' },
  { key: 'all', labelKey: 'admin.products.spAll', label: '전체' },
]

export default function SupplierProductsTab({
  loading, items, statusFilter, setStatusFilter, adminMemoMap, setAdminMemoMap, actionLoading, onAction,
}: Props) {
  const { t } = useTranslation()

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex gap-1 p-3 border-b border-gray-100">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === f.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            {t(f.labelKey, { defaultValue: f.label })}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" /></div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center">
          <Boxes className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">{t('admin.products.spEmpty', { defaultValue: '공급자 등록 상품이 없습니다.' })}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map(p => (
            <div key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {p.approval_status === 'pending' && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-50 text-yellow-700"><Clock className="w-3 h-3" /> {t('admin.products.spPending', { defaultValue: '승인 대기' })}</span>}
                    {p.approval_status === 'approved' && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700"><CheckCircle className="w-3 h-3" /> {t('admin.products.spApproved', { defaultValue: '승인됨' })}</span>}
                    {p.approval_status === 'rejected' && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-600"><XCircle className="w-3 h-3" /> {t('admin.products.spRejected', { defaultValue: '거부됨' })}</span>}
                    <span className="text-xs text-gray-400">{formatKSTDate(p.created_at)}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t('admin.products.spSupplier', { defaultValue: '공급자' })}: <span className="font-medium">{p.supplier_name || p.supplier_email || `#${p.supplier_id}`}</span>
                    &nbsp;·&nbsp; {t('admin.products.sampleSupplyPrice', { defaultValue: '공급가' })} <span className="text-purple-600 font-medium">{p.supply_price?.toLocaleString()}{t('common.won', { defaultValue: '원' })}</span>
                    &nbsp;·&nbsp; {t('admin.products.spRetail', { defaultValue: '권장가' })} {p.retail_price?.toLocaleString()}{t('common.won', { defaultValue: '원' })}
                    &nbsp;·&nbsp; {t('admin.products.spStock', { defaultValue: '재고' })} {p.stock}
                  </p>
                  {p.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.description}</p>}
                  {p.admin_memo && p.approval_status !== 'pending' && (
                    <p className="mt-1 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">{t('admin.products.adminMemo', { defaultValue: '어드민 메모' })}: {p.admin_memo}</p>
                  )}
                </div>
                {p.approval_status !== 'approved' && (
                  <div className="flex-shrink-0 flex flex-col gap-2 w-48">
                    <textarea
                      placeholder={t('admin.products.k036', { defaultValue: '어드민 메모 (선택)' })}
                      value={adminMemoMap[p.id] || ''}
                      onChange={e => setAdminMemoMap(prev => ({ ...prev, [p.id]: e.target.value }))}
                      rows={2}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => onAction(p.id, 'approve')} disabled={actionLoading === p.id}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                        {actionLoading === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        {t('admin.products.approve', { defaultValue: '승인' })}
                      </button>
                      <button onClick={() => onAction(p.id, 'reject')} disabled={actionLoading === p.id}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
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
