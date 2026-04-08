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
        setLiveStreams(response.data.streams || [])
      }
    } catch (error) {
      console.error('Failed to load live streams:', error)
      // Continue without live streams
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const sessionToken = localStorage.getItem('seller_token')

      if (!sessionToken) {
        navigate('/seller/login')
        return
      }

      const payload: Record<string, unknown> = {
        name: formData.name,
        description: formData.description,
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
          restaurant_name: (formData as any).restaurant_name || null,
          restaurant_address: (formData as any).restaurant_address || null,
          restaurant_phone: (formData as any).restaurant_phone || null,
          voucher_terms: (formData as any).voucher_terms || null,
          voucher_expiry: (formData as any).voucher_expiry || null,
          group_buy_target: Number((formData as any).group_buy_target) || 0,
          group_buy_deadline: (formData as any).group_buy_deadline || null,
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
          } catch (optError: any) {
            console.error('Failed to save options:', optError)
            // 옵션 저장 실패해도 상품은 등록됨
            toast.error(t('common.productRegisteredOptionsFailed'))
          }
        }
        
        toast.success(t('common.productRegistered'))
        navigate('/seller/products')
      }
    } catch (error: any) {
      console.error('Failed to create product:', error)
      setError(error.response?.data?.error || t('common.productRegisterFailed'))
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/seller/products')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('seller.backToProductList')}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-10 h-10 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">{t('seller.productCreate')}</h1>
          </div>
          <p className="text-gray-600 mt-2">
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="fashion">{t('common.fashion')}</option>
              <option value="beauty">{t('common.beauty')}</option>
              <option value="food">{t('common.food')}</option>
              <option value="electronics">{t('common.electronics')}</option>
              <option value="lifestyle">{t('common.lifestyle')}</option>
              <option value="meal_voucher">🍽️ 식사권 (공동구매)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">{t('seller.selectCategoryDesc')}</p>
          </div>

          {/* 식사권 전용 필드 */}
          {formData.category === 'meal_voucher' && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-orange-800">🍽️ 식사권 / 공동구매 정보</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">식당명 *</label>
                <input name="restaurant_name" onChange={handleChange} placeholder="예) 강남 OO식당"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">식당 주소</label>
                <input name="restaurant_address" onChange={handleChange} placeholder="서울시 강남구..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">식당 전화번호</label>
                <input name="restaurant_phone" onChange={handleChange} placeholder="02-1234-5678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이용 조건</label>
                <input name="voucher_terms" onChange={handleChange} placeholder="평일 런치만 / 주말 포함 등"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">유효기간</label>
                  <input type="date" name="voucher_expiry" onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">공동구매 목표 인원</label>
                  <input type="number" name="group_buy_target" onChange={handleChange} placeholder="50"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">공동구매 마감일</label>
                <input type="datetime-local" name="group_buy_deadline" onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
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
    </div>
  )
}
