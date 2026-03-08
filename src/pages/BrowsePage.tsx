import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import TopNav from '@/components/main/TopNav'
import BottomNav from '@/components/main/BottomNav'
import CategoryHeader from '@/components/browse/CategoryHeader'
import ProductGrid from '@/components/browse/ProductGrid'

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
    <div className="min-h-screen bg-background">
      <TopNav />
      
      <main className="px-4 py-6">
        {/* 카테고리 제목 */}
        <CategoryHeader category={category} productCount={products.length} />

        {/* 상품 그리드 */}
        <ProductGrid products={products} loading={loading} />
      </main>
      
      {/* Bottom Navigation Spacer */}
      <div className="h-20" aria-hidden="true"></div>
      
      <BottomNav />
    </div>
  )
}
