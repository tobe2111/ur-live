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
import { cfImage } from '@/utils/cf-image'
import { Pin } from 'lucide-react'

interface CuratorPin {
  id: number
  product_id: number
  title?: string | null
  product_name?: string | null
  image_url?: string | null
  price?: number | null
}

export default function CuratorPinsSection({ handle }: { handle?: string | null }) {
  const [pins, setPins] = useState<CuratorPin[] | null>(null)

  useEffect(() => {
    if (!handle) return
    let alive = true
    api.get(`/api/curator/${encodeURIComponent(handle)}`)
      .then(r => {
        if (!alive) return
        const list = (r.data?.data?.pins || r.data?.pins || []) as CuratorPin[]
        setPins(Array.isArray(list) ? list.slice(0, 8) : [])
      })
      .catch(() => { if (alive) setPins([]) })
    return () => { alive = false }
  }, [handle])

  if (!handle || !pins || pins.length === 0) return null

  return (
    <section className="px-4 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold text-white flex items-center gap-1.5">
          <Pin className="w-4 h-4 text-pink-400" /> 추천 핀
        </h2>
        <a href={`/u/${handle}`} className="text-[12px] text-gray-400 hover:text-gray-300">
          링크샵 전체보기 →
        </a>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {pins.map(pin => {
          const name = pin.title || pin.product_name || ''
          return (
            <a
              key={pin.id}
              href={`/u/${handle}/p/${pin.product_id}`}
              className="block rounded-2xl overflow-hidden bg-[#121212] border border-[#1A1A1A] active:scale-[0.98] transition-transform"
            >
              <div className="aspect-square bg-[#1A1A1A]">
                {pin.image_url && (
                  <img
                    src={cfImage(pin.image_url, { width: 300 })}
                    alt={name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="p-2.5">
                <p className="text-[12px] text-gray-300 line-clamp-2 leading-snug">{name}</p>
                {pin.price != null && pin.price > 0 && (
                  <p className="text-[13px] font-bold text-white mt-1">{Number(pin.price).toLocaleString('ko-KR')}원</p>
                )}
              </div>
            </a>
          )
        })}
      </div>
    </section>
  )
}
