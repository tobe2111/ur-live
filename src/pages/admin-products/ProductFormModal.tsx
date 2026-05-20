import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Truck } from 'lucide-react'
import ImageUpload from '@/components/ImageUpload'
import ProductOptionForm, { ProductOption } from '@/components/ProductOptionForm'
import { EMPTY_FORM } from './types'
import type { Product } from './types'

type FormData = typeof EMPTY_FORM

interface ProductFormModalProps {
  open: boolean
  editingProduct: Product | null
  formData: FormData
  setFormData: (data: FormData) => void
  productOptions: ProductOption[]
  setProductOptions: (opts: ProductOption[]) => void
  error: string
  onClose: () => void
  onSubmit: (e: FormEvent) => void
}

export default function ProductFormModal({
  open, editingProduct, formData, setFormData,
  productOptions, setProductOptions, error, onClose, onSubmit,
}: ProductFormModalProps) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90dvh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#1A1A1A] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            {editingProduct ? t('admin.products.k048', { defaultValue: '상품 수정' }) : t('admin.products.k049', { defaultValue: '상품 등록' })}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              {t('admin.products.k022', { defaultValue: '상품명' })} <span className="text-red-500">*</span>
            </label>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('admin.products.k050', { defaultValue: '짧은 설명' })}</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('admin.products.k051', { defaultValue: '상세 설명' })}</label>
            <textarea value={formData.long_description} onChange={e => setFormData({ ...formData, long_description: e.target.value })} rows={6} className="w-full px-3 py-2 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                {t('admin.products.k052', { defaultValue: '판매가 (Ur 특가 노출)' })} <span className="text-red-500">*</span>
              </label>
              <input type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required min="0" placeholder="89000" className="w-full px-3 py-2 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('admin.products.k053', { defaultValue: '정가 (할인 전)' })}</label>
              <input type="number" value={formData.compare_at_price} onChange={e => setFormData({ ...formData, compare_at_price: e.target.value })} min="0" placeholder="149000" className="w-full px-3 py-2 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>

          <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={formData.is_supply_product}
                onChange={e => setFormData({ ...formData, is_supply_product: e.target.checked })}
                className="w-4 h-4 text-purple-600 rounded"
              />
              <span className="text-xs font-semibold text-purple-800 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" /> {t('admin.products.supplyRegister', { defaultValue: '셀러 공급 상품으로 등록' })}
              </span>
            </label>
            {formData.is_supply_product && (
              <div>
                <label className="block text-xs font-medium text-purple-700 mb-1.5">{t('admin.products.k054', { defaultValue: '공급가 (셀러에게만 노출)' })}</label>
                <input
                  type="number"
                  value={formData.supply_price}
                  onChange={e => setFormData({ ...formData, supply_price: e.target.value })}
                  min="0"
                  placeholder="55000"
                  className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                />
                <p className="text-xs text-purple-600 mt-1">{t('admin.products.k055', { defaultValue: '셀러가 샘플 신청 후 승인되면 공급가로 상품을 등록해 판매할 수 있습니다.' })}</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              {t('admin.products.k056', { defaultValue: '재고 수량' })} <span className="text-red-500">*</span>
            </label>
            <input type="number" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} required min="0" placeholder="50" className="w-full px-3 py-2 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('admin.products.k057', { defaultValue: '대표 이미지' })}</label>
            <ImageUpload value={formData.image_url} onChange={url => setFormData({ ...formData, image_url: url })} label="" maxSizeKB={800} />
            <input type="url" value={formData.image_url} onChange={e => setFormData({ ...formData, image_url: e.target.value })} placeholder={t('admin.products.k058', { defaultValue: '또는 이미지 URL 직접 입력' })} className="w-full px-3 py-2 mt-2 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('admin.products.k059', { defaultValue: '상세 이미지 (최대 4장)' })}</label>
            <div className="space-y-2">
              {formData.detail_images.map((url, i) => (
                <input key={i} type="url" value={url} onChange={e => { const imgs = [...formData.detail_images]; imgs[i] = e.target.value; setFormData({ ...formData, detail_images: imgs }) }} placeholder={`${t('admin.products.k059', { defaultValue: '상세 이미지' })} ${i + 1} URL`} className="w-full px-3 py-2 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                {t('admin.products.k060', { defaultValue: '카테고리' })} <span className="text-red-500">*</span>
              </label>
              <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                {[
                  ['fashion', t('admin.products.k061', { defaultValue: '패션' })],
                  ['beauty', t('admin.products.k062', { defaultValue: '뷰티' })],
                  ['food', t('admin.products.k063', { defaultValue: '식품' })],
                  ['electronics', t('admin.products.k064', { defaultValue: '전자기기' })],
                  ['lifestyle', t('admin.products.k065', { defaultValue: '라이프스타일' })],
                ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                {t('admin.products.k066', { defaultValue: '상품 타입' })} <span className="text-red-500">*</span>
              </label>
              <select value={formData.product_type} onChange={e => setFormData({ ...formData, product_type: e.target.value as 'live' | 'featured' })} required className="w-full px-3 py-2 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="featured">{t('admin.products.k067', { defaultValue: 'Ur 특가 (메인 페이지 노출)' })}</option>
                <option value="live">{t('admin.products.k068', { defaultValue: '라이브 방송 전용' })}</option>
              </select>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 dark:border-[#2A2A2A]">
            <ProductOptionForm options={productOptions} onChange={setProductOptions} disabled={false} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
              {t('admin.products.k069', { defaultValue: '취소' })}
            </button>
            <button type="submit" className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700">
              {editingProduct ? t('admin.products.k070', { defaultValue: '수정' }) : t('admin.products.k071', { defaultValue: '등록' })}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
