import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, Home, Heart, User, ChevronDown, Share2, ShoppingCart } from 'lucide-react'
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

export default function ShortFormPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('home')
  const [filterTab, setFilterTab] = useState('popularity')
  const navigate = useNavigate()

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    try {
      setLoading(true)
      const response = await axios.get('/api/products?featured=true&limit=20')
      if (response.data.success) {
        setProducts(response.data.data)
      }
    } catch (error) {
      console.error('Failed to load products:', error)
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
        {/* Header - YOGO Style */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <button className="p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <h1 className="text-2xl font-black text-gray-900">YOGO</h1>
            
            <div className="flex items-center gap-2">
              <button className="p-2">
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
              onClick={() => setFilterTab('deals')}
              className={`text-sm font-medium ${filterTab === 'deals' ? 'text-blue-600' : 'text-gray-600'}`}
            >
              오늘의 특가
            </button>
            <button
              onClick={() => setFilterTab('popularity')}
              className={`flex items-center gap-1 text-sm font-medium ${filterTab === 'popularity' ? 'text-blue-600' : 'text-gray-600'}`}
            >
              인기순 <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => setFilterTab('views')}
              className={`flex items-center gap-1 text-sm font-medium ${filterTab === 'views' ? 'text-blue-600' : 'text-gray-600'}`}
            >
              조회순 <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <div className="relative h-64 bg-gradient-to-br from-orange-400 to-red-500 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white p-6">
              <h2 className="text-2xl font-bold mb-2">편리한 한 끼배달은</h2>
              <p className="text-xl mb-4">한주 속 6&50분</p>
              <button className="bg-white text-blue-600 font-bold px-6 py-2 rounded-full hover:bg-gray-100 transition">
                바로가기
              </button>
            </div>
          </div>
          <div className="absolute top-4 right-4">
            <button className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
              <Share2 className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Section Header */}
        <div className="bg-white px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">오늘의 추천 상품</h3>
        </div>

        {/* Product Grid - 2 Columns YOGO Style */}
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

                {/* Ranking Badge */}
                {index < 3 && (
                  <div className="absolute bottom-2 left-2 w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {index + 1}
                  </div>
                )}

                {/* Checkmark Badge */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    // TODO: Add to favorites
                  }}
                  className="absolute bottom-2 right-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-md"
                >
                  <Heart className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Product Info */}
              <div className="p-3">
                <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">
                  {product.name}
                </h4>
                
                <div className="flex items-center gap-2 mb-3">
                  {product.original_price && (
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
                  구매
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Section: 세트로 배달 */}
        <div className="mt-6">
          <div className="bg-white px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">세트로 배달</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-3 p-3">
            {products.slice(0, 4).map((product) => (
              <div
                key={`set-${product.id}`}
                className="bg-white rounded-xl shadow-sm overflow-hidden"
              >
                <div className="relative aspect-square bg-gray-100">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                    무료배송
                  </div>
                </div>
                <div className="p-3">
                  <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">
                    [세트] {product.name}
                  </h4>
                  <div className="text-lg font-bold text-blue-600 mb-2">
                    ₩{product.current_price.toLocaleString()}
                  </div>
                  <button className="w-full bg-blue-600 text-white font-bold text-sm py-2 rounded-lg">
                    구매
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section: 서비스 */}
        <div className="mt-6 mb-6">
          <div className="bg-white px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">서비스</h3>
          </div>
          
          <div className="space-y-3 p-3">
            {[
              { title: 'OTM 서비스 예약예', subtitle: '여행, 뷰티, 헬스 등', price: '₩25,000' },
              { title: '앱카 대행', subtitle: '운전기사 1시간', price: '₩45,000' },
              { title: 'JK코칭', subtitle: '1:1 맞춤 코칭', price: '₩80,000' }
            ].map((service, idx) => (
              <div key={idx} className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {idx + 1}
                    </div>
                    <h4 className="font-bold text-gray-900">{service.title}</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{service.subtitle}</p>
                  <p className="text-lg font-bold text-blue-600">{service.price}</p>
                </div>
                <button className="bg-blue-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-blue-700 transition">
                  예약
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Navigation - YOGO Style */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
          <div className="max-w-md mx-auto flex justify-around items-center py-2">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center gap-1 px-4 py-2 ${
                activeTab === 'home' ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <Home className="w-6 h-6" />
              <span className="text-xs font-medium">홈</span>
            </button>

            <button
              onClick={() => setActiveTab('search')}
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
              <ShoppingCart className="w-6 h-6" />
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
