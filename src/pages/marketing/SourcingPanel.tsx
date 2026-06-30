import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import PanelError from './PanelError'

/**
 * 🆕 2026-06-27 유어애즈 — 소싱 리포트(데이터랩 쇼핑인사이트 분야 트렌드).
 *   "뜨는 카테고리" 발굴 → 도매몰 소싱 시너지. 연동 불필요(오픈API), 읽기 전용.
 *   🆕 2026-06-28 카테고리 클릭 → 기기/성별/연령 분포(누가 사는가) 세분화.
 */
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}
interface CategoryTrend { name: string; changePct: number; latest: number; cid: string }
interface DemoSegment { label: string; pct: number }
interface CategoryDemographics { device: DemoSegment[]; gender: DemoSegment[]; age: DemoSegment[] }
const card = 'rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] p-4'

function DemoRow({ title, segs }: { title: string; segs: DemoSegment[] }) {
  if (!segs.length) return null
  return (
    <div className="flex items-start gap-2">
      <span className="w-10 shrink-0 text-[10.5px] text-gray-400 dark:text-gray-500 pt-0.5">{title}</span>
      <div className="flex-1 flex flex-wrap gap-1.5">
        {segs.map(s => (
          <span key={s.label} className="inline-flex items-center gap-1 rounded bg-gray-50 dark:bg-[#0A0A0A] px-1.5 py-0.5 text-[10.5px] text-gray-600 dark:text-gray-300">
            {s.label} <b className="text-gray-900 dark:text-white tabular-nums">{s.pct}%</b>
          </span>
        ))}
      </div>
    </div>
  )
}

export default function SourcingPanel() {
  const [rows, setRows] = useState<CategoryTrend[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)
  const [openCid, setOpenCid] = useState<string | null>(null)
  const [demo, setDemo] = useState<Record<string, CategoryDemographics | 'err'>>({})
  const [demoBusy, setDemoBusy] = useState<string | null>(null)

  async function run() {
    setBusy(true); setErr(false)
    try {
      const r = await api.get('/api/ads/sourcing/trends', { headers: authHeader() })
      if (r.data?.success) setRows(r.data.results || [])
      else toast.error(r.data?.error || '분석 실패')
    } catch (e: unknown) {
      setErr(true)
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '분석 실패')
    } finally { setBusy(false) }
  }

  async function toggle(cid: string) {
    if (!cid) return
    if (openCid === cid) { setOpenCid(null); return }
    setOpenCid(cid)
    if (demo[cid]) return // 캐시됨
    setDemoBusy(cid)
    try {
      const r = await api.get(`/api/ads/sourcing/demographics?cid=${encodeURIComponent(cid)}`, { headers: authHeader() })
      if (r.data?.success) setDemo(prev => ({ ...prev, [cid]: r.data.data }))
      else setDemo(prev => ({ ...prev, [cid]: 'err' }))
    } catch { setDemo(prev => ({ ...prev, [cid]: 'err' })) } finally { setDemoBusy(null) }
  }

  const max = rows && rows.length ? Math.max(...rows.map(r => Math.abs(r.changePct)), 1) : 1

  return (
    <div className={`mt-3 ${card}`}>
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-bold text-gray-900 dark:text-white">소싱 리포트 <span className="text-gray-400 dark:text-gray-500 text-[11px] font-medium">쇼핑 분야 트렌드</span></div>
        <button onClick={run} disabled={busy} className="shrink-0 rounded-lg bg-gray-900 dark:bg-white px-3 py-1.5 text-[12px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-50">{busy ? '분석 중…' : '트렌드 분석'}</button>
      </div>
      <p className="mt-1 text-[11.5px] text-gray-400 dark:text-gray-500">최근 1년 분야별 쇼핑 검색 증감 — 뜨는 카테고리를 찾아 소싱(도매)·광고 우선순위에 활용하세요. <span className="text-gray-300 dark:text-gray-600">카테고리를 누르면 기기·성별·연령 분포를 봅니다.</span></p>
      {err && <PanelError onRetry={run} busy={busy} label="트렌드 분석 실패" />}
      {rows && (rows.length === 0 ? (
        <p className="mt-3 text-[12px] text-gray-400 dark:text-gray-500">데이터가 없습니다.</p>
      ) : (
        <div className="mt-3 space-y-1">
          {rows.map(r => {
            const d = demo[r.cid]
            const isOpen = openCid === r.cid
            return (
              <div key={r.name}>
                <button onClick={() => toggle(r.cid)} disabled={!r.cid} className="w-full flex items-center gap-2 text-[12px] py-1 text-left disabled:cursor-default">
                  <span className="w-24 shrink-0 truncate text-gray-700 dark:text-gray-300">{r.cid ? (isOpen ? '▾ ' : '▸ ') : ''}{r.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-[#1A1A1A] overflow-hidden">
                    <div className={`h-full rounded-full ${r.changePct >= 0 ? 'bg-emerald-400 dark:bg-emerald-500' : 'bg-red-300 dark:bg-red-500/60'}`} style={{ width: `${Math.min(100, (Math.abs(r.changePct) / max) * 100)}%` }} />
                  </div>
                  <span className={`w-14 shrink-0 text-right tabular-nums font-bold ${r.changePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>{r.changePct >= 0 ? '▲' : '▼'}{Math.abs(r.changePct)}%</span>
                </button>
                {isOpen && (
                  <div className="ml-2 mb-1.5 rounded-lg border border-gray-100 dark:border-[#1A1A1A] p-2.5 space-y-1.5">
                    {demoBusy === r.cid ? (
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">불러오는 중…</p>
                    ) : d === 'err' ? (
                      <p className="text-[11px] text-amber-600 dark:text-amber-500">세분화 데이터를 불러오지 못했습니다 (검색광고 오픈API 키 필요).</p>
                    ) : d ? (
                      <>
                        <DemoRow title="기기" segs={d.device} />
                        <DemoRow title="성별" segs={d.gender} />
                        <DemoRow title="연령" segs={d.age} />
                        <p className="text-[10px] text-gray-300 dark:text-gray-600">최근 1년 평균 비중(상대값) · 누가 이 분야를 더 많이 검색·구매하는지의 방향 지표.</p>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
