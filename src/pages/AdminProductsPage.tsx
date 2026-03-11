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
  price: number
  stock: number
  image_url: string
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
    price: '',
    stock: '',
    image_url: '',
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
        price: Number(formData.price),
        stock: Number(formData.stock),
        image_url: formData.image_url,
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
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      stock: product.stock.toString(),
      image_url: product.image_url,
      category: product.category,
      product_type: product.product_type
    })
    setShowCreateModal(true)
  }

  function resetForm() {
    setFormData({
      name: '',
      description: '',
      price: '',
      stock: '',
      image_url: '',
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
                    상품 설명
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Price & Stock */}
                <div className="grid grid-cols-2 gap-4">
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    상품 이미지 <span className="text-gray-400">(선택사항)</span>
                  </label>
                  <ImageUpload
                    value={formData.image_url}
                    onChange={(url) => setFormData({ ...formData, image_url: url })}
                    label=""
                    maxSizeKB={800}
                  />
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
