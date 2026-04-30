import { useNavigate } from 'react-router-dom'

interface Product {
  id: number
  name: string
  price: number
  original_price: number
  discount_rate: number
  stock: number
  image_url: string | null
}

interface ProductGridProps {
  products: Product[]
}

export function ProductGrid({ products }: ProductGridProps) {
  const navigate = useNavigate()

  if (products.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-700">
          Products
        </h2>
        <p className="text-sm text-gray-500 text-center py-8">
          등록된 상품이 없습니다.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-700">
        Products
      </h2>
      
      <div className="grid grid-cols-2 gap-3">
        {products.map((product) => (
          <button
            key={product.id}
            onClick={() => navigate(`/product/${product.id}`)}
            className="group text-left"
          >
            {/* Product Image */}
            <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100 mb-2">
              <img
                src={product.image_url || 'https://via.placeholder.com/400?text=No+Image'}
                alt={product.name}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-all duration-300 group-hover:scale-110"
                onError={(e) => {
                  e.currentTarget.src = 'https://via.placeholder.com/400?text=No+Image'
                }}
              />
              
              {/* Out of Stock Badge */}
              {product.stock === 0 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-white text-xs font-semibold tracking-wide">
                    SOLD OUT
                  </span>
                </div>
              )}

              {/* Discount Badge */}
              {product.discount_rate > 0 && product.stock > 0 && (
                <div className="absolute top-2 left-2">
                  <span className="inline-block px-2 py-1 text-xs font-bold bg-red-500 text-white rounded">
                    {product.discount_rate}%
                  </span>
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="space-y-1">
              <h3 className="text-xs text-gray-900 line-clamp-2 leading-relaxed tracking-wide group-hover:text-gray-600 transition-colors">
                {product.name}
              </h3>
              
              <div className="flex items-baseline gap-1.5">
                {product.discount_rate > 0 && (
                  <span className="text-sm font-bold text-red-500">
                    {product.discount_rate}%
                  </span>
                )}
                <span className="text-sm font-bold text-gray-900">
                  {product.price.toLocaleString()}원
                </span>
              </div>

              {product.original_price > product.price && (
                <p className="text-xs text-gray-400 line-through">
                  {product.original_price.toLocaleString()}원
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
