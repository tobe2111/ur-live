import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import PanelError from './PanelError'

/**
 * 🆕 2026-06-28 유어애즈 — 네이버 쇼핑 순위 추적(오가닉/쇼핑, 광고 순위와 별개).
 *   키워드 + 내 몰/도메인 등록 → 쇼핑검색 상위 300위 내 내 순위 일일 추적 + 변동.
 */
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}
interface RankTarget { id: number; keyword: string; mall_match: string; last_rank: number | null; last_total: number | null; last_title: string | null; last_checked_at: string | null; prev_rank: number | null }
const card = 'rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] p-4'
const input = 'h-10 rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] px-3 text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500'

function RankDelta({ cur, prev }: { cur: number | null; prev: number | null }) {
  if (cur == null || prev == null) return <span className="text-gray-300 dark:text-gray-600">-</span>
  const d = prev - cur // 순위 숫자 감소 = 상승
  if (d === 0) return <span className="text-gray-400 dark:text-gray-500">—</span>
  return d > 0
    ? <span className="text-emerald-600 dark:text-emerald-400">▲{d}</span>
    : <span className="text-red-500 dark:text-red-400">▼{-d}</span>
}

export default function RankPanel() {
  const [targets, setTargets] = useState<RankTarget[] | null>(null)
  const [keyword, setKeyword] = useState('')
  const [mall, setMall] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState<number | null>(null)
  const [err, setErr] = useState(false)

  const load = useCallback(async () => {
    setErr(false)
    try {
      const r = await api.get('/api/ads/rank/targets', { headers: authHeader() })
      if (r.data?.success) setTargets(r.data.targets || [])
    } catch { setErr(true) }
  }, [])
  useEffect(() => { load() }, [load])

  async function add() {
    if (keyword.trim().length < 1 || mall.trim().length < 2) { toast.error('키워드와 내 몰/도메인을 입력해주세요'); return }
    setBusy(true)
    try {
      const r = await api.post('/api/ads/rank/target', { keyword: keyword.trim(), mall: mall.trim() }, { headers: authHeader() })
      if (r.data?.success) { toast.success('추적 시작'); setKeyword(''); setMall(''); setTargets(r.data.targets || []) }
      else toast.error(r.data?.error || '추가 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '추가 실패')
    } finally { setBusy(false) }
  }

  async function refresh(id: number) {
    setRefreshing(id)
    try {
      const r = await api.post(`/api/ads/rank/refresh?id=${id}`, {}, { headers: authHeader() })
      if (r.data?.success) setTargets(r.data.targets || [])
    } catch { /* graceful */ } finally { setRefreshing(null) }
  }

  async function remove(id: number) {
    if (!(await confirmDialog('이 순위 추적을 삭제할까요?'))) return
    await api.delete(`/api/ads/rank/target?id=${id}`, { headers: authHeader() }).catch(() => {})
    await load()
  }

  return (
    <div className={`mt-3 ${card}`}>
      <div className="text-[14px] font-bold text-gray-900 dark:text-white">쇼핑 순위 추적 <span className="text-gray-400 dark:text-gray-500 text-[11px] font-medium">네이버쇼핑 내 순위</span></div>
      <p className="mt-1 text-[11.5px] text-gray-400 dark:text-gray-500">키워드 + 내 몰 이름(또는 도메인)을 등록하면 쇼핑검색에서 내가 <b className="text-gray-600 dark:text-gray-300">몇 위</b>인지 매일 추적합니다(광고 순위와 별개·상위 300위). 변동은 직전 대비.</p>

      <div className="mt-2 flex flex-wrap gap-2">
        <input className={`${input} flex-1 min-w-[150px]`} placeholder="키워드 (예: 무선이어폰)" value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} />
        <input className={`${input} flex-1 min-w-[140px]`} placeholder="내 몰 이름 또는 도메인" value={mall} onChange={e => setMall(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} />
        <button onClick={add} disabled={busy} className="shrink-0 rounded-lg bg-gray-900 dark:bg-white px-4 py-2 text-[12px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-50">{busy ? '조회 중…' : '추적 추가'}</button>
      </div>

      {err && <PanelError onRetry={load} />}

      {targets && targets.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead><tr className="text-gray-400 dark:text-gray-500 text-left">
              <th className="py-1 pr-2">키워드 · 내 몰</th><th className="py-1 pr-2 text-right">현재 순위</th><th className="py-1 pr-2 text-right">변동</th><th className="py-1 pr-2 text-right">총 상품</th><th className="py-1"></th>
            </tr></thead>
            <tbody>
              {targets.map(t => (
                <tr key={t.id} className="border-t border-gray-100 dark:border-[#1A1A1A] text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-2">
                    <span className="font-medium text-gray-900 dark:text-white">{t.keyword}</span>
                    <span className="block text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[160px]">{t.mall_match}{t.last_title ? ` · ${t.last_title}` : ''}</span>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums font-bold">
                    {t.last_rank != null ? `${t.last_rank}위` : <span className="text-gray-400 dark:text-gray-500 font-normal">300위 밖</span>}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums"><RankDelta cur={t.last_rank} prev={t.prev_rank} /></td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{t.last_total ? formatNumber(t.last_total) : '-'}</td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    <button onClick={() => refresh(t.id)} disabled={refreshing === t.id} className="text-[10.5px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50">{refreshing === t.id ? '…' : '갱신'}</button>
                    <button onClick={() => remove(t.id)} className="ml-2 text-[10.5px] text-gray-400 dark:text-gray-500 hover:text-red-500">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
