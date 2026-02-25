import { CustomModal, useModal } from '@/components/CustomModal'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { GripVertical } from 'lucide-react'

interface Product {
  id: number
  name: string
  price: number
  original_price: number
  discount_rate: number
  stock: number
  image_url: string
}

interface LiveStream {
  id: number
  title: string
  youtube_video_id: string
  status: string
  current_product_id: number | null
  created_at: string
}

export default function SellerLiveControlPage() {
  const navigate = useNavigate()
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedStream, setSelectedStream] = useState<LiveStream | null>(null)
  const [currentProductId, setCurrentProductId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [changing, setChanging] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  useEffect(() => {
    // Check seller session (JWT-based)
    const accessToken = localStorage.getItem('access_token')
    const userType = localStorage.getItem('user_type')
    
    if (!accessToken || userType !== 'seller') {
      navigate('/seller/login')
      return
    }

    loadData()
  }, [navigate])

  async function loadData() {
    try {
      // Load live streams
      const streamsRes = await api.get('/api/seller/streams')
      
      // Load products
      const productsRes = await api.get('/api/seller/products')

      const liveStreams = streamsRes.data.data.filter((s: LiveStream) => s.status === 'live')
      setStreams(liveStreams)
      setProducts(productsRes.data.data)

      // Auto-select first live stream
      if (liveStreams.length > 0) {
        setSelectedStream(liveStreams[0])
        setCurrentProductId(liveStreams[0].current_product_id)
      }

      setLoading(false)
    } catch (err) {
      console.error('Failed to load data:', err)
      setLoading(false)
    }
  }

  async function changeProduct(productId: number) {
    if (!selectedStream || changing) return

    setChanging(true)
    try {
      await api.post(
        `/api/seller/streams/${selectedStream.id}/change-product`,
        { productId }
      )

      setCurrentProductId(productId)
      alert('상품이 변경되었습니다!')
    } catch (err: any) {
      alert(`상품 변경 실패: ${err.response?.data?.error || err.message}`)
    } finally {
      setChanging(false)
    }
  }

  function handleDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      return
    }

    const newProducts = [...products]
    const [draggedProduct] = newProducts.splice(draggedIndex, 1)
    newProducts.splice(dropIndex, 0, draggedProduct)
    
    setProducts(newProducts)
    setDraggedIndex(null)
  }

  function handleDragEnd() {
    setDraggedIndex(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (streams.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">진행 중인 라이브가 없습니다</h2>
            <p className="text-gray-600 mb-6">라이브 방송을 시작하려면 먼저 라이브 스트림을 생성하세요.</p>
            <button
              onClick={() => navigate('/seller')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              대시보드로 돌아가기
            </button>
          </div>
        </div>
      </div>
    )
  }

  const currentProduct = products.find(p => p.id === currentProductId)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">🔴 라이브 상품 컨트롤</h1>
            <button
              onClick={() => navigate('/seller')}
              className="text-gray-600 hover:text-gray-900"
            >
              대시보드로 돌아가기
            </button>
          </div>
          
          {/* Stream Selector */}
          {streams.length > 1 && (
            <select
              value={selectedStream?.id || ''}
              onChange={(e) => {
                const stream = streams.find(s => s.id === Number(e.target.value))
                setSelectedStream(stream || null)
                setCurrentProductId(stream?.current_product_id || null)
              }}
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg"
            >
              {streams.map(stream => (
                <option key={stream.id} value={stream.id}>
                  {stream.title}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Product Display */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">현재 노출 중인 상품</h2>
              
              {currentProduct ? (
                <div className="border-2 border-blue-500 rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-2">{currentProduct.name}</h3>
                  <div className="flex items-baseline gap-2 mb-2">
                    {currentProduct.discount_rate > 0 && (
                      <span className="text-red-500 font-bold">{currentProduct.discount_rate}%</span>
                    )}
                    <span className="text-xl font-bold">{currentProduct.price.toLocaleString()}원</span>
                  </div>
                  {currentProduct.original_price > currentProduct.price && (
                    <p className="text-gray-500 line-through">{currentProduct.original_price.toLocaleString()}원</p>
                  )}
                  <p className="text-sm text-gray-600 mt-2">재고: {currentProduct.stock}개</p>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  노출 중인 상품이 없습니다
                </div>
              )}
            </div>

            {/* Live Preview Link */}
            {selectedStream && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">📺 라이브 미리보기</p>
                <a
                  href={`/live/${selectedStream.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  {window.location.origin}/live/{selectedStream.id}
                </a>
              </div>
            )}
          </div>

          {/* Product List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">상품 목록 (클릭: 전환 | 드래그: 순서 변경)</h2>
              
              {products.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  등록된 상품이 없습니다
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {products.map((product, index) => (
                    <div
                      key={`${product.id}-${index}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`relative border-2 rounded-lg transition-all ${
                        draggedIndex === index ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Drag Handle */}
                      <div className="absolute top-2 left-2 text-gray-400 cursor-move">
                        <GripVertical className="w-4 h-4" />
                      </div>

                      {/* Product Button */}
                      <button
                        onClick={() => changeProduct(product.id)}
                        disabled={changing || currentProductId === product.id}
                        className={`w-full text-left p-3 pl-8 rounded-lg transition-all ${
                          currentProductId === product.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        } ${changing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <h3 className="font-bold text-gray-900 text-sm mb-1 truncate">{product.name}</h3>
                        <div className="flex items-baseline gap-1 mb-1">
                          {product.discount_rate > 0 && (
                            <span className="text-red-500 text-xs font-bold">{product.discount_rate}%</span>
                          )}
                          <span className="font-bold text-sm">{product.price.toLocaleString()}원</span>
                        </div>
                        <p className="text-xs text-gray-600">재고: {product.stock}개</p>
                        {currentProductId === product.id && (
                          <p className="text-xs text-blue-600 font-semibold mt-1">✓ 현재 노출 중</p>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-bold text-yellow-900 mb-2">💡 사용 방법</h3>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• 상품을 <strong>클릭</strong>하면 실시간으로 시청자 화면의 상품이 변경됩니다</li>
            <li>• 상품을 <strong>드래그</strong>하여 순서를 변경할 수 있습니다</li>
            <li>• 좌측에서 현재 노출 중인 상품을 확인할 수 있습니다</li>
            <li>• 라이브 미리보기 링크를 새 탭에서 열어 실시간으로 확인하세요</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
