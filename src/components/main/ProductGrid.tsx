import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingBag, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'

interface Product {
  id: number
  name: string
  price: number
  original_price?: number
  image_url?: string
  seller_name?: string
  is_new?: boolean
  is_popular?: boolean
  discount_rate?: number
}

function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate()
  const discountRate = product.discount_rate || (product.original_price ? Math.round((1 - product.price / product.original_price) * 100) : 0)

  return (
    <div
      className="cursor-pointer active:scale-[0.98] transition-transform"
      role="button"
      tabIndex={0}
      aria-label={`${product.name} 상세 보기`}
      onClick={() => navigate(`/products/${product.id}`)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/products/${product.id}`) } }}
    >
      <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-[#1A1A1A] rounded-xl">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
            <span className="text-gray-500 dark:text-gray-400 text-xs">No Image</span>
          </div>
        )}
        {discountRate > 0 && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
            {discountRate}%
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/products/${product.id}`) }}
          className="absolute bottom-2 right-2 p-1.5 bg-white/80 dark:bg-[#121212]/90 rounded-lg shadow-sm"
        >
          <ShoppingBag className="h-3.5 w-3.5 text-gray-700 dark:text-gray-300" />
        </button>
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-[12px] text-gray-900 dark:text-gray-100 leading-snug line-clamp-2">
          {product.name}
        </p>
        <div className="mt-1 flex items-baseline gap-1.5">
          {discountRate > 0 && (
            <span className="text-[13px] font-extrabold text-red-500">{discountRate}%</span>
          )}
          <span className="text-[13px] font-extrabold text-gray-900 dark:text-white">
            {formatNumber(product.price)}원
          </span>
        </div>
        {product.original_price && product.original_price > product.price && (
          <span className="text-[11px] text-gray-500 dark:text-gray-400 line-through">
            {formatNumber(product.original_price)}원
          </span>
        )}
      </div>
    </div>
  )
}

export default function ProductGrid() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/products?limit=6&sort=popular&featured=true')
      .then(r => {
        if (r.data.success && Array.isArray(r.data.data)) {
          setProducts(r.data.data)
        }
      })
      .catch((e) => { if (import.meta.env.DEV) console.warn('[ProductGrid] fetch failed:', e) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <section className="px-4 py-5">
        <div className="h-6 w-24 bg-[#333] animate-pulse rounded mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i}>
              <div className="aspect-square bg-gray-100 dark:bg-[#1A1A1A] animate-pulse rounded-xl" />
              <div className="mt-2 h-3 bg-gray-100 dark:bg-[#1A1A1A] animate-pulse rounded w-full" />
              <div className="mt-1 h-3 bg-gray-100 dark:bg-[#1A1A1A] animate-pulse rounded w-2/3" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="px-4 py-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[16px] font-extrabold text-gray-900 dark:text-white">UR 특가 🔥</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">지금 가장 인기있는 상품</p>
        </div>
        <a href="/browse" className="flex items-center text-[12px] text-gray-500 font-medium">
          전체보기 <ChevronRight className="w-3.5 h-3.5" />
        </a>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}
