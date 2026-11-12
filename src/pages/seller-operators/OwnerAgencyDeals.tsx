/**
 * 🤝💰 사장님 — 에이전시가 건 **인플루언서 소개비** 보기 · 승인 · 거절 · 끝내기 (2026-11-11 결재 ⑤ · 스위치 OFF 면 안 그린다)
 *   서버: `GET /api/seller/agency-link/deals` · `POST …/:id/decide {approve}` · `POST …/:id/end`
 *
 * 총 마케팅 비용 상한 안의 계약은 이미 적용 중이고(보기·끝내기만), 상한을 넘은 제안만 승인/거절을 기다린다.
 * ⚠️ 대시보드 = 라이트 고정(`dark:` 금지).
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'

interface Deal { id: number; pct: number; status: 'active' | 'pending_owner'; handle: string | null; influencer_name: string | null; agency_name: string | null }

export default function OwnerAgencyDeals() {
  const [enabled, setEnabled] = useState(false)
  const [deals, setDeals] = useState<Deal[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await api.get('/api/seller/agency-link/deals')
      setEnabled(!!r.data?.enabled)
      setDeals(r.data?.deals || [])
    } catch { /* 목록을 못 받으면 칸을 안 그린다(지어내지 않는다) */ }
  }, [])
  useEffect(() => { void load() }, [load])

  if (!enabled || deals.length === 0) return null

  async function act(path: string, body?: unknown) {
    setBusy(true); setError('')
    try {
      await api.post(path, body)
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.error || '처리하지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4" data-testid="owner-agency-deals">
      <p className="text-[15px] font-semibold text-gray-900">에이전시가 건 인플루언서 소개비</p>
      <p className="mt-1 text-[12px] leading-[1.55] text-gray-500">총 마케팅 비용 상한 안은 바로 적용돼요. 상한을 넘은 제안은 승인해야 적용돼요.</p>
      {error && <p className="mt-2 text-[13px] text-tone-bad">{error}</p>}
      <ul className="mt-2 flex flex-col gap-2">
        {deals.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-gray-900">{d.influencer_name || `@${d.handle}`} · 소개비 {d.pct}%</span>
              <span className="block text-[12px] text-gray-500">{d.agency_name || '에이전시'} 제안 · {d.status === 'active' ? '적용 중' : '승인 기다리는 중 (상한 초과)'}</span>
            </span>
            {d.status === 'pending_owner' ? (
              <>
                <button type="button" disabled={busy} onClick={() => { void act(`/api/seller/agency-link/deals/${d.id}/decide`, { approve: true }) }}
                  className="ur-btn ur-btn-md ur-btn-primary disabled:opacity-50">승인</button>
                <button type="button" disabled={busy} onClick={() => { void act(`/api/seller/agency-link/deals/${d.id}/decide`, { approve: false }) }}
                  className="h-9 rounded-lg px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50">거절</button>
              </>
            ) : (
              <button type="button" disabled={busy} onClick={() => { void act(`/api/seller/agency-link/deals/${d.id}/end`) }}
                className="h-9 rounded-lg px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50">끝내기</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
