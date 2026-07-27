import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'
import { DASH_TABS } from '../dashboard-tabs'

/**
 * 🏠 홈 탭 — 30일 KPI 요약 + 기능 런처 그리드 + 서비스몰 하이라이트 (2026-07-27 탭 재편).
 *   "한 페이지에 다 몰아넣은 벽" 대신 서비스 포털 첫 화면: 뭐가 있고 어디로 가면 되는지 한눈에.
 */
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

export default function HomeTab({ onGo }: { onGo: (tab: string) => void }) {
  const [summary, setSummary] = useState<{ impCnt: number; clkCnt: number; salesAmt: number; ccnt: number; convAmt: number; ctr: number; cpc: number } | null>(null)
  const [activeRules, setActiveRules] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [s, ar] = await Promise.allSettled([
        api.get('/api/ads/searchad/stats?days=30', { headers: authHeader() }),
        api.get('/api/ads/searchad/autobid/rules', { headers: authHeader() }),
      ])
      if (cancelled) return
      if (s.status === 'fulfilled' && s.value.data?.success) setSummary(s.value.data.data?.totals || null)
      if (ar.status === 'fulfilled' && ar.value.data?.success) setActiveRules((ar.value.data.rules || []).filter((r: { enabled?: number }) => r.enabled).length)
    })()
    return () => { cancelled = true }
  }, [])

  const hasKpi = summary && (summary.salesAmt > 0 || summary.impCnt > 0)

  return (
    <>
      {/* KPI 요약 — 최근 30일 통합실적(연동·데이터 있을 때만). 빈 0 노출 방지. */}
      {hasKpi && summary && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { l: '30일 광고비', v: `₩${formatNumber(summary.salesAmt)}` },
            ...(summary.convAmt > 0 ? [
              { l: '전환매출', v: `₩${formatNumber(summary.convAmt)}` },
              { l: 'ROAS', v: `${Math.round((summary.convAmt / summary.salesAmt) * 100)}%` },
            ] : []),
            { l: '클릭', v: formatNumber(summary.clkCnt) },
            { l: '전환', v: formatNumber(summary.ccnt) },
            { l: 'CTR', v: `${(summary.ctr * 100).toFixed(1)}%` },
            { l: '활성 자동입찰', v: `${formatNumber(activeRules)}개` },
          ].map((m) => (
            <div key={m.l} className="rounded-xl border border-gray-200 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] p-3">
              <div className="text-[10.5px] text-gray-400 dark:text-gray-500">{m.l}</div>
              <div className="mt-0.5 text-[15px] font-bold text-gray-900 dark:text-white tabular-nums">{m.v}</div>
            </div>
          ))}
        </div>
      )}
      {!hasKpi && (
        <button onClick={() => onGo('performance')} className="mt-4 w-full text-left rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/5 p-4 hover:border-blue-300 dark:hover:border-blue-500/50 transition-colors">
          <div className="text-[13.5px] font-bold text-gray-900 dark:text-white">📊 네이버 검색광고 계정을 연동하면 여기에 30일 실적 요약이 뜹니다</div>
          <p className="mt-0.5 text-[11.5px] text-gray-500 dark:text-gray-400">고객ID·액세스라이선스·비밀키 연결 → 실적·자동입찰·예상입찰가 사용 — '광고 성과' 탭에서 시작</p>
        </button>
      )}

      {/* 서비스몰 하이라이트 — 수익 상품을 첫 화면 전면에(대표 "서비스 느낌이 안 남" 해소 핵심) */}
      <button onClick={() => onGo('services')} className="mt-3 w-full text-left rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-500/10 dark:to-[#1A2334] p-5 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-extrabold text-gray-900 dark:text-white">🛍️ 유어애즈 서비스몰</div>
            <p className="mt-1 text-[12px] text-gray-600 dark:text-gray-300 leading-relaxed">지역 인플루언서 리스트업 · 협찬 제안 대행 — 직접 도구를 돌릴 시간이 없다면 주문으로 맡기세요. 카드 결제 지원.</p>
          </div>
          <span className="shrink-0 rounded-lg bg-indigo-600 px-3.5 py-2 text-[12px] font-bold text-white">주문하기 →</span>
        </div>
      </button>

      {/* 기능 런처 — 각 탭이 뭘 하는지 카드로(끝없는 스크롤 벽 대신 골라 들어가는 포털) */}
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {DASH_TABS.filter((t) => t.id !== 'home' && t.id !== 'services').map((t) => (
          <button key={t.id} onClick={() => onGo(t.id)}
            className="text-left rounded-2xl border border-gray-200 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] p-4 hover:border-gray-300 dark:hover:border-[#3A4456] transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-[#0F151D] text-gray-700 dark:text-gray-200">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
              </span>
              <div className="text-[13.5px] font-bold text-gray-900 dark:text-white">{t.label}</div>
            </div>
            <p className="mt-2 text-[11.5px] text-gray-500 dark:text-gray-400 leading-relaxed">{t.desc}</p>
          </button>
        ))}
      </div>
    </>
  )
}
