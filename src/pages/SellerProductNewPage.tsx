import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import ImageUpload from '@/components/ImageUpload'
import ProductOptionForm, { ProductOption } from '@/components/ProductOptionForm'
import {
  ArrowLeft,
  Package,
  Loader2,
  DollarSign,
  Box,
  FileText,
  Play,
  Download
} from 'lucide-react'
import { downloadSellerTemplate } from '@/utils/product-template'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'

interface LiveStream {
  id: number
  title: string
  status: string
}

export default function SellerProductNewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    long_description: '',
    price: '',
    stock: '',
    image_url: '',
    live_stream_id: '',
    live_only_price: '',
    live_price_enabled: false,
    product_type: 'live', // 판매자는 'live' 전용 상품만 등록 가능
    category: 'lifestyle' // 카테고리 기본값
  })
  
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])

  useEffect(() => {
    // Check authentication - use 'seller_token' (same as login page)
    const sessionToken = localStorage.getItem('seller_token')
    
    if (!sessionToken) {
      navigate('/seller/login')
      return
    }

    loadLiveStreams()
  }, [])

  async function loadLiveStreams() {
    try {
      const sessionToken = localStorage.getItem('seller_token')

      if (!sessionToken) {
        navigate('/seller/login')
        return
      }

      // Note: You may need to create this API endpoint
      const response = await api.get('/api/seller/streams', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      if (response.data.success) {
        setLiveStreams(response.data.data || [])
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to load live streams:', error)
      // Continue without live streams
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // 유효성 검사
    if (!formData.name?.trim()) { setError(t('seller.products.enterProductName')); return }
    if (!formData.price || Number(formData.price) <= 0) { setError(t('seller.products.priceAboveZero')); return }
    if (Number(formData.price) > 100000000) { setError(t('seller.products.priceTooHigh')); return }
    if (Number(formData.stock) < 0) { setError(t('seller.products.stockAboveZero')); return }

    setLoading(true)

    try {
      const sessionToken = localStorage.getItem('seller_token')

      if (!sessionToken) {
        navigate('/seller/login')
        return
      }

      const extra = formData as unknown as Record<string, string>
      const payload: Record<string, unknown> = {
        name: formData.name,
        description: formData.description,
        long_description: formData.long_description || undefined,
        price: Number(formData.price),
        stock: Number(formData.stock),
        image_url: formData.image_url,
        live_stream_id: formData.live_stream_id ? Number(formData.live_stream_id) : null,
        live_only_price: formData.live_only_price ? Number(formData.live_only_price) : null,
        live_price_enabled: formData.live_price_enabled,
        product_type: formData.product_type,
        category: formData.category,
        // 식사권/공동구매 필드 (category가 meal_voucher일 때만 유효)
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
        
        // 옵션이 있으면 저장
        if (productOptions.length > 0 && productId) {
          try {
            await api.post(`/api/seller/products/${productId}/options`, {
              options: productOptions
            }, {
              headers: { 'Authorization': `Bearer ${sessionToken}` }
            })
          } catch (optError: unknown) {
            if (import.meta.env.DEV) console.error('Failed to save options:', optError)
            // 옵션 저장 실패해도 상품은 등록됨
            toast.error(t('common.productRegisteredOptionsFailed'))
          }
        }
        
        toast.success(t('common.productRegistered'))
        navigate('/seller/products')
      }
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Failed to create product:', error)
      const axiosErr = error as { response?: { data?: { error?: string } } }
      setError(axiosErr.response?.data?.error || t('common.productRegisterFailed'))
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <SellerLayout title={t('seller.productCreate')}>
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 132: SellerLayout 으로 전환 */}
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
        <div className="mb-8 hidden">
          <p className="text-sm text-gray-500">
            {t('seller.newProductDesc')}
          </p>
          <button
            type="button"
            onClick={downloadSellerTemplate}
            className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
          >
            <Download className="w-4 h-4" />
            {t('seller.bulkUploadTemplate')}
          </button>

          {/* 대량등록 */}
          <div className="mt-3 flex items-center gap-3">
            <label className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer">
              <FileText className="w-4 h-4" />
              {t('seller.products.csvBulkUpload')}
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    const text = await file.text()
                    const lines = text.split('\n').filter(l => l.trim())
                    if (lines.length < 2) { toast.error(t('common.noData')); return }

                    const headers = lines[0].split(',').map(h => h.trim())
                    const token = localStorage.getItem('seller_token')
                    let success = 0, fail = 0

                    for (let i = 1; i < lines.length; i++) {
                      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
                      const row: Record<string, string> = {}
                      headers.forEach((h, idx) => { row[h] = values[idx] || '' })

                      try {
                        await api.post('/api/seller/products', {
                          name: row['name'] || row['상품명'],
                          description: row['description'] || row['설명'] || '',
                          price: Number(row['price'] || row['가격'] || 0),
                          stock: Number(row['stock'] || row['재고'] || 0),
                          image_url: row['image_url'] || row['이미지'] || '',
                          category: row['category'] || row['카테고리'] || 'lifestyle',
                        }, { headers: { Authorization: `Bearer ${token}` } })
                        success++
                      } catch { fail++ }
                    }

                    toast.success(t('seller.products.bulkResult', { success, fail }))
                    if (success > 0) navigate('/seller/products')
                  } catch { toast.error(t('seller.products.csvReadFailed')) }
                  e.target.value = ''
                }}
              />
            </label>
            <p className="text-xs text-gray-500">{t('seller.products.bulkUploadHint')}</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <Package className="w-5 h-5" />
              <p>{error}</p>
            </div>
            <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">{t('common.retry')}</button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
          {/* Product Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('seller.productName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={t('seller.productNamePlaceholderForm')}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('seller.productDescription')}
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder={t('seller.descriptionPlaceholder')}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Long Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('seller.products.longDescription')}
            </label>
            <textarea
              name="long_description"
              value={formData.long_description}
              onChange={handleChange}
              placeholder={t('seller.products.longDescPlaceholder')}
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">{t('seller.products.longDescHint')}</p>
          </div>

          {/* Price & Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('seller.originalPrice')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="30000"
                  required
                  min="0"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{t('common.enterInWon')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('seller.stockQuantity')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Box className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  onChange={handleChange}
                  placeholder="100"
                  required
                  min="0"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{t('common.enterInUnits')}</p>
            </div>
          </div>

          {/* 라이브 전용 특가 */}
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="live_price_enabled"
                checked={formData.live_price_enabled}
                onChange={e => setFormData({ ...formData, live_price_enabled: e.target.checked })}
                className="rounded border-orange-300 text-orange-600"
              />
              <label htmlFor="live_price_enabled" className="text-sm font-semibold text-orange-800">
                {t('seller.liveOnly')}
              </label>
              <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">{t('seller.liveOnlyDuring')}</span>
            </div>
            {formData.live_price_enabled && (
              <div>
                <input
                  type="number"
                  name="live_only_price"
                  value={formData.live_only_price}
                  onChange={handleChange}
                  placeholder={t('seller.liveOnlyPricePlaceholder')}
                  min="0"
                  className="w-full px-3 py-2 border border-orange-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-orange-500 bg-white"
                />
                <p className="text-xs text-orange-600 mt-1">{t('seller.liveOnlyPriceDesc')}</p>
              </div>
            )}
          </div>

          {/* Image Upload - Optional */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('seller.productImageOptional')} <span className="text-gray-400">({t('common.optional')})</span>
            </label>
            <ImageUpload
              value={formData.image_url}
              onChange={(url) => setFormData({ ...formData, image_url: url })}
              label=""
              maxSizeKB={800}
            />
            <p className="text-xs text-gray-500 mt-2">
              {t('seller.productImageOptionalDesc')}
            </p>
          </div>

          {/* Image Preview - Removed as ImageUpload component handles it */}

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('common.category')} <span className="text-red-500">*</span>
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="fashion">{t('common.fashion')}</option>
              <option value="beauty">{t('common.beauty')}</option>
              <option value="food">{t('common.food')}</option>
              <option value="electronics">{t('common.electronics')}</option>
              <option value="lifestyle">{t('common.lifestyle')}</option>
              <option value="meal_voucher">{t('seller.products.mealVoucherCategory')}</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">{t('seller.selectCategoryDesc')}</p>
          </div>

          {/* 식사권 전용 필드 */}
          {formData.category === 'meal_voucher' && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-orange-800">{t('seller.products.mealVoucherInfo')}</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.restaurantName')} *</label>
                <input name="restaurant_name" onChange={handleChange} placeholder={t('seller.products.restaurantNamePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.restaurantAddress')}</label>
                <input name="restaurant_address" onChange={handleChange} placeholder={t('seller.products.restaurantAddressPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.restaurantPhone')}</label>
                <input name="restaurant_phone" onChange={handleChange} placeholder="02-1234-5678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.voucherTerms')}</label>
                <input name="voucher_terms" onChange={handleChange} placeholder={t('seller.products.voucherTermsPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.expiryDate')}</label>
                  <input type="date" name="voucher_expiry" onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.groupBuyTarget')}</label>
                  <input type="number" name="group_buy_target" onChange={handleChange} placeholder="50"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.groupBuyDeadline')}</label>
                <input type="datetime-local" name="group_buy_deadline" onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.products.storeVerifyPin')} *</label>
                <input name="store_verify_pin" onChange={handleChange} placeholder={t('seller.products.storeVerifyPinPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
                <p className="text-xs text-gray-400 mt-1">{t('seller.products.storeVerifyPinDesc')}</p>
              </div>
            </div>
          )}

          {/* Product Type - Only Live Products for Sellers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('seller.productType')}
            </label>
            <div className="p-4 border-2 border-blue-500 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-3">
                <Play className="w-5 h-5 text-red-600 mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{t('seller.liveOnlyProduct')}</span>
                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">{t('seller.sellerOnly')}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {t('seller.liveOnlyProductNote')}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    💡 {t('seller.featuredOnlyAdmin')}
                  </p>
                </div>
              </div>
            </div>
            {/* Hidden input to ensure product_type is submitted */}
            <input type="hidden" name="product_type" value="live" />
          </div>

          {/* Live Stream Selection */}
          {liveStreams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('seller.liveStreamLink')}
              </label>
              <div className="relative">
                <Play className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  name="live_stream_id"
                  value={formData.live_stream_id}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                >
                  <option value="">{t('seller.selectLiveStream')}</option>
                  {liveStreams.map((stream) => (
                    <option key={stream.id} value={stream.id}>
                      {stream.title} ({stream.status === 'live' ? 'LIVE' : stream.status === 'scheduled' ? t('common.scheduled') : t('common.ended')})
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-1">{t('seller.selectLiveStreamDesc')}</p>
            </div>
          )}

          {/* Product Options */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <ProductOptionForm
              options={productOptions}
              onChange={setProductOptions}
              disabled={loading}
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t">
            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => navigate('/seller/products')}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('seller.registering')}
                  </span>
                ) : (
                  t('seller.productCreate')
                )}
              </Button>
            </div>
          </div>

          {/* Help Text */}
          <div className="pt-4 border-t">
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">{t('common.notices')}</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>{t('seller.productNameRequired')}</li>
                  <li>{t('seller.productCreateAfterEdit')}</li>
                  <li>{t('seller.liveStreamLaterLink')}</li>
                </ul>
              </div>
            </div>
          </div>
        </form>
      </div>
    </SellerLayout>
  )
}
