/**
 * 🛡️ 2026-05-02: TD-018 분할 — MainHomePage 최근 본 상품 가로 캐러셀.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function RecentlyViewed() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Array<{ id: number; name: string; price?: number; image?: string }>>([])

  useEffect(() => {
    try { setItems(JSON.parse(localStorage.getItem('recently_viewed') || '[]').slice(0, 10)) } catch {}
  }, [])

  if (items.length === 0) return null

  return (
    <div className="px-4 py-6">
      <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">최근 본 상품</h2>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 lg:overflow-visible lg:grid lg:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-10">
        {items.map(p => (
          <button type="button" key={p.id} onClick={() => navigate(`/products/${p.id}`)} className="shrink-0 w-28 lg:w-auto cursor-pointer text-left">
            <div className="aspect-square bg-gray-100 dark:bg-[#1A1A1A] rounded-xl overflow-hidden">
              {p.image && <img src={p.image} alt={p.name || '상품 이미지'} loading="lazy" className="w-full h-full object-cover" />}
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-300 mt-1.5 truncate">{p.name}</p>
            <p className="text-xs font-bold text-gray-900 dark:text-white">{p.price?.toLocaleString()}원</p>
          </button>
        ))}
      </div>
    </div>
  )
}
