import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import ImageUpload from '@/components/ImageUpload'
import ProductOptionForm, { ProductOption } from '@/components/ProductOptionForm'
import {
  ArrowLeft,
  Package,
  Loader2,
  Box,
  FileText,
  Play,
  Image as ImageIcon,
  Tag,
  X,
  Camera,
} from 'lucide-react'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { StickyActionBar } from '@/components/ui/sticky-action-bar'

import type { LiveStream, ProductFormData } from './seller-product-new/types'
import DigitalProductSection from './seller-product-new/DigitalProductSection'
import MealVoucherFields from './seller-product-new/MealVoucherFields'
import LivePriceSection from './seller-product-new/LivePriceSection'
import FormSection from './seller-product-new/FormSection'
import BulkUploadTools from './seller-product-new/BulkUploadTools'
import ProductPreviewRail from './seller-product-new/ProductPreviewRail'

const FORM_ID = 'seller-product-new-form'

export default function SellerProductNewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // 🛡️ 2026-06-03 Tier2(대시보드): mount 페칭 → useApiQuery (/api/seller prefix 토큰 자동 주입).
  const streamsQ = useApiQuery<LiveStream[]>(['seller', 'product-new-streams'], '/api/seller/streams', { select: (r: any) => (r?.success ? r.data || [] : []) })
  const liveStreams = streamsQ.data ?? []

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    long_description: '',
    price: '',
    stock: '',
    image_url: '',
    live_stream_id: '',
    live_only_price: '',
    live_price_enabled: false,
    product_type: 'live',
    category: 'lifestyle',
    product_kind: 'physical',
    delivery_type: 'shipping',
    content_url: '',
    content_format: '',
    access_duration_days: '',
    preview_url: '',
  })

  const [productOptions, setProductOptions] = useState<ProductOption[]>([])

  useEffect(() => {
    if (!localStorage.getItem('seller_token')) navigate('/seller/login')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const categoryOptions: { value: string; label: string }[] = [
    { value: 'fashion', label: t('common.fashion') },
    { value: 'beauty', label: t('common.beauty') },
    { value: 'food', label: t('common.food') },
    { value: 'electronics', label: t('common.electronics') },
    { value: 'lifestyle', label: t('common.lifestyle') },
    { value: 'meal_voucher', label: t('seller.products.mealVoucherCategory') },
  ]
  const categoryLabel = categoryOptions.find(c => c.value === formData.category)?.label || ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!formData.name?.trim()) { setError(t('seller.products.enterProductName')); return }
    if (!formData.price || Number(formData.price) <= 0) { setError(t('seller.products.priceAboveZero')); return }
    if (Number(formData.price) > 100000000) { setError(t('seller.products.priceTooHigh')); return }
    const isDigital = formData.product_kind !== 'physical'
    if (!isDigital && Number(formData.stock) < 0) { setError(t('seller.products.stockAboveZero')); return }
    if (isDigital && !formData.content_url?.trim()) { setError(t('seller.products.digitalContentUrlRequired', { defaultValue: '디지털 상품의 콘텐츠 URL을 입력해주세요' })); return }

    setLoading(true)
    try {
      const sessionToken = localStorage.getItem('seller_token')
      if (!sessionToken) { navigate('/seller/login'); return }

      const extra = formData as unknown as Record<string, string>
      const payload: Record<string, unknown> = {
        name: formData.name,
        description: formData.description,
        long_description: formData.long_description || undefined,
        price: Number(formData.price),
        stock: isDigital ? 999999 : Number(formData.stock),
        image_url: formData.image_url,
        live_stream_id: formData.live_stream_id ? Number(formData.live_stream_id) : null,
        live_only_price: formData.live_only_price ? Number(formData.live_only_price) : null,
        live_price_enabled: formData.live_price_enabled,
        product_type: formData.product_type,
        category: formData.category,
        product_kind: formData.product_kind,
        delivery_type: isDigital ? formData.delivery_type : 'shipping',
        content_url: isDigital ? formData.content_url : null,
        content_format: isDigital ? formData.content_format : null,
        access_duration_days: isDigital && formData.access_duration_days ? Number(formData.access_duration_days) : null,
        preview_url: isDigital ? formData.preview_url || null : null,
        ...(formData.category === 'meal_voucher' ? {
          restaurant_name: extra.restaurant_name || null,
          restaurant_address: extra.restaurant_address || null,
          restaurant_phone: extra.restaurant_phone || null,
          voucher_terms: extra.voucher_terms || null,
          voucher_expiry: extra.voucher_expiry || null,
          group_buy_target: Number(extra.group_buy_target) || 0,
          group_buy_deadline: extra.group_buy_deadline || null,
          store_verify_pin: extra.store_verify_pin || null,
        } : {}),
      }

      const response = await api.post('/api/seller/products', payload, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      if (response.data.success) {
        const productId = response.data.data?.id || response.data.data?.productId
        if (productOptions.length > 0 && productId) {
          try {
            await api.post(`/api/seller/products/${productId}/options`, {
              options: productOptions
            }, {
              headers: { 'Authorization': `Bearer ${sessionToken}` }
            })
          } catch (optError: unknown) {
            if (import.meta.env.DEV) console.error('Failed to save options:', optError)
            toast.error(t('common.productRegisteredOptionsFailed'))
          }
        }
        toast.success(t('common.productRegistered'))
        navigate('/seller/products')
      }
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Failed to create product:', error)
      const axiosErr = error as { response?: { data?: { error?: string } } }
      // 🛡️ 폼 데이터를 보존한 채 에러만 표시(이전: window.location.reload 로 전체 입력 유실).
      setError(axiosErr.response?.data?.error || t('common.productRegisterFailed'))
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  return (
    <SellerLayout title={t('seller.productCreate')}>
      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('seller.productCreate')}
          subtitle={t('seller.newProductDesc')}
          icon={<Package className="h-5 w-5" />}
          actions={
            <button
              onClick={() => navigate('/seller/products')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{t('seller.backToProductList')}</span>
            </button>
          }
        />

        <BulkUploadTools />

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <Package className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <p className="flex-1 text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => setError('')}
              aria-label={t('common.close', { defaultValue: '닫기' })}
              className="rounded-lg p-1 text-red-500 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <form id={FORM_ID} onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            {/* ── 좌: 입력 폼 ── */}
            <div className="space-y-5">
              {/* 기본 정보 */}
              <FormSection
                title={t('seller.products.secBasic', { defaultValue: '기본 정보' })}
                desc={t('seller.products.secBasicDesc', { defaultValue: '상품명과 소개를 입력하세요' })}
                icon={<FileText className="h-5 w-5" />}
              >
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    {t('seller.productName')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder={t('seller.productNamePlaceholderForm')}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    {t('seller.productDescription')}
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder={t('seller.descriptionPlaceholder')}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    {t('seller.products.longDescription')}
                  </label>
                  <textarea
                    name="long_description"
                    value={formData.long_description}
                    onChange={handleChange}
                    placeholder={t('seller.products.longDescPlaceholder')}
                    rows={5}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-400">{t('seller.products.longDescHint')}</p>
                </div>
              </FormSection>

              {/* 가격 · 재고 */}
              <FormSection
                title={t('seller.products.secPricing', { defaultValue: '가격 · 재고' })}
                icon={<Tag className="h-5 w-5" />}
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      {t('seller.originalPrice')} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">₩</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        name="price"
                        value={formData.price}
                        onChange={handleChange}
                        placeholder="30000"
                        required
                        min="0"
                        className="w-full rounded-lg border border-gray-300 py-2.5 pl-8 pr-4 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{t('common.enterInWon')}</p>
                  </div>

                  {formData.product_kind === 'physical' ? (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        {t('seller.stockQuantity')} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Box className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <input
                          type="number"
                          inputMode="numeric"
                          name="stock"
                          value={formData.stock}
                          onChange={handleChange}
                          placeholder="100"
                          required
                          min="0"
                          className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{t('common.enterInUnits')}</p>
                    </div>
                  ) : (
                    <div className="flex items-center rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                      <span className="text-xs text-blue-700">{t('seller.products.digitalUnlimitedStock', { defaultValue: '📦 디지털 상품 — 무한 재고 (자동 999,999)' })}</span>
                    </div>
                  )}
                </div>

                <LivePriceSection
                  formData={formData}
                  onChange={handleChange}
                  onToggle={enabled => setFormData(p => ({ ...p, live_price_enabled: enabled }))}
                />
              </FormSection>

              {/* 상품 유형 (실물/디지털) */}
              <FormSection
                title={t('seller.products.secType', { defaultValue: '상품 유형' })}
                icon={<Package className="h-5 w-5" />}
              >
                <DigitalProductSection
                  formData={formData}
                  onChange={handleChange}
                  onKindChange={(kind, deliveryType, contentFormat) =>
                    setFormData(p => ({ ...p, product_kind: kind, delivery_type: deliveryType, content_format: contentFormat }))
                  }
                />
              </FormSection>

              {/* 대표 이미지 */}
              <FormSection
                title={t('seller.products.secImage', { defaultValue: '대표 이미지' })}
                icon={<ImageIcon className="h-5 w-5" />}
                aside={<span className="text-xs text-gray-400">{t('common.optional')}</span>}
              >
                <ImageUpload
                  value={formData.image_url}
                  onChange={(url) => setFormData({ ...formData, image_url: url })}
                  label=""
                  maxSizeKB={800}
                />
                <p className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Camera className="h-3.5 w-3.5" />
                  {t('seller.products.cameraHint', { defaultValue: '휴대폰에서는 촬영하거나 갤러리에서 선택할 수 있어요' })}
                </p>
                <p className="text-xs text-gray-400">{t('seller.productImageOptionalDesc')}</p>
              </FormSection>

              {/* 카테고리 · 상세 */}
              <FormSection
                title={t('seller.products.secCategory', { defaultValue: '카테고리 · 상세' })}
                icon={<Tag className="h-5 w-5" />}
              >
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    {t('common.category')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    {categoryOptions.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">{t('seller.selectCategoryDesc')}</p>
                </div>

                {formData.category === 'meal_voucher' && (
                  <MealVoucherFields onChange={handleChange} />
                )}

                {/* 노출 방식 안내 */}
                <div className="rounded-lg border-2 border-blue-500 bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <Play className="mt-1 h-5 w-5 text-red-600" />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900">{t('seller.liveOnlyProduct')}</span>
                        <span className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white">{t('seller.sellerOnly')}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{t('seller.liveOnlyProductNote')}</p>
                      <p className="mt-2 text-xs text-gray-500">💡 {t('seller.featuredOnlyAdmin')}</p>
                    </div>
                  </div>
                  <input type="hidden" name="product_type" value="live" />
                </div>

                {liveStreams.length > 0 && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      {t('seller.liveStreamLink')}
                    </label>
                    <div className="relative">
                      <Play className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <select
                        name="live_stream_id"
                        value={formData.live_stream_id}
                        onChange={handleChange}
                        className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">{t('seller.selectLiveStream')}</option>
                        {liveStreams.map((stream) => (
                          <option key={stream.id} value={stream.id}>
                            {stream.title} ({stream.status === 'live' ? 'LIVE' : stream.status === 'scheduled' ? t('common.scheduled') : t('common.ended')})
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{t('seller.selectLiveStreamDesc')}</p>
                  </div>
                )}
              </FormSection>

              {/* 옵션 */}
              <FormSection
                title={t('seller.products.secOptions', { defaultValue: '옵션 · 재고 변형' })}
                icon={<Box className="h-5 w-5" />}
              >
                <ProductOptionForm
                  options={productOptions}
                  onChange={setProductOptions}
                  disabled={loading}
                />
              </FormSection>

              {/* PC 인라인 액션 (모바일은 하단 고정 바) */}
              <div className="hidden items-center justify-end gap-3 lg:flex">
                <Button
                  type="button"
                  onClick={() => navigate('/seller/products')}
                  className="bg-gray-100 px-6 py-2.5 text-gray-700 hover:bg-gray-200"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 px-8 py-2.5 text-white hover:bg-blue-700"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {t('seller.registering')}
                    </span>
                  ) : (
                    t('seller.productCreate')
                  )}
                </Button>
              </div>

              {/* 유의사항 */}
              <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
                <FileText className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                  <p className="mb-1 font-medium">{t('common.notices')}</p>
                  <ul className="list-inside list-disc space-y-1 text-xs">
                    <li>{t('seller.productNameRequired')}</li>
                    <li>{t('seller.productCreateAfterEdit')}</li>
                    <li>{t('seller.liveStreamLaterLink')}</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* ── 우: PC 미리보기 레일 (sticky) ── */}
            <aside className="hidden lg:sticky lg:top-4 lg:block">
              <ProductPreviewRail formData={formData} categoryLabel={categoryLabel} />
            </aside>
          </div>
        </form>
      </div>

      {/* 모바일 하단 고정 액션 바 (PC 는 위 인라인 버튼) */}
      <StickyActionBar
        responsiveClassName="lg:hidden"
        className="border-t border-gray-200 bg-white px-4 pt-2.5 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
      >
        <div className="mx-auto flex max-w-6xl gap-3">
          <Button
            type="button"
            onClick={() => navigate('/seller/products')}
            className="flex-1 bg-gray-100 py-3 text-gray-700 hover:bg-gray-200"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            disabled={loading}
            className="flex-[2] bg-blue-600 py-3 text-white hover:bg-blue-700"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t('seller.registering')}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <Package className="h-4 w-4" />
                {t('seller.productCreate')}
              </span>
            )}
          </Button>
        </div>
      </StickyActionBar>
    </SellerLayout>
  )
}
