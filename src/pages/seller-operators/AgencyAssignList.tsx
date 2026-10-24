/**
 * 🎟️ 이미 있는 이용권을 에이전시에 맡기기 — 사장님 전용 (2026-10-24 대표 *"이미 있는 이용권을 특정 에이전시에도 배정하는 기능 필요해"*)
 *
 * 에이전시 줄(`AgencyLinkCard`)에서 펼친다. 이 매장 이용권마다 [맡기기 / 맡김 · 돌려받기] 한 번.
 * 다른 에이전시가 맡은 이용권도 옮길 수 있다 — 옮겨도 그 전 판매는 앞 에이전시 성과로 남는다(서버 '맡은 기간').
 * 서버: `GET /api/seller/agency-link/products` · `POST /api/seller/agency-link/assign`.
 * ⚠️ 대시보드 = 라이트 고정(`dark:` 금지).
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'

interface ProductRow { id: number; name: string; price: number; active: boolean; agencyId: number | null }

export default function AgencyAssignList({ agencyId, agencyName, agencyNames, onChanged }: {
  agencyId: number
  agencyName: string
  /** 다른 에이전시 이름(이미 맡은 이용권 표시용). */
  agencyNames: Map<number, string>
  onChanged: () => void
}) {
  const [items, setItems] = useState<ProductRow[] | undefined>(undefined)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await api.get('/api/seller/agency-link/products')
      if (!r.data?.success) throw new Error(r.data?.error)
      setItems(Array.isArray(r.data.data) ? r.data.data : [])
    } catch (e: any) {
      setError(e?.response?.data?.error || '이용권을 불러오지 못했어요')
    }
  }, [])
  useEffect(() => { load() }, [load])

  async function assign(p: ProductRow, to: number | null) {
    if (busyId) return
    setBusyId(p.id); setError('')
    try {
      const r = await api.post('/api/seller/agency-link/assign', { product_id: p.id, agency_id: to })
      if (!r.data?.success) throw new Error(r.data?.error)
      setItems((prev) => prev?.map((x) => (x.id === p.id ? { ...x, agencyId: to } : x)))
      onChanged()
    } catch (e: any) {
      setError(e?.response?.data?.error || '바꾸지 못했어요')
    } finally {
      setBusyId(null)
    }
  }

  if (error && !items) {
    return (
      <div className="mt-3">
        <p className="text-[13px] text-tone-bad">{error}</p>
        <button type="button" onClick={load} className="mt-1 text-[13px] font-semibold text-brand-text underline">다시 시도</button>
      </div>
    )
  }
  if (!items) return <p className="mt-3 text-[13px] text-gray-500">불러오는 중…</p>
  if (items.length === 0) return <p className="mt-3 text-[13px] text-gray-500">아직 등록한 이용권이 없어요.</p>

  return (
    <div className="mt-3">
      <p className="text-[12px] leading-[1.55] text-gray-500">
        {agencyName} 에이전시에 맡긴 이용권은 그 에이전시가 보고 고칠 수 있어요. 옮기거나 돌려받아도 그 전 판매는 원래 맡았던 쪽 성과로 남아요.
      </p>
      {error && <p className="mt-2 text-[13px] text-tone-bad">{error}</p>}
      <ul className="mt-2 divide-y divide-gray-100">
        {items.map((p) => {
          const mine = p.agencyId === agencyId
          const other = p.agencyId != null && !mine ? (agencyNames.get(p.agencyId) || '다른 에이전시') : null
          return (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-gray-900">{p.name}</span>
                <span className="block text-[12px] text-gray-500">
                  {formatNumber(p.price)}원{!p.active && ' (판매 중지)'}{other && ` / 지금 ${other}`}
                </span>
              </span>
              <button type="button" disabled={busyId === p.id} onClick={() => assign(p, mine ? null : agencyId)}
                className={`h-8 shrink-0 rounded-lg px-3 text-[12px] font-semibold disabled:opacity-50 ${mine ? 'bg-gray-100 text-gray-700' : 'bg-brand text-white'}`}>
                {mine ? '돌려받기' : other ? '여기로 옮기기' : '맡기기'}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
