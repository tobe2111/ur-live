import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import PanelError from './PanelError'

/**
 * 🆕 2026-06-27 유어애즈 — AI 주간 리포트 패널.
 *   매주 월요일 cron 이 연결 고객사의 7일 실적을 AI 진단으로 자동 생성·저장 → 여기서 열람.
 *   "이번 주 리포트 생성"으로 즉시 생성도 가능(연결 필요). 읽기 전용.
 */
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

interface Report { id: number; period_key: string; summary_json: string | null; advice_md: string | null; created_at: string }

const card = 'rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] p-4'

export default function WeeklyReportPanel() {
  const [reports, setReports] = useState<Report[]>([])
  const [openId, setOpenId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)

  const load = useCallback(async () => {
    setErr(false)
    try {
      const r = await api.get('/api/ads/reports', { headers: authHeader() })
      if (r.data?.success) { setReports(r.data.reports || []); setOpenId((r.data.reports || [])[0]?.id ?? null) }
    } catch { setErr(true) }
  }, [])
  useEffect(() => { load() }, [load])

  async function generate() {
    setBusy(true)
    try {
      const r = await api.post('/api/ads/reports/generate', {}, { headers: authHeader() })
      if (r.data?.success) { toast.success('주간 리포트를 생성했습니다'); await load() }
      else toast.error(r.data?.error || '생성 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '생성 실패 (계정 연동 필요)')
    } finally { setBusy(false) }
  }

  return (
    <div className={`mt-3 ${card}`}>
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-bold text-gray-900 dark:text-white">AI 주간 리포트 <span className="text-gray-400 dark:text-gray-500 font-medium">({reports.length})</span></div>
        <button onClick={generate} disabled={busy} className="rounded-lg bg-gray-900 dark:bg-white px-2.5 py-1 text-[11.5px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-40">{busy ? '생성 중…' : '이번 주 리포트 생성'}</button>
      </div>
      <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">매주 월요일 자동 생성 · 최근 7일 실적 기반 AI 진단(읽기 전용).</p>

      {err && <PanelError onRetry={load} />}

      {reports.length === 0 ? (
        <p className="mt-3 text-[12px] text-gray-500 dark:text-gray-400">아직 리포트가 없습니다. 검색광고 계정을 연결하면 매주 자동 생성됩니다.</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {reports.map((rep) => (
            <div key={rep.id} className="rounded-xl border border-gray-100 dark:border-[#1A1A1A]">
              <button onClick={() => setOpenId(openId === rep.id ? null : rep.id)} className="w-full flex items-center justify-between px-3 py-2 text-left">
                <span className="text-[12.5px] font-bold text-gray-900 dark:text-white">주간 리포트 · {rep.period_key}</span>
                <span className="text-[10.5px] text-gray-400 dark:text-gray-500">{(rep.created_at || '').slice(0, 10)} {openId === rep.id ? '▴' : '▾'}</span>
              </button>
              {openId === rep.id && (
                <div className="px-3 pb-3 -mt-0.5 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                  {rep.advice_md || '이 주간의 AI 진단이 없습니다(AI 미설정 시 통계만 저장됩니다).'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
