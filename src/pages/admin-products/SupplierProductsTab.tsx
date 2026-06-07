/**
 * 🛡️ 2026-06-01 도매몰 INC-4: 공급자가 직접 등록한 공급상품 승인 큐 (어드민).
 *   GET /api/admin/supplier-products?status=... · PATCH /api/admin/supplier-products/:id
 * 🏭 2026-06-07 (사용자 요청): 온라인 최저가 검수 + 공급가 변경 승인 큐 추가.
 *   - 신규/대기 상품: 제조사 제출 '온라인 최저가 링크' 확인 후 '최저가 확인함' 체크 → 승인.
 *   - 판매중 상품 가격 변경 요청(price_change): 현재가→요청가 비교 후 승인(반영)/거부.
 */
import { useTranslation } from 'react-i18next'
import { Loader2, Boxes, CheckCircle, XCircle, Clock, ExternalLink, ShieldCheck, TrendingUp } from 'lucide-react'
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
  lowest_price_url?: string | null
  lowest_price_checked?: number
  pending_supply_price?: number | null
  pending_retail_price?: number | null
  pending_price_url?: string | null
  pending_price_reason?: string | null
  pending_price_requested_at?: string | null
}

interface Props {
  loading: boolean
  items: SupplierProductRow[]
  statusFilter: string
  setStatusFilter: (s: string) => void
  adminMemoMap: Record<number, string>
  setAdminMemoMap: (fn: (prev: Record<number, string>) => Record<number, string>) => void
  lowestCheckedMap: Record<number, boolean>
  setLowestCheckedMap: (fn: (prev: Record<number, boolean>) => Record<number, boolean>) => void
  actionLoading: number | null
  onAction: (id: number, action: 'approve' | 'reject') => void
  onPriceChangeAction: (id: number, action: 'approve' | 'reject') => void
}

const FILTERS = [
  { key: 'pending', labelKey: 'admin.products.spPending', label: '승인 대기' },
  { key: 'price_change', labelKey: 'admin.products.spPriceChange', label: '가격변경 요청' },
  { key: 'approved', labelKey: 'admin.products.spApproved', label: '승인됨' },
  { key: 'rejected', labelKey: 'admin.products.spRejected', label: '거부됨' },
  { key: 'all', labelKey: 'admin.products.spAll', label: '전체' },
]

const won = (n: number | null | undefined, suffix: string) => `${(n ?? 0).toLocaleString()}${suffix}`

export default function SupplierProductsTab({
  loading, items, statusFilter, setStatusFilter, adminMemoMap, setAdminMemoMap,
  lowestCheckedMap, setLowestCheckedMap, actionLoading, onAction, onPriceChangeAction,
}: Props) {
  const { t } = useTranslation()
  const wonUnit = t('common.won', { defaultValue: '원' })

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex gap-1 p-3 border-b border-gray-100 flex-wrap">
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
          {items.map(p => {
            const hasPriceChange = p.pending_supply_price != null
            return (
            <div key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {p.approval_status === 'pending' && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-50 text-yellow-700"><Clock className="w-3 h-3" /> {t('admin.products.spPending', { defaultValue: '승인 대기' })}</span>}
                    {p.approval_status === 'approved' && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700"><CheckCircle className="w-3 h-3" /> {t('admin.products.spApproved', { defaultValue: '승인됨' })}</span>}
                    {p.approval_status === 'rejected' && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-600"><XCircle className="w-3 h-3" /> {t('admin.products.spRejected', { defaultValue: '거부됨' })}</span>}
                    {p.lowest_price_checked === 1 && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700"><ShieldCheck className="w-3 h-3" /> {t('admin.products.spLowestChecked', { defaultValue: '최저가 검수됨' })}</span>}
                    {hasPriceChange && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-orange-50 text-orange-700"><TrendingUp className="w-3 h-3" /> {t('admin.products.spPriceChange', { defaultValue: '가격변경 요청' })}</span>}
                    <span className="text-xs text-gray-400">{formatKSTDate(p.created_at)}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t('admin.products.spSupplier', { defaultValue: '공급자' })}: <span className="font-medium">{p.supplier_name || p.supplier_email || `#${p.supplier_id}`}</span>
                    &nbsp;·&nbsp; {t('admin.products.sampleSupplyPrice', { defaultValue: '공급가' })} <span className="text-purple-600 font-medium">{won(p.supply_price, wonUnit)}</span>
                    &nbsp;·&nbsp; {t('admin.products.spRetail', { defaultValue: '권장가' })} {won(p.retail_price, wonUnit)}
                    &nbsp;·&nbsp; {t('admin.products.spStock', { defaultValue: '재고' })} {p.stock}
                  </p>
                  {p.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.description}</p>}

                  {/* 온라인 최저가 참고 링크 (검수용). */}
                  {p.lowest_price_url && (
                    <a href={p.lowest_price_url} target="_blank" rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                      <ExternalLink className="w-3 h-3" /> {t('admin.products.spLowestLink', { defaultValue: '온라인 최저가 참고 링크' })}
                    </a>
                  )}

                  {/* 가격 변경 요청 상세 (현재가 → 요청가). */}
                  {hasPriceChange && (
                    <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                      <p className="text-xs font-semibold text-orange-800 mb-1">{t('admin.products.spPriceChangeReq', { defaultValue: '가격 변경 요청' })}</p>
                      <p className="text-xs text-gray-700">
                        {t('admin.products.spSupplyPriceShort', { defaultValue: '공급가' })}: <span className="line-through text-gray-400">{won(p.supply_price, wonUnit)}</span> → <span className="font-bold text-orange-700">{won(p.pending_supply_price, wonUnit)}</span>
                      </p>
                      {p.pending_retail_price != null && (
                        <p className="text-xs text-gray-700">
                          {t('admin.products.spRetail', { defaultValue: '권장가' })}: <span className="line-through text-gray-400">{won(p.retail_price, wonUnit)}</span> → <span className="font-bold text-orange-700">{won(p.pending_retail_price, wonUnit)}</span>
                        </p>
                      )}
                      {p.pending_price_reason && <p className="text-xs text-gray-500 mt-0.5">{t('admin.products.spReason', { defaultValue: '사유' })}: {p.pending_price_reason}</p>}
                      {p.pending_price_url && (
                        <a href={p.pending_price_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                          <ExternalLink className="w-3 h-3" /> {t('admin.products.spLowestLink', { defaultValue: '온라인 최저가 참고 링크' })}
                        </a>
                      )}
                    </div>
                  )}

                  {p.admin_memo && p.approval_status !== 'pending' && !hasPriceChange && (
                    <p className="mt-1 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">{t('admin.products.adminMemo', { defaultValue: '어드민 메모' })}: {p.admin_memo}</p>
                  )}
                </div>

                {/* 액션 패널 — 가격변경 요청 우선, 그 다음 신규/대기 상품 승인. */}
                {hasPriceChange ? (
                  <div className="flex-shrink-0 flex flex-col gap-2 w-48">
                    <textarea
                      placeholder={t('admin.products.k036', { defaultValue: '어드민 메모 (선택)' })}
                      value={adminMemoMap[p.id] || ''}
                      onChange={e => setAdminMemoMap(prev => ({ ...prev, [p.id]: e.target.value }))}
                      rows={2}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => onPriceChangeAction(p.id, 'approve')} disabled={actionLoading === p.id}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
                        {actionLoading === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        {t('admin.products.spApplyPrice', { defaultValue: '반영' })}
                      </button>
                      <button onClick={() => onPriceChangeAction(p.id, 'reject')} disabled={actionLoading === p.id}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-gray-400 text-white rounded-lg hover:bg-gray-500 disabled:opacity-50">
                        <XCircle className="w-3 h-3" /> {t('admin.products.reject', { defaultValue: '거부' })}
                      </button>
                    </div>
                  </div>
                ) : p.approval_status !== 'approved' && (
                  <div className="flex-shrink-0 flex flex-col gap-2 w-48">
                    <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={!!lowestCheckedMap[p.id]}
                        onChange={e => setLowestCheckedMap(prev => ({ ...prev, [p.id]: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300" />
                      {t('admin.products.spLowestConfirm', { defaultValue: '온라인 최저가 확인함' })}
                    </label>
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
            )
          })}
        </div>
      )}
    </div>
  )
}
