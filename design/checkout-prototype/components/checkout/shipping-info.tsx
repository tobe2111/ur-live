"use client"

import { ChevronRight } from "lucide-react"

interface ShippingAddress {
  name: string
  phone: string
  address: string
  addressDetail: string
  memo?: string
}

interface ShippingInfoProps {
  address?: ShippingAddress
  onChangeAddress?: () => void
}

export function ShippingInfo({ address, onChangeAddress }: ShippingInfoProps) {
  const data: ShippingAddress = address ?? {
    name: "홍길동",
    phone: "010-1234-5678",
    address: "서울특별시 강남구 테헤란로 123",
    addressDetail: "4층 401호",
    memo: "문 앞에 놓아주세요",
  }

  return (
    <section className="bg-card px-5 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-bold text-foreground">배송지</h2>
        <button
          type="button"
          onClick={onChangeAddress}
          className="flex items-center text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          변경
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-foreground">{data.name}</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            기본
          </span>
        </div>
        <p className="text-[14px] leading-relaxed text-muted-foreground">{data.phone}</p>
        <p className="text-[14px] leading-relaxed text-foreground">
          {data.address} {data.addressDetail}
        </p>
      </div>

      {data.memo && (
        <div className="mt-4 rounded-2xl bg-secondary px-4 py-3">
          <p className="text-[13px] text-muted-foreground">{data.memo}</p>
        </div>
      )}
    </section>
  )
}
