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
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
        </div>
      </GripFrameLayout>
    )
  }

  return (
    <GripFrameLayout>
      <div className="min-h-screen bg-gray-50 pb-24">
        {/* Header - UR Live Branding */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition" onClick={() => navigate('/browse')}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <h1 className="text-2xl font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              UR Live
            </h1>
            
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition" onClick={() => navigate('/search')}>
                <Search className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                <Bell className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => setFilterTab('live')}
              className={`text-sm font-semibold transition-all duration-200 ${
                filterTab === 'live' 
                  ? 'text-purple-600 scale-105' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              라이브 중
            </button>
            <button
              onClick={() => setFilterTab('popularity')}
              className={`flex items-center gap-1 text-sm font-semibold transition-all duration-200 ${
                filterTab === 'popularity' 
                  ? 'text-purple-600 scale-105' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              인기순 <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => setFilterTab('newest')}
              className={`flex items-center gap-1 text-sm font-semibold transition-all duration-200 ${
                filterTab === 'newest' 
                  ? 'text-purple-600 scale-105' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              최신순 <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Section Header - Popular Products */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-3 border-b border-purple-100">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="text-purple-600">🔥</span>
            인기 상품
          </h3>
        </div>

        {/* Product Grid - 2 Columns */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50">
          {products.map((product, index) => (
            <div
              key={product.id}
              onClick={() => handleProductClick(product.id)}
              className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
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
                  <div className="absolute top-2 left-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                    {product.discount_rate}%
                  </div>
                )}
                
                {product.sold_count && product.sold_count > 100 && (
                  <div className="absolute top-2 right-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                    인기
                  </div>
                )}

                {/* Ranking Badge for top 3 */}
                {index < 3 && (
                  <div className="absolute bottom-2 left-2 w-7 h-7 bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg">
                    {index + 1}
                  </div>
                )}

                {/* Like Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    // TODO: Add to favorites
                  }}
                  className="absolute bottom-2 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white hover:scale-110 transition-all duration-200"
                >
                  <Heart className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {/* Product Info */}
              <div className="p-3">
                <p className="text-xs text-gray-500 mb-1">{product.seller_name}</p>
                <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2 leading-snug">
                  {product.name}
                </h4>
                
                <div className="flex items-center gap-2 mb-3">
                  {product.original_price && product.original_price > product.current_price && (
                    <span className="text-xs text-gray-400 line-through">
                      ₩{product.original_price.toLocaleString()}
                    </span>
                  )}
                  <span className="text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                    ₩{product.current_price.toLocaleString()}
                  </span>
                </div>

                {/* Purchase Button */}
                <button
                  onClick={(e) => handleAddToCart(product.id, e)}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-sm py-2.5 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-[1.02]"
                >
                  장바구니 담기
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Live Streams Section */}
        {streams.length > 0 && (
          <div className="mt-4 bg-white">
            <div className="bg-gradient-to-r from-red-50 to-pink-50 px-4 py-3 border-b border-red-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <h3 className="text-lg font-bold text-gray-900">지금 LIVE 중</h3>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50">
              {streams.slice(0, 4).map((stream) => (
                <div
                  key={stream.id}
                  onClick={() => handleStreamClick(stream.id)}
                  className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
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
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                      LIVE
                    </div>

                    {/* Viewer Count */}
                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {stream.viewer_count || 0}
                    </div>

                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-transform duration-200">
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

        {/* Bottom Navigation - Casual Design */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200 shadow-lg z-40">
          <div className="max-w-md mx-auto flex justify-around items-center py-3">
            <button
              onClick={() => {
                setActiveTab('home')
                navigate('/')
              }}
              className={`flex flex-col items-center gap-1.5 px-3 transition-all duration-200 ${
                activeTab === 'home' 
                  ? 'text-purple-600 scale-110' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className={`p-2 rounded-2xl transition-all duration-200 ${
                activeTab === 'home' 
                  ? 'bg-gradient-to-br from-purple-100 to-indigo-100' 
                  : 'hover:bg-gray-100'
              }`}>
                <Home className="w-6 h-6" strokeWidth={activeTab === 'home' ? 2.5 : 2} />
              </div>
              <span className="text-xs font-semibold">홈</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('search')
                navigate('/search')
              }}
              className={`flex flex-col items-center gap-1.5 px-3 transition-all duration-200 ${
                activeTab === 'search' 
                  ? 'text-purple-600 scale-110' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className={`p-2 rounded-2xl transition-all duration-200 ${
                activeTab === 'search' 
                  ? 'bg-gradient-to-br from-purple-100 to-indigo-100' 
                  : 'hover:bg-gray-100'
              }`}>
                <Search className="w-6 h-6" strokeWidth={activeTab === 'search' ? 2.5 : 2} />
              </div>
              <span className="text-xs font-semibold">검색</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('cart')
                navigate('/cart')
              }}
              className={`flex flex-col items-center gap-1.5 px-3 transition-all duration-200 ${
                activeTab === 'cart' 
                  ? 'text-purple-600 scale-110' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className={`p-2 rounded-2xl relative transition-all duration-200 ${
                activeTab === 'cart' 
                  ? 'bg-gradient-to-br from-purple-100 to-indigo-100' 
                  : 'hover:bg-gray-100'
              }`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={activeTab === 'cart' ? 2.5 : 2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="text-xs font-semibold">장바구니</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('like')
                // TODO: Add favorites page route
              }}
              className={`flex flex-col items-center gap-1.5 px-3 transition-all duration-200 ${
                activeTab === 'like' 
                  ? 'text-purple-600 scale-110' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className={`p-2 rounded-2xl transition-all duration-200 ${
                activeTab === 'like' 
                  ? 'bg-gradient-to-br from-purple-100 to-indigo-100' 
                  : 'hover:bg-gray-100'
              }`}>
                <Heart className="w-6 h-6" strokeWidth={activeTab === 'like' ? 2.5 : 2} />
              </div>
              <span className="text-xs font-semibold">좋아요</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('my')
                navigate('/mypage')
              }}
              className={`flex flex-col items-center gap-1.5 px-3 transition-all duration-200 ${
                activeTab === 'my' 
                  ? 'text-purple-600 scale-110' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className={`p-2 rounded-2xl transition-all duration-200 ${
                activeTab === 'my' 
                  ? 'bg-gradient-to-br from-purple-100 to-indigo-100' 
                  : 'hover:bg-gray-100'
              }`}>
                <User className="w-6 h-6" strokeWidth={activeTab === 'my' ? 2.5 : 2} />
              </div>
              <span className="text-xs font-semibold">마이</span>
            </button>
          </div>
        </nav>
      </div>
    </GripFrameLayout>
  )
}
