import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import PanelError from './PanelError'
import { downloadCsv } from '@/utils/csv-download'

/**
 * 🆕 2026-06-30 유어애즈 — 성과 추세(30일) 패널.
 *   /api/ads/metrics/history (cron 적재 ad_daily_metrics) → 광고비/전환매출/ROAS/평균순위 시계열 + 전주 대비.
 *   데이터 없으면(연동 직후) '지금 갱신'으로 최근치 즉시 적재. 의존성 없는 인라인 SVG 차트(번들 경량).
 */
interface DailyMetric { snap_date: string; cost: number; conv_amt: number; clicks: number; conv: number; imp: number; roas: number | null; avg_rnk: number | null }
interface WoW { recent: { cost: number; conv_amt: number; roas: number | null }; prev: { cost: number; conv_amt: number; roas: number | null }; costPct: number | null; convPct: number | null }

const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

type MetricKey = 'cost' | 'conv_amt' | 'roas' | 'avg_rnk'
const METRICS: Array<{ key: MetricKey; label: string; unit: string; lowerBetter?: boolean }> = [
  { key: 'cost', label: '광고비', unit: '₩' },
  { key: 'conv_amt', label: '전환매출', unit: '₩' },
  { key: 'roas', label: 'ROAS', unit: '%' },
  { key: 'avg_rnk', label: '평균순위', unit: '위', lowerBetter: true },
]

function mmdd(s: string): string { const p = s.split('-'); return p.length === 3 ? `${p[1]}/${p[2]}` : s }

/** 의존성 없는 인라인 SVG 라인+영역 차트. null 값 일자는 점 생략(선 연결만). */
function MiniChart({ series, metric }: { series: DailyMetric[]; metric: MetricKey }) {
  const W = 640, H = 160, padL = 8, padR = 8, padT = 12, padB = 18
  const pts = series.map((d, i) => ({ i, v: d[metric] == null ? null : Number(d[metric]), date: d.snap_date }))
  const defined = pts.filter(p => p.v != null) as Array<{ i: number; v: number; date: string }>
  if (defined.length < 2) return <div className="h-[160px] flex items-center justify-center text-[12px] text-gray-400 dark:text-gray-500">표시할 데이터가 2일 이상 필요합니다</div>
  const vals = defined.map(p => p.v)
  const maxV = Math.max(...vals), minV = Math.min(...vals)
  const span = maxV - minV || 1
  const n = series.length
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR))
  const y = (v: number) => padT + (1 - (v - minV) / span) * (H - padT - padB)
  const line = defined.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(defined[defined.length - 1].i).toFixed(1)},${(H - padB).toFixed(1)} L${x(defined[0].i).toFixed(1)},${(H - padB).toFixed(1)} Z`
  const last = defined[defined.length - 1]
  const labelIdx = [0, Math.floor((n - 1) / 2), n - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B6EF5" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#3B6EF5" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#trendFill)" />
      <path d={line} fill="none" stroke="#3B6EF5" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r="3.5" fill="#3B6EF5" />
      {labelIdx.map((i) => series[i] && (
        <text key={i} x={Math.min(W - padR, Math.max(padL, x(i)))} y={H - 5} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="fill-gray-400 dark:fill-gray-500" style={{ fontSize: 10 }}>{mmdd(series[i].snap_date)}</text>
      ))}
    </svg>
  )
}

export default function TrendPanel() {
  const [series, setSeries] = useState<DailyMetric[] | null>(null)
  const [wow, setWoW] = useState<WoW | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const [metric, setMetric] = useState<MetricKey>('cost')
  const [notConnected, setNotConnected] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setErr(false)
    try {
      const r = await api.get('/api/ads/metrics/history?days=30', { headers: authHeader() })
      if (r.data?.success) { setSeries(r.data.series || []); setWoW(r.data.wow || null) }
      else setErr(true)
    } catch { setErr(true) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function snapshotNow() {
    setBusy(true); setNotConnected(false)
    try {
      const r = await api.post('/api/ads/metrics/snapshot', {}, { headers: authHeader() })
      if (r.data?.success) { setSeries(r.data.series || []); setWoW(r.data.wow || null); toast.success('최근 실적을 적재했습니다') }
      else toast.error(r.data?.error || '적재 실패')
    } catch (e: unknown) {
      const ax = e as { response?: { status?: number; data?: { code?: string; error?: string } } }
      if (ax.response?.data?.code === 'NOT_CONNECTED') { setNotConnected(true) }
      else toast.error(ax.response?.data?.error || '적재 실패')
    } finally { setBusy(false) }
  }

  const card = 'mt-3 rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] p-4'
  const hasData = useMemo(() => (series || []).some(d => d.cost > 0 || d.imp > 0 || d.conv_amt > 0), [series])
  const cur = METRICS.find(m => m.key === metric)!

  const fmtVal = (v: number | null, m: typeof cur): string => {
    if (v == null) return '–'
    if (m.unit === '₩') return `₩${formatNumber(v)}`
    if (m.unit === '%') return `${formatNumber(v)}%`
    if (m.unit === '위') return `${v}위`
    return formatNumber(v)
  }

  return (
    <div className={card}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[14px] font-bold text-gray-900 dark:text-white">성과 추세 <span className="text-gray-400 dark:text-gray-500 font-medium">최근 30일</span></div>
          <p className="mt-0.5 text-[11.5px] text-gray-400 dark:text-gray-500">매일 자동 적재된 실적의 시계열입니다. 광고비·전환매출·ROAS·평균순위 추이를 한눈에.</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {hasData && series && series.length > 0 && (
            <button onClick={() => downloadCsv('유어애즈_성과추세_30일.csv',
              ['날짜', '광고비', '전환매출', 'ROAS(%)', '클릭', '전환', '노출', '평균순위'],
              series.map((d) => [d.snap_date, d.cost, d.conv_amt, d.roas ?? '', d.clicks, d.conv, d.imp, d.avg_rnk ?? '']))}
              className="rounded-lg border border-gray-200 dark:border-[#2A2A2A] px-2 py-1 text-[11px] font-bold text-gray-700 dark:text-gray-200">CSV</button>
          )}
          <button onClick={snapshotNow} disabled={busy} className="rounded-lg border border-gray-200 dark:border-[#2A2A2A] px-2.5 py-1 text-[11px] font-bold text-gray-700 dark:text-gray-200 disabled:opacity-50">{busy ? '갱신 중…' : '지금 갱신'}</button>
        </div>
      </div>

      {err ? (
        <PanelError onRetry={load} busy={loading} label="추세 조회 실패" />
      ) : loading ? (
        <div className="mt-4 h-[160px] animate-pulse rounded-xl bg-gray-100 dark:bg-[#1A1A1A]" />
      ) : !hasData ? (
        <div className="mt-3 rounded-xl border border-dashed border-gray-200 dark:border-[#2A2A2A] p-5 text-center">
          <p className="text-[12.5px] text-gray-500 dark:text-gray-400">{notConnected
            ? '검색광고 계정을 먼저 연결하면 매일 실적이 자동 적재됩니다.'
            : '아직 적재된 실적이 없습니다. 연동 직후라면 \'지금 갱신\'으로 최근 실적을 바로 불러올 수 있어요. 이후로는 매일 자동 적립됩니다.'}</p>
        </div>
      ) : (
        <>
          {/* WoW 요약 — 최근 7일 vs 직전 7일 */}
          {wow && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { l: '광고비 (7일)', v: `₩${formatNumber(wow.recent.cost)}`, pct: wow.costPct, goodUp: false },
                { l: '전환매출 (7일)', v: `₩${formatNumber(wow.recent.conv_amt)}`, pct: wow.convPct, goodUp: true },
                { l: 'ROAS (7일)', v: wow.recent.roas != null ? `${formatNumber(wow.recent.roas)}%` : '–', pct: null, goodUp: true },
              ].map((m) => (
                <div key={m.l} className="rounded-xl border border-gray-100 dark:border-[#1A1A1A] p-2.5">
                  <div className="text-[10.5px] text-gray-400 dark:text-gray-500">{m.l}</div>
                  <div className="mt-0.5 text-[14px] font-bold text-gray-900 dark:text-white tabular-nums">{m.v}</div>
                  {m.pct != null && (
                    <div className={`text-[11px] font-semibold tabular-nums ${(m.pct >= 0) === m.goodUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                      {m.pct >= 0 ? '▲' : '▼'} {Math.abs(m.pct)}% <span className="font-normal text-gray-400 dark:text-gray-500">전주 대비</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 지표 선택 */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {METRICS.map((m) => (
              <button key={m.key} onClick={() => setMetric(m.key)}
                className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${metric === m.key
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-[#0A0A0A]'
                  : 'border border-gray-200 dark:border-[#2A2A2A] text-gray-600 dark:text-gray-300'}`}>{m.label}</button>
            ))}
          </div>

          {/* 차트 */}
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[11.5px] text-gray-400 dark:text-gray-500">{cur.label}{cur.lowerBetter ? ' (낮을수록 좋음)' : ''}</span>
              <span className="text-[13px] font-bold text-gray-900 dark:text-white tabular-nums">{fmtVal(series && series.length ? series[series.length - 1][metric] : null, cur)}</span>
            </div>
            <MiniChart series={series || []} metric={metric} />
          </div>
        </>
      )}
    </div>
  )
}
