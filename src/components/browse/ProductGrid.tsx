import { ShoppingBag } from 'lucide-react'
import BrowseProductCard from './BrowseProductCard'

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

interface ProductGridProps {
  products: Product[]
  loading: boolean
}

export default function ProductGrid({ products, loading }: ProductGridProps) {
  // Loading State
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-square bg-gray-200 animate-pulse rounded"></div>
            <div className="h-4 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-3 bg-gray-200 animate-pulse rounded w-3/4"></div>
          </div>
        ))}
      </div>
    )
  }

  // Empty State
  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">해당 카테고리에 상품이 없습니다.</p>
      </div>
    )
  }

  // Product Grid
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
      {products.map((product) => (
        <BrowseProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
