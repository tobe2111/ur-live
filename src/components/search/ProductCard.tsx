import { Link } from 'react-router-dom'
import { Package } from 'lucide-react'

interface Product {
  id: number
  name: string
  price: number
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
  const getDiscountedPrice = (price: number, discountRate: number) => {
    return Math.floor(price * (1 - discountRate / 100))
  }

  const discountedPrice = getDiscountedPrice(product.price, product.discount_rate)

  return (
    <Link
      to={`/product/${product.id}`}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all"
    >
      {/* 상품 이미지 */}
      <div className="relative aspect-square overflow-hidden bg-[#f5f5f7]">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-[#6e6e73]" />
          </div>
        )}
        
        {/* 품절 오버레이 */}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-[15px] font-bold">품절</span>
          </div>
        )}
        
        {/* 할인율 배지 */}
        {product.discount_rate > 0 && product.stock > 0 && (
          <div className="absolute top-2 left-2 bg-[#ff3b30] text-white px-2 py-1 rounded-lg">
            <span className="text-[12px] font-bold">{product.discount_rate}%</span>
          </div>
        )}
      </div>

      {/* 상품 정보 */}
      <div className="p-3">
        {/* 판매자명 */}
        <p className="text-[11px] text-[#6e6e73] mb-1 line-clamp-1">
          {product.seller_name || product.seller_username}
        </p>
        
        {/* 상품명 */}
        <h3 className="text-[14px] font-semibold text-[#1d1d1f] mb-2 line-clamp-2 min-h-[40px]">
          {product.name}
        </h3>

        {/* 가격 */}
        <div className="flex flex-col gap-1">
          {product.discount_rate > 0 ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[#ff3b30] text-[14px] font-bold">
                  {product.discount_rate}%
                </span>
                <span className="text-[#1d1d1f] text-[16px] font-bold">
                  {discountedPrice.toLocaleString()}원
                </span>
              </div>
              <span className="text-[#8e8e93] text-[12px] line-through">
                {product.price.toLocaleString()}원
              </span>
            </>
          ) : (
            <span className="text-[#1d1d1f] text-[16px] font-bold">
              {product.price.toLocaleString()}원
            </span>
          )}
        </div>

        {/* 재고 경고 */}
        {product.stock > 0 && product.stock <= 10 && (
          <p className="text-[11px] text-[#ff9500] font-semibold mt-2">
            재고 {product.stock}개
          </p>
        )}
      </div>
    </Link>
  )
}
