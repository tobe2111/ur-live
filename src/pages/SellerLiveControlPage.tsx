import { CustomModal, useModal } from '@/components/CustomModal'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { useLiveStreamWebSocket } from '@/hooks/useLiveStreamWebSocket'
import SellerLayout from '@/components/SellerLayout'
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
  viewer_count?: number
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
  const [viewerCounts, setViewerCounts] = useState<Record<number, number>>({})
  
  // 🎭 Special Controls (권한 필요)
  const [canManipulateStats, setCanManipulateStats] = useState(false)
  const [manualViewerCount, setManualViewerCount] = useState<string>('')
  const [fakeProductName, setFakeProductName] = useState<string>('')
  const [fakeQuantity, setFakeQuantity] = useState<number>(1)
  const [sendingFakeNotification, setSendingFakeNotification] = useState(false)
  const [updatingViewerCount, setUpdatingViewerCount] = useState(false)

  // 🔌 DO WebSocket 실시간 스트림 구독 (선택된 스트림)
  const { streamData: wsStreamData } = useLiveStreamWebSocket(selectedStream?.id || null, !!selectedStream)

  // WebSocket에서 상품 변경 감지 시 UI 자동 업데이트
  useEffect(() => {
    if (!wsStreamData || !selectedStream) return

    if (wsStreamData.current_product_id !== currentProductId) {
      setCurrentProductId(wsStreamData.current_product_id)
    }
  }, [wsStreamData?.current_product_id, selectedStream?.id])

  useEffect(() => {
    // Check seller session (JWT-based) - seller_token이 primary
    const sellerToken = localStorage.getItem('seller_token') || localStorage.getItem('access_token')

    if (!sellerToken) {
      navigate('/seller/login')
      return
    }

    loadData()
  }, [navigate])

  // 실시간 시청자 수 업데이트 (10초마다)
  useEffect(() => {
    if (streams.length === 0) return

    const fetchViewerCounts = async () => {
      try {
        const counts: Record<number, number> = {}
        for (const stream of streams) {
          const response = await api.get(`/api/streams/${stream.id}/viewer-count`)
          if (response.data.success) {
            counts[stream.id] = response.data.data.viewer_count
          }
        }
        setViewerCounts(counts)
      } catch (error) {
        console.error('[SellerLiveControl] Failed to fetch viewer counts:', error)
      }
    }

    // 초기 로드
    fetchViewerCounts()

    // 10초마다 업데이트
    const interval = setInterval(fetchViewerCounts, 10000)

    return () => clearInterval(interval)
  }, [streams])

  async function loadData() {
    try {
      // Load live streams
      const streamsRes = await api.get('/api/seller/streams')
      
      // Load products
      const productsRes = await api.get('/api/seller/products')

      const allStreams = streamsRes.data?.data ?? []
      const liveStreams = allStreams.filter((s: LiveStream) => s.status === 'live')
      setStreams(liveStreams)
      setProducts(productsRes.data?.data ?? [])

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

  // 🎭 권한 확인 (can_manipulate_stats)
  async function checkPermissions() {
    try {
      const response = await api.get('/api/seller/profile')
      if (response.data.success) {
        setCanManipulateStats(!!response.data.data.can_manipulate_stats)
      }
    } catch (error) {
      console.error('Failed to check permissions:', error)
    }
  }

  // 🔢 시청자 수 조작
  async function handleUpdateViewerCount() {
    if (!selectedStream || updatingViewerCount) return
    
    const count = manualViewerCount ? parseInt(manualViewerCount) : null
    
    if (count !== null && (isNaN(count) || count < 0)) {
      toast.error('올바른 숫자를 입력하세요 (0 이상)')
      return
    }

    setUpdatingViewerCount(true)
    try {
      const response = await api.put(`/api/streams/${selectedStream.id}/viewer-count`, {
        manual_count: count
      })

      if (response.data.success) {
        toast.success(count === null ? '실제 시청자 수로 복귀했습니다!' : `시청자 수가 ${count}명으로 설정되었습니다!`)
        setManualViewerCount('')
        
        // 시청자 수 즉시 업데이트
        setViewerCounts(prev => ({
          ...prev,
          [selectedStream.id]: count || 0
        }))
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || '시청자 수 업데이트 실패'
      toast.error(errorMsg)
    } finally {
      setUpdatingViewerCount(false)
    }
  }

  // 🛒 가짜 장바구니 알림 전송
  async function handleSendFakeNotification() {
    if (!selectedStream || sendingFakeNotification) return
    
    if (!fakeProductName.trim()) {
      toast.error('상품명을 입력하세요')
      return
    }

    setSendingFakeNotification(true)
    try {
      const response = await api.post(`/api/streams/${selectedStream.id}/fake-cart-notification`, {
        product_name: fakeProductName.trim(),
        quantity: fakeQuantity
      })

      if (response.data.success) {
        toast.success('🎉 가짜 알림이 전송되었습니다!')
        setFakeProductName('')
        setFakeQuantity(1)
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || '알림 전송 실패'
      toast.error(errorMsg)
    } finally {
      setSendingFakeNotification(false)
    }
  }

  // 권한 확인 (초기 로드)
  useEffect(() => {
    checkPermissions()
  }, [])

  async function changeProduct(productId: number) {
    if (!selectedStream || changing) return

    setChanging(true)
    try {
      await api.post(
        `/api/seller/streams/${selectedStream.id}/change-product`,
        { productId }
      )

      setCurrentProductId(productId)
      toast.success('상품이 변경되었습니다!')
    } catch (err: any) {
      toast.error(`상품 변경 실패: ${err.response?.data?.error || err.message}`)
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
    <SellerLayout title="라이브 상품 컨트롤">
      <div className="max-w-7xl mx-auto">
        {/* Stream info & selector */}
        <div className="mb-6">
          {selectedStream && (
            <div className="flex items-center gap-2 mb-3 text-gray-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold">{viewerCounts[selectedStream.id] || 0}명 시청 중</span>
            </div>
          )}

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

            {/* 🎭 Special Controls (권한 필요) */}
            {canManipulateStats && selectedStream && (
              <div className="mt-4 space-y-4">
                {/* 시청자 수 조작 */}
                <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-purple-900 mb-3 flex items-center gap-2">
                    🔢 시청자 수 조작
                    <span className="text-xs bg-purple-200 px-2 py-0.5 rounded">관리자 승인됨</span>
                  </h3>
                  <div className="space-y-2">
                    <input
                      type="number"
                      min="0"
                      value={manualViewerCount}
                      onChange={(e) => setManualViewerCount(e.target.value)}
                      placeholder={`현재: ${viewerCounts[selectedStream.id] || 0}명`}
                      className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateViewerCount}
                        disabled={updatingViewerCount || !manualViewerCount}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                      >
                        {updatingViewerCount ? '설정 중...' : '설정'}
                      </button>
                      <button
                        onClick={() => {
                          setManualViewerCount('')
                          handleUpdateViewerCount()
                        }}
                        disabled={updatingViewerCount}
                        className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                      >
                        실제값 복귀
                      </button>
                    </div>
                    <p className="text-xs text-purple-700">
                      💡 실제: {viewerCounts[selectedStream.id] || 0}명
                    </p>
                  </div>
                </div>

                {/* 가짜 장바구니 알림 */}
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-yellow-900 mb-3 flex items-center gap-2">
                    🛒 장바구니 알림 전송
                    <span className="text-xs bg-yellow-200 px-2 py-0.5 rounded">관리자 승인됨</span>
                  </h3>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={fakeProductName}
                      onChange={(e) => setFakeProductName(e.target.value)}
                      placeholder="상품명 (예: 프리미엄 텀블러)"
                      className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-yellow-900">수량:</label>
                      <input
                        type="number"
                        min="1"
                        value={fakeQuantity}
                        onChange={(e) => setFakeQuantity(parseInt(e.target.value) || 1)}
                        className="w-20 px-2 py-1 border border-yellow-300 rounded text-sm"
                      />
                    </div>
                    <button
                      onClick={handleSendFakeNotification}
                      disabled={sendingFakeNotification || !fakeProductName.trim()}
                      className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                      {sendingFakeNotification ? '전송 중...' : '🎉 알림 전송'}
                    </button>
                    <p className="text-xs text-yellow-700">
                      💡 채팅창에 "🎉 {fakeProductName || '상품명'} {fakeQuantity}개가 장바구니에 추가되었습니다!" 메시지가 표시됩니다
                    </p>
                  </div>
                </div>
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
    </SellerLayout>
  )
}
