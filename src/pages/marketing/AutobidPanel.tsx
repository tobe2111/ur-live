import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { confirmDialog } from '@/components/ui/confirm-dialog'

/**
 * 🆕 2026-06-27 유어애즈 — 자동입찰 규칙 관리(목표순위→입찰가 자동조정).
 *   안전: 규칙 기본 OFF · max_bid 하드캡 · 글로벌 킬스위치 · dry-run 미리보기 · 변경로그.
 *   규칙 *생성*은 SearchAdPanel 키워드 행에서, *관리/실행*은 여기서.
 */
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

interface Rule { keyword_id: string; adgroup_id: string | null; keyword_text: string | null; target_rank: number; max_bid: number; device: string; enabled: number; last_applied_bid: number | null; last_run_at: string | null }
interface LogRow { keyword_id: string; old_bid: number; new_bid: number; target_rank: number; est_bid: number; reason: string; created_at: string }
interface PreviewRow { keyword_id: string; keyword_text: string | null; estBid: number; plan: { bid: number; change: boolean; reason: string }; applied: boolean }

const card = 'rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] p-4'
const REASON_KO: Record<string, string> = { matched_estimate: '추정가 적용', capped_at_max: '최대가 도달', within_threshold: '변동 미미', no_estimate: '추정 없음' }

export default function AutobidPanel() {
  const [rules, setRules] = useState<Rule[]>([])
  const [log, setLog] = useState<LogRow[]>([])
  const [engineOn, setEngineOn] = useState(false)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await api.get('/api/ads/searchad/autobid/rules', { headers: authHeader() })
      if (r.data?.success) { setRules(r.data.rules || []); setLog(r.data.log || []); setEngineOn(!!r.data.engine_on) }
    } catch { /* graceful */ }
  }, [])
  useEffect(() => { load() }, [load])

  async function toggle(rule: Rule) {
    setBusy(rule.keyword_id)
    try {
      await api.post('/api/ads/searchad/autobid/rule', {
        keyword_id: rule.keyword_id, adgroup_id: rule.adgroup_id, keyword_text: rule.keyword_text,
        target_rank: rule.target_rank, max_bid: rule.max_bid, device: rule.device, enabled: !rule.enabled,
      }, { headers: authHeader() })
      await load()
    } catch { toast.error('변경 실패') } finally { setBusy(null) }
  }

  async function remove(keywordId: string) {
    if (!(await confirmDialog('이 자동입찰 규칙을 삭제할까요?'))) return
    await api.delete(`/api/ads/searchad/autobid/rule?keyword_id=${encodeURIComponent(keywordId)}`, { headers: authHeader() }).catch(() => {})
    await load()
  }

  async function runPreview() {
    setBusy('preview'); setPreview(null)
    try {
      const r = await api.post('/api/ads/searchad/autobid/preview', {}, { headers: authHeader() })
      if (r.data?.success) setPreview(r.data.results || [])
      else toast.error(r.data?.error || '미리보기 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '미리보기 실패')
    } finally { setBusy(null) }
  }

  async function runNow() {
    if (!(await confirmDialog('활성 규칙의 입찰가를 지금 적용할까요? (실제 광고비에 영향)'))) return
    setBusy('run')
    try {
      const r = await api.post('/api/ads/searchad/autobid/run', {}, { headers: authHeader() })
      if (r.data?.success) { toast.success(`${r.data.applied ?? 0}개 키워드 입찰가 적용`); setPreview(null); await load() }
      else toast.error(r.data?.error || '실행 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '실행 실패')
    } finally { setBusy(null) }
  }

  if (rules.length === 0) return null // 규칙 없으면 패널 숨김(생성은 SearchAdPanel 키워드 행에서)

  const enabledCount = rules.filter(r => r.enabled).length

  return (
    <div className={`mt-3 ${card}`}>
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-bold text-gray-900 dark:text-white">⚙️ 자동입찰 규칙 <span className="text-gray-400 dark:text-gray-500 font-medium">({rules.length} · 활성 {enabledCount})</span></div>
        <div className="flex gap-1.5">
          <button onClick={runPreview} disabled={busy === 'preview'} className="rounded-lg border border-gray-200 dark:border-[#2A2A2A] px-2.5 py-1 text-[11.5px] font-bold text-gray-700 dark:text-gray-200 disabled:opacity-50">{busy === 'preview' ? '…' : '미리보기'}</button>
          <button onClick={runNow} disabled={busy === 'run' || enabledCount === 0} className="rounded-lg bg-gray-900 dark:bg-white px-2.5 py-1 text-[11.5px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-40">{busy === 'run' ? '…' : '지금 적용'}</button>
        </div>
      </div>
      <p className={`mt-1 text-[11px] ${engineOn ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-500'}`}>
        {engineOn ? '✅ 자동 엔진 ON — 활성 규칙이 주기적으로 자동 적용됩니다.' : '⏸️ 자동 엔진 OFF — 규칙은 저장되지만 자동 적용은 안 됩니다(‘지금 적용’으로 수동 실행 가능). 운영자가 검증 후 엔진을 켭니다.'}
      </p>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-[11.5px]">
          <thead><tr className="text-gray-400 dark:text-gray-500 text-left">
            <th className="py-1 pr-2">키워드</th><th className="py-1 pr-2">목표순위</th><th className="py-1 pr-2 text-right">최대 입찰가</th><th className="py-1 pr-2 text-right">최근 적용</th><th className="py-1 pr-2">상태</th><th className="py-1"></th>
          </tr></thead>
          <tbody>
            {rules.map(r => (
              <tr key={r.keyword_id} className="border-t border-gray-100 dark:border-[#1A1A1A] text-gray-700 dark:text-gray-300">
                <td className="py-1.5 pr-2 font-medium text-gray-900 dark:text-white truncate max-w-[120px]">{r.keyword_text || r.keyword_id}</td>
                <td className="py-1.5 pr-2">{r.target_rank}위 <span className="text-gray-400 dark:text-gray-500">{r.device === 'MOBILE' ? '모바일' : 'PC'}</span></td>
                <td className="py-1.5 pr-2 text-right tabular-nums">₩{formatNumber(r.max_bid)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{r.last_applied_bid ? `₩${formatNumber(r.last_applied_bid)}` : '-'}</td>
                <td className="py-1.5 pr-2">
                  <button onClick={() => toggle(r)} disabled={busy === r.keyword_id}
                    className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold ${r.enabled ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-400'}`}>
                    {r.enabled ? 'ON' : 'OFF'}
                  </button>
                </td>
                <td className="py-1.5 text-right"><button onClick={() => remove(r.keyword_id)} className="text-[10.5px] text-gray-400 dark:text-gray-500 hover:text-red-500">삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview && (
        <div className="mt-3 rounded-xl border border-gray-100 dark:border-[#1A1A1A] p-3">
          <p className="text-[12px] font-bold text-gray-900 dark:text-white">🔍 미리보기 (적용 안 됨)</p>
          <div className="mt-1.5 space-y-1">
            {preview.length === 0 ? <p className="text-[11px] text-gray-400 dark:text-gray-500">활성 규칙이 없습니다.</p>
              : preview.map((p) => (
                <div key={p.keyword_id} className="flex items-center justify-between gap-2 text-[11.5px] text-gray-600 dark:text-gray-300">
                  <span className="truncate">{p.keyword_text || p.keyword_id}</span>
                  <span className="shrink-0 tabular-nums">추정 ₩{formatNumber(p.estBid)} → {p.plan.change ? <b className="text-gray-900 dark:text-white">₩{formatNumber(p.plan.bid)}</b> : '변경 없음'} <span className="text-gray-400 dark:text-gray-500">({REASON_KO[p.plan.reason] || p.plan.reason})</span></span>
                </div>
              ))}
          </div>
        </div>
      )}

      {log.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">최근 변경 로그</p>
          <div className="space-y-0.5">
            {log.slice(0, 8).map((l, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-[10.5px] text-gray-500 dark:text-gray-400">
                <span className="truncate">{l.keyword_id}</span>
                <span className="shrink-0 tabular-nums">₩{formatNumber(l.old_bid)} → ₩{formatNumber(l.new_bid)} · {(l.created_at || '').slice(5, 16)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
