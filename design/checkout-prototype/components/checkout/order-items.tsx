"use client"

import { Package } from "lucide-react"
import Image from "next/image"

interface OrderItem {
  id: string
  name: string
  option?: string
  quantity: number
  price: number
  originalPrice?: number
  imageUrl: string
}

interface OrderItemsProps {
  items?: OrderItem[]
}

function formatPrice(price: number) {
  return price.toLocaleString("ko-KR")
}

export function OrderItems({ items }: OrderItemsProps) {
  const defaultItems: OrderItem[] = items ?? [
    {
      id: "1",
      name: "[LIVE] 프리미엄 비타민C 1000mg 60정",
      option: "2박스 세트",
      quantity: 1,
      price: 29900,
      originalPrice: 45000,
      imageUrl: "",
    },
    {
      id: "2",
      name: "콜라겐 젤리스틱 15포",
      option: "망고맛",
      quantity: 2,
      price: 19900,
      originalPrice: 25000,
      imageUrl: "",
    },
  ]

  return (
    <section className="bg-card px-5 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-bold text-foreground">주문 상품</h2>
        <span className="text-[13px] text-muted-foreground">
          {defaultItems.length}개
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-5">
        {defaultItems.map((item) => {
          const discount = item.originalPrice
            ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
            : 0

          return (
            <div key={item.id} className="flex gap-4">
              <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-secondary">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Package className="h-7 w-7 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                <p className="truncate text-[14px] leading-snug text-foreground">
                  {item.name}
                </p>
                {item.option && (
                  <p className="text-[13px] text-muted-foreground">
                    {item.option} / {item.quantity}개
                  </p>
                )}
                <div className="flex items-center gap-1.5">
                  {discount > 0 && (
                    <span className="text-[15px] font-bold text-destructive">{discount}%</span>
                  )}
                  <span className="text-[15px] font-bold text-foreground">
                    {formatPrice(item.price * item.quantity)}원
                  </span>
                  {item.originalPrice && (
                    <span className="text-[13px] text-muted-foreground line-through">
                      {formatPrice(item.originalPrice * item.quantity)}원
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
