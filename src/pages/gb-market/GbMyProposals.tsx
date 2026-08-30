/**
 * 🎟️ 인플루언서 공구 제안 인박스 (2026-07-06 §2-B — 인플루언서 관점)
 *   · 받은 협업(매장→인플): 승인/거절 → 승인 시 공구 시작 + 내가 우선/전용 링크 주체
 *   · 보낸 제안(인플→매장): 상태 확인
 *   소비자/인플루언서 대면 — 다크 지원.
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { Loader2 } from 'lucide-react'

interface Proposal {
  id: number; product_id: number; product_name?: string; proposed_by: 'influencer' | 'seller'
  deadline?: string | null; price?: number | null; promo_pct?: number | null; status: string
}
const STATUS_LABEL: Record<string, string> = { proposed: '대기', approved: '승인·진행', rejected: '거절', withdrawn: '철회' }

export default function GbMyProposals() {
  const [rows, setRows] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  async function load() {
    try {
      const res = await api.get('/api/gb-proposals/mine')
      if (res.data?.success) setRows(res.data.data || [])
    } catch { /* 비로그인/게이트 OFF */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function respond(id: number, action: 'approve' | 'reject') {
    setBusy(id)
    try {
      const res = await api.post(`/api/gb-proposals/${id}/respond`, { action })
      if (res.data?.success) { toast.success(action === 'approve' ? '수락됨 · 공구 시작' : '거절됨'); load() }
      else toast.error(res.data?.error || '처리 실패')
    } catch (e: unknown) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '처리 실패') }
    finally { setBusy(null) }
  }

  if (loading || rows.length === 0) return null
  const offers = rows.filter(r => r.proposed_by === 'seller')  // 매장이 내게 보낸 협업 제안
  const mine = rows.filter(r => r.proposed_by === 'influencer') // 내가 낸 제안

  return (
    <div className="mb-5 space-y-3">
      {offers.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5 p-3">
          <p className="text-[12px] font-bold text-emerald-800 dark:text-emerald-300 mb-2">📩 받은 협업 제안</p>
          {offers.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-2 py-1.5">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100 truncate">{r.product_name || `#${r.product_id}`}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">공구가 {formatNumber(r.price || 0)}원 · 소개비 {r.promo_pct || 0}%</p>
              </div>
              {r.status === 'proposed' ? (
                <div className="flex gap-1.5 shrink-0">
                  <button disabled={busy === r.id} onClick={() => respond(r.id, 'approve')} className="px-2.5 py-1 rounded-lg bg-gray-900 text-white text-[11px] font-bold disabled:opacity-50">{busy === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '수락'}</button>
                  <button disabled={busy === r.id} onClick={() => respond(r.id, 'reject')} className="px-2.5 py-1 rounded-lg border border-gray-300 dark:border-white/20 text-gray-600 dark:text-gray-300 text-[11px] font-semibold disabled:opacity-50">거절</button>
                </div>
              ) : <span className="text-[11px] text-gray-400 shrink-0">{STATUS_LABEL[r.status] || r.status}</span>}
            </div>
          ))}
        </div>
      )}
      {mine.length > 0 && (
        <div className="rounded-2xl border border-gray-100 dark:border-[#2A3446] p-3">
          <p className="text-[12px] font-bold text-gray-700 dark:text-gray-200 mb-2">📤 내가 낸 제안</p>
          {mine.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-2 py-1.5">
              <p className="text-[12px] text-gray-700 dark:text-gray-300 truncate">{r.product_name || `#${r.product_id}`} · 소개비 {r.promo_pct || 0}%</p>
              <span className="text-[11px] text-gray-400 shrink-0">{STATUS_LABEL[r.status] || r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
