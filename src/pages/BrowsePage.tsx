import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { ShoppingBag, Bookmark } from 'lucide-react'
import TopNav from '@/components/main/TopNav'
import BottomNav from '@/components/main/BottomNav'

interface Product {
  id: number
  name: string
  price: number
  current_price: number
  original_price?: number
  discount_rate: number
  image_url: string
  sold_count?: number
  stock: number
  category?: string
  seller_name?: string
  is_new?: boolean
  is_popular?: boolean
}

const categoryLabels: Record<string, string> = {
  all: '전체',
  fashion: '패션',
  beauty: '뷰티',
  food: '식품',
  electronics: '전자제품',
  lifestyle: '라이프스타일',
  home: '홈/리빙',
  sports: '스포츠'
}

export default function BrowsePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const category = searchParams.get('category') || 'all'

  useEffect(() => {
    loadProducts()
  }, [category])

  async function loadProducts() {
    try {
      setLoading(true)
      // 카테고리별 상품 조회 API
      const url = category === 'all' 
        ? '/api/products'
        : `/api/products?category=${category}`
      
      const response = await api.get(url)
      
      if (response.data.success) {
        setProducts(response.data.data || [])
      }
    } catch (err) {
      console.error('Failed to load products:', err)
    } finally {
      setLoading(false)
    }
  }

  // ProductCard 컴포넌트 (ProductGrid와 100% 동일)
  function ProductCard({ product }: { product: Product }) {
    const [saved, setSaved] = useState(false)
    const [loading, setLoading] = useState(false)

    // 위시리스트 상태 확인
    useEffect(() => {
      const checkWishlist = async () => {
        try {
          const userId = localStorage.getItem('userId')
          if (!userId) return
          
          const response = await api.get(`/api/wishlists/check/${userId}/${product.id}`)
          if (response.data.success) {
            setSaved(response.data.data.isSaved)
          }
        } catch (err) {
          console.error('위시리스트 확인 실패:', err)
        }
      }
      checkWishlist()
    }, [product.id])

    const handleCardClick = () => {
      navigate(`/product/${product.id}`)
    }

    const handleSaveClick = async (e: React.MouseEvent) => {
      e.stopPropagation()
      
      const userId = localStorage.getItem('userId')
      if (!userId) {
        alert('로그인이 필요합니다.')
        navigate('/login')
        return
      }
      
      if (loading) return
      setLoading(true)
      
      try {
        if (saved) {
          // 위시리스트에서 제거
          await api.delete(`/api/wishlists/product/${product.id}`)
          setSaved(false)
        } else {
          // 위시리스트에 추가
          await api.post('/api/wishlists', {
            user_id: parseInt(userId),
            product_id: product.id
          })
          setSaved(true)
        }
      } catch (err) {
        console.error('위시리스트 처리 실패:', err)
        alert('저장 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    const getTag = () => {
      if (product.is_new) return 'New'
      if (product.is_popular) return 'Popular'
      return null
    }

    const tag = getTag()
    const discountRate = product.discount_rate || (product.original_price ? Math.round((1 - product.price / product.original_price) * 100) : 0)

    return (
      <div className="group cursor-pointer" onClick={handleCardClick}>
        <div className="relative aspect-square overflow-hidden bg-gray-100 rounded-sm">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
              <span className="text-gray-400 text-xs">No Image</span>
            </div>
          )}
          {tag && (
            <span className="absolute top-2 left-2 bg-gray-900 text-white text-[10px] font-bold uppercase px-2 py-0.5 tracking-wide">
              {tag}
            </span>
          )}
          {discountRate > 0 && (
            <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
              -{discountRate}%
            </span>
          )}
          <button
            onClick={handleSaveClick}
            aria-label={saved ? 'Remove from saved' : 'Save item'}
            className="absolute bottom-2 right-2 p-1.5 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Bookmark
              className={`h-4 w-4 ${saved ? 'fill-gray-900 text-gray-900' : 'text-gray-900'}`}
              strokeWidth={1.5}
            />
          </button>
        </div>
        <div className="mt-2.5 px-0.5">
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">
            {product.seller_name || 'Brand'}
          </p>
          <p className="mt-0.5 text-xs text-gray-600 leading-relaxed line-clamp-2">
            {product.name}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <p className="text-sm font-bold text-foreground">
              ₩{product.price.toLocaleString()}
            </p>
            {product.original_price && product.original_price > product.price && (
              <p className="text-xs text-gray-400 line-through">
                ₩{product.original_price.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNav />
      
      <main className="px-4 py-6">
        {/* 카테고리 제목 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {categoryLabels[category] || '전체'} 상품
          </h1>
          <p className="text-sm text-muted-foreground">
            {products.length}개의 상품
          </p>
        </div>

        {/* 상품 그리드 */}
        {loading ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="aspect-square bg-gray-200 animate-pulse rounded"></div>
                <div className="h-4 bg-gray-200 animate-pulse rounded"></div>
                <div className="h-3 bg-gray-200 animate-pulse rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">해당 카테고리에 상품이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
      
      <BottomNav />
    </div>
  )
}
