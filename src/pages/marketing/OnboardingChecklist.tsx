import { useEffect, useState } from 'react'

/**
 * 🆕 2026-07-01 유어애즈 — 온보딩 체크리스트 (activation).
 *   가입 직후 빈 대시보드에서 뭘 해야 할지 3스텝으로 안내: ① 광고계정 연동 ② 키워드 담기 ③ 자동화 준비.
 *   전부 완료(또는 닫기)면 스스로 사라짐. 상태는 기존 API 3개 fail-soft 병렬 조회.
 */
import api from '@/lib/api'
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}
const DISMISS_KEY = 'ads_onboarding_dismissed'

interface Steps { connected: boolean; hasKeywords: boolean; hasAutomation: boolean }

export default function OnboardingChecklist() {
  const [steps, setSteps] = useState<Steps | null>(null)
  const [hidden, setHidden] = useState(() => typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1')

  useEffect(() => {
    if (hidden) return
    let cancelled = false
    ;(async () => {
      const h = { headers: authHeader() }
      const [st, kw, ab] = await Promise.allSettled([
        api.get('/api/ads/searchad/status', h),
        api.get('/api/ads/keywords/saved', h),
        api.get('/api/ads/searchad/autobid/rules', h),
      ])
      if (cancelled) return
      const connected = st.status === 'fulfilled' && !!st.value.data?.connected
      const hasKeywords = kw.status === 'fulfilled' && (kw.value.data?.items?.length || 0) > 0
      const hasAutomation = ab.status === 'fulfilled' && ((ab.value.data?.rules?.length || 0) > 0)
      setSteps({ connected, hasKeywords, hasAutomation })
    })()
    return () => { cancelled = true }
  }, [hidden])

  if (hidden || !steps) return null
  const done = [steps.connected, steps.hasKeywords, steps.hasAutomation].filter(Boolean).length
  if (done === 3) return null // 전부 완료 — 안내 불필요

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const items: Array<{ ok: boolean; label: string; hint: string; anchor: string }> = [
    { ok: steps.connected, label: '광고계정 연동', hint: '검색광고 API 키로 고객사 계정을 연결하면 실적·자동입찰이 열립니다', anchor: 'sec-searchad' },
    { ok: steps.hasKeywords, label: '키워드 담기', hint: '연관키워드·기회 발굴에서 타겟 키워드를 포트폴리오에 저장하세요', anchor: 'sec-keyword' },
    { ok: steps.hasAutomation, label: '자동화 준비', hint: '자동입찰 규칙(최대가 하드캡)을 만들어 미리보기로 검증하세요', anchor: 'sec-autobid' },
  ]

  return (
    <div className="mt-3 rounded-2xl border border-blue-100 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[13.5px] font-bold text-gray-900 dark:text-white">시작하기 <span className="text-blue-600 dark:text-blue-400">{done}/3</span></div>
        <button onClick={() => { localStorage.setItem(DISMISS_KEY, '1'); setHidden(true) }}
          className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">닫기</button>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {items.map((it, i) => (
          <button key={i} onClick={() => go(it.anchor)} disabled={it.ok}
            className={`rounded-xl border p-2.5 text-left transition ${it.ok
              ? 'border-emerald-200 dark:border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-500/5 cursor-default'
              : 'border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] hover:border-blue-300 dark:hover:border-blue-500/40'}`}>
            <div className={`text-[12px] font-bold ${it.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
              {it.ok ? '✓ ' : `${i + 1}. `}{it.label}
            </div>
            <div className="mt-0.5 text-[10.5px] leading-snug text-gray-500 dark:text-gray-400">{it.hint}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
