import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Play } from 'lucide-react'
import { runAfterLoad } from '@/lib/after-load'
import type { UrShortItem } from '@/shared/urshorts'
import { storeShortsFor, storeShortsHref } from '@/shared/urshorts-store'

/**
 * 🎬 2026-10-26 (대표 "이용권 상세 갤러리에 매장 숏폼 영상"): 상세 사진 위 `▶ 매장 영상` 버튼.
 *
 * - 사진 위에 **떠 있는**(absolute) 알약이라 늦게 도착해도 아래 내용을 밀지 않는다(밀림 0).
 * - 목록은 첫 화면이 다 뜬 뒤(`runAfterLoad`) 받는다 — 사진·가격과 회선을 나누지 않는다.
 * - 영상이 없으면 아무것도 안 그린다. 누르면 유어쇼츠 뷰어가 **그 영상부터** 튼다(재생기는 거기 하나뿐).
 * - 목록은 탭 수명 동안 한 번만 받는다(상세를 여러 번 열어도 같은 요청).
 */
let listPromise: Promise<UrShortItem[]> | null = null
function loadShorts(): Promise<UrShortItem[]> {
  if (!listPromise) {
    listPromise = fetch('/api/urshorts?all=1')
      .then((r) => r.json() as Promise<{ success?: boolean; data?: UrShortItem[] }>)
      .then((r) => (r?.success && Array.isArray(r.data) ? r.data : []))
      .catch(() => { listPromise = null; return [] })
  }
  return listPromise
}

export default function StoreShortsPill({ productId }: { productId: number | null | undefined }) {
  const [items, setItems] = useState<UrShortItem[]>([])
  useEffect(() => {
    let alive = true
    setItems([])
    const cancel = runAfterLoad(() => {
      loadShorts().then((list) => { if (alive) setItems(storeShortsFor(list, productId)) })
    })
    return () => { alive = false; cancel() }
  }, [productId])

  if (items.length === 0) return null
  return (
    <Link
      to={storeShortsHref(items[0])}
      aria-label={`매장 영상 ${items.length}편 보기`}
      data-store-shorts
      className="absolute left-4 bottom-4 z-[2] inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full bg-black/60 text-white text-[13px] font-medium backdrop-blur-sm"
    >
      <Play className="w-3.5 h-3.5" fill="currentColor" strokeWidth={0} aria-hidden />
      매장 영상{items.length > 1 ? ` ${items.length}` : ''}
    </Link>
  )
}
