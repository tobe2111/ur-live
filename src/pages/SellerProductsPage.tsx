import { CustomModal, useModal } from '@/components/CustomModal'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import SellerLayout from '@/components/SellerLayout'
import {
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
  Download,
  Upload
} from 'lucide-react'
import { downloadSellerTemplate } from '@/utils/product-template'
import BulkUploadModal from '@/components/BulkUploadModal'

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
  const [supplyProducts, setSupplyProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [activeTab, setActiveTab] = useState<'my' | 'supply'>('my')

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    setLoading(true)
    setError('')

    try {
      const sessionToken = localStorage.getItem('seller_token')
      

      if (!sessionToken) {
        navigate('/seller/login')
        return
      }

      const headers = { 'Authorization': `Bearer ${sessionToken}` }
      const [prodRes, supplyRes] = await Promise.allSettled([
        api.get('/api/seller/products', { headers }),
        api.get('/api/supply/products', { headers }),
      ])
      if (prodRes.status === 'fulfilled' && prodRes.value.data.success) {
        setProducts(prodRes.value.data.data || [])
      }
      if (supplyRes.status === 'fulfilled' && supplyRes.value.data?.success) {
        const d = supplyRes.value.data.data
        const items = Array.isArray(d) ? d : d?.items || []
        setSupplyProducts(items.filter((p: Record<string, unknown>) =>
          String(p.request_status || '').toUpperCase() === 'APPROVED'
        ).map((p: Record<string, unknown>) => ({
          id: p.id, name: p.name, description: p.description || '',
          price: p.retail_price || p.price, stock: p.stock || 0,
          image_url: p.image_url || '', is_active: 1, category: p.category || '',
        } as unknown as Product)))
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
      const sessionToken = localStorage.getItem('seller_token')
      

      const response = await api.put(
        `/api/seller/products/${productId}`,
        { is_active: !currentStatus, status: !currentStatus ? 'ACTIVE' : 'PAUSED' },
        { headers: { 'Authorization': `Bearer ${sessionToken}` } }
      )

      if (response.data.success) {
        toast.success('상품 상태가 변경되었습니다.')
        loadProducts()
      }
    } catch (error: any) {
      console.error('Failed to toggle product:', error)
      toast.error(error.response?.data?.error || '상품 상태 변경에 실패했습니다.')
    }
  }

  async function handleDelete(productId: number) {
    if (!confirm('정말 이 상품을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    setDeleting(productId)

    try {
      const sessionToken = localStorage.getItem('seller_token')
      

      const response = await api.delete(`/api/seller/products/${productId}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      if (response.data.success) {
        toast.success('상품이 삭제되었습니다.')
        loadProducts()
      }
    } catch (error: any) {
      console.error('Failed to delete product:', error)
      toast.error(error.response?.data?.error || '상품 삭제에 실패했습니다.')
    } finally {
      setDeleting(null)
    }
  }

  function formatPrice(price: number) {
    return price.toLocaleString('ko-KR')
  }

  return (
    <SellerLayout title="상품 관리">
      <div className="max-w-7xl mx-auto">
        {/* Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <Package className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-blue-600" />
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">상품 관리</h1>
            </div>
            <p className="text-sm sm:text-base text-gray-600">
              판매 상품을 등록하고 관리할 수 있습니다.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={downloadSellerTemplate}
              variant="outline"
              className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100 px-3 py-2.5 flex items-center gap-1.5 justify-center text-sm flex-1 sm:flex-none"
            >
              <Download className="w-4 h-4" />
              <span>대량등록 양식 다운로드</span>
            </Button>
            <Button
              onClick={() => setShowBulkUpload(true)}
              variant="outline"
              className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 px-3 py-2.5 flex items-center gap-1.5 justify-center text-sm flex-1 sm:flex-none"
            >
              <Upload className="w-4 h-4" />
              <span>대량등록</span>
            </Button>
            <Button
              onClick={() => navigate('/seller/products/new')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 flex items-center gap-2 justify-center text-sm flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4" />
              <span>상품 등록</span>
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <Trash2 className="w-5 h-5" />
              <p>{error}</p>
            </div>
            <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">다시 시도</button>
          </div>
        )}

        {/* 탭: 내 상품 / 공급 상품 */}
        <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'my' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            내 상품 ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('supply')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'supply' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            공급 상품 ({supplyProducts.length})
          </button>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          </div>
        ) : (
          /* Products List */
          <div>
            {(activeTab === 'my' ? products : supplyProducts).length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border text-center py-12 sm:py-20">
                <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-sm sm:text-base text-gray-600 mb-4">등록된 상품이 없습니다.</p>
                <Button
                  onClick={() => navigate('/seller/products/new')}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  첫 상품 등록하기
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop Table View - Hidden on mobile */}
                <div className="hidden lg:block bg-white rounded-lg shadow-sm border overflow-x-auto">
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
                      {(activeTab === 'my' ? products : supplyProducts).map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                              {product.image_url && product.image_url.trim() !== '' ? (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                  }}
                                />
                              ) : null}
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

                {/* Mobile Card View - Shown on mobile/tablet */}
                <div className="lg:hidden space-y-3 sm:space-y-4">
                  {(activeTab === 'my' ? products : supplyProducts).map((product) => (
                    <div key={product.id} className="bg-white rounded-lg shadow-sm border p-3 sm:p-4">
                      <div className="flex gap-3 sm:gap-4">
                        {/* Product Image */}
                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                          {product.image_url && product.image_url.trim() !== '' ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          ) : null}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="text-sm sm:text-base font-semibold text-gray-900 line-clamp-2">
                              {product.name}
                            </h3>
                            <button
                              onClick={() => handleToggleActive(product.id, product.is_active)}
                              className="flex-shrink-0"
                            >
                              {product.is_active ? (
                                <Badge className="bg-blue-100 text-blue-800 border-blue-200 cursor-pointer hover:bg-blue-200 text-xs">
                                  <Eye className="w-3 h-3 mr-1" />
                                  판매중
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-800 border-gray-200 cursor-pointer hover:bg-gray-200 text-xs">
                                  <EyeOff className="w-3 h-3 mr-1" />
                                  비활성
                                </Badge>
                              )}
                            </button>
                          </div>

                          {product.description && (
                            <p className="text-xs sm:text-sm text-gray-500 line-clamp-1 mb-2">
                              {product.description}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-1 text-gray-900">
                              <DollarSign className="w-4 h-4 text-green-600" />
                              <span className="text-base sm:text-lg font-bold">
                                {formatPrice(product.price)}원
                              </span>
                            </div>
                            <Badge className={product.stock > 0 ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}>
                              <Box className="w-3 h-3 mr-1" />
                              {product.stock > 0 ? `${product.stock}개` : '품절'}
                            </Badge>
                          </div>

                          {product.live_stream_title && (
                            <p className="text-xs text-gray-500 mb-2">
                              📺 {product.live_stream_title}
                            </p>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigate(`/seller/products/${product.id}/edit`)}
                              className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 text-xs sm:text-sm"
                            >
                              <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              수정
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              disabled={deleting === product.id}
                              className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 text-xs sm:text-sm"
                            >
                              {deleting === product.id ? (
                                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                              ) : (
                                <>
                                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  삭제
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
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
      <BulkUploadModal
        open={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        tokenKey="seller_token"
        onSuccess={loadProducts}
      />
    </SellerLayout>
  )
}
