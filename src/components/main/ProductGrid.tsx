import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark } from 'lucide-react'
import axios from 'axios'

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
  const [saved, setSaved] = useState(false)

  const handleCardClick = () => {
    navigate(`/product/${product.id}`)
  }

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSaved(!saved)
    // TODO: 저장 API 호출
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

export default function ProductGrid() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      const response = await axios.get('/api/products?limit=6&sort=popular')
      if (response.data.success) {
        setProducts(response.data.data.products || [])
      }
    } catch (error) {
      console.error('Failed to load products:', error)
      // Fallback demo data
      setProducts([
        {
          id: 1,
          name: 'Premium Wireless Headphones',
          price: 89000,
          original_price: 149000,
          seller_name: 'Nike',
          is_new: false,
          is_popular: true,
        },
        {
          id: 2,
          name: 'Classic White Sneakers',
          price: 120000,
          seller_name: 'Adidas',
        },
        {
          id: 3,
          name: 'Leather Backpack',
          price: 75000,
          original_price: 110000,
          seller_name: 'Brand',
          is_new: true,
        },
        {
          id: 4,
          name: 'Sports Watch',
          price: 189000,
          seller_name: 'Jordan',
        },
        {
          id: 5,
          name: 'Designer Sunglasses',
          price: 125000,
          seller_name: 'ASICS',
          is_new: true,
        },
        {
          id: 6,
          name: 'Canvas Tote Bag',
          price: 45000,
          seller_name: 'Converse',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <section className="bg-background px-4 py-6">
        <div className="h-8 w-32 bg-gray-200 animate-pulse rounded mb-4"></div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-square bg-gray-200 animate-pulse rounded"></div>
              <div className="h-4 bg-gray-200 animate-pulse rounded"></div>
              <div className="h-3 bg-gray-200 animate-pulse rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="bg-background px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-extrabold text-foreground uppercase tracking-tight">
          Ur 특가
        </h3>
        <a 
          href="/browse" 
          className="text-xs font-medium text-gray-600 hover:text-foreground transition-colors"
        >
          See All
        </a>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}
