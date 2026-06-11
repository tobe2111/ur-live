import { useState, useRef } from 'react'
import { Package, Plus, Clock, CheckCircle, XCircle, Tag, ShieldCheck, Upload } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'
import { supplierApi } from '@/lib/supplier-api'
import { downloadSupplierCsv } from './download-csv'
import type { CatalogItem } from './types'

const STATUS_BADGE: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  pending: { label: '승인 대기', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
  approved: { label: '승인됨', cls: 'bg-green-50 text-green-700 border-green-200', Icon: CheckCircle },
  rejected: { label: '거부됨', cls: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle },
}

export default function CatalogTab({ items, t, onAdd, onBulkDone, onManageChannel, onRequestPriceChange, onBulkPrice }: { items: CatalogItem[]; t: (k: string, o?: Record<string, unknown>) => string; onAdd: () => void; onBulkDone: () => void; onManageChannel: (item: CatalogItem) => void; onRequestPriceChange: (item: CatalogItem) => void; onBulkPrice: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [stockImporting, setStockImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const stockFileRef = useRef<HTMLInputElement>(null)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const csv = await file.text()
      // 🧭 2026-06-10 (생애주기 감사 갭): 서버는 행별 결과(results)를 이미 반환 — 합계만 보여주던 것을
      //   실패 행 상세("3행: 공급가 오류")로 표시. 제조사가 어느 행을 고칠지 즉시 알 수 있게.
      const res = await supplierApi.post<{ summary?: { created: number; failed: number }; results?: Array<{ row: number; name?: string; status: string; reason?: string }> }>('/api/supplier/products/bulk', { csv })
      const s = res.summary
      toast.success(t('supplier.bulkDone', { defaultValue: '{{c}}건 등록, {{f}}건 실패', c: s?.created ?? 0, f: s?.failed ?? 0 })
        .replace('{{c}}', String(s?.created ?? 0)).replace('{{f}}', String(s?.failed ?? 0)))
      const failedRows = (res.results || []).filter(r => r.status === 'error')
      if (failedRows.length > 0) {
        const detail = failedRows.slice(0, 8).map(r => `${r.row}행${r.name ? `(${r.name})` : ''}: ${r.reason || '오류'}`).join('\n')
        toast.error(t('supplier.bulkFailedRows', { defaultValue: '실패 행:\n{{d}}{{more}}' })
          .replace('{{d}}', detail)
          .replace('{{more}}', failedRows.length > 8 ? `\n…외 ${failedRows.length - 8}건` : ''), { duration: 12000 } as never)
      }
      onBulkDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '대량 등록 실패')
    } finally { setUploading(false) }
  }

  // 재고 CSV 가져오기 (바코드,재고) — 즉시 반영(재고는 승인 대상 아님).
  const onStockFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setStockImporting(true)
    try {
      const csv = await file.text()
      const res = await supplierApi.post<{ summary?: { updated: number; skipped: number } }>('/api/supplier/products/stock-import', { csv })
      const s = res.summary
      toast.success(t('supplier.stockImportDone', { defaultValue: '{{u}}건 반영, {{s}}건 건너뜀', u: s?.updated ?? 0, s: s?.skipped ?? 0 })
        .replace('{{u}}', String(s?.updated ?? 0)).replace('{{s}}', String(s?.skipped ?? 0)))
      onBulkDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '재고 가져오기 실패')
    } finally { setStockImporting(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm text-gray-600">{t('supplier.catalogCount', { defaultValue: '총 {{n}}개', n: items.length }).replace('{{n}}', String(items.length))}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onBulkPrice}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">
            <Tag className="w-4 h-4" /> {t('supplier.bulkPriceChange', { defaultValue: '가격 일괄변경' })}
          </button>
          <button onClick={() => stockFileRef.current?.click()} disabled={stockImporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-60">
            <Upload className="w-4 h-4" /> {stockImporting ? t('common.loading', { defaultValue: '처리 중...' }) : t('supplier.stockImport', { defaultValue: '재고 CSV 가져오기' })}
          </button>
          <input ref={stockFileRef} type="file" accept=".csv,text/csv" hidden onChange={onStockFile} />
          <button onClick={() => downloadSupplierCsv('/api/supplier/products/bulk-template', 'supply-products-template.csv')}
            className="px-3 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">
            {t('supplier.dlTemplate', { defaultValue: '양식 다운' })}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="px-3 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-60">
            {uploading ? t('common.loading', { defaultValue: '처리 중...' }) : t('supplier.bulkUpload', { defaultValue: '대량 등록(CSV)' })}
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
          <button onClick={onAdd} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF0033] text-white text-sm font-semibold">
            <Plus className="w-4 h-4" /> {t('supplier.addProduct', { defaultValue: '공급상품 등록' })}
          </button>
        </div>
      </div>
      <p className="text-[11px] text-gray-400 mb-3">{t('supplier.stockImportHint', { defaultValue: '재고 CSV: 헤더 "바코드,재고" — 바코드로 내 공급상품을 매칭해 재고를 즉시 반영합니다.' })}</p>
      {items.length === 0 ? (
        /* 🧭 2026-06-10 (생애주기 감사 갭#5): 첫 상품 온보딩 — 빈 문구 한 줄 → 3단계 시작 카드 (NewSellerSteps 패턴) */
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-extrabold text-gray-900">👋 {t('supplier.onboardTitle', { defaultValue: '첫 상품을 올려볼까요?' })}</h3>
          <p className="text-xs text-gray-500 mt-0.5 mb-4">{t('supplier.onboardSub', { defaultValue: '상품이 승인되면 전국 유통사에게 등급 공급가로 노출됩니다' })}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button onClick={onAdd} className="text-left rounded-xl border border-gray-200 p-3 hover:bg-gray-50 transition-colors">
              <p className="text-[13px] font-bold text-gray-900">1. {t('supplier.onboardStep1', { defaultValue: '상품 직접 등록' })}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{t('supplier.onboardStep1Desc', { defaultValue: '상품명·공급가·재고만 있으면 1분' })}</p>
            </button>
            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-[13px] font-bold text-gray-900">2. {t('supplier.onboardStep2', { defaultValue: '여러 개면 CSV 한 번에' })}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{t('supplier.onboardStep2Desc', { defaultValue: '위 \'CSV 업로드\' 버튼 — 템플릿 제공' })}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-[13px] font-bold text-gray-900">3. {t('supplier.onboardStep3', { defaultValue: '승인 후 자동 노출' })}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{t('supplier.onboardStep3Desc', { defaultValue: '주문이 오면 홈 탭에 발송 대기로 떠요' })}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const badge = STATUS_BADGE[item.approval_status] || STATUS_BADGE.pending
            const Icon = badge.Icon
            const margin = item.retail_price - item.supply_price
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${badge.cls}`}>
                      <Icon className="w-3 h-3" /> {t(`supplier.status_${item.approval_status}`, { defaultValue: badge.label })}
                    </span>
                    {item.lowest_price_checked === 1 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-[11px] font-medium">
                        <ShieldCheck className="w-3 h-3" /> {t('supplier.lowestChecked', { defaultValue: '최저가 검수됨' })}
                      </span>
                    )}
                    {item.pending_supply_price != null && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-[11px] font-medium">
                        <Clock className="w-3 h-3" /> {t('supplier.priceChangePendingBadge', { defaultValue: '가격변경 승인 대기' })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {t('supplier.supplyPrice', { defaultValue: '공급가' })} <b className="text-gray-700">{formatWon(item.supply_price)}</b>
                    {' · '}{t('supplier.suggestedRetail', { defaultValue: '권장가' })} {formatWon(item.retail_price)}
                    {' · '}{t('supplier.stock', { defaultValue: '재고' })} {item.stock}
                  </p>
                  {item.pending_supply_price != null && (
                    <p className="text-xs text-amber-600 mt-1">
                      {t('supplier.priceChangeReqLine', { defaultValue: '요청한 공급가' })}: {formatWon(item.pending_supply_price)}
                      {item.pending_retail_price != null && ` / ${t('supplier.suggestedRetail', { defaultValue: '권장가' })} ${formatWon(item.pending_retail_price)}`}
                    </p>
                  )}
                  {item.approval_status === 'rejected' && item.admin_memo && (
                    <p className="text-xs text-red-500 mt-1">{t('supplier.rejectReason', { defaultValue: '거부 사유' })}: {item.admin_memo}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {item.supply_visibility === 'APPROVED_CHANNEL' && (
                      <button onClick={() => onManageChannel(item)} className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-700 border border-gray-300 rounded-lg px-2 py-1 hover:bg-gray-50">
                        <Package className="w-3 h-3" /> {t('supplier.manageChannel', { defaultValue: '승인 유통사 관리' })}
                      </button>
                    )}
                    {item.approval_status === 'approved' && item.pending_supply_price == null && (
                      <button onClick={() => onRequestPriceChange(item)} className="inline-flex items-center gap-1 text-[11px] font-medium text-[#FF0033] border border-[#FF0033]/30 rounded-lg px-2 py-1 hover:bg-[#FF0033]/5">
                        <Tag className="w-3 h-3" /> {t('supplier.requestPriceChange', { defaultValue: '가격 수정 요청' })}
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-gray-400">{t('supplier.marginLabel', { defaultValue: '셀러 마진 여력' })}</p>
                  <p className="text-sm font-semibold text-gray-700">{formatWon(margin)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
