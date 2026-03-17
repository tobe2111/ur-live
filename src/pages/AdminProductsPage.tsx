import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ImageUpload from '@/components/ImageUpload'
import { 
  ArrowLeft, 
  Package,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Image as ImageIcon,
  DollarSign,
  Box,
  Star
} from 'lucide-react'

interface Product {
  id: number
  name: string
  description: string
  long_description?: string
  price: number
  compare_at_price?: number
  stock: number
  image_url: string
  detail_images?: string | string[]
  is_active: boolean
  product_type: 'live' | 'featured'
  category: string
  seller_id?: number
  seller_name?: string
  created_at: string
}

export default function AdminProductsPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    long_description: '',
    price: '',
    compare_at_price: '',
    stock: '',
    image_url: '',
    detail_images: ['', '', '', ''], // 상세 이미지 4장
    category: 'lifestyle',
    product_type: 'featured' as 'live' | 'featured'
  })

  useEffect(() => {
    checkAuth()
    loadProducts()
  }, [])

  function checkAuth() {
    const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
    if (!token) {
      navigate('/admin/login')
      return
    }
  }

  async function loadProducts() {
    setLoading(true)
    setError('')

    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      
      const response = await api.get('/api/admin/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.data.success) {
        setProducts(response.data.data)
      }
    } catch (error: any) {
      console.error('Failed to load products:', error)
      setError('상품 목록을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      
      const payload = {
        name: formData.name,
        description: formData.description,
        long_description: formData.long_description || undefined,
        price: Number(formData.price),
        compare_at_price: formData.compare_at_price ? Number(formData.compare_at_price) : undefined,
        stock: Number(formData.stock),
        image_url: formData.image_url,
        detail_images: JSON.stringify(formData.detail_images.filter(url => url.trim() !== '')),
        category: formData.category,
        product_type: formData.product_type,
        is_active: 1
      }

      if (editingProduct) {
        // Update existing product
        await api.put(`/api/admin/products/${editingProduct.id}`, payload, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        alert('상품이 수정되었습니다.')
      } else {
        // Create new product
        await api.post('/api/admin/products', payload, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        alert('상품이 등록되었습니다.')
      }

      setShowCreateModal(false)
      setEditingProduct(null)
      resetForm()
      loadProducts()
    } catch (error: any) {
      console.error('Failed to save product:', error)
      setError(error.response?.data?.error || '상품 저장에 실패했습니다.')
    }
  }

  async function handleDelete(productId: number) {
    if (!confirm('정말 이 상품을 삭제하시겠습니까?')) {
      return
    }

    setDeleting(productId)

    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      
      await api.delete(`/api/admin/products/${productId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      alert('상품이 삭제되었습니다.')
      loadProducts()
    } catch (error: any) {
      console.error('Failed to delete product:', error)
      alert(error.response?.data?.error || '상품 삭제에 실패했습니다.')
    } finally {
      setDeleting(null)
    }
  }

  async function handleToggleActive(productId: number, currentStatus: boolean) {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      
      await api.patch(
        `/api/admin/products/${productId}`,
        { is_active: !currentStatus },
        { headers: { 'Authorization': `Bearer ${token}` } }
      )

      alert('상품 상태가 변경되었습니다.')
      loadProducts()
    } catch (error: any) {
      console.error('Failed to toggle product:', error)
      alert(error.response?.data?.error || '상품 상태 변경에 실패했습니다.')
    }
  }

  function handleEdit(product: Product) {
    setEditingProduct(product)
    
    // Parse detail_images if it's a JSON string
    let detailImagesArray = ['', '', '', '']
    if (product.detail_images) {
      try {
        const parsed = typeof product.detail_images === 'string' 
          ? JSON.parse(product.detail_images) 
          : product.detail_images
        detailImagesArray = [...parsed, '', '', '', ''].slice(0, 4)
      } catch (e) {
        console.error('Failed to parse detail_images:', e)
      }
    }
    
    setFormData({
      name: product.name,
      description: product.description,
      long_description: product.long_description || '',
      price: product.price.toString(),
      compare_at_price: product.compare_at_price?.toString() || '',
      stock: product.stock.toString(),
      image_url: product.image_url,
      detail_images: detailImagesArray,
      category: product.category,
      product_type: product.product_type
    })
    setShowCreateModal(true)
  }

  function resetForm() {
    setFormData({
      name: '',
      description: '',
      long_description: '',
      price: '',
      compare_at_price: '',
      stock: '',
      image_url: '',
      detail_images: ['', '', '', ''],
      category: 'lifestyle',
      product_type: 'featured'
    })
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  function formatPrice(price: number) {
    return price.toLocaleString('ko-KR')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>어드민 대시보드로 돌아가기</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Title & Actions */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Package className="w-10 h-10 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">상품 관리 (어드민)</h1>
            </div>
            <p className="text-gray-600 mt-2">
              "Ur 특가" 상품을 포함한 모든 상품을 관리할 수 있습니다.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingProduct(null)
              resetForm()
              setShowCreateModal(true)
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span>Ur 특가 상품 등록</span>
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <Trash2 className="w-5 h-5" />
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          </div>
        ) : (
          /* Products Table */
          <div className="bg-white rounded-lg shadow-sm border">
            {products.length === 0 ? (
              <div className="text-center py-20">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">등록된 상품이 없습니다.</p>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  첫 상품 등록하기
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이미지</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">타입</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">가격</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">재고</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">상태</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {products.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="w-10 h-10 text-gray-400" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{product.name}</p>
                            <p className="text-xs text-gray-500 line-clamp-1 mt-1">{product.description || '설명 없음'}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {product.product_type === 'featured' ? (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                              <Star className="w-3 h-3 mr-1" />
                              Ur 특가
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 border-red-200">
                              라이브
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-900 font-medium">
                          {formatPrice(product.price)}원
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge className={product.stock > 0 ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}>
                            {product.stock > 0 ? `${product.stock}개` : '품절'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleToggleActive(product.id, product.is_active)}
                            className="inline-flex items-center gap-1"
                          >
                            {product.is_active ? (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-200 cursor-pointer hover:bg-blue-200">
                                <Eye className="w-3 h-3 mr-1" />
                                판매중
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-800 border-gray-200 cursor-pointer hover:bg-gray-200">
                                <EyeOff className="w-3 h-3 mr-1" />
                                비활성
                              </Badge>
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(product)}
                              className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                              title="수정"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              disabled={deleting === product.id}
                              className="text-red-600 hover:text-red-800 transition-colors p-1 disabled:opacity-50"
                              title="삭제"
                            >
                              {deleting === product.id ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <Trash2 className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {editingProduct ? '상품 수정' : 'Ur 특가 상품 등록'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
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
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    짧은 설명 <span className="text-gray-400">(상품 카드에 표시)</span>
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    placeholder="예: Premium noise-cancelling headphones with 30-hour battery life."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Long Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    상세 설명 <span className="text-gray-400">(상품 상세 페이지 하단에 표시)</span>
                  </label>
                  <textarea
                    name="long_description"
                    value={formData.long_description}
                    onChange={handleChange}
                    rows={10}
                    placeholder="상품의 자세한 특징, 사양, 패키지 구성, 사용 방법 등을 작성하세요.

예시:
최고급 노이즈 캔슬링 헤드폰으로 완벽한 몰입감을 선사합니다.

【주요 특징】
✓ 액티브 노이즈 캔슬링 (ANC) 기술
✓ 30시간 초장시간 배터리
✓ 고해상도 40mm 드라이버
..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    💡 Tip: 줄바꿈은 그대로 표시됩니다. 특수문자(✓, 【】, ■ 등)를 활용하면 더 보기 좋습니다.
                  </p>
                </div>

                {/* Price & Compare Price & Stock */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      판매가격 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      required
                      min="0"
                      placeholder="89000"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      정가 <span className="text-gray-400">(할인 전)</span>
                    </label>
                    <input
                      type="number"
                      name="compare_at_price"
                      value={formData.compare_at_price}
                      onChange={handleChange}
                      min="0"
                      placeholder="149000"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      재고 수량 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="stock"
                      value={formData.stock}
                      onChange={handleChange}
                      required
                      min="0"
                      placeholder="50"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    대표 이미지 <span className="text-gray-400">(썸네일)</span>
                  </label>
                  <ImageUpload
                    value={formData.image_url}
                    onChange={(url) => setFormData({ ...formData, image_url: url })}
                    label=""
                    maxSizeKB={800}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    또는 이미지 URL을 직접 입력:
                  </p>
                  <input
                    type="url"
                    name="image_url"
                    value={formData.image_url}
                    onChange={handleChange}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="w-full px-4 py-2 mt-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>

                {/* Detail Images */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    상세 이미지 (4장) <span className="text-gray-400">(상품 상세 페이지에 표시)</span>
                  </label>
                  <div className="space-y-3">
                    {formData.detail_images.map((url, index) => (
                      <div key={index}>
                        <label className="block text-xs text-gray-500 mb-1">
                          상세 이미지 {index + 1}
                        </label>
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => {
                            const newDetailImages = [...formData.detail_images]
                            newDetailImages[index] = e.target.value
                            setFormData({ ...formData, detail_images: newDetailImages })
                          }}
                          placeholder={`https://images.unsplash.com/photo-...?w=1200 (${index === 0 ? '제품 전체샷' : index === 1 ? '제품 상세샷' : index === 2 ? '제품 특징' : '패키지 구성'})`}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    💡 Tip: Unsplash에서 `?w=1200` 파라미터를 추가하면 최적 크기로 로드됩니다.
                  </p>
                </div>

                {/* Category */}
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
                </div>

                {/* Product Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    상품 타입 <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="product_type"
                    value={formData.product_type}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="featured">Ur 특가 (메인 페이지 노출)</option>
                    <option value="live">라이브 방송 전용</option>
                  </select>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      setEditingProduct(null)
                      resetForm()
                    }}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800"
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {editingProduct ? '수정' : '등록'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
