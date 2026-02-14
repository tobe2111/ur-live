import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, Home, Heart, User, ChevronDown, Play, Users } from 'lucide-react'
import { getUserId } from '@/utils/auth'
import axios from 'axios'
import GripFrameLayout from '@/components/GripFrameLayout'

interface Product {
  id: number
  name: string
  price: number
  current_price: number
  original_price?: number
  discount_rate: number
  image_url: string
  seller_name: string
  stock: number
  sold_count?: number
  category?: string
}

interface Stream {
  id: number
  title: string
  description: string
  thumbnail_url?: string
  seller_name: string
  viewer_count?: number
  status: string
}

export default function ShortFormPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('home')
  const [filterTab, setFilterTab] = useState('popularity')
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      
      // Load products
      const productsRes = await axios.get('/api/products?featured=true&limit=20')
      if (productsRes.data.success) {
        setProducts(productsRes.data.data)
      }

      // Load live streams
      const streamsRes = await axios.get('/api/streams?status=live')
      if (streamsRes.data.success) {
        setStreams(streamsRes.data.data || [])
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddToCart(productId: number, e: React.MouseEvent) {
    e.stopPropagation()
    const userId = getUserId()
    if (!userId) {
      if (confirm('로그인이 필요합니다. 로그인 페이지로 이동하시겠습니까?')) {
        navigate('/login')
      }
      return
    }

    try {
      await axios.post('/api/cart', {
        userId: Number(userId),
        productId: productId,
        quantity: 1
      })
      alert('장바구니에 추가되었습니다!')
    } catch (error) {
      console.error('Failed to add to cart:', error)
      alert('장바구니 추가에 실패했습니다.')
    }
  }

  function handleProductClick(productId: number) {
    navigate(`/product/${productId}`)
  }

  function handleStreamClick(streamId: number) {
    navigate(`/live/${streamId}`)
  }

  if (loading) {
    return (
      <GripFrameLayout>
        <div className="flex items-center justify-center h-screen bg-white">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      </GripFrameLayout>
    )
  }

  return (
    <GripFrameLayout>
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header - UR Live Branding */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <button className="p-2" onClick={() => navigate('/browse')}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <h1 className="text-2xl font-black text-gray-900">UR Live</h1>
            
            <div className="flex items-center gap-2">
              <button className="p-2" onClick={() => navigate('/search')}>
                <Search className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2">
                <Bell className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100">
            <button
              onClick={() => setFilterTab('live')}
              className={`text-sm font-medium ${filterTab === 'live' ? 'text-blue-600' : 'text-gray-600'}`}
            >
              라이브 중
            </button>
            <button
              onClick={() => setFilterTab('popularity')}
              className={`flex items-center gap-1 text-sm font-medium ${filterTab === 'popularity' ? 'text-blue-600' : 'text-gray-600'}`}
            >
              인기순 <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => setFilterTab('newest')}
              className={`flex items-center gap-1 text-sm font-medium ${filterTab === 'newest' ? 'text-blue-600' : 'text-gray-600'}`}
            >
              최신순 <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Live Streams Section */}
        {streams.length > 0 && (
          <div className="mt-2">
            <div className="bg-white px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <h3 className="text-lg font-bold text-gray-900">지금 LIVE 중</h3>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 p-3">
              {streams.slice(0, 4).map((stream) => (
                <div
                  key={stream.id}
                  onClick={() => handleStreamClick(stream.id)}
                  className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition"
                >
                  <div className="relative aspect-square bg-gray-900">
                    {stream.thumbnail_url ? (
                      <img
                        src={stream.thumbnail_url}
                        alt={stream.title}
                        className="w-full h-full object-cover opacity-90"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-16 h-16 text-white opacity-50" />
                      </div>
                    )}
                    
                    {/* LIVE Badge */}
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                      LIVE
                    </div>

                    {/* Viewer Count */}
                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {stream.viewer_count || 0}
                    </div>

                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center">
                        <Play className="w-6 h-6 text-white fill-white" />
                      </div>
                    </div>
                  </div>

                  <div className="p-3">
                    <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                      {stream.title}
                    </h4>
                    <p className="text-xs text-gray-600">{stream.seller_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section Header */}
        <div className="bg-white px-4 py-3 border-b border-gray-200 mt-4">
          <h3 className="text-lg font-bold text-gray-900">인기 상품</h3>
        </div>

        {/* Product Grid - 2 Columns */}
        <div className="grid grid-cols-2 gap-3 p-3">
          {products.map((product, index) => (
            <div
              key={product.id}
              onClick={() => handleProductClick(product.id)}
              className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition"
            >
              {/* Product Image */}
              <div className="relative aspect-square bg-gray-100">
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                
                {/* Badges */}
                {product.discount_rate > 0 && (
                  <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                    {product.discount_rate}%
                  </div>
                )}
                
                {product.sold_count && product.sold_count > 100 && (
                  <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                    인기
                  </div>
                )}

                {/* Ranking Badge for top 3 */}
                {index < 3 && (
                  <div className="absolute bottom-2 left-2 w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {index + 1}
                  </div>
                )}

                {/* Like Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    // TODO: Add to favorites
                  }}
                  className="absolute bottom-2 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition"
                >
                  <Heart className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {/* Product Info */}
              <div className="p-3">
                <p className="text-xs text-gray-500 mb-1">{product.seller_name}</p>
                <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">
                  {product.name}
                </h4>
                
                <div className="flex items-center gap-2 mb-3">
                  {product.original_price && product.original_price > product.current_price && (
                    <span className="text-xs text-gray-400 line-through">
                      ₩{product.original_price.toLocaleString()}
                    </span>
                  )}
                  <span className="text-lg font-bold text-blue-600">
                    ₩{product.current_price.toLocaleString()}
                  </span>
                </div>

                {/* Purchase Button */}
                <button
                  onClick={(e) => handleAddToCart(product.id, e)}
                  className="w-full bg-blue-600 text-white font-bold text-sm py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  장바구니
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
          <div className="max-w-md mx-auto flex justify-around items-center py-2">
            <button
              onClick={() => {
                setActiveTab('home')
                navigate('/')
              }}
              className={`flex flex-col items-center gap-1 px-4 py-2 ${
                activeTab === 'home' ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <Home className="w-6 h-6" />
              <span className="text-xs font-medium">홈</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('search')
                navigate('/search')
              }}
              className={`flex flex-col items-center gap-1 px-4 py-2 ${
                activeTab === 'search' ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <Search className="w-6 h-6" />
              <span className="text-xs font-medium">검색</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('cart')
                navigate('/cart')
              }}
              className={`flex flex-col items-center gap-1 px-4 py-2 ${
                activeTab === 'cart' ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <div className="relative">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="text-xs font-medium">장바구니</span>
            </button>

            <button
              onClick={() => setActiveTab('like')}
              className={`flex flex-col items-center gap-1 px-4 py-2 ${
                activeTab === 'like' ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <Heart className="w-6 h-6" />
              <span className="text-xs font-medium">좋아요</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('my')
                navigate('/mypage')
              }}
              className={`flex flex-col items-center gap-1 px-4 py-2 ${
                activeTab === 'my' ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <User className="w-6 h-6" />
              <span className="text-xs font-medium">마이</span>
            </button>
          </div>
        </nav>
      </div>
    </GripFrameLayout>
  )
}
