/**
 * 🏁 2026-06-12 (P5 — 전 플로우 감사, 사용자 승인 "모두 이상적"): 셀러 공개페이지의 '추천 핀' 섹션.
 *
 * 배경: 셀러와 연결된 큐레이터(같은 사람)의 핀이 어느 URL 에서도 비노출이었음 —
 * /u/:handle 은 linked seller 면 SellerPublicPage 를 통째 렌더해 핀 그리드에 도달 불가,
 * BottomNav 도 /profile/:username 우선. 본 컴포넌트가 그 마지막 칸을 채움 (additive lazy).
 *
 * 핵심: 카드 클릭은 반드시 `/u/:handle/p/:productId` (서버 attribution redirect) 경유 —
 * 큐레이터 적립이 작동하는 경로. 데이터 없거나 실패 시 아무것도 그리지 않음 (fail-soft).
 * 다크 페이지(셀러 공개) 토큰 사용.
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Pin } from 'lucide-react'
// 🏁 2026-06-25 (대표 신고 — "상품쪽이 깨졌다"): 다크 전용 하드코딩 카드(bg-[#121212]/text-white)가
//   라이트 페이지에서 까맣게 깨져 보임 → 큐레이터 페이지·picker 와 동일한 표준 BrowseProductCard(테마 자동) 로 통일.
import BrowseProductCard from '@/pages/browse/BrowseProductCard'
import { seededColor } from '@/utils/card-gradient'
import type { Product as BrowseProduct } from '@/pages/browse/types'

interface CuratorPin {
  id: number
  product_id: number
  title?: string | null
  product_name?: string | null
  image_url?: string | null
  price?: number | null
  // 🏁 2026-06-26 (대표 — 링크샵 카드를 쇼핑 카드와 동일하게): 할인/평점/구매수/대표색.
  original_price?: number | null
  discount_rate?: number | null
  dominant_color?: string | null
  avg_rating?: number | null
  review_count?: number | null
  sold_count?: number | null
}

export default function CuratorPinsSection({ handle, initialPins }: { handle?: string | null; initialPins?: CuratorPin[] | null }) {
  const [pins, setPins] = useState<CuratorPin[] | null>(initialPins && initialPins.length ? initialPins.slice(0, 12) : null)

  useEffect(() => {
    if (!handle) return
    // 🏁 2026-06-26 (대표 — 진입 불필요 로딩 감사): 부모(CuratorPage)가 이미 받은 핀을 내려주면 재fetch 0.
    //   SPA 진입 시 CuratorPage 의 GET /api/curator/{handle} 와 본 컴포넌트가 같은 endpoint 를 중복 호출하던
    //   것을 제거(SSR 하드로드는 기존처럼 inject 사용 → 동작 동일, SPA 만 1요청 절감).
    if (initialPins) { setPins(initialPins.slice(0, 12)); return }
    let alive = true
    // 🏁 2026-06-17 (#4): SSR 주입(__SSR_INITIAL_CURATOR__)에 같은 handle 핀이 있으면 재fetch 생략.
    //   (/u/{handle} 에선 CuratorPage 가 이미 같은 endpoint 를 불러 → 중복 호출이었음.)
    try {
      const el = typeof document !== 'undefined' ? document.getElementById('__SSR_INITIAL_CURATOR__') : null
      if (el?.textContent) {
        const parsed = JSON.parse(el.textContent)
        if (parsed?.curator?.handle?.toLowerCase?.() === handle.toLowerCase() && Array.isArray(parsed.pins)) {
          setPins(parsed.pins.slice(0, 12))
          return () => { alive = false }
        }
      }
    } catch { /* SSR 누락 — fetch fallback */ }
    api.get(`/api/curator/${encodeURIComponent(handle)}`)
      .then(r => {
        if (!alive) return
        const list = (r.data?.data?.pins || r.data?.pins || []) as CuratorPin[]
        setPins(Array.isArray(list) ? list.slice(0, 12) : [])
      })
      .catch(() => { if (alive) setPins([]) })
    return () => { alive = false }
  }, [handle, initialPins])

  if (!handle || !pins || pins.length === 0) return null

  // 🏁 2026-06-17 (#4): 이미 /u/{handle} 위라면 '전체보기'는 같은 페이지로의 순환 링크 → 숨김.
  //   /profile/{username}·/s/{username}(직접 셀러 페이지)에서만 큐레이터 링크샵으로 안내.
  const onOwnLinkshop = typeof window !== 'undefined'
    && window.location.pathname.toLowerCase().startsWith(`/u/${handle.toLowerCase()}`)

  return (
    <section className="px-4 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <Pin className="w-4 h-4 text-gray-400 dark:text-gray-500" /> 추천템
        </h2>
        {!onOwnLinkshop && (
          <a href={`/u/${handle}`} className="text-[12px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            링크샵 전체보기 →
          </a>
        )}
      </div>
      {/* 🏁 2026-06-25 (대표 신고 — 카드 가로폭 좁음): 링크샵은 PC 에서도 430 액자라 viewport 기반
          `sm:grid-cols-4` 가 액자 안에서 4열→카드 협소 + 우측 공백. PinGrid 와 동일하게 항상 2열. */}
      <div className="grid grid-cols-2 gap-3">
        {pins.map(pin => {
          const name = pin.title || pin.product_name || ''
          // 🏁 2026-06-26 (대표 — 쇼핑 카드와 동일): 할인/평점/구매수/대표색까지 전달.
          const product = {
            id: pin.product_id,
            name,
            price: pin.price ?? 0,
            current_price: pin.price ?? 0,
            original_price: pin.original_price ?? undefined,
            discount_rate: pin.discount_rate ?? 0,
            image_url: pin.image_url || '',
            stock: 0,
            dominant_color: pin.dominant_color,
            avg_rating: pin.avg_rating ?? undefined,
            review_count: pin.review_count ?? undefined,
            sold_count: pin.sold_count ?? undefined,
          } as BrowseProduct
          // 클릭은 반드시 /u/:handle/p/:productId (서버 attribution redirect — 큐레이터 적립 작동 경로) 유지.
          return (
            <BrowseProductCard
              key={pin.id}
              product={product}
              aboveFold={false}
              to={`/u/${handle}/p/${pin.product_id}`}
              fallbackColor={seededColor(pin.product_id)}
            />
          )
        })}
      </div>
    </section>
  )
}
