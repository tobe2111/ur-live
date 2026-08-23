/**
 * 📣 보낸 제안 현황 — 사장님이 접수한 제안의 상태·수락 수를 한눈에 (2026-08-23 대표 승인 1번).
 *   접수한 제안이 없으면 아무것도 렌더하지 않는다.
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { formatKSTShort } from '@/utils/date'

interface OutreachRow {
  id: number; target_count: number; commission_pct: number; product_support: string
  status: string; created_at: string; accepted_count: number
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  submitted: { label: '유어딜 검토 중', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: '검토 완료', cls: 'bg-blue-100 text-blue-700' },
  sent: { label: '발송됨', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '반려', cls: 'bg-gray-200 text-gray-500' },
}

export default function SentOutreachList({ refreshKey }: { refreshKey?: number }) {
  const [rows, setRows] = useState<OutreachRow[]>([])
  useEffect(() => {
    api.get('/api/seller/influencers/outreach')
      .then((r) => setRows(r.data?.data || []))
      .catch(() => { /* 보조 섹션 — 실패 시 침묵 */ })
  }, [refreshKey])

  if (rows.length === 0) return null
  return (
    <div className="rounded-xl bg-white border border-gray-200 px-4 py-3">
      <p className="text-xs font-bold text-gray-700 mb-2">보낸 제안</p>
      <div className="divide-y divide-gray-100">
        {rows.slice(0, 5).map((r) => {
          const st = STATUS_LABEL[r.status] || STATUS_LABEL.submitted
          return (
            <div key={r.id} className="py-2 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <span className="font-semibold text-gray-900">{r.target_count}명에게 커미션 {r.commission_pct}%</span>
                <span className="text-gray-400 ml-1.5">{formatKSTShort(r.created_at)}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {r.accepted_count > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand font-bold">✓ {r.accepted_count}명 수락</span>
                )}
                <span className={`px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
