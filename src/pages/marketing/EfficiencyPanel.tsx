import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { downloadCsv } from '@/utils/csv-download'
import PanelError from './PanelError'

/**
 * 🆕 2026-06-28 유어애즈 — 키워드 효율 분석(ROAS·CPA + 낭비 키워드 발굴).
 *   온디맨드(API 다수 호출 — 쿼터 보호 cap). 비용 내림차순 + 낭비(고비용·전환0) 강조.
 */
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}
interface KeywordEff { id: string; keyword: string; cost: number; clicks: number; conv: number; convAmt: number; cpa: number | null; roas: number | null; waste: boolean }
const card = 'rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] p-4'

export default function EfficiencyPanel() {
  const [items, setItems] = useState<KeywordEff[] | null>(null)
  const [scanned, setScanned] = useState(0)
  const [days, setDays] = useState<7 | 30>(30)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)

  async function run(d: 7 | 30 = days) {
    setBusy(true); setErr(false)
    try {
      const r = await api.get(`/api/ads/searchad/keyword-efficiency?days=${d}`, { headers: authHeader() })
      if (r.data?.success) { setItems(r.data.items || []); setScanned(r.data.scanned || 0) }
      else toast.error(r.data?.error || '분석 실패')
    } catch (e: unknown) {
      setErr(true)
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '분석 실패')
    } finally { setBusy(false) }
  }

  const wasteCount = items ? items.filter(k => k.waste).length : 0
  const wasteCost = items ? items.filter(k => k.waste).reduce((s, k) => s + k.cost, 0) : 0

  return (
    <div className={`mt-3 ${card}`}>
      <div className="flex items-center justify-between flex-wrap gap-1.5">
        <div className="text-[14px] font-bold text-gray-900 dark:text-white">키워드 효율 분석 <span className="text-gray-400 dark:text-gray-500 text-[11px] font-medium">ROAS·CPA·낭비 발굴</span></div>
        <div className="flex items-center gap-1.5">
          {items && items.length > 0 && (
            <button onClick={() => downloadCsv(`유어애즈_키워드효율_${days}일.csv`,
              ['키워드', '비용', '클릭', '전환', '전환매출', 'CPA', 'ROAS%', '낭비'],
              items.map(k => [k.keyword, k.cost, k.clicks, k.conv, k.convAmt, k.cpa ?? '', k.roas != null ? Math.round(k.roas * 100) : '', k.waste ? 'Y' : '']))}
              className="rounded-lg border border-gray-200 dark:border-[#2A2A2A] px-2 py-1 text-[11px] font-bold text-gray-700 dark:text-gray-200">CSV</button>
          )}
          <div className="flex rounded-lg border border-gray-200 dark:border-[#2A2A2A] overflow-hidden">
            {([7, 30] as const).map(d => (
              <button key={d} onClick={() => { setDays(d); run(d) }} className={`px-2.5 py-0.5 text-[11px] font-semibold ${days === d ? 'bg-gray-900 dark:bg-white text-white dark:text-[#0A0A0A]' : 'text-gray-500 dark:text-gray-400'}`}>{d}일</button>
            ))}
          </div>
          <button onClick={() => run()} disabled={busy} className="rounded-lg bg-gray-900 dark:bg-white px-3 py-1.5 text-[12px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-50">{busy ? '분석 중…' : '분석'}</button>
        </div>
      </div>
      <p className="mt-1 text-[11.5px] text-gray-400 dark:text-gray-500">키워드별 ROAS(전환매출/비용)·CPA(전환당비용)를 계산해 <b className="text-gray-600 dark:text-gray-300">고비용·전환0 ‘낭비 키워드’</b>를 찾아줍니다. (쿼터 보호: 상위 키워드 기준)</p>

      {err && <PanelError onRetry={() => run()} busy={busy} label="키워드 효율 분석 실패" />}

      {items && (items.length === 0 ? (
        <p className="mt-3 text-[12px] text-gray-400 dark:text-gray-500">분석할 키워드가 없습니다(캠페인·키워드 등록 후 다시 시도).</p>
      ) : (
        <>
          {wasteCount > 0 && (
            <div className="mt-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-2.5">
              <span className="text-[12px] font-bold text-red-700 dark:text-red-400">낭비 키워드 {wasteCount}개 · 비용 ₩{formatNumber(wasteCost)}</span>
              <span className="text-[11px] text-red-600/80 dark:text-red-300/80"> — 비용은 크지만 전환이 없습니다. 입찰가 인하/제외를 검토하세요.</span>
            </div>
          )}
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead><tr className="text-gray-400 dark:text-gray-500 text-left">
                <th className="py-1 pr-2">키워드</th><th className="py-1 pr-2 text-right">비용</th><th className="py-1 pr-2 text-right">클릭</th><th className="py-1 pr-2 text-right">전환</th><th className="py-1 pr-2 text-right">CPA</th><th className="py-1 pr-2 text-right">ROAS</th><th className="py-1"></th>
              </tr></thead>
              <tbody>
                {items.slice(0, 50).map(k => (
                  <tr key={k.id} className={`border-t border-gray-100 dark:border-[#1A1A1A] ${k.waste ? 'bg-red-50/60 dark:bg-red-500/5' : ''} text-gray-700 dark:text-gray-300`}>
                    <td className="py-1.5 pr-2 font-medium text-gray-900 dark:text-white truncate max-w-[140px]">{k.keyword}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">₩{formatNumber(k.cost)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{formatNumber(k.clicks)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{formatNumber(k.conv)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{k.cpa != null ? `₩${formatNumber(k.cpa)}` : '-'}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums font-bold">{k.roas != null ? `${Math.round(k.roas * 100)}%` : '-'}</td>
                    <td className="py-1.5 text-right">{k.waste && <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 font-bold">낭비</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10.5px] text-gray-400 dark:text-gray-500">스캔 키워드 {scanned}개 · 비용순 상위 50 표시 · ROAS/전환은 네이버 전환추적 설정 시 표시.</p>
        </>
      ))}
    </div>
  )
}
