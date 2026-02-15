import { CustomModal, useModal } from '@/components/CustomModal'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Box
} from 'lucide-react'

interface Product {
  id: number
  name: string
  description: string
  price: number
  stock: number
  image_url: string
  is_active: boolean
  live_stream_title?: string
  created_at: string
}

export default function SellerProductsPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    setLoading(true)
    setError('')

    try {
      const sessionToken = localStorage.getItem('seller_session_token')
      

      if (!sessionToken) {
        navigate('/seller/login')
        return
      }

      const response = await api.get('/api/seller/products', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
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

  async function handleToggleActive(productId: number, currentStatus: boolean) {
    if (!confirm(`상품을 ${currentStatus ? '비활성화' : '활성화'}하시겠습니까?`)) {
      return
    }

    try {
      const sessionToken = localStorage.getItem('seller_session_token')
      

      const response = await api.patch(
        `/api/seller/products/${productId}`,
        { is_active: !currentStatus },
        { headers: { 'Authorization': `Bearer ${sessionToken}` } }
      )

      if (response.data.success) {
        alert('상품 상태가 변경되었습니다.')
        loadProducts()
      }
    } catch (error: any) {
      console.error('Failed to toggle product:', error)
      alert(error.response?.data?.error || '상품 상태 변경에 실패했습니다.')
    }
  }

  async function handleDelete(productId: number) {
    if (!confirm('정말 이 상품을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    setDeleting(productId)

    try {
      const sessionToken = localStorage.getItem('seller_session_token')
      

      const response = await api.delete(`/api/seller/products/${productId}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      if (response.data.success) {
        alert('상품이 삭제되었습니다.')
        loadProducts()
      }
    } catch (error: any) {
      console.error('Failed to delete product:', error)
      alert(error.response?.data?.error || '상품 삭제에 실패했습니다.')
    } finally {
      setDeleting(null)
    }
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
            onClick={() => navigate('/seller')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>판매자 대시보드로 돌아가기</span>
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
              <h1 className="text-3xl font-bold text-gray-900">상품 관리</h1>
            </div>
            <p className="text-gray-600 mt-2">
              판매 상품을 등록하고 관리할 수 있습니다.
            </p>
          </div>
          <Button
            onClick={() => navigate('/seller/products/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span>상품 등록</span>
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
          /* Products Grid */
          <div className="bg-white rounded-lg shadow-sm border">
            {products.length === 0 ? (
              <div className="text-center py-20">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">등록된 상품이 없습니다.</p>
                <Button
                  onClick={() => navigate('/seller/products/new')}
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
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">가격</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">재고</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">상태</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">라이브 스트림</th>
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
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64'
                                }}
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
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {product.live_stream_title || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => navigate(`/seller/products/${product.id}/edit`)}
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

        {/* Stats Card */}
        {products.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">전체 상품</p>
                  <p className="text-2xl font-bold text-gray-900">{products.length}개</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Eye className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">판매중</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {products.filter(p => p.is_active).length}개
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Box className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">총 재고</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {products.reduce((sum, p) => sum + p.stock, 0)}개
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
