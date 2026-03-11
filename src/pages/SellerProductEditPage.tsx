import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
    is_active: true,
    detail_images: [] as string[],
    product_type: 'featured', // 'live' or 'featured'
    category: 'lifestyle' // 카테고리 기본값
  })
  
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])

  useEffect(() => {
    // Check authentication
    const sessionToken = localStorage.getItem('seller_token')
    const userType = localStorage.getItem('user_type')
    
    if (!sessionToken || userType !== 'seller') {
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
          is_active: productData.is_active,
          detail_images: detailImages,
          product_type: productData.product_type || 'featured',
          category: productData.category || 'lifestyle'
        })
        
        // Set product options if they exist
        if (productData.options && Array.isArray(productData.options)) {
          setProductOptions(productData.options)
        }
      }
    } catch (error: any) {
      console.error('Failed to load product:', error)
      setError('상품 정보를 불러올 수 없습니다.')
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
        setLiveStreams(response.data.data)
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

      const payload = {
        name: formData.name,
        description: formData.description,
        price: Number(formData.price),
        stock: Number(formData.stock),
        image_url: formData.image_url,
        live_stream_id: formData.live_stream_id ? Number(formData.live_stream_id) : null,
        is_active: formData.is_active,
        detail_images: JSON.stringify(formData.detail_images),
        product_type: formData.product_type,
        category: formData.category
      }

      const response = await api.patch(`/api/seller/products/${id}`, payload, {
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
        } catch (optError: any) {
          console.error('Failed to save options:', optError)
          alert('상품은 수정되었으나 옵션 저장에 실패했습니다.')
        }
        
        alert('상품이 수정되었습니다.')
        navigate('/seller/products')
      }
    } catch (error: any) {
      console.error('Failed to update product:', error)
      setError(error.response?.data?.error || '상품 수정에 실패했습니다.')
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
    const url = prompt('상세 이미지 URL을 입력하세요:')
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
          <p className="text-gray-600">상품을 찾을 수 없습니다.</p>
          <Button
            onClick={() => navigate('/seller/products')}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
          >
            목록으로 돌아가기
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
            <h1 className="text-3xl font-bold text-gray-900">상품 수정</h1>
          </div>
          <p className="text-gray-600 mt-2">
            상품 정보를 수정하고 변경사항을 저장할 수 있습니다.
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
                    <span className="font-semibold text-gray-900">라이브 방송 전용 상품</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    라이브 스트리밍 중에만 판매되는 한정 상품
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
                    <span className="font-semibold text-gray-900">Ur 특가 상품</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    메인 페이지 "Ur 특가" 섹션에 노출되는 일반 판매 상품
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
                상품 상세 이미지 (선택)
              </label>
              <Button
                type="button"
                onClick={addDetailImage}
                className="text-sm py-1 px-3 bg-green-600 hover:bg-green-700 text-white"
              >
                + 이미지 추가
              </Button>
            </div>
            
            {formData.detail_images.length > 0 ? (
              <div className="space-y-3">
                {formData.detail_images.map((imageUrl, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border">
                    <div className="w-24 h-24 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                      <img
                        src={imageUrl}
                        alt={`상세 이미지 ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/96'
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-1">이미지 {index + 1}</p>
                      <p className="text-sm text-gray-700 break-all">{imageUrl}</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => removeDetailImage(index)}
                      className="flex-shrink-0 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm"
                    >
                      삭제
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
                <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">상세 이미지가 없습니다</p>
                <p className="text-xs text-gray-400 mt-1">위의 "+ 이미지 추가" 버튼을 클릭하여 이미지를 추가하세요</p>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              💡 Tip: Unsplash, Pexels 등 무료 이미지 사이트에서 이미지 URL을 복사하여 사용할 수 있습니다
            </p>
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
                <p className="text-sm font-medium text-gray-700">상품 활성화</p>
                <p className="text-xs text-gray-500">체크하면 고객에게 상품이 표시됩니다</p>
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
                취소
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    저장 중...
                  </span>
                ) : (
                  '변경사항 저장'
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
                  <li>변경사항은 즉시 반영됩니다.</li>
                  <li>비활성화 상태로 변경하면 고객에게 표시되지 않습니다.</li>
                </ul>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
