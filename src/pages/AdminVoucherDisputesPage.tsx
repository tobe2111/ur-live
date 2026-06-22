/**
 * 🎟️ 2026-06-22 (대표 — 사용처리 분쟁 중재): 어드민이 매장 "안 왔어요" 신고를 중재.
 *   백엔드: voucher-dispute.routes (GET /api/admin/voucher-dispute, POST /:id/resolve).
 *   resolve: settle(분쟁 종료 → cron 정산) / reactivate(공구권 used→unused, 손님 재사용).
 *   라이트 테마 고정(AdminLayout) — 다크 variant 미사용.
 */
import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { toast } from '@/hooks/useToast'

interface Dispute {
  id: number
  voucher_id: number
  product_id: number
  seller_id: number
  reason: string
  status: string
  created_at: string
  code?: string
  voucher_status?: string
  product_name?: string
  restaurant_name?: string
}

export default function AdminVoucherDisputesPage() {
  const [items, setItems] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/admin/voucher-dispute')
      setItems(res.data?.data || [])
    } catch {
      toast.error('분쟁 목록을 불러오지 못했어요')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function resolve(id: number, action: 'settle' | 'reactivate') {
    const label = action === 'settle' ? '정산 진행' : '재사용 처리'
    setBusy(id)
    try {
      await api.post(`/api/admin/voucher-dispute/${id}/resolve`, { action })
      toast.success(`${label} 완료`)
      setItems(prev => prev.filter(d => d.id !== id))
    } catch {
      toast.error(`${label} 실패`)
    } finally { setBusy(null) }
  }

  return (
    <AdminLayout title="사용처리 분쟁">
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm font-bold text-gray-900">대기 중 분쟁 ({items.length})</p>
          <p className="text-[12px] text-gray-500 mt-1">
            매장이 "안 왔어요"로 신고한 사용처리. <b>정산 진행</b> = 정상 처리(매장 정산) · <b>재사용 처리</b> = 공구권을
            미사용으로 되돌림(손님 재사용). 실제 환불(돈)은 기존 환불 메뉴에서.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">대기 중인 분쟁이 없습니다</div>
        ) : (
          <div className="space-y-3">
            {items.map(d => (
              <div key={d.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{d.restaurant_name || d.product_name || `상품 #${d.product_id}`}</p>
                    <p className="text-[12px] text-gray-500 mt-0.5">공구권 #{d.voucher_id} {d.code ? `· ${d.code}` : ''} · 셀러 #{d.seller_id}</p>
                    <p className="text-[12px] text-gray-700 mt-1.5">사유: {d.reason || '미방문 신고'}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{d.created_at}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => resolve(d.id, 'settle')}
                      disabled={busy === d.id}
                      className="px-3 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-bold disabled:opacity-50"
                    >정산 진행</button>
                    <button
                      onClick={() => resolve(d.id, 'reactivate')}
                      disabled={busy === d.id}
                      className="px-3 py-2 rounded-lg bg-gray-100 text-gray-900 text-[13px] font-bold disabled:opacity-50"
                    >재사용 처리</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
