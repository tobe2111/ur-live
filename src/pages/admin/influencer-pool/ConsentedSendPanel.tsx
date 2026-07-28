import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

/**
 * 📨 동의 리드 일괄 발송 — **사전 수신동의자(인바운드 신청, consented_at)에게만** 자동 발송.
 *   ⚖️ [LEGAL] 서버(send-consented)가 SQL 로 동의+이메일 보유를 강제 — 콜드 리드는 여기로 못 보냄.
 *   {name}/{이름} 플레이스홀더 치환 + 수신거부 안내 자동 첨부(서버 강제). 50명씩 분할 호출.
 */
interface ConsentedLead { id: number; name: string; email: string | null }

export default function ConsentedSendPanel() {
  const [open, setOpen] = useState(false)
  const [targets, setTargets] = useState<ConsentedLead[] | null>(null)
  const [subject, setSubject] = useState('[유어딜] 제휴 크리에이터 온보딩 안내')
  const [body, setBody] = useState('안녕하세요 {name}님, 유어딜 제휴 담당자입니다.\n\n신청해주셔서 감사합니다. 다음 단계 안내드립니다:\n\n1. \n2. \n\n궁금한 점은 이 메일에 회신해주세요. 감사합니다.')
  const [busy, setBusy] = useState(false)

  async function openPanel() {
    setOpen(true)
    try {
      // 동의 풀 = 인바운드 신청자(신청 시 consented_at 기록) 중 이메일 보유 — 서버가 발송 시 재검증.
      const r = await api.get('/api/admin/ads/influencer-pool?source=inbound&hasEmail=1&limit=500')
      setTargets((r.data?.leads || []).map((l: ConsentedLead) => ({ id: l.id, name: l.name, email: l.email })))
    } catch { setTargets([]) }
  }

  async function send() {
    if (!targets?.length) return
    if (!window.confirm(`동의한 신청자 ${targets.length}명에게 발송할까요?\n(수신거부 안내는 자동 첨부됩니다)`)) return
    setBusy(true)
    let sent = 0, failed = 0, skipped = 0, recent = 0
    try {
      for (let i = 0; i < targets.length; i += 50) {
        const ids = targets.slice(i, i + 50).map(t => t.id)
        try {
          const r = await api.post('/api/admin/ads/influencer-pool/send-consented', { ids, subject, body })
          if (r.data?.success) { sent += r.data.sent || 0; failed += (r.data.failed || []).length; skipped += (r.data.skipped || []).length; recent += r.data.recent_skipped || 0 }
          else { failed += ids.length; if (i === 0) { toast.error(r.data?.error || '발송 실패'); break } }
        } catch { failed += ids.length }
      }
      // 🔁 최근 7일 내 이미 받은 사람은 서버가 자동 제외한다(중복 클릭·재실행이 같은 사람에게 또 보내지 않게).
      if (!sent && recent) toast.info(`이미 최근 7일 내 발송한 리드라 ${formatNumber(recent)}명 전원 제외했어요 — 중복 발송을 막았습니다`)
      else if (sent) toast.success(`📨 ${formatNumber(sent)}건 발송 완료${failed ? ` · 실패 ${failed}` : ''}${skipped ? ` · 제외 ${skipped}${recent ? `(최근 발송 ${recent} 포함)` : '(미동의/이메일없음)'}` : ''}`)
    } finally { setBusy(false); setOpen(false) }
  }

  return (
    <>
      <button onClick={openPanel} className="px-4 py-2 rounded-lg border border-sky-300 bg-sky-50 text-sky-700 text-sm font-medium" title="사전 수신동의한 인바운드 신청자에게만 자동 발송(서버가 동의를 강제)">
        📨 동의 리드 일괄발송
      </button>
      {open && (
        <div className="fixed inset-0 z-[10500] flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">📨 동의 리드 일괄발송 (신청자 전용)</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 text-sm" aria-label="닫기">✕</button>
            </div>
            <div className="mb-3 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-800">
              대상: <b>{targets == null ? '조회 중…' : `${formatNumber(targets.length)}명`}</b> — 스스로 신청해 수신동의한 리드만(서버 강제). 콜드 수집 리드는 발송되지 않습니다.
            </div>
            <label className="block text-xs font-medium text-gray-500 mb-1">제목</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full mb-3 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900" />
            <label className="block text-xs font-medium text-gray-500 mb-1">본문 — <code className="text-[11px]">{'{name}'}</code> 은 이름으로 치환 · 수신거부 안내 자동 첨부</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} className="w-full mb-3 px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-900 leading-relaxed" />
            <button onClick={send} disabled={busy || !targets?.length || body.trim().length < 20} className="w-full py-2.5 rounded-lg bg-sky-600 text-white text-sm font-semibold disabled:opacity-40">
              {busy ? '발송 중…' : `발송 (${targets ? formatNumber(targets.length) : 0}명)`}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
