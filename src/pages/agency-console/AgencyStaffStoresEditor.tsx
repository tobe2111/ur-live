import { useEffect, useState } from 'react'
import { toast } from '@/hooks/useToast'
import { agencyRequest } from './agency-api'

interface StoreOption { sellerId: number; name: string; status: 'pending' | 'active' }

/**
 * 👥 직원 한 명의 매장 범위 — "맡은 매장 전부" 또는 "고른 매장만" (관리자만 연다).
 *   서버: GET/PUT `/staff/:id/stores` (`agency-staff-stores.ts`). 기본은 전부라 안 열면 종전과 같다.
 */
export function AgencyStaffStoresEditor({ staffId, who, onClose, onSaved }: {
  staffId: number
  who: string
  onClose: () => void
  onSaved: () => void
}) {
  const [stores, setStores] = useState<StoreOption[] | null>(null)
  const [scope, setScope] = useState<'all' | 'assigned'>('all')
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([
      agencyRequest<{ stores: StoreOption[] }>('/stores'),
      agencyRequest<{ scope: 'all' | 'assigned'; sellerIds: number[] }>(`/staff/${staffId}/stores`),
    ]).then(([s, a]) => {
      if (!alive) return
      if (!s.ok || !a.ok) { setError(s.data.error || a.data.error || '불러오지 못했어요.'); return }
      setStores(s.data.stores.filter((x) => x.status === 'active'))
      setScope(a.data.scope)
      setPicked(new Set(a.data.sellerIds))
    })
    return () => { alive = false }
  }, [staffId])

  function toggle(id: number) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const problem = scope === 'assigned' && picked.size === 0 ? '매장을 하나 이상 골라 주세요.' : ''

  async function save() {
    if (busy || problem) return
    setBusy(true)
    const r = await agencyRequest(`/staff/${staffId}/stores`, {
      method: 'PUT',
      body: scope === 'all' ? { scope } : { scope, sellerIds: [...picked] },
    })
    setBusy(false)
    if (!r.ok) { toast.error(r.data.error || '저장하지 못했어요.'); return }
    toast.success(r.data.message || '저장했어요.')
    onSaved()
    onClose()
  }

  return (
    <div className="border-t border-rule bg-[#F8F7FC] dark:bg-[#11141C] px-6 py-4">
      <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">{who} 님이 들어갈 수 있는 매장</p>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-tone-bad">{error}</p>
      ) : stores === null ? (
        <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">불러오는 중…</p>
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            {(['all', 'assigned'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setScope(v)} aria-pressed={scope === v}
                className={`h-9 rounded-full px-4 text-[13px] font-semibold ${scope === v ? 'bg-brand text-white' : 'bg-white dark:bg-[#1D1F29] text-gray-600 dark:text-gray-300 shadow-lift'}`}>
                {v === 'all' ? '맡은 매장 전부' : '고른 매장만'}
              </button>
            ))}
          </div>
          {scope === 'assigned' && (
            stores.length === 0 ? (
              <p className="mt-3 text-[13px] text-gray-500 dark:text-gray-400">아직 운영 중인 매장이 없어요.</p>
            ) : (
              <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                {stores.map((s) => (
                  <li key={s.sellerId}>
                    <label className="flex min-h-[40px] items-center gap-3 rounded-xl bg-white dark:bg-[#1D1F29] px-3 text-[15px] text-gray-900 dark:text-white">
                      <input type="checkbox" checked={picked.has(s.sellerId)} onChange={() => toggle(s.sellerId)}
                        className="h-4 w-4 shrink-0 accent-brand" />
                      <span className="truncate">{s.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )
          )}
          {problem && <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">{problem}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={onClose} className="h-10 rounded-xl px-4 text-[13px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-[#1D1F29]">닫기</button>
            <button type="button" disabled={busy || !!problem} onClick={save}
              className="h-10 flex-1 rounded-xl bg-brand px-4 text-[15px] font-semibold text-white disabled:opacity-50">
              {busy ? '저장 중…' : '저장'}
            </button>
          </div>
          <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">빼면 그 매장 화면은 다음 동작부터 막혀요. 새로 맡은 매장은 직접 더해 줘야 해요.</p>
        </>
      )}
    </div>
  )
}
