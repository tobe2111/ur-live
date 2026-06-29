import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import PanelError from './PanelError'

/**
 * 🆕 2026-06-27 유어애즈 — 가격 모니터링(네이버쇼핑 최저가 추적).
 *   상품 검색어 + 내 판매가 등록 → 최저가/최저몰 추적 + 내가 최저가인지 비교. 일일 자동 갱신.
 *   연동 불필요(오픈API). 차단/돈 변경 없음.
 */
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

interface Watch { id: number; query: string; my_price: number | null; last_lowest: number | null; last_mall: string | null; last_total: number | null; last_checked_at: string | null }

const card = 'rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] p-4'
const input = 'h-10 rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] px-3 text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500'

export default function PricePanel() {
  const [watches, setWatches] = useState<Watch[]>([])
  const [query, setQuery] = useState('')
  const [myPrice, setMyPrice] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState<number | null>(null)
  const [err, setErr] = useState(false)

  const load = useCallback(async () => {
    setErr(false)
    try {
      const r = await api.get('/api/ads/price/watches', { headers: authHeader() })
      if (r.data?.success) setWatches(r.data.watches || [])
    } catch { setErr(true) }
  }, [])
  useEffect(() => { load() }, [load])

  async function add() {
    if (query.trim().length < 2) { toast.error('상품 검색어를 2자 이상 입력해주세요'); return }
    setBusy(true)
    try {
      const r = await api.post('/api/ads/price/watch', { query: query.trim(), my_price: myPrice ? Number(myPrice) : undefined }, { headers: authHeader() })
      if (r.data?.success) { toast.success('등록 완료'); setQuery(''); setMyPrice(''); setWatches(r.data.watches || []) }
      else toast.error(r.data?.error || '등록 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '등록 실패')
    } finally { setBusy(false) }
  }

  async function refresh(id: number) {
    setRefreshing(id)
    try {
      const r = await api.post(`/api/ads/price/refresh?id=${id}`, {}, { headers: authHeader() })
      if (r.data?.success) setWatches(r.data.watches || [])
    } catch { /* graceful */ } finally { setRefreshing(null) }
  }

  async function remove(id: number) {
    if (!(await confirmDialog('이 가격 모니터링을 삭제할까요?'))) return
    await api.delete(`/api/ads/price/watch?id=${id}`, { headers: authHeader() }).catch(() => {})
    await load()
  }

  return (
    <div className={`mt-3 ${card}`}>
      <div className="text-[14px] font-bold text-gray-900 dark:text-white">가격 모니터링 <span className="text-gray-400 dark:text-gray-500 text-[11px] font-medium">네이버쇼핑 최저가 추적</span></div>
      <p className="mt-1 text-[11.5px] text-gray-400 dark:text-gray-500">내 상품 검색어 + 판매가를 등록하면 최저가·최저몰을 매일 자동 추적하고, 내가 최저가인지 비교해줍니다.</p>

      <div className="mt-2 flex flex-wrap gap-2">
        <input className={`${input} flex-1 min-w-[160px]`} placeholder="상품 검색어 (예: 무선이어폰 블랙)" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} />
        <input className={`${input} w-32`} type="number" placeholder="내 판매가(선택)" value={myPrice} onChange={e => setMyPrice(e.target.value)} />
        <button onClick={add} disabled={busy} className="shrink-0 rounded-lg bg-gray-900 dark:bg-white px-4 py-2 text-[12px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-50">{busy ? '등록 중…' : '추적 추가'}</button>
      </div>

      {err && <PanelError onRetry={load} />}

      {watches.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead><tr className="text-gray-400 dark:text-gray-500 text-left">
              <th className="py-1 pr-2">상품 검색어</th><th className="py-1 pr-2 text-right">내 판매가</th><th className="py-1 pr-2 text-right">최저가</th><th className="py-1 pr-2">최저몰</th><th className="py-1 pr-2">상태</th><th className="py-1"></th>
            </tr></thead>
            <tbody>
              {watches.map(w => {
                const cheaper = w.my_price != null && w.last_lowest != null && w.last_lowest > 0 && w.my_price <= w.last_lowest
                const higher = w.my_price != null && w.last_lowest != null && w.last_lowest > 0 && w.my_price > w.last_lowest
                return (
                  <tr key={w.id} className="border-t border-gray-100 dark:border-[#1A1A1A] text-gray-700 dark:text-gray-300">
                    <td className="py-1.5 pr-2 font-medium text-gray-900 dark:text-white truncate max-w-[160px]">{w.query}<span className="block text-[10px] text-gray-400 dark:text-gray-500">상품 {formatNumber(w.last_total || 0)}개</span></td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{w.my_price != null ? `₩${formatNumber(w.my_price)}` : '-'}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums font-bold">{w.last_lowest ? `₩${formatNumber(w.last_lowest)}` : '-'}</td>
                    <td className="py-1.5 pr-2 truncate max-w-[100px] text-gray-500 dark:text-gray-400">{w.last_mall || '-'}</td>
                    <td className="py-1.5 pr-2">
                      {cheaper ? <span className="px-1.5 py-0.5 rounded text-[10.5px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">최저가 ✓</span>
                        : higher ? <span className="px-1.5 py-0.5 rounded text-[10.5px] bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">더 비쌈</span>
                        : <span className="text-gray-400 dark:text-gray-500 text-[10.5px]">-</span>}
                    </td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      <button onClick={() => refresh(w.id)} disabled={refreshing === w.id} className="text-[10.5px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50">{refreshing === w.id ? '…' : '갱신'}</button>
                      <button onClick={() => remove(w.id)} className="ml-2 text-[10.5px] text-gray-400 dark:text-gray-500 hover:text-red-500">삭제</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
