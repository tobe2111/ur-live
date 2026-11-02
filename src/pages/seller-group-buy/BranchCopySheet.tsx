/**
 * 🏬 이용권을 다른 지점에 복사 — 시트 (2026-10-17 대표 "응응 다 해줘" — 프랜차이즈 편의 기능)
 *
 * 내가 운영하는 지점이 둘 이상일 때만 뜬다. 고른 지점마다 서버를 **한 번씩** 부르고(요청당 한도 —
 * `seller-product-copy.routes.ts` 머리말) 결과를 지점별로 보여 준다. 가게 정보(상호·주소·좌표)는
 * 서버가 대상 지점 프로필로 채운다 — 이 화면은 무엇을 어디에 복사할지만 고른다.
 */
import { useEffect, useMemo, useState } from 'react'
import api from '@/lib/api'
import { Check, Loader2, X } from 'lucide-react'

interface StoreRow { seller_id: number; name: string; status?: string | null }
type Outcome = 'ok' | 'fail'

export default function BranchCopySheet({ productId, productName, onClose }: { productId: number; productName: string; onClose: () => void }) {
  const [stores, setStores] = useState<StoreRow[] | null>(null)
  const [current, setCurrent] = useState<number | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<Map<number, { outcome: Outcome; error?: string }>>(new Map())
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api.get('/api/seller/my-stores/summary')
      .then((r) => {
        if (!alive) return
        setStores((r.data?.data?.stores || []) as StoreRow[])
        setCurrent(r.data?.data?.current_seller_id ?? null)
      })
      .catch(() => { if (alive) setLoadError('지점 목록을 불러오지 못했어요') })
    return () => { alive = false }
  }, [])

  // 이 이용권이 있는 지점(지금 앉은 좌석)은 대상에서 뺀다.
  const others = useMemo(() => (stores || []).filter((s) => s.seller_id !== current), [stores, current])
  const allPicked = others.length > 0 && others.every((s) => picked.has(s.seller_id))
  const done = result.size > 0 && !running

  function toggle(id: number) {
    setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleAll() {
    setPicked(allPicked ? new Set() : new Set(others.map((s) => s.seller_id)))
  }

  async function run() {
    if (running || picked.size === 0) return
    setRunning(true)
    const next = new Map<number, { outcome: Outcome; error?: string }>()
    // 한 지점씩 — 한 요청에 몰면 서버 한도에 걸린다.
    for (const id of picked) {
      try {
        const r = await api.post(`/api/seller/products/${productId}/copy-to/${id}`)
        next.set(id, r.data?.success ? { outcome: 'ok' } : { outcome: 'fail', error: r.data?.error })
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } } }
        next.set(id, { outcome: 'fail', error: err?.response?.data?.error || '복사하지 못했어요' })
      }
      setResult(new Map(next))
    }
    setRunning(false)
  }

  const okCount = [...result.values()].filter((r) => r.outcome === 'ok').length

  return (
    <div className="ur-sheet-veil fixed inset-0 z-[10600] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="ur-sheet-in w-full max-w-md rounded-t-2xl bg-white sm:rounded-[var(--dash-radius,16px)] max-h-[85dvh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="min-w-0">
            <p className="text-[17px] font-bold text-gray-900">다른 지점에 복사</p>
            <p className="mt-1 truncate text-[13px] text-gray-500">{productName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-2 text-gray-400"><X size={18} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5">
          {loadError ? (
            <p className="py-8 text-center text-[13px] text-tone-bad">{loadError}</p>
          ) : stores == null ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : others.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-gray-500">복사할 다른 지점이 없어요. 지점을 먼저 등록해 주세요.</p>
          ) : (
            <>
              <p className="pb-2 text-[13px] text-gray-500">가게 이름·주소·위치는 지점마다 그 지점 정보로 들어가요.</p>
              <button type="button" onClick={toggleAll} disabled={running || done} className="w-full py-3 text-left text-[13px] font-bold text-brand-text">
                {allPicked ? '전체 해제' : `전체 선택 (${others.length}곳)`}
              </button>
              <ul className="divide-y divide-rule">
                {others.map((s) => {
                  const r = result.get(s.seller_id)
                  return (
                    <li key={s.seller_id}>
                      <button type="button" onClick={() => toggle(s.seller_id)} disabled={running || done}
                        className="flex w-full items-center gap-3 py-3 text-left">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${picked.has(s.seller_id) ? 'bg-brand text-white' : 'border border-rule-strong'}`}>
                          {picked.has(s.seller_id) && <Check size={13} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-gray-900">{s.name}</span>
                        {r?.outcome === 'ok' && <span className="text-[13px] font-bold text-tone-ok">복사됨</span>}
                        {r?.outcome === 'fail' && <span className="max-w-[45%] truncate text-[13px] text-tone-bad">{r.error || '실패'}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>

        <div className="px-5 pt-3 pb-5">
          {done ? (
            <button type="button" onClick={onClose} className="ur-btn ur-btn-lg ur-btn-primary w-full">
              {okCount}곳에 복사했어요 · 닫기
            </button>
          ) : (
            <button type="button" onClick={run} disabled={running || picked.size === 0} className="ur-btn ur-btn-lg ur-btn-primary w-full disabled:opacity-40">
              {running ? `복사 중… ${result.size}/${picked.size}` : picked.size > 0 ? `${picked.size}곳에 복사` : '지점을 골라 주세요'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
