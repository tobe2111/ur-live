/**
 * 🤝💰 에이전시 — 이 매장의 **인플루언서 소개비 계약** (2026-11-11 결재 ⑤ · 스위치 OFF 면 안 그린다)
 *   서버: `GET/POST /api/agency-console/stores/:sellerId/influencer-deals` · `POST …/:id/end`
 *
 * 유어샵 아이디와 % 를 적으면 끝. 우리 수수료 + 소개비가 사장님이 동의한 **총 마케팅 비용 상한** 안이면 바로 발효,
 * 넘으면 사장님께 승인 요청이 간다(사장님이 승인하기 전엔 붙지 않는다). 계약은 **우리가 맡은 이용권에만** 붙는다.
 */
import { useCallback, useEffect, useState } from 'react'
import { toast } from '@/hooks/useToast'
import { agencyRequest } from './agency-api'

interface Deal { id: number; pct: number; status: 'active' | 'pending_owner'; handle: string | null; influencer_name: string | null }

export default function AgencyDealsSection({ sellerId }: { sellerId: number }) {
  const [enabled, setEnabled] = useState(false)
  const [deals, setDeals] = useState<Deal[]>([])
  const [handle, setHandle] = useState('')
  const [pct, setPct] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await agencyRequest<{ enabled?: boolean; deals?: Deal[] }>(`/stores/${sellerId}/influencer-deals`)
    if (!r.ok) return
    setEnabled(!!r.data.enabled)
    setDeals(r.data.deals || [])
  }, [sellerId])
  useEffect(() => { void load() }, [load])

  if (!enabled) return null

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const r = await agencyRequest<{ message?: string }>(`/stores/${sellerId}/influencer-deals`, { method: 'POST', body: { handle, pct } })
    setBusy(false)
    if (!r.ok) { toast.error(r.data.error || '걸지 못했어요.'); return }
    toast.success(r.data.message || '걸었어요.')
    setHandle(''); setPct('')
    void load()
  }

  async function end(id: number) {
    setBusy(true)
    const r = await agencyRequest(`/stores/${sellerId}/influencer-deals/${id}/end`, { method: 'POST' })
    setBusy(false)
    if (!r.ok) { toast.error(r.data.error || '끝내지 못했어요.'); return }
    void load()
  }

  return (
    <section className="mx-5 mt-5" data-testid="agency-deals">
      <p className="text-[15px] font-semibold text-gray-900 dark:text-white">인플루언서 소개비</p>
      <p className="mt-1 text-[12px] leading-[1.55] text-gray-500 dark:text-gray-400">
        우리 수수료와 합쳐 사장님이 동의한 총 마케팅 비용 상한 안이면 바로 적용돼요. 넘으면 사장님 승인 뒤에 적용돼요. 우리가 맡은 이용권에만 붙어요.
      </p>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="유어샵 아이디" aria-label="유어샵 아이디"
          className="h-10 min-w-0 flex-1 rounded-xl bg-gray-50 dark:bg-white/5 px-3 text-[15px] text-gray-900 dark:text-white outline-none" />
        <span className="relative">
          <input value={pct} onChange={(e) => setPct(e.target.value)} type="number" inputMode="decimal" min={0} max={90} step={0.5} placeholder="0" aria-label="소개비 %"
            className="h-10 w-20 rounded-xl bg-gray-50 dark:bg-white/5 pl-3 pr-7 text-right text-[15px] text-gray-900 dark:text-white tabular-nums outline-none" />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-gray-400 dark:text-gray-500">%</span>
        </span>
        <button type="submit" disabled={busy || !handle.trim() || !pct} className="h-10 shrink-0 rounded-xl bg-brand px-4 text-[13px] font-medium text-white disabled:opacity-50">걸기</button>
      </form>
      {deals.length > 0 && (
        <ul className="mt-3 divide-y divide-rule">
          {deals.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-gray-900 dark:text-white">{d.influencer_name || `@${d.handle}`}</span>
                <span className="block text-[12px] text-gray-500 dark:text-gray-400">
                  소개비 {d.pct}% · {d.status === 'active' ? '적용 중' : '사장님 승인 기다리는 중'}
                </span>
              </span>
              <button type="button" disabled={busy} onClick={() => { void end(d.id) }}
                className="h-9 shrink-0 rounded-lg px-3 text-[13px] font-medium text-gray-600 dark:text-gray-300 disabled:opacity-50">끝내기</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
