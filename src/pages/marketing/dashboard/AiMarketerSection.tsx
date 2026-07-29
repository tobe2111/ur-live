import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { CARD_CLS, INPUT_CLS } from '../dashboard-tabs'

/**
 * 🤖 AI 마케터(Claude 진단/추천 — 읽기 전용) — MarketingDashboardPage 에서 추출
 *   (2026-07-27 탭 재편 · 600줄 캡). 상태·로직 byte-동일 이동, 'AI 스튜디오' 탭 전용 섹션.
 */
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

export default function AiMarketerSection() {
  const [aiSeed, setAiSeed] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiAdvice, setAiAdvice] = useState<string | null>(null)
  const [aiOff, setAiOff] = useState(false)

  async function runAiMarketer() {
    setAiBusy(true); setAiAdvice(null); setAiOff(false)
    try {
      const r = await api.post('/api/ads/ai-marketer', { seed: aiSeed.trim() || undefined }, { headers: authHeader() })
      if (r.data?.success) setAiAdvice(r.data.advice || '')
      else toast.error(r.data?.error || 'AI 분석 실패')
    } catch (e: unknown) {
      const ax = e as { response?: { status?: number; data?: { error?: string } } }
      if (ax.response?.status === 503) setAiOff(true)
      else toast.error(ax.response?.data?.error || 'AI 분석 실패')
    } finally { setAiBusy(false) }
  }

  return (
    <section id="sec-ai" style={{ scrollMarginTop: 76 }} className={`mt-3 ${CARD_CLS}`}>
      <div className="text-[14px] font-bold text-gray-900 dark:text-white">AI 마케터</div>
      <p className="mt-1 text-[11.5px] text-gray-400 dark:text-gray-500">실적·키워드 데이터를 분석해 개선 액션을 제안합니다(추천만 — 자동 실행 없음). 계정 연동 시 실적까지 반영.</p>
      <div className="mt-2 flex gap-2">
        <input className={INPUT_CLS} placeholder="중심 키워드 (선택, 예: 무선이어폰)" value={aiSeed} onChange={(e) => setAiSeed(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runAiMarketer() }} />
        <button onClick={runAiMarketer} disabled={aiBusy} className="shrink-0 rounded-lg bg-gray-900 dark:bg-white px-4 py-2 text-[12px] font-bold text-white dark:text-[#0F151D] disabled:opacity-50">{aiBusy ? '분석 중…' : 'AI 분석 받기'}</button>
      </div>
      {aiOff && <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-500">AI 마케터는 Anthropic API 키 설정 후 사용할 수 있습니다.</p>}
      {aiAdvice && (
        <div className="mt-3 space-y-1 text-[12.5px] leading-relaxed">
          {aiAdvice.split('\n').map((line, i) => {
            const h = line.match(/^#{1,4}\s+(.*)/)
            if (h) return <p key={i} className="font-bold text-gray-900 dark:text-white mt-2">{h[1]}</p>
            const b = line.match(/^\s*[-*]\s+(.*)/)
            if (b) return <p key={i} className="text-gray-600 dark:text-gray-300 pl-3">• {b[1].replace(/\*\*/g, '')}</p>
            if (!line.trim()) return null
            return <p key={i} className="text-gray-600 dark:text-gray-300">{line.replace(/\*\*/g, '')}</p>
          })}
        </div>
      )}
    </section>
  )
}
