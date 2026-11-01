/**
 * ⭐ 생활 견적 후기 관리 (2026-10-26 대표 "후기 기능 만들어주고") — 욕설·광고 후기를 숨긴다.
 * 지우지 않는다: 숨긴 후기는 손님 화면·평균 별점에서 빠지고 기록은 남는다.
 */
import { useState } from 'react'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { formatKSTDate } from '@/utils/date'

interface Review { id: number; request_id: number; rating: number; body: string; hidden: number; created_at: string; pro_name: string | null; reviewer: string | null }

export default function AdminHomeServiceReviews() {
  const q = useApiQuery<Review[]>(['admin', 'home-service', 'reviews'], '/api/admin/home-service/reviews', {
    select: (raw) => (raw as { data: Review[] }).data, staleTime: 0,
  })
  const [busy, setBusy] = useState(false)

  async function toggle(r: Review) {
    setBusy(true)
    try {
      await api.post(`/api/admin/home-service/reviews/${r.id}/hidden`, { hidden: !r.hidden })
      toast.success(r.hidden ? '다시 보이게 했습니다' : '숨겼습니다')
      await q.refetch()
    } catch { toast.error('바꾸지 못했습니다') } finally { setBusy(false) }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <h2 className="text-[15px] font-semibold text-gray-900">후기</h2>
      <p className="text-[13px] text-gray-500">손님이 고른 업체에 남긴 후기입니다. 숨기면 손님 화면과 평균 별점에서 빠집니다.</p>
      {q.isError && <div className="rounded-lg tone-bad-bg p-3 text-[13px] tone-bad">불러오지 못했습니다. <button className="underline" onClick={() => q.refetch()}>다시 시도</button></div>}
      <ul className="divide-y divide-gray-100">
        {(q.data ?? []).map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3 py-2 text-[13px] text-gray-900">
            <span className={r.hidden ? 'text-gray-400 line-through' : ''}>
              <b>{'★'.repeat(r.rating)}</b> {r.pro_name ?? '-'} · 요청 #{r.request_id} · {r.reviewer ?? '손님'} · {formatKSTDate(r.created_at)}
              <span className="block whitespace-pre-wrap text-gray-600">{r.body}</span>
            </span>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => toggle(r)}>{r.hidden ? '되살리기' : '숨기기'}</Button>
          </li>
        ))}
        {!q.isError && (q.data ?? []).length === 0 && <li className="py-2 text-[13px] text-gray-500">아직 없어요</li>}
      </ul>
    </section>
  )
}
