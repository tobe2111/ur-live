import { useState, useRef } from 'react'
import { X, FileSpreadsheet, Download, Upload, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { supplierApi } from '@/lib/supplier-api'
import { WHOLESALE_CATEGORIES } from '../wholesale/wholesale-theme'
import { categoryCodePrefix } from '@/shared/wholesale-category-codes'
import SupplyChannelGuide from './SupplyChannelGuide'
import NaverPriceCheck from './NaverPriceCheck'
import DemandSignal from './DemandSignal'
import { uploadBulkProducts, BULK_ACCEPT } from './bulk-upload'
import { downloadSupplierCsv } from './download-csv'
import MultiImageUpload from './MultiImageUpload'
import type { CatalogItem } from './types'

export default function AddProductModal({ t, onClose, onCreated, editItem }: { t: (k: string, o?: Record<string, unknown>) => string; onClose: () => void; onCreated: () => void; editItem?: CatalogItem }) {
  // 🔧 2026-06-24 (전수조사 H1): 거부/대기 상품 수정·재제출 — 기존엔 PATCH 엔드포인트만 있고 UI 없어 거부 상품이 막다른 길이었음.
  //   editItem 있으면 prefill + PATCH(재제출 → pending). detail_images 는 GET /products 가 반환 안 하고 PATCH 도 미처리 → 수정모드에서 숨김(유실 방지).
  const isEdit = !!editItem
  const [form, setForm] = useState(() => isEdit && editItem ? {
    name: editItem.name || '', description: editItem.description || '',
    supply_price: String(editItem.supply_price ?? ''), suggested_retail_price: String(editItem.retail_price ?? ''),
    stock: String(editItem.stock ?? ''), min_order_qty: editItem.min_order_qty ? String(editItem.min_order_qty) : '',
    pack_size: editItem.pack_size ? String(editItem.pack_size) : '', order_multiple: editItem.order_multiple ? String(editItem.order_multiple) : '',
    shipping_fee: '', category: editItem.category || 'lifestyle', image_url: editItem.image_url || '', detail_images: '',
    supply_visibility: editItem.supply_visibility || 'ALL', barcode: editItem.barcode || '',
    is_brand_product: !!editItem.is_brand_product, brand_name: editItem.brand_name || '', brand_logo_url: editItem.brand_logo_url || '',
    lowest_price_url: editItem.lowest_price_url || '', product_code: (editItem as { product_code?: string }).product_code || '',
  } : { name: '', description: '', supply_price: '', suggested_retail_price: '', stock: '', min_order_qty: '', pack_size: '', order_multiple: '', shipping_fee: '', category: 'food', image_url: '', detail_images: '', supply_visibility: 'ALL', barcode: '', is_brand_product: false, brand_name: '', brand_logo_url: '', lowest_price_url: '', product_code: '' })
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
    // 🆕 2026-06-16 신모델: 권장 소비자가(판매가) 필수 — 폴백 제거. 유통 마진이 (판매가−공급가) 에서 나옴.
    const retail = Number(form.suggested_retail_price)
    if (!form.name.trim()) { setError(t('supplier.errName', { defaultValue: '상품명을 입력해주세요' })); return }
    if (!Number.isFinite(supply) || supply <= 0) { setError(t('supplier.errSupply', { defaultValue: '공급가를 올바르게 입력해주세요' })); return }
    if (!form.suggested_retail_price || !Number.isFinite(retail) || retail <= supply) { setError(t('supplier.errRetail', { defaultValue: '권장 소비자가(판매가)는 공급가보다 높아야 합니다 — 유통 마진이 여기서 나옵니다' })); return }
    setSaving(true)
    try {
      // 🔧 공통 payload. 수정 모드는 detail_images 제외(PATCH 미처리·GET 미반환 → 유실/혼동 방지).
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        supply_price: supply,
        suggested_retail_price: retail,
        stock: Number(form.stock) || 0,
        min_order_qty: Number(form.min_order_qty) || 1,
        pack_size: Number(form.pack_size) || 1,
        order_multiple: Number(form.order_multiple) || 1,
        shipping_fee: form.shipping_fee !== '' ? Math.max(0, Math.floor(Number(form.shipping_fee))) : undefined,
        category: form.category,
        image_url: form.image_url.trim() || undefined,
        supply_visibility: form.supply_visibility,
        barcode: form.barcode.trim() || undefined,
        is_brand_product: form.is_brand_product,
        brand_name: form.brand_name.trim() || undefined,
        brand_logo_url: form.is_brand_product ? (form.brand_logo_url.trim() || undefined) : undefined,
        lowest_price_url: form.lowest_price_url.trim() || undefined,
        product_code: form.product_code.trim() || undefined, // 🏭 #8 상품코드(카테고리 접두 자동) — 서버에서 정규화
      }
      if (isEdit && editItem) {
        await supplierApi.patch(`/api/supplier/products/${editItem.id}`, payload)
        toast.success(t('supplier.productUpdated', { defaultValue: '수정되었습니다. 다시 승인 대기 상태가 됩니다.' }))
      } else {
        payload.detail_images = form.detail_images.trim() || undefined // 🖼️ 쉼표 구분 여러 장 — 서버가 JSON 배열로 정규화
        await supplierApi.post('/api/supplier/products', payload)
        toast.success(t('supplier.productCreated', { defaultValue: '상품이 등록되었습니다. 승인 후 노출됩니다.' }))
      }
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#FC5424]/30 focus:border-[#FC5424] outline-none"
  const labelCls = "block text-xs font-medium text-gray-600 mb-1"
  // 🏭 #8 카테고리 접두(식품 FD/리빙 LV/건강 HT) — 상품코드 입력 도우미.
  const codePrefix = categoryCodePrefix(form.category)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">{isEdit ? t('supplier.editProduct', { defaultValue: '공급상품 수정' }) : t('supplier.addProduct', { defaultValue: '공급상품 등록' })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        {isEdit && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-800">
            {t('supplier.editResubmitHint', { defaultValue: '수정 후 저장하면 다시 승인 대기 상태가 됩니다.' })}
          </div>
        )}
        {/* 📥 2026-06-12 (사용자 요청): 대량등록 옵션 — 여러 상품이면 엑셀 한 번에. (수정 모드 숨김) */}
        {!isEdit && (
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
        )}

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
              <label className={labelCls}>{t('supplier.fieldRetail', { defaultValue: '권장 소비자가(원)' })} <span className="text-red-500">*</span></label>
              <input required type="number" min={1} disabled={saving} value={form.suggested_retail_price} onChange={e => setForm(f => ({ ...f, suggested_retail_price: e.target.value }))} className={inputCls} />
            </div>
          </div>
          {/* 🏭 2026-06-29 (대표 #6): 마진율(%) 직접 입력 — 입력 시 공급가 기준으로 판매가 자동 계산.
              저장은 기존대로 공급가/판매가(정산 엔진 불변). 판매가를 직접 입력해도 됨(양방향). */}
          <div>
            <label className={labelCls}>{t('supplier.fieldMargin', { defaultValue: '판매 마진율 (%)' })} <span className="text-gray-400 font-normal">{t('supplier.fieldMarginNote', { defaultValue: '· 공급가·판매가와 자동 연동' })}</span></label>
            <input type="number" min={0} max={99} disabled={saving}
              value={(() => { const s = Number(form.supply_price), r = Number(form.suggested_retail_price); return (Number.isFinite(s) && Number.isFinite(r) && r > s && r > 0) ? String(Math.round(((r - s) / r) * 100)) : '' })()}
              onChange={e => { const m = Number(e.target.value); const s = Number(form.supply_price); if (Number.isFinite(m) && m >= 0 && m < 100 && Number.isFinite(s) && s > 0) setForm(f => ({ ...f, suggested_retail_price: String(Math.round(s / (1 - m / 100))) })) }}
              className={inputCls} placeholder={t('supplier.fieldMarginPh', { defaultValue: '예: 30' })} />
            <p className="text-[11px] text-gray-400 mt-1">{t('supplier.marginHint', { defaultValue: '마진율을 입력하면 공급가 기준 권장 판매가가 자동 계산됩니다 (판매가 대비 마진).' })}</p>
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
                  카탈로그 필터(WHOLESALE_CATEGORIES)와 값 일치 → 판매사 카테고리 필터가 항상 동작. */}
              <select disabled={saving} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                {WHOLESALE_CATEGORIES.filter(c => c.id !== 'all').map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          {/* 🏭 2026-06-29 (대표 #8): 상품코드 — 카테고리 접두(식품 FD·리빙 LV·건강 HT)로 시작. 대량발주 매칭 코드. */}
          <div>
            <label className={labelCls}>{t('supplier.fieldProductCode', { defaultValue: '상품코드' })} <span className="text-gray-400 font-normal">{t('supplier.fieldProductCodeNote', { defaultValue: '· 대량발주 매칭용' })}</span></label>
            <div className="flex items-stretch">
              {codePrefix && <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-sm font-bold text-gray-600">{codePrefix}</span>}
              <input disabled={saving} value={form.product_code} onChange={e => setForm(f => ({ ...f, product_code: e.target.value }))} maxLength={60}
                className={codePrefix ? inputCls + ' rounded-l-none' : inputCls} placeholder={codePrefix ? '0001' : '예: FD0001'} />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">{t('supplier.productCodeHint', { defaultValue: '카테고리 접두(식품 FD·리빙 LV·건강 HT)로 시작합니다. 접두 없이 입력하면 자동으로 붙어요. 대량발주 엑셀에서 이 코드로 상품을 매칭합니다.' })}</p>
          </div>
          {/* 🏷️ 2026-06-17 (대표 요청): 브랜드명 상시 노출 — 모든 상품 등록 시 입력 가능(선택). */}
          <div>
            <label className={labelCls}>{t('supplier.fieldBrandName', { defaultValue: '브랜드명' })} <span className="text-gray-400 font-normal">(선택)</span></label>
            <input disabled={saving} value={form.brand_name} onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))} className={inputCls} placeholder={t('supplier.fieldBrandNamePh', { defaultValue: '예: 코카콜라, 농심' })} maxLength={120} />
            <p className="text-[11px] text-gray-400 mt-1">{t('supplier.brandNameHint2', { defaultValue: '입력 시 도매몰 브랜드 전시관에 이 브랜드로 묶여 노출됩니다.' })}</p>
          </div>
          {/* 🚚 2026-06-15 (대표 요청): 상품별 배송비 — 비우면 제조사 기본 배송정책, 0 입력 시 무료배송. */}
          <div>
            <label className={labelCls}>{t('supplier.fieldShippingFee', { defaultValue: '배송비 (원)' })}</label>
            <input type="number" min={0} disabled={saving} value={form.shipping_fee} onChange={e => setForm(f => ({ ...f, shipping_fee: e.target.value }))} className={inputCls} placeholder={t('supplier.fieldShippingFeePh', { defaultValue: '예: 3000 · 0 = 무료배송' })} />
            <p className="text-[11px] text-gray-400 mt-1">{t('supplier.shippingFeeHint', { defaultValue: '이 상품의 배송비입니다. 비우면 내 기본 배송정책을 따르고, 0 입력 시 무료배송. 같은 제조사 묶음배송은 가장 높은 배송비 1회만 청구됩니다.' })}</p>
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
          {/* 🧩 2026-06-17 (입점폼 간소화): 부가 항목은 접어서 첫 등록 마찰 감소. 안의 값은 그대로 제출됨. */}
          <details className="border border-gray-200 rounded-xl">
            <summary className="cursor-pointer select-none text-sm font-semibold text-gray-700 px-3 py-2.5">⚙️ {t('supplier.moreFields', { defaultValue: '더보기 — 상세이미지 · 최저가 링크 · 바코드 · 공급범위 · 브랜드' })}</summary>
            <div className="px-3 pb-3 space-y-3">
          {/* 🖼️ 2026-06-13 (사용자 요청): 상세페이지 이미지 — 세로로 긴 사진·GIF 다수 직접 업로드(무압축 원본). (수정 모드는 PATCH 미처리라 숨김) */}
          {!isEdit && (
          <div>
            <label className={labelCls}>{t('supplier.fieldDetailImages2', { defaultValue: '상세페이지 이미지 (여러 장·GIF 가능)' })}</label>
            <MultiImageUpload value={form.detail_images} onChange={(v) => setForm(f => ({ ...f, detail_images: v }))} t={t} />
          </div>
          )}
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
                <option value="ALL">{t('supplier.visAll', { defaultValue: '전체공급 (모든 판매사)' })}</option>
                <option value="APPROVED_CHANNEL">{t('supplier.visApproved', { defaultValue: '승인한 유통채널만' })}</option>
                <option value="UTONGSTART_ONLY">{t('supplier.visUtong', { defaultValue: '유통스타트 유통채널 (선정 판매사)' })}</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" disabled={saving} checked={form.is_brand_product} onChange={e => setForm(f => ({ ...f, is_brand_product: e.target.checked }))} className="w-4 h-4" />
            {t('supplier.fieldBrand', { defaultValue: '브랜드제품 (판매 후 당일 정산)' })}
          </label>
          <p className="text-[11px] text-gray-400 -mt-1">{t('supplier.brandHint', { defaultValue: '체크 시 판매 후 당일 정산, 미체크 시 일반제품(7일 환불창 후 정산).' })}</p>
          {/* 🏷️ 브랜드제품 체크 시 로고만 추가 입력(브랜드명은 위에서 상시 입력). */}
          {form.is_brand_product && (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>{t('supplier.fieldBrandLogoUrl', { defaultValue: '브랜드 로고 URL (선택)' })}</label>
                <input disabled={saving} value={form.brand_logo_url} onChange={e => setForm(f => ({ ...f, brand_logo_url: e.target.value }))} className={inputCls} placeholder="https://..." maxLength={1000} />
                <p className="text-[11px] text-gray-400 mt-1">{t('supplier.brandLogoUrlHint', { defaultValue: '브랜드 전시관 그리드에 텍스트 대신 로고 이미지로 표시됩니다. 비워두면 텍스트 칩으로 표시.' })}</p>
              </div>
            </div>
          )}
            </div>
          </details>
          <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-[#FC5424] text-white font-semibold text-sm disabled:opacity-60 mt-2">
            {saving ? t('common.loading', { defaultValue: '처리 중...' }) : isEdit ? t('supplier.saveEdit', { defaultValue: '수정 저장 (재승인 요청)' }) : t('supplier.submitProduct', { defaultValue: '등록 신청' })}
          </button>
        </form>
      </div>
    </div>
  )
}
