import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ShoppingBag, Heart, Star, TrendingUp } from 'lucide-react'
import TopNav from '@/components/main/TopNav'
import BottomNav from '@/components/main/BottomNav'
import { LazyImage } from '@/components/LazyImage'

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
}

const categoryLabels: Record<string, string> = {
  all: '전체',
  fashion: '패션',
  beauty: '뷰티',
  food: '식품',
  electronics: '전자제품',
  lifestyle: '라이프스타일'
}

export default function BrowsePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
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
          <div className="text-center py-12">
            <p className="text-muted-foreground">상품을 불러오는 중...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">해당 카테고리에 상품이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {products.map((product) => (
              <Link
                key={product.id}
                to={`/product/${product.id}`}
                className="group"
              >
                <Card className="overflow-hidden hover:shadow-lg transition-all">
                  <div className="relative aspect-square">
                    <LazyImage
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {product.discount_rate > 0 && (
                      <Badge className="absolute top-2 left-2 bg-red-500">
                        {product.discount_rate}% OFF
                      </Badge>
                    )}
                    <button className="absolute top-2 right-2 p-2 bg-white/80 rounded-full hover:bg-white transition-colors">
                      <Heart className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="p-3">
                    <h3 className="font-semibold text-sm mb-2 line-clamp-2 text-foreground">
                      {product.name}
                    </h3>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-lg text-foreground">
                        {product.current_price.toLocaleString()}원
                      </span>
                      {product.original_price && product.original_price > product.current_price && (
                        <span className="text-xs text-muted-foreground line-through">
                          {product.original_price.toLocaleString()}원
                        </span>
                      )}
                    </div>
                    
                    {product.sold_count && product.sold_count > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        <span>{product.sold_count}개 판매</span>
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
      
      <BottomNav />
    </div>
  )
}
