/**
 * 🎟️ 크리에이터 콘솔 — 진행 중 공구별 내 실적 (2026-07-06 §4 후속)
 *   내가 담은(핀) 진행 중 공구별: 판매 건수 · 확정 소개비 · 적립 예정. 어필리에이트 집계 재사용.
 *   소비자/인플루언서 대면 — 다크 지원.
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'
import { cfImage } from '@/utils/cf-image'
import { TrendingUp } from 'lucide-react'

interface Row {
  product_id: number; name: string; image_url: string | null
  gb_price: number; promo_pct: number; deadline: string | null
  sales: number; confirmed_commission: number; pending_commission: number
}

export default function GbMyPerformance() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get('/api/gb-marketplace/my-performance')
        if (!cancelled && res.data?.success) setRows(res.data.data || [])
      } catch { /* 비로그인/게이트 OFF */ } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  if (loading || rows.length === 0) return null
  const totalConfirmed = rows.reduce((s, r) => s + r.confirmed_commission, 0)
  const totalPending = rows.reduce((s, r) => s + r.pending_commission, 0)

  return (
    <div className="mb-5 rounded-2xl border border-gray-100 dark:border-[#2A3446] p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="flex items-center gap-1.5 text-[12px] font-bold text-gray-700 dark:text-gray-200">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> 내 공구 실적 (진행 중)
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          확정 <strong className="text-emerald-700 dark:text-emerald-400">{formatNumber(totalConfirmed)}원</strong>
          {totalPending > 0 && <span className="text-gray-400"> · 예정 {formatNumber(totalPending)}원</span>}
        </p>
      </div>
      {rows.map(r => (
        <div key={r.product_id} className="flex items-center gap-2.5 py-2 border-t border-gray-50 dark:border-[#151515]">
          <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-[#1A2334]">
            {r.image_url && <img src={cfImage(r.image_url, { width: 72 })} alt={r.name} className="w-full h-full object-cover" loading="lazy" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100 truncate">{r.name}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">소개비 {r.promo_pct}% · 판매 {r.sales}건</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[12px] font-bold text-emerald-700 dark:text-emerald-400">{formatNumber(r.confirmed_commission)}원</p>
            {r.pending_commission > 0 && <p className="text-[10px] text-gray-400">예정 {formatNumber(r.pending_commission)}원</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
