/**
 * 🛡️ 2026-05-02: TD-018 분할 — BrowsePage 최근 본 상품 가로 캐러셀.
 *   localStorage('recently_viewed') 에서 최대 10개 표시.
 */
import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import DealMiniCard from '@/components/deal/DealMiniCard'
import type { RecentProduct } from './types'

export default function RecentlyViewedSection() {
  const [items, setItems] = useState<RecentProduct[]>([])

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('recently_viewed') || '[]') as RecentProduct[]
      // 🛡️ 2026-05-21: 사용자 요청 — /browse 최근 본 상품에서 교환권 (deal_only=1) 제외.
      //   /browse 는 일반 쇼핑 페이지 → /vouchers 의 교환권은 별도 영역.
      //   교환권은 별도 /vouchers 페이지에서 자체 history 관리.
      const generalOnly = raw.filter(p => Number(p.deal_only) !== 1)
      setItems(generalOnly.slice(0, 10))
    } catch {
      // ignore parse errors
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="mb-5">
      <div className="flex items-center gap-1.5 mb-3">
        <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        <h2 className="text-[13px] font-bold text-gray-900 dark:text-white">최근 본 상품</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 pt-0.5 px-0.5">
        {items.map(p => (
          <DealMiniCard
            key={p.id}
            to={`/products/${p.id}`}
            imageUrl={p.image}
            title={p.name || ''}
            price={p.price ?? null}
            unit={Number(p.deal_only) === 1 ? '딜' : '원'}
            className="shrink-0 w-24"
          />
        ))}
      </div>
    </div>
  )
}
