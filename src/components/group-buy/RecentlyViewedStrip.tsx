/**
 * 🛡️ 2026-05-15: 최근 본 공구 strip — localStorage 기반, 0원.
 *
 * 사용:
 *   <RecentlyViewedStrip />
 *
 * GroupBuyDetailPage 진입 시 자동 push (recordRecentlyViewed export).
 * 최대 12개 유지.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const KEY = 'gb_recently_viewed_v1'
const MAX = 12

export interface RecentItem {
  id: number
  name: string
  image_url?: string | null
  restaurant_name?: string | null
  price?: number
  viewed_at: number
}

export function recordRecentlyViewed(item: Omit<RecentItem, 'viewed_at'>): void {
  try {
    const raw = localStorage.getItem(KEY)
    const arr: RecentItem[] = raw ? JSON.parse(raw) : []
    const filtered = arr.filter(i => i.id !== item.id)
    filtered.unshift({ ...item, viewed_at: Date.now() })
    localStorage.setItem(KEY, JSON.stringify(filtered.slice(0, MAX)))
  } catch { /* silent */ }
}

export default function RecentlyViewedStrip() {
  const navigate = useNavigate()
  const [items, setItems] = useState<RecentItem[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setItems(JSON.parse(raw) as RecentItem[])
    } catch { /* silent */ }
  }, [])

  if (items.length === 0) return null

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-2 px-1">
        <h3 className="text-[15px] font-extrabold text-gray-900 dark:text-white tracking-tight">📍 최근 본 공구</h3>
        <span className="text-[10px] text-gray-400">{items.length}개</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 lg:-mx-8 px-4 lg:px-8 scrollbar-hide snap-x snap-mandatory">
        {items.slice(0, 8).map(item => (
          <button
            key={item.id}
            onClick={() => navigate(`/group-buy/${item.id}`)}
            className="snap-start shrink-0 w-[120px] text-left"
            aria-label={`${item.name} 다시 보기`}
          >
            <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-100">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-100 to-rose-200" />
              )}
            </div>
            <p className="text-[11px] font-medium text-gray-900 dark:text-white truncate mt-1.5">{item.name}</p>
            {item.restaurant_name && (
              <p className="text-[10px] text-gray-500 truncate">{item.restaurant_name}</p>
            )}
          </button>
        ))}
      </div>
    </section>
  )
}
