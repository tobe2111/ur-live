import { useState, useRef, lazy, Suspense } from 'react'
import { Package, Plus, Clock, CheckCircle, XCircle, Tag, ShieldCheck, Upload, Download, Pencil } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'
import { supplierApi } from '@/lib/supplier-api'
import { downloadSupplierCsv } from './download-csv'
import { readTableFileAsCsv } from '@/lib/read-table-file'
import { uploadBulkProducts, BULK_ACCEPT } from './bulk-upload'
import type { CatalogItem } from './types'

// 📥 2026-06-12: 내 스토어(스마트스토어/쿠팡) 상품 가져오기 — lazy (안 쓰면 chunk 0).
const StoreImportModal = lazy(() => import('./StoreImportModal'))

const STATUS_BADGE: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  pending: { label: '승인 대기', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
  approved: { label: '승인됨', cls: 'bg-green-50 text-green-700 border-green-200', Icon: CheckCircle },
  rejected: { label: '거부됨', cls: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle },
}

export default function CatalogTab({ items, t, onAdd, onEdit, onBulkDone, onManageChannel, onRequestPriceChange, onBulkPrice }: { items: CatalogItem[]; t: (k: string, o?: Record<string, unknown>) => string; onAdd: () => void; onEdit: (item: CatalogItem) => void; onBulkDone: () => void; onManageChannel: (item: CatalogItem) => void; onRequestPriceChange: (item: CatalogItem) => void; onBulkPrice: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [stockImporting, setStockImporting] = useState(false)
  const [storeImportOpen, setStoreImportOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const stockFileRef = useRef<HTMLInputElement>(null)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      // 📥 2026-06-12: 공용 업로드 로직(bulk-upload.ts) — .xlsx/CP949 대응 + 실패 행 상세 토스트.
      //   AddProductModal 의 "엑셀 대량등록" 옵션과 동일 흐름 공유.
      await uploadBulkProducts(file, t)
      onBulkDone()
    } finally { setUploading(false) }
  }

  // 재고 CSV 가져오기 (바코드,재고) — 즉시 반영(재고는 승인 대상 아님).
  const onStockFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setStockImporting(true)
    try {
      const csv = await readTableFileAsCsv(file) // 📥 2026-06-12: 엑셀/CP949 대응
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
            <Upload className="w-4 h-4" /> {stockImporting ? t('common.loading', { defaultValue: '처리 중...' }) : t('supplier.stockImport', { defaultValue: '재고 가져오기(엑셀/CSV)' })}
          </button>
          <input ref={stockFileRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={onStockFile} />
          {/* 📥 2026-06-12: 기본 양식 = 진짜 .xlsx (사용자 요청 — 엑셀 우선. CSV 양식 endpoint 는 존치) */}
          <button onClick={() => downloadSupplierCsv('/api/supplier/products/bulk-template.xlsx', 'supply-products-template.xlsx')}
            className="px-3 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">
            {t('supplier.dlTemplate', { defaultValue: '양식 다운' })}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="px-3 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-60">
            {uploading ? t('common.loading', { defaultValue: '처리 중...' }) : t('supplier.bulkUpload', { defaultValue: '대량 등록(엑셀/CSV)' })}
          </button>
          {/* 📥 2026-06-12: 내 스토어 상품 가져오기 (스마트스토어/쿠팡 — 역방향 임포트). */}
          <button onClick={() => setStoreImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50">
            <Download className="w-4 h-4" /> {t('supplier.storeImportBtn2', { defaultValue: '내 스토어에서 가져오기' })}
          </button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={onFile} />
          <button onClick={onAdd} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FC5424] text-white text-sm font-semibold">
            <Plus className="w-4 h-4" /> {t('supplier.addProduct', { defaultValue: '공급상품 등록' })}
          </button>
        </div>
      </div>
      <p className="text-[11px] text-gray-400 mb-3">{t('supplier.stockImportHint', { defaultValue: '재고 파일(.xlsx/.csv): 헤더 "바코드,재고" — 바코드로 내 공급상품을 매칭해 재고를 즉시 반영합니다.' })}</p>
      {items.length === 0 ? (
        /* 🧭 2026-06-10 (생애주기 감사 갭#5): 첫 상품 온보딩 — 빈 문구 한 줄 → 3단계 시작 카드 (NewSellerSteps 패턴) */
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-extrabold text-gray-900">👋 {t('supplier.onboardTitle', { defaultValue: '첫 상품을 올려볼까요?' })}</h3>
          <p className="text-xs text-gray-500 mt-0.5 mb-4">{t('supplier.onboardSub', { defaultValue: '상품이 승인되면 전국 판매사에게 등급 공급가로 노출됩니다' })}</p>
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
            const stockNum = Number(item.stock) || 0
            const isLive = item.approval_status === 'approved'
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
                    {/* 🆕 2026-06-17 (재고 가시성): 노출 상품인데 품절/재고부족이면 경고 — 침묵 손실(주문불가) 방지. */}
                    {isLive && stockNum === 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-700 text-[11px] font-semibold">
                        ⚠ {t('supplier.outOfStock', { defaultValue: '품절 — 주문 불가' })}
                      </span>
                    )}
                    {isLive && stockNum > 0 && stockNum <= 10 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-[11px] font-semibold">
                        {t('supplier.lowStock', { defaultValue: '재고 부족' })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {t('supplier.supplyPrice', { defaultValue: '공급가' })} <b className="text-gray-700">{formatWon(item.supply_price)}</b>
                    {' · '}{t('supplier.suggestedRetail', { defaultValue: '권장가' })} {formatWon(item.retail_price)}
                    {' · '}{t('supplier.stock', { defaultValue: '재고' })} <b className={stockNum === 0 ? 'text-red-600' : stockNum <= 10 ? 'text-amber-600' : 'text-gray-700'}>{item.stock}</b>
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
                    {/* 🔧 2026-06-24 (전수조사 H1): 대기·거부 상품은 수정 후 재제출 가능(거부 막다른 길 해소). 승인 상품은 가격수정요청만. */}
                    {item.approval_status !== 'approved' && (
                      <button onClick={() => onEdit(item)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FC5424] border border-[#FC5424]/30 rounded-lg px-2 py-1 hover:bg-[#FC5424]/5">
                        <Pencil className="w-3 h-3" /> {item.approval_status === 'rejected' ? t('supplier.fixAndResubmit', { defaultValue: '수정 후 재제출' }) : t('supplier.editProductBtn', { defaultValue: '수정' })}
                      </button>
                    )}
                    {item.supply_visibility === 'APPROVED_CHANNEL' && (
                      <button onClick={() => onManageChannel(item)} className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-700 border border-gray-300 rounded-lg px-2 py-1 hover:bg-gray-50">
                        <Package className="w-3 h-3" /> {t('supplier.manageChannel', { defaultValue: '승인 판매사 관리' })}
                      </button>
                    )}
                    {item.approval_status === 'approved' && item.pending_supply_price == null && (
                      <button onClick={() => onRequestPriceChange(item)} className="inline-flex items-center gap-1 text-[11px] font-medium text-[#FC5424] border border-[#FC5424]/30 rounded-lg px-2 py-1 hover:bg-[#FC5424]/5">
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

      {/* 📥 내 스토어 상품 가져오기 — lazy 모달. */}
      {storeImportOpen && (
        <Suspense fallback={null}>
          <StoreImportModal t={t} onClose={() => setStoreImportOpen(false)} onImported={onBulkDone} />
        </Suspense>
      )}
    </div>
  )
}
