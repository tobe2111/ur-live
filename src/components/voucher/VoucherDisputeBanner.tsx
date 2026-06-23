/**
 * 🔁 2026-06-23 (대표 — 양방향 분쟁): 손님 항변 배너.
 *   매장이 "안 왔어요"로 신고한 내 공구권을 손님이 직접 확인 — 네 이용했어요(contest) / 아직 안 갔어요(concede).
 *   자가 완결(자체 fetch/state) — MyVouchersPage 에는 <VoucherDisputeBanner/> 한 줄만 추가(잠금 안전).
 *   API: GET /api/voucher-dispute/against-me · POST /api/voucher-dispute/:id/respond
 *   소비자 테마(화이트/다크) — 분쟁=긴급이라 기능 빨강 사용.
 */
import { useState, useEffect, useCallback } from 'react'
import { AlertCircle } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface DisputeAgainstMe {
  id: number
  voucher_id: number
  reason?: string
  status: string
  customer_response?: string | null
  product_name?: string
  restaurant_name?: string
}

export default function VoucherDisputeBanner() {
  const [items, setItems] = useState<DisputeAgainstMe[]>([])
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/voucher-dispute/against-me')
      // 아직 응답 안 한 건만 노출(이미 항변/인정한 건 숨김).
      setItems((res.data?.data || []).filter((d: DisputeAgainstMe) => !d.customer_response))
    } catch { /* 비로그인/네트워크 — 조용히 무시 */ }
  }, [])
  useEffect(() => { load() }, [load])

  async function respond(d: DisputeAgainstMe, action: 'contest' | 'concede') {
    setBusy(d.id)
    try {
      await api.post(`/api/voucher-dispute/${d.id}/respond`, { action })
      toast.success(action === 'contest'
        ? '이용했다고 알렸어요. 운영자가 확인합니다.'
        : '공구권을 다시 사용할 수 있도록 되돌렸어요.')
      setItems(prev => prev.filter(x => x.id !== d.id))
    } catch {
      toast.error('처리에 실패했어요')
    } finally { setBusy(null) }
  }

  if (items.length === 0) return null
  return (
    <div className="ur-content-narrow px-4 lg:px-8 mb-4 space-y-2">
      {items.map(d => {
        const store = d.restaurant_name || d.product_name || '매장'
        return (
          <div key={d.id} className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/15 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-gray-900 dark:text-white">{store} 방문 확인 요청</p>
                <p className="text-[12px] text-gray-600 dark:text-gray-300 mt-0.5">
                  매장이 "방문이 확인되지 않았다"고 신고했어요. 실제로 이용하셨나요?
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => respond(d, 'contest')}
                disabled={busy === d.id}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-bold disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                네, 이용했어요
              </button>
              <button
                onClick={() => respond(d, 'concede')}
                disabled={busy === d.id}
                className="flex-1 py-2.5 rounded-xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300 text-[13px] font-bold disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                아직 안 갔어요
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
