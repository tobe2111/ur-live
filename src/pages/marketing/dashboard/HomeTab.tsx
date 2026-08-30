import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'
import { DASH_TABS } from '../dashboard-tabs'

/**
 * 🏠 홈 탭 — 30일 KPI 요약 + 큰 컬러 액션 카드 + 컬러 아이콘 런처 (2026-07-27 탭 재편).
 *   v2 (대표 "가시적으로 눈에 들어오지 않고 쉬워 보이지 않음"): 동일 톤 흰 카드 나열 → 위계 재설계.
 *   ① 인사말 헤더(회사명) ② 지금 할 일 = 큰 컬러 카드 3장(연동/서비스몰/키워드 — 색·크기로 구분)
 *   ③ 나머지 기능은 컬러 아이콘 칩 그리드(한눈에 스캔).
 */
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

// 탭별 액센트(런처 아이콘 칩) — 색이 정보: 같은 탭은 항상 같은 색(파스텔 칩은 다크 카드 위에서도 그대로).
const TAB_TINT: Record<string, { bg: string; fg: string }> = {
  keywords: { bg: '#EFF6FF', fg: '#2563EB' },
  performance: { bg: '#ECFDF5', fg: '#059669' },
  monitoring: { bg: '#FFF7ED', fg: '#D97706' },
  ai: { bg: '#F5F3FF', fg: '#7C3AED' },
  services: { bg: '#EEF2FF', fg: '#4F46E5' },
  tools: { bg: '#F1F5F9', fg: '#475569' },
}

export default function HomeTab({ onGo }: { onGo: (tab: string) => void }) {
  const [summary, setSummary] = useState<{ impCnt: number; clkCnt: number; salesAmt: number; ccnt: number; convAmt: number; ctr: number; cpc: number } | null>(null)
  const [activeRules, setActiveRules] = useState(0)
  const company = typeof window !== 'undefined' ? (localStorage.getItem('ads_company') || '') : ''

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
      {/* 인사말 — 화면에 주인이 있음을 크게(가시성의 시작은 큰 제목) */}
      <h1 className="mt-1 text-[24px] font-extrabold tracking-tight text-gray-900 dark:text-white">
        {company ? `${company}님, ` : ''}무엇을 할까요?
      </h1>
      <p className="mt-1 text-[13.5px] text-gray-500 dark:text-gray-400">자주 쓰는 일 3가지를 크게 두었어요. 나머지는 아래에서 골라 들어가세요.</p>

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
            <div key={m.l} className="rounded-xl border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#1A1C21] p-3">
              <div className="text-[10.5px] text-gray-400 dark:text-gray-500">{m.l}</div>
              <div className="mt-0.5 text-[15px] font-bold text-gray-900 dark:text-white tabular-nums">{m.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* 지금 할 일 — 큰 컬러 액션 카드 3장(색·크기가 위계를 만든다) */}
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <button onClick={() => onGo('performance')} className="text-left rounded-2xl p-5 bg-[#3B6EF5] text-white hover:brightness-105 transition">
          <div className="text-[26px]">📊</div>
          <div className="mt-2 text-[16.5px] font-extrabold">{hasKpi ? '광고 성과 보기' : '광고 계정 연동하기'}</div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-white/85">{hasKpi ? '실적 추세 · 키워드 효율 · 자동입찰 규칙' : '검색광고 키 1분 연결 → 실적·자동입찰이 열립니다'}</p>
          <div className="mt-3 text-[12.5px] font-bold">시작하기 →</div>
        </button>
        <button onClick={() => onGo('services')} className="text-left rounded-2xl p-5 bg-[#FEE500] text-[#191919] hover:brightness-[1.02] transition">
          <div className="text-[26px]">🛍️</div>
          <div className="mt-2 text-[16.5px] font-extrabold">대행 서비스 주문</div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#191919]/70">지역 인플루언서 리스트업 · 협찬 제안 대행 — 맡기면 끝. 카드 결제 지원</p>
          <div className="mt-3 text-[12.5px] font-bold">서비스몰 열기 →</div>
        </button>
        <button onClick={() => onGo('keywords')} className="text-left rounded-2xl p-5 bg-gray-900 dark:bg-white text-white dark:text-[#0D0F12] hover:brightness-110 dark:hover:brightness-95 transition">
          <div className="text-[26px]">🔎</div>
          <div className="mt-2 text-[16.5px] font-extrabold">키워드 분석</div>
          <p className="mt-1 text-[12.5px] leading-relaxed opacity-75">연관키워드 · 월 검색량 · 쇼핑 경쟁 — 지금 바로 무료</p>
          <div className="mt-3 text-[12.5px] font-bold">분석하러 가기 →</div>
        </button>
      </div>

      {/* 전체 기능 — 컬러 아이콘 칩으로 스캔 가능한 목록 */}
      <div className="mt-5">
        <div className="text-[12.5px] font-bold text-gray-500 dark:text-gray-400">전체 기능</div>
        <div className="mt-2 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {DASH_TABS.filter((t) => t.id !== 'home').map((t) => {
            const tint = TAB_TINT[t.id] || TAB_TINT.tools
            return (
              <button key={t.id} onClick={() => onGo(t.id)}
                className="flex items-center gap-3 text-left rounded-2xl border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#1A1C21] p-3.5 hover:border-gray-300 dark:hover:border-[#3A4456] transition-colors">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: tint.bg, color: tint.fg }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-gray-900 dark:text-white">{t.label}</span>
                  <span className="block truncate text-[11.5px] text-gray-500 dark:text-gray-400">{t.desc}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
