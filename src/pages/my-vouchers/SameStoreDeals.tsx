/**
 * 🎯 사용 완료 직후 락인 — "이 매장의 다른 이용권" (2026-08-22 대표 승인 제안 ②)
 *   이용권을 막 쓴 순간이 재구매 의사가 가장 높은 순간이다. QR 모달의 '사용 완료' 화면 아래에
 *   같은 매장(같은 셀러)의 다른 활성 이용권을 최대 3개 노출한다.
 *   데이터: 상세 페이지 otherDeals 와 동일 패턴 — 활성 목록에서 seller_id 로 클라 필터(캐시 적중).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { cfImage, cfImageOnError } from '@/utils/cf-image'

interface DealLite { id: number; name: string; price: number; image_url?: string | null; discount_rate?: number | null; current_price?: number | null }

export default function SameStoreDeals({ productId, hideTitle }: { productId?: number; hideTitle?: boolean }) {
  const navigate = useNavigate()
  const [deals, setDeals] = useState<DealLite[]>([])

  useEffect(() => {
    if (!productId) return
    let cancelled = false
    // 1) 내가 쓴 이용권의 셀러 → 2) 활성 목록에서 같은 셀러의 다른 이용권 (둘 다 엣지캐시 적중 경로)
    api.get(`/api/group-buy/products/${productId}`)
      .then((r) => {
        const sid = Number(r.data?.data?.seller_id ?? r.data?.seller_id)
        if (!sid || cancelled) return null
        return api.get('/api/group-buy/products?status=active').then((lr) => {
          if (cancelled) return
          const list = (lr.data?.data || []) as Array<DealLite & { seller_id?: number }>
          setDeals(list.filter((p) => Number(p.seller_id) === sid && Number(p.id) !== productId).slice(0, 3))
        })
      })
      .catch(() => { /* 락인 보조 UI — 실패해도 침묵 */ })
    return () => { cancelled = true }
  }, [productId])

  if (!deals.length) return null
  return (
    <div className="mt-3">
      {!hideTitle && <p className="text-[12px] font-semibold text-gray-600 dark:text-gray-300 mb-2">이 매장의 다른 이용권도 있어요</p>}
      <div className="space-y-2">
        {deals.map((d) => (
          <button
            key={d.id}
            className="w-full flex items-center gap-3 bg-gray-50 dark:bg-[#1D1F29] rounded-xl p-2.5 text-left"
            onClick={() => navigate(`/group-buy/${d.id}`)}
          >
            {d.image_url ? (
              <img src={cfImage(d.image_url, { width: 96 })} alt="" width={40} height={40} loading="lazy" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" onError={(e) => cfImageOnError(e.currentTarget, d.image_url)} />
            ) : (
              <span className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-[#2A3344] flex-shrink-0" aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-gray-900 dark:text-white truncate">{d.name}</span>
              <span className="block text-[12px] text-gray-500 dark:text-gray-400">
                {Number(d.current_price ?? d.price).toLocaleString()}원
                {d.discount_rate ? <em className="not-italic text-brand-text font-bold ml-1">{d.discount_rate}%</em> : null}
              </span>
            </span>
            <span className="text-[12px] text-gray-400 flex-shrink-0" aria-hidden>›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
