import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import PanelError from './PanelError'

/**
 * 🆕 2026-07-01 유어애즈 — 키워드 기회 발굴기.
 *   연관키워드 × 내 보유(자동입찰 규칙+저장 키워드) 교차 → "검색량↑·경쟁↓·미보유" 순위.
 *   저장 버튼은 기존 포트폴리오(/keywords/save) 재사용 — 발굴→저장→(연동 시)등록 흐름.
 */
interface Opportunity { keyword: string; monthlyTotal: number; compIdx: string; monthlyAvgClick: number; score: number; reason: string }
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}
const card = 'rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] p-4'
const COMP_BADGE: Record<string, string> = {
  낮음: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400',
  중간: 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400',
  높음: 'bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400',
}

export default function OpportunityPanel() {
  const [seed, setSeed] = useState('')
  const [items, setItems] = useState<Opportunity[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState<Set<string>>(new Set())

  async function search() {
    const s = seed.trim()
    if (!s) { toast.error('기준 키워드를 입력해주세요'); return }
    setLoading(true); setErr(null)
    try {
      const r = await api.get(`/api/ads/keywords/opportunities?seed=${encodeURIComponent(s)}`, { headers: authHeader() })
      if (r.data?.success) { setItems(r.data.items || []); setSaved(new Set()) }
      else setErr(r.data?.error || '조회 실패')
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string }; status?: number } })?.response
      setErr(msg?.status === 503 ? '검색광고 키가 설정되지 않았습니다' : (msg?.data?.error || '조회 실패'))
    } finally { setLoading(false) }
  }

  async function save(k: Opportunity) {
    try {
      const r = await api.post('/api/ads/keywords/save', { keyword: k.keyword, monthly_total: k.monthlyTotal, comp_idx: k.compIdx, tag: '기회' }, { headers: authHeader() })
      if (r.data?.success) { setSaved(prev => new Set(prev).add(k.keyword)); toast.success('포트폴리오에 저장 (태그: 기회)') }
      else toast.error(r.data?.error || '저장 실패')
    } catch { toast.error('저장 실패') }
  }

  return (
    <div className={`mt-3 ${card}`}>
      <div className="text-[14px] font-bold text-gray-900 dark:text-white">기회 키워드 발굴</div>
      <p className="mt-0.5 text-[11.5px] text-gray-400 dark:text-gray-500">
        기준 키워드의 연관키워드 중 <b className="text-gray-600 dark:text-gray-300">검색량은 높고 경쟁은 낮은데 아직 안 물고 있는</b> 키워드를 점수순으로 찾아드립니다.
        (내 자동입찰 규칙·저장 키워드는 자동 제외)
      </p>
      <div className="mt-2.5 flex gap-2">
        <input value={seed} onChange={e => setSeed(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search() }}
          placeholder="기준 키워드 (예: 무선청소기)" maxLength={40}
          className="flex-1 h-9 rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] px-3 text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400" />
        <button onClick={search} disabled={loading}
          className="shrink-0 rounded-lg bg-gray-900 dark:bg-white px-4 text-[12.5px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-40">
          {loading ? '분석 중…' : '발굴'}
        </button>
      </div>

      {err && <PanelError onRetry={search} busy={loading} label={err} />}
      {items && !err && (
        items.length === 0 ? (
          <p className="mt-3 text-[12px] text-gray-400 dark:text-gray-500">조건(검색량 100+ · 미보유)에 맞는 기회 키워드가 없습니다. 다른 기준 키워드로 시도해보세요.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead><tr className="text-gray-400 dark:text-gray-500 text-left">
                <th className="py-1 pr-2">#</th><th className="py-1 pr-2">키워드</th><th className="py-1 pr-2 text-right">월검색량</th><th className="py-1 pr-2">경쟁</th><th className="py-1 pr-2 text-right">기회점수</th><th className="py-1"></th>
              </tr></thead>
              <tbody>
                {items.map((k, i) => (
                  <tr key={k.keyword} className="border-t border-gray-100 dark:border-[#1A1A1A] text-gray-700 dark:text-gray-300">
                    <td className="py-1.5 pr-2 text-gray-400 dark:text-gray-500 tabular-nums">{i + 1}</td>
                    <td className="py-1.5 pr-2 font-medium text-gray-900 dark:text-white">{k.keyword}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{formatNumber(k.monthlyTotal)}</td>
                    <td className="py-1.5 pr-2"><span className={`rounded px-1.5 py-0.5 text-[10.5px] font-bold ${COMP_BADGE[k.compIdx] || COMP_BADGE['중간']}`}>{k.compIdx}</span></td>
                    <td className="py-1.5 pr-2 text-right tabular-nums font-semibold">{formatNumber(k.score)}</td>
                    <td className="py-1.5 text-right">
                      {saved.has(k.keyword)
                        ? <span className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-bold">저장됨</span>
                        : <button onClick={() => save(k)} className="text-[10.5px] font-bold text-blue-600 dark:text-blue-400">저장</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10.5px] text-gray-400 dark:text-gray-500">기회점수 = 월검색량 × 경쟁도 가중치(낮음 1.0 / 중간 0.55 / 높음 0.25). 저장한 키워드는 포트폴리오(태그: 기회)에서 관리 → 검색광고 패널에서 그룹에 등록하세요.</p>
          </div>
        )
      )}
    </div>
  )
}
