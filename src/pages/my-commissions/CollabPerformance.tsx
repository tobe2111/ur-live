/**
 * 🤝 내 협업 딜 성과 — 수락한 인플루언서가 "얼마 벌었는지" 보는 유일한 자리 (2026-08-23 대표 승인 2번).
 *   데이터: GET /api/influencer-offers/my/performance (딜 목록 + 딜별 적립·주문수 + 전용 링크).
 *   딜이 하나도 없으면 아무것도 렌더하지 않는다 — 일반 유저의 추천 수익 페이지를 어지럽히지 않기 위해.
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { formatWon } from '@/utils/format'
import { toast } from '@/hooks/useToast'

interface DealPerf {
  id: number; seller_name: string | null; commission_pct: number; status: string
  tracking_url: string; orders_count: number; pending_krw: number; confirmed_krw: number
}
interface Perf { deals: DealPerf[]; totals: { orders: number; pending: number; confirmed: number } }

export default function CollabPerformance() {
  const [perf, setPerf] = useState<Perf | null>(null)
  useEffect(() => {
    api.get('/api/influencer-offers/my/performance')
      .then((r) => setPerf(r.data?.data || null))
      .catch(() => { /* 보조 섹션 — 실패 시 침묵(아래 추천수익 화면은 독립) */ })
  }, [])

  if (!perf || perf.deals.length === 0) return null
  return (
    <section className="mb-5">
      <div className="rounded-3xl p-5 bg-white dark:bg-[#1A2334] border border-gray-200 dark:border-[#2A3446]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-bold text-gray-900 dark:text-white">🤝 협업 딜 성과</h2>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">확정분은 자동 지급돼요</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div className="bg-gray-50 dark:bg-[#0F151D] rounded-xl py-2.5">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">판매</p>
            <p className="text-[15px] font-bold text-gray-900 dark:text-white">{perf.totals.orders}건</p>
          </div>
          <div className="bg-gray-50 dark:bg-[#0F151D] rounded-xl py-2.5">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">대기 적립</p>
            <p className="text-[15px] font-bold text-gray-900 dark:text-white">{formatWon(perf.totals.pending)}</p>
          </div>
          <div className="bg-gray-50 dark:bg-[#0F151D] rounded-xl py-2.5">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">확정</p>
            <p className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400">{formatWon(perf.totals.confirmed)}</p>
          </div>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-[#2A3446]">
          {perf.deals.map((d) => (
            <div key={d.id} className="py-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">
                  {d.seller_name || '매장'} <span className="text-gray-400 font-normal">· 커미션 {d.commission_pct}%</span>
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  판매 {d.orders_count}건 · 적립 {formatWon(d.pending_krw + d.confirmed_krw)}
                </p>
              </div>
              <button
                className="flex-shrink-0 text-[11px] px-2.5 py-1.5 rounded-full border border-gray-300 dark:border-[#2A3446] text-gray-700 dark:text-gray-200"
                onClick={() => { navigator.clipboard?.writeText(d.tracking_url).then(() => toast.success('내 홍보 링크를 복사했어요')).catch(() => {}) }}
              >링크 복사</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
