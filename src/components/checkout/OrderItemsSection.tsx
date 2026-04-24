import { Package } from 'lucide-react'
import { CartItem } from '@/types/cart'
import { SellerGroup } from './checkout-types'

interface OrderItemsSectionProps {
  cartItems: CartItem[]
  sellerGroups: Record<number, SellerGroup>
}

export function OrderItemsSection({ cartItems, sellerGroups }: OrderItemsSectionProps) {
  return (
    <section className="bg-white px-5 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-gray-900">주문 상품</h2>
        <span className="text-[13px] text-gray-400">
          {cartItems.length}개
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-5">
        {Object.values(sellerGroups).map((group) => (
          <div key={group.seller_id} className="border border-gray-200 rounded-2xl p-4">
            <p className="text-[13px] font-semibold text-gray-500 mb-3">
              {group.seller_name}
            </p>

            {group.items.map((item) => (
              <div key={item.id} className="flex gap-4 py-3 border-t border-gray-200 first:border-t-0">
                {/* 이미지 or 아이콘 */}
                <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-gray-50">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.product_name}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-7 w-7 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* 상품 정보 */}
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                  <p className="truncate text-[14px] leading-snug text-gray-900">
                    {item.product_name}
                  </p>
                  {item.option_value && (
                    <p className="text-[13px] text-gray-400">
                      {item.option_value} / {item.quantity}개
                    </p>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-bold text-gray-900">
                      {((item.price_snapshot ?? 0) * item.quantity).toLocaleString()}원
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* 배송비 정보 */}
            <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-[13px]">
              <span className="text-gray-400">배송비</span>
              <span className="font-semibold text-gray-900">
                {group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold
                  ? <span className="text-blue-600 font-medium">무료</span>
                  : `${group.shipping_fee.toLocaleString()}원`}
              </span>
            </div>
            {group.free_shipping_threshold > 0 && group.subtotal < group.free_shipping_threshold && (
              <p className="text-[12px] text-gray-500 mt-1">
                {(group.free_shipping_threshold - group.subtotal).toLocaleString()}원 추가 시 무료배송
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
