/**
 * 🤝 에이전시 몫 % 정하기 — 사장님 전용 (2026-10-24, 에이전시 몫 1단계)
 *
 * 사장님이 이 에이전시에 판매액의 몇 % 를 줄지 정한다. 유어딜은 그 % 로 **줄 금액만 계산해 보여 준다**
 * (매출 분석 '누가 팔았나' · 에이전시 판매 내역). 실제 돈은 매장이 에이전시에 직접 보내고,
 * 세금계산서도 에이전시가 매장에 발행한다. 바꾸면 **지금부터의 판매**에 적용된다(지난 판매 금액은 그대로).
 * 서버: `POST /api/seller/agency-link/share` (`agency-share.ts`).
 * ⚠️ 대시보드 = 라이트 고정(`dark:` 금지).
 */
import { useState } from 'react'
import api from '@/lib/api'

export const AGENCY_SHARE_NOTE = '유어딜은 줄 금액을 계산해 보여 주기만 해요. 돈은 매장이 에이전시에 직접 보내고, 세금계산서는 에이전시가 매장에 발행해요.'

export default function AgencyShareEditor({ agencyId, agencyName, current, onSaved }: {
  agencyId: number
  agencyName: string
  current: number | null
  onSaved: () => void
}) {
  const [value, setValue] = useState(current == null ? '' : String(current))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const r = await api.post('/api/seller/agency-link/share', { agency_id: agencyId, pct: value })
      if (!r.data?.success) throw new Error(r.data?.error)
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.error || '저장하지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="mt-3">
      <label htmlFor={`agency-share-${agencyId}`} className="block text-[13px] font-semibold text-gray-700">
        {agencyName} 에이전시 몫 (판매액의 %)
      </label>
      <div className="mt-1 flex gap-2">
        <span className="relative">
          <input
            id={`agency-share-${agencyId}`}
            type="number" inputMode="decimal" min={0} max={90} step={0.1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            className="h-10 w-24 rounded-lg border border-gray-200 pl-3 pr-7 text-right text-[15px] text-gray-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-gray-400">%</span>
        </span>
        <button type="submit" disabled={busy || value === ''} className="ur-btn ur-btn-md ur-btn-primary disabled:opacity-50">저장</button>
      </div>
      {error && <p className="mt-2 text-[13px] text-tone-bad">{error}</p>}
      <p className="mt-2 text-[12px] leading-[1.55] text-gray-500">
        바꾸면 지금부터의 판매에 적용돼요. 환불된 판매에는 붙지 않아요. {AGENCY_SHARE_NOTE}
      </p>
    </form>
  )
}
