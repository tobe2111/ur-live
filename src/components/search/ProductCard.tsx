import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'

interface Product {
  id: number
  name: string
  price: number
  original_price?: number
  discount_rate: number
  image_url: string
  stock: number
  seller_name: string
  seller_username: string
}

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  const discountedPrice = Math.floor(product.price * (1 - (product.discount_rate || 0) / 100))
  const discount = product.discount_rate || 0

  return (
    <Link to={`/products/${product.id}`} className="block text-left">
      <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '1', background: '#F9FAFB' }}>
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <span className="text-gray-300 text-2xl">📦</span>
          </div>
        )}

        {discount > 0 && product.stock > 0 && (
          <span className="absolute top-1.5 left-1.5 rounded-md px-1.5 py-0.5"
            style={{ background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 800 }}>
            -{discount}%
          </span>
        )}

        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-[13px] font-bold">품절</span>
          </div>
        )}

        <button className="absolute bottom-1.5 right-1.5 rounded-full p-1.5"
          style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(6px)' }}
          onClick={(e) => e.preventDefault()}>
          <Heart className="w-3 h-3 text-gray-300" />
        </button>
      </div>

      <div className="mt-2">
        <p style={{ fontSize: 10, color: '#9CA3AF' }}>@{product.seller_name || product.seller_username}</p>
        <p style={{ fontSize: 12, color: '#111827', lineHeight: 1.3, marginTop: 2 }} className="line-clamp-2">
          {product.name}
        </p>
        {product.price > discountedPrice && (
          <p style={{ fontSize: 10, color: '#9CA3AF', textDecoration: 'line-through', marginTop: 3 }}>
            {product.price.toLocaleString()}원
          </p>
        )}
        <div className="flex items-baseline gap-1 mt-0.5">
          {discount > 0 && (
            <span style={{ fontSize: 13, fontWeight: 800, color: '#EF4444' }}>{discount}%</span>
          )}
          <span style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>
            {discountedPrice.toLocaleString()}원
          </span>
        </div>
        {product.stock > 0 && product.stock <= 10 && (
          <p style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600, marginTop: 4 }}>
            재고 {product.stock}개
          </p>
        )}
      </div>
    </Link>
  )
}
