/**
 * 🔎 검색 결과 카드 — **격자 SSOT(`GroupBuyFeedCard`)에 얹는 얇은 어댑터** (2026-09-03)
 *
 *   이 파일은 자체 격자 카드였다. 그래서 검색 결과만 다른 그림이었고, 그 자체 구현 안에
 *   실제 결함이 둘 있었다:
 *     ① 사진 우하단 하트가 **아무 일도 안 했다** — `onClick={(e) => e.preventDefault()}` 뿐이라
 *        누르면 찜이 되는 것처럼 보이고 아무것도 저장되지 않았다(SSOT 의 `WishlistHeart` 는 진짜다).
 *     ② 30% 이상일 때만 사진 위에 빨간 할인 배지 — 2026-08-31 대표 지시
 *        *"할인율이 사진 안으로 들어가면 안돼"* 이후 다른 카드는 전부 본문으로 내렸는데 여기만 남았다.
 *   ⇒ 어댑터로 접으면서 둘 다 사라진다. 검색 고유의 것(검색어 하이라이트 · 유어샵 핀 버튼 ·
 *      품절/재고)만 슬롯으로 넘긴다.
 */
import { type ReactNode } from 'react'
import GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'
import { publicSellerHandle } from '@/shared/seller-handle'
import PinButton from '@/components/curator/PinButton'

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
  // 🛡️ 2026-05-19: KT Alpha 교환권 (deal_only=1) 은 '딜' 단위로 표시.
  deal_only?: number
  // 🎫 2026-06-21 (대표 요청): 교환권은 판매자 핸들 대신 브랜드명(스타벅스 등) 표시.
  brand_name?: string
  // 🧭 2026-07-20 (대표 — 검색 페이지 이동 정규화): 종류별 정규 상세 경로 판별용.
  category?: string | null
}

interface ProductCardProps {
  product: Product
  highlightQuery?: string
}

function highlightText(text: string, query: string): ReactNode {
  if (!query || query.length < 1) return <>{text}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-brand-tint text-brand-text rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

export default function ProductCard({ product, highlightQuery }: ProductCardProps) {
  // 🛡️ 2026-07-02 (쇼핑 전수조사): price 는 이미 최종 판매가(서버 과금가 = order.routes unit_price).
  const soldOut = Number(product.stock) === 0
  const lowStock = !soldOut && Number(product.stock) > 0 && Number(product.stock) <= 10
  return (
    <GroupBuyFeedCard
      p={{
        ...product,
        /* 🏷️ 머천트 줄 — 카드 SSOT 는 `restaurant_name || brand_name` 을 쓴다. 둘 다 없는
           일반 쇼핑 상품은 판매자 이름으로 채운다(그러지 않으면 그 줄이 통째로 빈다).
           ⚠️ 자동 발급 아이디(`@store_xxxx`)는 폴백에 쓰지 않는다 — main 2026-09-03 수정을
              `publicSellerHandle` 로 그대로 승계한다. */
        restaurant_name: (product as { restaurant_name?: string }).restaurant_name
          || product.brand_name
          || product.seller_name
          || publicSellerHandle(product.seller_username)
          || undefined,
      } as never}
      aboveFold={false}
      titleNode={highlightQuery ? highlightText(product.name, highlightQuery) : undefined}
      /* 🚩 품절·재고는 **본문 맨 위 한 줄**로 — 사진 위에 얹지 않는다(08-31 규칙). */
      flags={soldOut ? (
        <p className="text-[11px] font-bold text-red-500 mb-0.5">품절</p>
      ) : lowStock ? (
        <p className="text-[11px] font-semibold text-red-500 mb-0.5">재고 {product.stock}개</p>
      ) : undefined}
      /* 🛡️ 2026-05-25 큐레이터 핀 — 1탭 핀 추가(Phase 1-B 핵심 UX). 찜 하트 아래에 놓는다. */
      overlayExtra={<PinButton productId={product.id} price={product.price} variant="card-overlay" />}
    />
  )
}
