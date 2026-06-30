import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import PanelError from './PanelError'

/**
 * 🆕 2026-06-28 유어애즈 — 임계값 알림 설정/미리보기.
 *   예산 소진 임박 · 최저가 역전 → 켜면 매일 점검 후 계정 이메일로 알림(1일 1회). 읽기·돈 0.
 */
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}
interface Settings { enabled: number; budget_pace_pct: number; price_undercut: number }
interface AlertItem { kind: 'budget' | 'price'; title: string; detail: string }
const card = 'rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] p-4'

export default function AlertsPanel() {
  const [s, setS] = useState<Settings | null>(null)
  const [err, setErr] = useState(false)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<AlertItem[] | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)

  const load = useCallback(async () => {
    setErr(false)
    try {
      const r = await api.get('/api/ads/alerts/settings', { headers: authHeader() })
      if (r.data?.success) setS(r.data.settings)
    } catch { setErr(true) }
  }, [])
  useEffect(() => { load() }, [load])

  async function patch(next: Partial<Settings>) {
    if (!s) return
    const merged = { ...s, ...next }
    setS(merged); setSaving(true)
    try {
      const r = await api.patch('/api/ads/alerts/settings', {
        enabled: !!merged.enabled, budget_pace_pct: merged.budget_pace_pct, price_undercut: !!merged.price_undercut,
      }, { headers: authHeader() })
      if (r.data?.success) setS(r.data.settings)
      else toast.error('저장 실패')
    } catch { toast.error('저장 실패'); load() } finally { setSaving(false) }
  }

  async function preview() {
    setPreviewBusy(true)
    try {
      const r = await api.get('/api/ads/alerts/preview', { headers: authHeader() })
      if (r.data?.success) setItems(r.data.items || [])
      else toast.error(r.data?.error || '확인 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '확인 실패')
    } finally { setPreviewBusy(false) }
  }

  return (
    <div className={`mt-3 ${card}`}>
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-bold text-gray-900 dark:text-white">임계값 알림 <span className="text-gray-400 dark:text-gray-500 text-[11px] font-medium">예산·최저가</span></div>
        {s && (
          <button onClick={() => patch({ enabled: s.enabled ? 0 : 1 })} disabled={saving}
            className={`px-2.5 py-1 rounded-lg text-[11.5px] font-bold ${s.enabled ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-400'}`}>
            {s.enabled ? '알림 ON' : '알림 OFF'}
          </button>
        )}
      </div>
      <p className="mt-1 text-[11.5px] text-gray-400 dark:text-gray-500">켜면 매일 점검해 임계 초과 시 계정 이메일로 알려드립니다(1일 1회). 지금 상태는 ‘지금 확인’으로.</p>

      {err && <PanelError onRetry={load} />}

      {s && (
        <>
          <div className="mt-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] text-gray-700 dark:text-gray-300">예산 소진 임박 알림 (오늘 소진율 ≥)</span>
              <div className="flex items-center gap-1.5">
                <input type="number" min={50} max={100} value={s.budget_pace_pct}
                  onChange={(e) => setS({ ...s, budget_pace_pct: Number(e.target.value) })}
                  onBlur={() => patch({ budget_pace_pct: s.budget_pace_pct })}
                  className="w-16 h-8 rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] px-2 text-[12px] text-right text-gray-900 dark:text-white" />
                <span className="text-[12px] text-gray-400 dark:text-gray-500">%</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] text-gray-700 dark:text-gray-300">최저가 역전 알림 (내 가격이 더 비쌀 때)</span>
              <button onClick={() => patch({ price_undercut: s.price_undercut ? 0 : 1 })} disabled={saving}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${s.price_undercut ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-400'}`}>
                {s.price_undercut ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button onClick={preview} disabled={previewBusy} className="rounded-lg border border-gray-200 dark:border-[#2A2A2A] px-3 py-1.5 text-[12px] font-bold text-gray-700 dark:text-gray-200 disabled:opacity-50">{previewBusy ? '확인 중…' : '지금 확인'}</button>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">현재 임계 초과 항목을 즉시 표시(발송 안 함)</span>
          </div>

          {items && (
            <div className="mt-2">
              {items.length === 0 ? (
                <p className="text-[12px] text-emerald-600 dark:text-emerald-400">현재 임계를 넘은 항목이 없습니다.</p>
              ) : (
                <div className="space-y-1.5">
                  {items.map((it, i) => (
                    <div key={i} className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-2.5">
                      <div className="text-[12px] font-bold text-amber-800 dark:text-amber-300">{it.title}</div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-200/80 mt-0.5">{it.detail}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
