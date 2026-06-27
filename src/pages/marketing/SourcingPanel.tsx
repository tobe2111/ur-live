import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

/**
 * 🆕 2026-06-27 유어애즈 — 소싱 리포트(데이터랩 쇼핑인사이트 분야 트렌드).
 *   "뜨는 카테고리" 발굴 → 도매몰 소싱 시너지. 연동 불필요(오픈API), 읽기 전용.
 */
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}
interface CategoryTrend { name: string; changePct: number; latest: number }
const card = 'rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] p-4'

export default function SourcingPanel() {
  const [rows, setRows] = useState<CategoryTrend[] | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      const r = await api.get('/api/ads/sourcing/trends', { headers: authHeader() })
      if (r.data?.success) setRows(r.data.results || [])
      else toast.error(r.data?.error || '분석 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '분석 실패')
    } finally { setBusy(false) }
  }

  const max = rows && rows.length ? Math.max(...rows.map(r => Math.abs(r.changePct)), 1) : 1

  return (
    <div className={`mt-3 ${card}`}>
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-bold text-gray-900 dark:text-white">📈 소싱 리포트 <span className="text-gray-400 dark:text-gray-500 text-[11px] font-medium">쇼핑 분야 트렌드</span></div>
        <button onClick={run} disabled={busy} className="shrink-0 rounded-lg bg-gray-900 dark:bg-white px-3 py-1.5 text-[12px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-50">{busy ? '분석 중…' : '트렌드 분석'}</button>
      </div>
      <p className="mt-1 text-[11.5px] text-gray-400 dark:text-gray-500">최근 1년 분야별 쇼핑 검색 증감 — 뜨는 카테고리를 찾아 소싱(도매)·광고 우선순위에 활용하세요.</p>
      {rows && (rows.length === 0 ? (
        <p className="mt-3 text-[12px] text-gray-400 dark:text-gray-500">데이터가 없습니다.</p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {rows.map(r => (
            <div key={r.name} className="flex items-center gap-2 text-[12px]">
              <span className="w-24 shrink-0 truncate text-gray-700 dark:text-gray-300">{r.name}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-[#1A1A1A] overflow-hidden">
                <div className={`h-full rounded-full ${r.changePct >= 0 ? 'bg-emerald-400 dark:bg-emerald-500' : 'bg-red-300 dark:bg-red-500/60'}`} style={{ width: `${Math.min(100, (Math.abs(r.changePct) / max) * 100)}%` }} />
              </div>
              <span className={`w-14 shrink-0 text-right tabular-nums font-bold ${r.changePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>{r.changePct >= 0 ? '▲' : '▼'}{Math.abs(r.changePct)}%</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
