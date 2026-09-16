import { useEffect, useState } from 'react'
import api from '@/lib/api'

/**
 * 🎬 연동 전 데모 미리보기 (2026-07-27 — 승인 후 진입한 광고주가 '빈 대시보드'를 보고 이탈하는 문제).
 *
 *   검색광고 **미연동일 때만** '광고 성과' 탭 상단에 "연동하면 이렇게 보입니다"를 보여준다.
 *   ⚖️ 정직성 규칙: 모든 숫자는 화면에 '예시' 라벨 + 회색 워터마크로 명시(실데이터 오인 금지).
 *   연동되면 이 블록은 **스스로 사라진다**(실데이터가 그 자리를 대체).
 */
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

const KPI = [
  { l: '30일 광고비', v: '₩1,240,000' },
  { l: '클릭', v: '5,012' },
  { l: '전환', v: '284' },
  { l: 'ROAS', v: '412%' },
  { l: 'CTR', v: '3.4%' },
  { l: '평균 CPC', v: '₩248' },
]
const ROWS = [
  { k: '무선 이어폰', goal: '2위', now: '2위', ok: true, bid: '₩320', cpc: '₩214' },
  { k: '블루투스 스피커', goal: '1위', now: '3위', ok: false, bid: '₩480', cpc: '₩390' },
  { k: '노이즈캔슬링 헤드폰', goal: '3위', now: '2위', ok: true, bid: '₩540', cpc: '₩468' },
]

export default function DemoPreview() {
  const [connected, setConnected] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    api.get('/api/ads/searchad/status', { headers: authHeader() })
      .then(r => { if (!cancelled) setConnected(!!r.data?.connected) })
      .catch(() => { if (!cancelled) setConnected(null) }) // 조회 실패 시 노출 안 함(오표시 방지)
    return () => { cancelled = true }
  }, [])

  if (connected !== false) return null // 연동됐거나 판단 불가 → 미노출

  const go = () => document.getElementById('sec-searchad')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="mt-3 rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-white dark:bg-[#1D1F29] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 dark:border-[#2C2F35] bg-blue-50/60 dark:bg-blue-500/5 px-4 py-3">
        <div>
          <div className="text-[14px] font-bold text-gray-900 dark:text-white">🎬 연동하면 이렇게 보입니다</div>
          <p className="mt-0.5 text-[11.5px] text-gray-500 dark:text-gray-400">아래는 <b>예시 화면</b>입니다. 검색광고 계정을 연결하면 이 자리에 내 실제 데이터가 들어옵니다.</p>
        </div>
        <button onClick={go} className="shrink-0 rounded-lg bg-[#3B6EF5] px-4 py-2 text-[12.5px] font-bold text-white">1분 만에 연동하기 ↓</button>
      </div>

      <div className="relative p-4">
        {/* 워터마크 — 예시임을 시각적으로도 고정(스크린샷으로 잘려 나가도 표시 유지) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rotate-[-12deg] text-[54px] font-extrabold tracking-widest text-gray-900/[0.045] dark:text-white/[0.06]">예시 데이터</span>
        </div>

        <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {KPI.map(m => (
            <div key={m.l} className="rounded-xl border border-gray-200 dark:border-[#2C2F35] p-3">
              <div className="text-[10.5px] text-gray-400 dark:text-gray-500">{m.l}</div>
              <div className="mt-0.5 text-[15px] font-bold text-gray-900 dark:text-white tabular-nums">{m.v}</div>
            </div>
          ))}
        </div>

        <div className="relative mt-3 grid gap-3 lg:grid-cols-[1fr_1.3fr]">
          <div className="rounded-xl border border-gray-200 dark:border-[#2C2F35] p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[12.5px] font-bold text-gray-900 dark:text-white">30일 추세</span>
              <span className="text-[11px] font-bold text-emerald-600">▲ 18.4%</span>
            </div>
            <svg width="100%" height="52" viewBox="0 0 340 52" preserveAspectRatio="none" className="mt-2">
              <polyline points="0,42 38,38 76,40 114,29 152,31 190,20 228,22 266,12 304,14 340,5" fill="none" stroke="#3B6EF5" strokeWidth="2.4" />
            </svg>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-[#2C2F35] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-[#2C2F35]">
              <span className="text-[12.5px] font-bold text-gray-900 dark:text-white">자동입찰 키워드</span>
              <span className="rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400">자동입찰 ON</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead><tr className="text-left text-gray-400 dark:text-gray-500">
                  <th className="py-1.5 px-3 font-medium">키워드</th>
                  <th className="py-1.5 px-2 text-right font-medium">목표/현재</th>
                  <th className="py-1.5 px-2 text-right font-medium">입찰가</th>
                  <th className="py-1.5 px-3 text-right font-medium">CPC</th>
                </tr></thead>
                <tbody>
                  {ROWS.map(r => (
                    <tr key={r.k} className="border-t border-gray-100 dark:border-[#2C2F35] text-gray-700 dark:text-gray-300">
                      <td className="py-2 px-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{r.k}</td>
                      <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">
                        <span className="text-gray-400 dark:text-gray-500">{r.goal}</span>/<span className={`font-bold ${r.ok ? 'text-emerald-600' : 'text-amber-600'}`}>{r.now}</span>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">{r.bid}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-bold whitespace-nowrap">{r.cpc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <p className="relative mt-3 text-[11px] text-gray-400 dark:text-gray-500">
          * 위 숫자는 기능 설명용 예시이며 특정 계정의 성과가 아닙니다. 실제 결과는 업종·예산·경쟁 상황에 따라 다릅니다.
        </p>
      </div>
    </div>
  )
}
