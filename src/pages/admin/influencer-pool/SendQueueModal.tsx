import { useEffect, useState } from 'react'
import { pickReach, parseReachDraft, type ReachLead } from './reach'

/**
 * 🚀 발송 모드 — 현재 필터의 리드를 한 명씩 넘기며 원클릭 발송(고속 수동 발송 큐).
 *   Enter = 최적 채널 열기(메일/인스타DM/블로그, 부모 onReach 가 컨택 기록) 후 다음.
 *   → = 건너뛰기. Esc = 종료.
 *   ⚖️ [LEGAL] 자동 발송 아님 — 한 건씩 사람이 열고 눈으로 확인 후 직접 보냄(정보통신망법 선 준수).
 */
export interface QueueLead extends ReachLead { id: number; status: string }

const PLATFORM_KO: Record<string, string> = { youtube: '유튜브', naver_blog: '네이버블로그', naver_cafe: '네이버카페', tistory: '티스토리', instagram: '인스타', tiktok: '틱톡' }

export default function SendQueueModal<T extends QueueLead>({ leads, onReach, onClose }: { leads: T[]; onReach: (l: T) => void; onClose: () => void }) {
  const [idx, setIdx] = useState(0)
  const [sent, setSent] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const cur = leads[idx]
  const done = idx >= leads.length

  function reachAndNext() {
    if (!cur) return
    onReach(cur)
    setSent(s => s + 1); setIdx(i => i + 1)
  }
  function skip() { setSkipped(s => s + 1); setIdx(i => i + 1) }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (done) { if (e.key === 'Enter') onClose(); return }
      if (e.key === 'Enter') { e.preventDefault(); reachAndNext() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); skip() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, done])

  const plan = cur ? pickReach(cur) : null
  const draft = cur ? parseReachDraft(cur.outreach_draft) : null

  return (
    <div className="fixed inset-0 z-[10500] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">🚀 발송 모드 — 한 건씩 열고 직접 보내기</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm" aria-label="닫기">✕</button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="text-3xl mb-2">🎉</div>
            <div className="text-sm font-semibold text-gray-900">끝! 열기 {sent}건 · 건너뜀 {skipped}건</div>
            <p className="mt-1 text-xs text-gray-500">각 창에서 내용 확인 후 직접 보내기를 눌러 마무리하세요.</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm">닫기 (Enter)</button>
          </div>
        ) : (
          <>
            <div className="mb-1 text-[11px] text-gray-400">{idx + 1} / {leads.length} · 열기 {sent} · 건너뜀 {skipped}</div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-sm font-semibold text-gray-900">{cur.name} <span className="ml-1 text-xs font-normal text-gray-400">{PLATFORM_KO[cur.platform] || cur.platform}</span></div>
              <div className="mt-1 text-xs text-gray-600">
                {plan ? (plan.channel === 'email' ? `✉ ${cur.email}` : plan.channel === 'dm' ? `📷 인스타 DM @${cur.instagram}` : '💬 블로그 쪽지·댓글 (초안 자동 복사)') : '연락 채널 없음 — 건너뛰세요'}
              </div>
              {draft && <div className="mt-2 text-xs text-violet-700 truncate" title={draft.subject}>✍ {draft.subject}</div>}
              {!draft && <div className="mt-2 text-[11px] text-gray-400">AI 초안 없음 → 공통 템플릿 사용</div>}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={reachAndNext} disabled={!plan} className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40">
                {plan?.openLabel || '열기'} + 다음 (Enter)
              </button>
              <button onClick={skip} className="px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm">건너뛰기 (→)</button>
            </div>
            <p className="mt-3 text-[11px] text-gray-400">⚖️ 창이 열리면 내용을 확인하고 직접 보내세요 — 자동 발송되지 않습니다. 거부 의사를 받은 상대는 상태를 '거절'로 바꿔 재컨택을 막으세요.</p>
          </>
        )}
      </div>
    </div>
  )
}
