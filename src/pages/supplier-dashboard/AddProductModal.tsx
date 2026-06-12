import { useState, useRef } from 'react'
import { X, FileSpreadsheet, Download, Upload, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { supplierApi } from '@/lib/supplier-api'
import { WHOLESALE_CATEGORIES } from '../wholesale/wholesale-theme'
import SupplyChannelGuide from './SupplyChannelGuide'
import NaverPriceCheck from './NaverPriceCheck'
import DemandSignal from './DemandSignal'
import { uploadBulkProducts, BULK_ACCEPT } from './bulk-upload'
import { downloadSupplierCsv } from './download-csv'

export default function AddProductModal({ t, onClose, onCreated }: { t: (k: string, o?: Record<string, unknown>) => string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', supply_price: '', suggested_retail_price: '', stock: '', min_order_qty: '', pack_size: '', order_multiple: '', category: 'lifestyle', image_url: '', detail_images: '', supply_visibility: 'ALL', barcode: '', is_brand_product: false, brand_name: '', brand_logo_url: '', lowest_price_url: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // 📥 2026-06-12 (사용자 요청): 등록 진입점에서 대량등록 옵션 선택 가능 — CatalogTab 과 동일 흐름 공유.
  const [bulkUploading, setBulkUploading] = useState(false)
  const bulkRef = useRef<HTMLInputElement>(null)
  const onBulkFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBulkUploading(true)
    try {
      const ok = await uploadBulkProducts(file, t)
      if (ok) onCreated() // 1건이라도 등록되면 목록 갱신 + 모달 닫기
    } finally { setBulkUploading(false) }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const supply = Number(form.supply_price)
    const retail = Number(form.suggested_retail_price || form.supply_price)
    if (!form.name.trim()) { setError(t('supplier.errName', { defaultValue: '상품명을 입력해주세요' })); return }
    if (!Number.isFinite(supply) || supply <= 0) { setError(t('supplier.errSupply', { defaultValue: '공급가를 올바르게 입력해주세요' })); return }
    if (retail < supply) { setError(t('supplier.errRetail', { defaultValue: '권장 소비자가는 공급가 이상이어야 합니다' })); return }
    setSaving(true)
    try {
      await supplierApi.post('/api/supplier/products', {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        supply_price: supply,
        suggested_retail_price: retail,
        stock: Number(form.stock) || 0,
        min_order_qty: Number(form.min_order_qty) || 1,
        pack_size: Number(form.pack_size) || 1,
        order_multiple: Number(form.order_multiple) || 1,
        category: form.category,
        image_url: form.image_url.trim() || undefined,
        detail_images: form.detail_images.trim() || undefined, // 🖼️ 쉼표 구분 여러 장 — 서버가 JSON 배열로 정규화
        supply_visibility: form.supply_visibility,
        barcode: form.barcode.trim() || undefined,
        is_brand_product: form.is_brand_product,
        brand_name: form.is_brand_product ? (form.brand_name.trim() || undefined) : undefined,
        brand_logo_url: form.is_brand_product ? (form.brand_logo_url.trim() || undefined) : undefined,
        lowest_price_url: form.lowest_price_url.trim() || undefined,
      })
      toast.success(t('supplier.productCreated', { defaultValue: '상품이 등록되었습니다. 승인 후 노출됩니다.' }))
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#FF0033]/30 focus:border-[#FF0033] outline-none"
  const labelCls = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">{t('supplier.addProduct', { defaultValue: '공급상품 등록' })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        {/* 📥 2026-06-12 (사용자 요청): 대량등록 옵션 — 여러 상품이면 엑셀 한 번에. */}
        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-[12.5px] font-bold text-gray-700 flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            {t('supplier.bulkOptionTitle', { defaultValue: '여러 상품이면 엑셀로 한 번에 등록하세요' })}
          </p>
          <div className="flex gap-2 mt-2">
            <button type="button" disabled={bulkUploading}
              onClick={() => downloadSupplierCsv('/api/supplier/products/bulk-template.xlsx', 'supply-products-template.xlsx')}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-[12px] font-semibold hover:bg-gray-50">
              <Download className="w-3.5 h-3.5" /> {t('supplier.bulkOptionTemplate', { defaultValue: '엑셀 양식 받기' })}
            </button>
            <button type="button" disabled={bulkUploading} onClick={() => bulkRef.current?.click()}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-gray-900 text-white text-[12px] font-semibold disabled:opacity-60">
              {bulkUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {t('supplier.bulkOptionUpload', { defaultValue: '작성한 엑셀 업로드' })}
            </button>
            <input ref={bulkRef} type="file" accept={BULK_ACCEPT} hidden onChange={onBulkFile} />
          </div>
          <p className="text-[10.5px] text-gray-400 mt-1.5">{t('supplier.bulkOptionHint', { defaultValue: '.xlsx 그대로 업로드 가능 · 한글 깨짐 자동 복구 · 최대 2,000행' })}</p>
        </div>

        {error && <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={labelCls}>{t('supplier.fieldName', { defaultValue: '상품명' })} <span className="text-red-500">*</span></label>
            <input required disabled={saving} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('supplier.fieldDesc', { defaultValue: '설명' })}</label>
            <textarea disabled={saving} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('supplier.fieldSupplyPrice', { defaultValue: '공급가(원)' })} <span className="text-red-500">*</span></label>
              <input required type="number" min={1} disabled={saving} value={form.supply_price} onChange={e => setForm(f => ({ ...f, supply_price: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('supplier.fieldRetail', { defaultValue: '권장 소비자가(원)' })}</label>
              <input type="number" min={0} disabled={saving} value={form.suggested_retail_price} onChange={e => setForm(f => ({ ...f, suggested_retail_price: e.target.value }))} className={inputCls} />
            </div>
          </div>
          {/* 🏭 2026-06-12 (영업단 제안): 공급률 실시간 안내 — 낮출수록 더 많은 채널 잠금해제.
              권장가 미입력 시엔 입력 유도 한 줄만(공급가 폴백을 쓰면 공급률 100% 로 오해 유발). */}
          <SupplyChannelGuide t={t} supplyPrice={form.supply_price} retailPrice={form.suggested_retail_price} />
          {/* 🛒 2026-06-12 (사용자 요청): 시중(네이버쇼핑) 최저가 대조 — 키 미설정 시 자동 숨김. */}
          <NaverPriceCheck t={t} name={form.name} supplyPrice={form.supply_price} retailPrice={form.suggested_retail_price} />
          {/* 📊 2026-06-12 (사용자 요청 ②④): 수요 신호 — 클릭 추이 + 시즌성. 신호 없으면 자연 숨김. */}
          <DemandSignal t={t} name={form.name} category={form.category} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('supplier.fieldStock', { defaultValue: '재고' })}</label>
              <input type="number" min={0} disabled={saving} value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('supplier.fieldCategory', { defaultValue: '카테고리' })}</label>
              {/* 🏭 2026-06-04 카테고리 표준화 — 자유 입력 → 도매몰 표준 카테고리 select.
                  카탈로그 필터(WHOLESALE_CATEGORIES)와 값 일치 → 유통사 카테고리 필터가 항상 동작. */}
              <select disabled={saving} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                {WHOLESALE_CATEGORIES.filter(c => c.id !== 'all').map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          {/* 🏭 BIZ-8 (2026-06-08) MOQ / 박스당 수량 / 주문 배수 — 수량 제약(가격과 무관). */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>{t('supplier.fieldMoq', { defaultValue: '최소 주문 수량 (MOQ)' })}</label>
              <input type="number" min={1} disabled={saving} value={form.min_order_qty} onChange={e => setForm(f => ({ ...f, min_order_qty: e.target.value }))} className={inputCls} placeholder="1" />
            </div>
            <div>
              <label className={labelCls}>{t('supplier.fieldPackSize', { defaultValue: '박스당 수량' })}</label>
              <input type="number" min={1} disabled={saving} value={form.pack_size} onChange={e => setForm(f => ({ ...f, pack_size: e.target.value }))} className={inputCls} placeholder="1" />
            </div>
            <div>
              <label className={labelCls}>{t('supplier.fieldOrderMultiple', { defaultValue: '주문 단위(배수)' })}</label>
              <input type="number" min={1} disabled={saving} value={form.order_multiple} onChange={e => setForm(f => ({ ...f, order_multiple: e.target.value }))} className={inputCls} placeholder="1" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 -mt-1">{t('supplier.qtyConstraintHint', { defaultValue: 'MOQ=최소 주문 수량 · 박스당 수량=1박스 낱개 수(표시용) · 주문 단위=이 배수로만 주문 가능(예: 12면 12·24·36…). 비우면 모두 1.' })}</p>
          <div>
            <label className={labelCls}>{t('supplier.fieldImage', { defaultValue: '썸네일(대표) 이미지 URL' })}</label>
            <input disabled={saving} value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} className={inputCls} placeholder="https://..." />
          </div>
          {/* 🖼️ 2026-06-12 (사용자 요청): 썸네일과 상세페이지 이미지 분리. */}
          <div>
            <label className={labelCls}>{t('supplier.fieldDetailImages', { defaultValue: '상세페이지 이미지 URL (쉼표로 여러 장, 최대 10)' })}</label>
            <textarea disabled={saving} rows={2} value={form.detail_images} onChange={e => setForm(f => ({ ...f, detail_images: e.target.value }))} className={inputCls} placeholder="https://.../detail1.jpg, https://.../detail2.jpg" />
            <p className="text-[11px] text-gray-400 mt-1">{t('supplier.detailImagesHint', { defaultValue: '상품 상세 페이지의 설명 아래에 순서대로 표시됩니다.' })}</p>
          </div>
          <div>
            <label className={labelCls}>{t('supplier.fieldLowestUrl', { defaultValue: '온라인 최저가 참고 링크' })}</label>
            <input disabled={saving} value={form.lowest_price_url} onChange={e => setForm(f => ({ ...f, lowest_price_url: e.target.value }))} className={inputCls} placeholder="https://search.shopping.naver.com/..." />
            <p className="text-[11px] text-gray-400 mt-1">{t('supplier.lowestUrlSubmitHint', { defaultValue: '운영진이 온라인 최저가 여부를 검수합니다. 네이버쇼핑 등 비교 링크를 입력해주세요.' })}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('supplier.fieldBarcode', { defaultValue: '바코드 (오프라인 판로)' })}</label>
              <input disabled={saving} value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} className={inputCls} placeholder="8801234567890" />
            </div>
            <div>
              <label className={labelCls}>{t('supplier.fieldVisibility', { defaultValue: '공급 범위' })}</label>
              <select disabled={saving} value={form.supply_visibility} onChange={e => setForm(f => ({ ...f, supply_visibility: e.target.value }))} className={inputCls}>
                <option value="ALL">{t('supplier.visAll', { defaultValue: '전체공급 (모든 유통사)' })}</option>
                <option value="APPROVED_CHANNEL">{t('supplier.visApproved', { defaultValue: '승인한 유통채널만' })}</option>
                <option value="UTONGSTART_ONLY">{t('supplier.visUtong', { defaultValue: '유통스타트 유통채널 (선정 유통사)' })}</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" disabled={saving} checked={form.is_brand_product} onChange={e => setForm(f => ({ ...f, is_brand_product: e.target.checked }))} className="w-4 h-4" />
            {t('supplier.fieldBrand', { defaultValue: '브랜드제품 (판매 후 당일 정산)' })}
          </label>
          <p className="text-[11px] text-gray-400 -mt-1">{t('supplier.brandHint', { defaultValue: '체크 시 판매 후 당일 정산, 미체크 시 일반제품(7일 환불창 후 정산).' })}</p>
          {/* 🏷️ 브랜드 전시관 — 브랜드제품 체크 시에만 브랜드명 입력(브랜드 전시관 그리드에 노출). */}
          {form.is_brand_product && (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>{t('supplier.fieldBrandName', { defaultValue: '브랜드명' })}</label>
                <input disabled={saving} value={form.brand_name} onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))} className={inputCls} placeholder={t('supplier.fieldBrandNamePh', { defaultValue: '예: 코카콜라, 농심' })} maxLength={120} />
                <p className="text-[11px] text-gray-400 mt-1">{t('supplier.brandNameHint', { defaultValue: '도매몰 브랜드 전시관에 이 브랜드로 묶여 노출됩니다.' })}</p>
              </div>
              <div>
                <label className={labelCls}>{t('supplier.fieldBrandLogoUrl', { defaultValue: '브랜드 로고 URL (선택)' })}</label>
                <input disabled={saving} value={form.brand_logo_url} onChange={e => setForm(f => ({ ...f, brand_logo_url: e.target.value }))} className={inputCls} placeholder="https://..." maxLength={1000} />
                <p className="text-[11px] text-gray-400 mt-1">{t('supplier.brandLogoUrlHint', { defaultValue: '브랜드 전시관 그리드에 텍스트 대신 로고 이미지로 표시됩니다. 비워두면 텍스트 칩으로 표시.' })}</p>
              </div>
            </div>
          )}
          <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-[#FF0033] text-white font-semibold text-sm disabled:opacity-60 mt-2">
            {saving ? t('common.loading', { defaultValue: '처리 중...' }) : t('supplier.submitProduct', { defaultValue: '등록 신청' })}
          </button>
        </form>
      </div>
    </div>
  )
}
