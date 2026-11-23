/**
 * 📞 사장님 — 전화 예약 손님 (2026-11-23 대표 *"응 다 해줘"* · 1단계)
 *
 * "방문 전 전화 예약" 을 켠 이용권을 산 손님 중 **아직 안 쓴** 손님. 손님이 전화하면 정한 날짜를 여기 적어 둔다
 * (손님이 직접 적었으면 그대로 보인다). 손님 번호는 **손님이 알려주기를 켠 경우에만, 방문 다음 날까지** 보인다.
 * 사용 처리는 여기서 하지 않는다 — 손님이 오면 평소처럼 QR 로 한다. 규칙: `worker/utils/visit-plan.ts`.
 */
import { useState } from 'react'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import { DateInput } from '@/components/ui/date-input'
import { formatKSTDate } from '@/utils/date'
import { visitWhen } from '@/pages/my-vouchers/CallBookingBlock'

interface Row {
  voucher_id: number; code_tail: string; product_name: string | null; bought_at: string
  buyer_name: string | null; buyer_phone: string | null; phone_shared: boolean
  visit_date: string | null; visit_time: string | null
}

const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export default function CallBookingsPanel() {
  const { data: rows = [], isLoading, isError, refetch } = useApiQuery<Row[]>(
    ['seller', 'visit-plans'], '/api/seller/visit-plans',
    { select: (r) => { const x = r as { success?: boolean; data?: Row[] }; return x?.success ? x.data || [] : [] }, refetchOnMount: 'always' },
  )
  const [editing, setEditing] = useState<{ id: number; date: string; time: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!editing || busy) return
    if (!editing.date) { toast.error('날짜를 골라 주세요'); return }
    setBusy(true)
    try {
      const r = await api.put(`/api/seller/visit-plans/${editing.id}`, { visit_date: editing.date, visit_time: editing.time || null })
      if (!r.data?.success) throw new Error(r.data?.error)
      toast.success('예약 날짜를 적어 뒀어요. 손님에게도 알려요.')
      setEditing(null)
      await refetch()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string }
      toast.error(err?.response?.data?.error || err?.message || '저장하지 못했어요')
    } finally { setBusy(false) }
  }

  if (isLoading) return <p className="mx-auto max-w-5xl text-[13px] text-gray-500">불러오는 중…</p>
  if (isError) {
    return (
      <div className="mx-auto max-w-5xl rounded-xl bg-white p-4 shadow-lift">
        <p className="text-[13px] text-tone-bad">예약 손님을 불러오지 못했어요.</p>
        <button type="button" onClick={() => refetch()} className="mt-1 text-[13px] font-semibold text-brand-text underline">다시 시도</button>
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-5xl rounded-xl bg-white p-6 text-center shadow-lift">
        <p className="text-[15px] font-semibold text-gray-900">전화 예약을 기다리는 손님이 없어요</p>
        <p className="mt-1 text-[13px] leading-relaxed text-gray-500">이용권 목록에서 [방문 전 전화 예약]을 켠 이용권이 팔리면 여기에 떠요.</p>
      </div>
    )
  }

  const waiting = rows.filter((r) => !r.visit_date).length
  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <p className="text-[13px] text-gray-600">
        아직 안 쓴 손님 <b className="text-gray-900">{rows.length}명</b>
        {waiting > 0 && <> · 날짜 미정 <b className="text-gray-900">{waiting}명</b></>} — 손님이 오면 평소처럼 QR 로 사용 처리해요.
      </p>
      <ul className="overflow-hidden rounded-xl bg-white shadow-lift divide-y divide-gray-100">
        {rows.map((r) => (
          <li key={r.voucher_id} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-gray-900">
                  {r.buyer_name || '손님'}
                  <span className={`ml-2 text-[12px] font-semibold ${r.visit_date ? 'text-tone-ok' : 'text-gray-500'}`}>
                    {r.visit_date ? visitWhen(r.visit_date, r.visit_time) : '날짜 미정'}
                  </span>
                </p>
                <p className="truncate text-[13px] text-gray-500">
                  {r.product_name || '이용권'} · {formatKSTDate(r.bought_at)} 구매 · 코드 끝 {r.code_tail}
                </p>
              </div>
              {r.phone_shared && r.buyer_phone
                ? <a href={`tel:${r.buyer_phone}`} className="ur-btn ur-btn-sm ur-btn-primary">손님에게 전화</a>
                : <span className="text-[12px] text-gray-500">손님 전화를 기다려요</span>}
              <button type="button" onClick={() => setEditing({ id: r.voucher_id, date: r.visit_date || '', time: r.visit_time || '' })}
                className="h-9 rounded-lg px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-50">{r.visit_date ? '날짜 바꾸기' : '날짜 적기'}</button>
            </div>
            {editing?.id === r.voucher_id && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <DateInput type="date" value={editing.date} min={todayKst()} onChange={(e) => setEditing({ ...editing, date: e.target.value })} aria-label="방문 날짜"
                  className="h-9 w-40 rounded-lg bg-gray-50 px-3 text-[13px] text-gray-900" />
                <DateInput type="time" value={editing.time} onChange={(e) => setEditing({ ...editing, time: e.target.value })} aria-label="방문 시간(선택)"
                  className="h-9 w-32 rounded-lg bg-gray-50 px-3 text-[13px] text-gray-900" />
                <button type="button" disabled={busy} onClick={save} className="ur-btn ur-btn-sm ur-btn-primary disabled:opacity-50">저장</button>
                <button type="button" onClick={() => setEditing(null)} className="h-9 rounded-lg px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-50">취소</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
