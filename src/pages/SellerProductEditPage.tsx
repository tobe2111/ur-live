import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  Image as ImageIcon
} from 'lucide-react'

interface LiveStream {
  id: number
  title: string
  status: string
}

interface Product {
  id: number
  name: string
  description: string
  price: number
  stock: number
  image_url: string
  live_stream_id: number | null
  is_active: boolean
  detail_images?: string | string[]
  product_type?: string // 'live' or 'featured'
}

export default function SellerProductEditPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [product, setProduct] = useState<Product | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    image_url: '',
    live_stream_id: '',
    live_only_price: '',
    live_price_enabled: false,
    is_active: true,
    detail_images: [] as string[],
    product_type: 'featured',
    category: 'lifestyle',
    // 식사권 필드
    restaurant_name: '',
    restaurant_address: '',
    restaurant_phone: '',
    voucher_terms: '',
    voucher_expiry: '',
    group_buy_target: '',
    group_buy_deadline: '',
    store_verify_pin: '',
  })
  
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])

  useEffect(() => {
    // Check authentication
    const sessionToken = localStorage.getItem('seller_token')

    if (!sessionToken) {
      navigate('/seller/login')
      return
    }
    
    loadProduct()
    loadLiveStreams()
  }, [id])

  async function loadProduct() {
    try {
      const sessionToken = localStorage.getItem('seller_token')

      if (!sessionToken) {
        navigate('/seller/login')
        return
      }

      const response = await api.get(`/api/seller/products/${id}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      if (response.data.success) {
        const productData = response.data.data
        setProduct(productData)
        
        // Parse detail_images if it exists
        let detailImages: string[] = []
        if (productData.detail_images) {
          detailImages = typeof productData.detail_images === 'string' 
            ? JSON.parse(productData.detail_images)
            : productData.detail_images
        }
        
        setFormData({
          name: productData.name,
          description: productData.description || '',
          price: String(productData.price),
          stock: String(productData.stock),
          image_url: productData.image_url || '',
          live_stream_id: productData.live_stream_id ? String(productData.live_stream_id) : '',
          live_only_price: productData.live_only_price ? String(productData.live_only_price) : '',
          live_price_enabled: !!productData.live_price_enabled,
          is_active: productData.is_active,
          detail_images: detailImages,
          product_type: productData.product_type || 'featured',
          category: productData.category || 'lifestyle',
          restaurant_name: productData.restaurant_name || '',
          restaurant_address: productData.restaurant_address || '',
          restaurant_phone: productData.restaurant_phone || '',
          voucher_terms: productData.voucher_terms || '',
          voucher_expiry: productData.voucher_expiry || '',
          group_buy_target: productData.group_buy_target ? String(productData.group_buy_target) : '',
          group_buy_deadline: productData.group_buy_deadline || '',
          store_verify_pin: productData.store_verify_pin || '',
        })
        
        // Set product options if they exist
        if (productData.options && Array.isArray(productData.options)) {
          setProductOptions(productData.options)
        }
      }
    } catch (error: unknown) {
      console.error('Failed to load product:', error)
      setError(t('common.productLoadFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function loadLiveStreams() {
    try {
      const sessionToken = localStorage.getItem('seller_token')

      if (!sessionToken) return

      const response = await api.get('/api/seller/streams', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      if (response.data.success) {
        setLiveStreams(response.data.data || [])
      }
    } catch (error) {
      console.error('Failed to load live streams:', error)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

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
        is_active: formData.is_active,
        detail_images: JSON.stringify(formData.detail_images),
        product_type: formData.product_type,
        category: formData.category,
        ...(formData.category === 'meal_voucher' ? {
          restaurant_name: formData.restaurant_name || null,
          restaurant_address: formData.restaurant_address || null,
          restaurant_phone: formData.restaurant_phone || null,
          voucher_terms: formData.voucher_terms || null,
          voucher_expiry: formData.voucher_expiry || null,
          group_buy_target: Number(formData.group_buy_target) || 0,
          group_buy_deadline: formData.group_buy_deadline || null,
          store_verify_pin: formData.store_verify_pin || null,
        } : {}),
      }

      const response = await api.put(`/api/seller/products/${id}`, payload, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      if (response.data.success) {
        // Save options if they changed
        try {
          await api.post(`/api/seller/products/${id}/options`, {
            options: productOptions
          }, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
          })
        } catch (optError: unknown) {
          console.error('Failed to save options:', optError)
          toast.error(t('common.productSavedOptionsFailed'))
        }
        
        toast.success(t('common.productUpdated'))
        navigate('/seller/products')
      }
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string; message?: string }; status?: number } };
      console.error('Failed to update product:', error)
      setError(error_.response?.data?.error || t('common.productUpdateFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value, type } = e.target as HTMLInputElement
    
    if (type === 'checkbox') {
      setFormData({
        ...formData,
        [name]: (e.target as HTMLInputElement).checked
      })
    } else {
      setFormData({
        ...formData,
        [name]: value
      })
    }
  }

  function addDetailImage() {
    const url = prompt(t('seller.detailImageUrlPrompt'))
    if (url && url.trim()) {
      setFormData({
        ...formData,
        detail_images: [...formData.detail_images, url.trim()]
      })
    }
  }

  function removeDetailImage(index: number) {
    setFormData({
      ...formData,
      detail_images: formData.detail_images.filter((_, i) => i !== index)
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">{t('common.productNotFound')}</p>
          <Button
            onClick={() => navigate('/seller/products')}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {t('common.backToList')}
          </Button>
        </div>
      </div>
    )
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
            <h1 className="text-3xl font-bold text-gray-900">{t('seller.productEdit')}</h1>
          </div>
          <p className="text-gray-600 mt-2">
            {t('seller.editProductDesc')}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <Package className="w-5 h-5" />
              <p>{error}</p>
            </div>
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

          {/* Image Upload */}
          <ImageUpload
            value={formData.image_url}
            onChange={(url) => setFormData({ ...formData, image_url: url })}
            label={t('seller.productImage')}
            maxSizeKB={800}
          />

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
              <option value="meal_voucher">🍽️ 식사권 (공동구매)</option>
            </select>
          </div>

          {/* 식사권 전용 필드 */}
          {formData.category === 'meal_voucher' && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-orange-800">🍽️ 식사권 / 공동구매 정보</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">식당명</label>
                <input name="restaurant_name" value={formData.restaurant_name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">식당 주소</label>
                <input name="restaurant_address" value={formData.restaurant_address} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">식당 전화번호</label>
                <input name="restaurant_phone" value={formData.restaurant_phone} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이용 조건</label>
                <input name="voucher_terms" value={formData.voucher_terms} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">유효기간</label>
                  <input type="date" name="voucher_expiry" value={formData.voucher_expiry} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">목표 인원</label>
                  <input type="number" name="group_buy_target" value={formData.group_buy_target} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">공동구매 마감일</label>
                <input type="datetime-local" name="group_buy_deadline" value={formData.group_buy_deadline} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">식당 인증 비밀번호</label>
                <input name="store_verify_pin" value={formData.store_verify_pin} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
            </div>
          )}

          {/* Product Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('seller.productType')} <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${formData.product_type === 'live' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                <input
                  type="radio"
                  name="product_type"
                  value="live"
                  checked={formData.product_type === 'live'}
                  onChange={handleChange}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Play className="w-5 h-5 text-red-600" />
                    <span className="font-semibold text-gray-900">{t('seller.liveOnlyProduct')}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {t('seller.liveOnlyProductDesc')}
                  </p>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${formData.product_type === 'featured' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                <input
                  type="radio"
                  name="product_type"
                  value="featured"
                  checked={formData.product_type === 'featured'}
                  onChange={handleChange}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-gray-900">{t('seller.featuredProduct')}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {t('seller.featuredProductDesc')}
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Image Preview - Removed as ImageUpload component handles it */}

          {/* Detail Images */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                {t('seller.productDetailImages')}
              </label>
              <Button
                type="button"
                onClick={addDetailImage}
                className="text-sm py-1 px-3 bg-green-600 hover:bg-green-700 text-white"
              >
                {t('seller.addImage')}
              </Button>
            </div>
            
            {formData.detail_images.length > 0 ? (
              <div className="space-y-3">
                {formData.detail_images.map((imageUrl, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border">
                    <div className="w-24 h-24 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                      <img
                        src={imageUrl}
                        alt={`${t('seller.detailImage')} ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/96'
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-1">{t('seller.imageIndex', { index: index + 1 })}</p>
                      <p className="text-sm text-gray-700 break-all">{imageUrl}</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => removeDetailImage(index)}
                      className="flex-shrink-0 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm"
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
                <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">{t('seller.noDetailImages')}</p>
                <p className="text-xs text-gray-400 mt-1">{t('seller.addDetailImageGuide')}</p>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              💡 {t('seller.detailImageTip')}
            </p>
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

          {/* Active Status */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-700">{t('seller.productActivate')}</p>
                <p className="text-xs text-gray-500">{t('seller.productActivateDesc')}</p>
              </div>
            </label>
          </div>

          {/* Product Options */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <ProductOptionForm
              options={productOptions}
              onChange={setProductOptions}
              disabled={submitting}
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
                disabled={submitting}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('common.saving')}
                  </span>
                ) : (
                  t('seller.saveChanges')
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
                  <li>{t('seller.changesAppliedImmediately')}</li>
                  <li>{t('seller.inactiveProductHidden')}</li>
                </ul>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
