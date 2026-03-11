import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
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
  Play
} from 'lucide-react'

interface LiveStream {
  id: number
  title: string
  status: string
}

export default function SellerProductNewPage() {
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
    product_type: 'featured', // 'live' or 'featured'
    category: 'lifestyle' // 카테고리 기본값
  })
  
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])

  useEffect(() => {
    // Check authentication - use 'seller_token' (same as login page)
    const sessionToken = localStorage.getItem('seller_token')
    
    if (!sessionToken) {
      console.log('[SellerProductNewPage] ❌ No seller_token, redirecting to login')
      navigate('/seller/login')
      return
    }
    
    console.log('[SellerProductNewPage] ✅ seller_token found, loading page')
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
        setLiveStreams(response.data.data)
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

      const payload = {
        name: formData.name,
        description: formData.description,
        price: Number(formData.price),
        stock: Number(formData.stock),
        image_url: formData.image_url,
        live_stream_id: formData.live_stream_id ? Number(formData.live_stream_id) : null,
        product_type: formData.product_type,
        category: formData.category
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
            alert('상품은 등록되었으나 옵션 저장에 실패했습니다. 수정 페이지에서 다시 시도해주세요.')
          }
        }
        
        alert('상품이 등록되었습니다.')
        navigate('/seller/products')
      }
    } catch (error: any) {
      console.error('Failed to create product:', error)
      setError(error.response?.data?.error || '상품 등록에 실패했습니다.')
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
            <span>상품 목록으로 돌아가기</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-10 h-10 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">상품 등록</h1>
          </div>
          <p className="text-gray-600 mt-2">
            새로운 상품을 등록하고 라이브 스트림에 연결할 수 있습니다.
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
              상품명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="예: 프리미엄 무선 이어폰"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상품 설명
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="상품에 대한 자세한 설명을 입력해주세요"
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Price & Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                판매가격 <span className="text-red-500">*</span>
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
              <p className="text-xs text-gray-500 mt-1">원 단위로 입력해주세요</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                재고 수량 <span className="text-red-500">*</span>
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
              <p className="text-xs text-gray-500 mt-1">개 단위로 입력해주세요</p>
            </div>
          </div>

          {/* Image Upload */}
          <ImageUpload
            value={formData.image_url}
            onChange={(url) => setFormData({ ...formData, image_url: url })}
            label="상품 이미지"
            maxSizeKB={800}
          />

          {/* Image Preview - Removed as ImageUpload component handles it */}

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              카테고리 <span className="text-red-500">*</span>
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="fashion">패션</option>
              <option value="beauty">뷰티</option>
              <option value="food">식품</option>
              <option value="electronics">전자기기</option>
              <option value="lifestyle">라이프스타일</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">상품이 속할 카테고리를 선택하세요</p>
          </div>

          {/* Product Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              상품 타입 <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 {formData.product_type === 'live' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}">
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
                    <span className="font-semibold text-gray-900">라이브 방송 전용 상품</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    라이브 스트리밍 중에만 판매되는 한정 상품
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 {formData.product_type === 'featured' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}">
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
                    <span className="font-semibold text-gray-900">Ur 특가 상품</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    메인 페이지 "Ur 특가" 섹션에 노출되는 일반 판매 상품
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Live Stream Selection */}
          {liveStreams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                라이브 스트림 연결 (선택)
              </label>
              <div className="relative">
                <Play className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  name="live_stream_id"
                  value={formData.live_stream_id}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                >
                  <option value="">라이브 스트림을 선택하세요 (선택사항)</option>
                  {liveStreams.map((stream) => (
                    <option key={stream.id} value={stream.id}>
                      {stream.title} ({stream.status === 'live' ? 'LIVE' : stream.status === 'scheduled' ? '예정' : '종료'})
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-1">특정 라이브 스트림에서 판매할 상품인 경우 선택하세요</p>
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
                취소
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    등록 중...
                  </span>
                ) : (
                  '상품 등록'
                )}
              </Button>
            </div>
          </div>

          {/* Help Text */}
          <div className="pt-4 border-t">
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">안내사항</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>상품명과 가격, 재고는 필수 입력 항목입니다.</li>
                  <li>상품 등록 후 언제든지 수정할 수 있습니다.</li>
                  <li>라이브 스트림은 나중에도 연결할 수 있습니다.</li>
                </ul>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
