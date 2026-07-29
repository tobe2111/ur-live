import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

/**
 * 📮 콜드 제휴 제안 발송 — **수집 풀(미동의)** 대상. 2026-07-28 대표 결정으로 신설.
 *   경위·근거·잔여 리스크는 `outreach-cold.ts` 헤더에 기록(그 전까지는 "만들지 않는다"였다).
 *
 *   ⚖️ 이 화면은 편의를 줄 뿐 **강제는 전부 서버**가 한다 — (광고) 제목 표기 · 수신거부 안내 · 전송자 정보 ·
 *      야간(21~08시) 차단 · 1일 상한 · 반송 회로차단 · 30일 쿨다운. 클라가 보낸 id 도 서버가 재검증한다.
 *   동의 리드는 이 경로로 안 보낸다(서버가 `consented_at IS NULL` 강제) — 그쪽은 ConsentedSendPanel.
 */
interface Lead { id: number; name: string; email: string | null; consented_at?: string | null; campaign_sent_at?: string | null }

const BATCH = 30 // 서버 COLD_SEND_MAX 와 동일 — 초과분은 나눠 호출

export default function ColdSendPanel() {
  const [open, setOpen] = useState(false)
  const [targets, setTargets] = useState<Lead[] | null>(null)
  const [subject, setSubject] = useState('유어딜 제휴 제안 — 지역 매장 이용권 협업 문의')
  const [body, setBody] = useState(
    '안녕하세요 {name}님, 유어딜 제휴 담당자입니다.\n\n'
    + '채널에 공개해두신 제휴 문의 주소로 연락드립니다.\n\n'
    + '유어딜은 동네 매장의 이용권을 소개하는 서비스입니다. {name}님 채널과 어울리는 매장을 매칭해\n'
    + '소개해주시면, 발생한 실제 방문·구매에 따라 보상을 드리는 형태로 협업하고 있습니다.\n\n'
    + '관심 있으시면 이 메일에 회신해주세요. 조건과 진행 방식을 자세히 안내드리겠습니다.\n\n'
    + '감사합니다.',
  )
  const [busy, setBusy] = useState(false)

  async function openPanel() {
    setOpen(true)
    try {
      // 이메일 보유 리드를 받아 **미동의만** 남긴다(동의자는 전용 경로). 서버가 발송 시 같은 조건을 재검증.
      const r = await api.get('/api/admin/ads/influencer-pool?hasEmail=1&limit=500')
      const all: Lead[] = r.data?.leads || []
      setTargets(all.filter(l => !l.consented_at && l.email))
    } catch { setTargets([]) }
  }

  async function send() {
    if (!targets?.length) return
    const n = Math.min(targets.length, BATCH)
    if (!window.confirm(
      `콜드 리드 ${n}명에게 제휴 제안을 발송합니다.\n\n`
      + '· 제목에 "(광고)" 가 자동으로 붙습니다\n'
      + '· 수신거부 안내와 전송자 정보가 자동 첨부됩니다\n'
      + '· 같은 사람에게 30일 내 재발송되지 않습니다\n\n'
      + '진행할까요?',
    )) return
    setBusy(true)
    try {
      const ids = targets.slice(0, BATCH).map(t => t.id)
      const r = await api.post('/api/admin/ads/influencer-pool/send-cold', { ids, subject, body })
      if (!r.data?.success) { toast.error(r.data?.error || '발송 실패'); return }
      const sent = r.data.sent || 0
      const skipped = (r.data.skipped || []).length
      if (sent) toast.success(`📮 ${formatNumber(sent)}건 발송${skipped ? ` · 제외 ${skipped}` : ''} · 오늘 남은 한도 ${formatNumber(r.data.remaining_today ?? 0)}건`)
      else toast.info(r.data.note || '발송 가능한 리드가 없습니다')
      setTargets(prev => (prev ? prev.filter(t => !ids.includes(t.id)) : prev))
    } catch (e) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '발송 실패')
    } finally { setBusy(false) }
  }

  const batchCount = targets ? Math.min(targets.length, BATCH) : 0

  return (
    <>
      <button onClick={openPanel} className="px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 text-sm font-medium" title="수집한 공개 제휴문의 주소로 제안 발송 — 광고표기·수신거부·야간금지·1일 상한을 서버가 강제">
        📮 콜드 제휴 제안
      </button>
      {open && (
        <div className="fixed inset-0 z-[10500] flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">📮 콜드 제휴 제안 (수집 풀)</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 text-sm" aria-label="닫기">✕</button>
            </div>
            <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 leading-relaxed">
              대상: <b>{targets == null ? '조회 중…' : `${formatNumber(targets.length)}명`}</b> (미동의 · 이메일 보유) — 이번 발송 <b>{formatNumber(batchCount)}명</b>
              <div className="mt-1 text-[11px] text-amber-700">
                제목 <b>(광고)</b> 표기 · 수신거부 안내 · 전송자 정보가 자동 첨부되고, 야간(21~08시)과 30일 내 재발송은 서버가 막습니다.
              </div>
            </div>
            <label className="block text-xs font-medium text-gray-500 mb-1">제목</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full mb-3 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900" />
            <label className="block text-xs font-medium text-gray-500 mb-1">본문 — <code className="text-[11px]">{'{name}'}</code> 은 이름으로 치환</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={9} className="w-full mb-3 px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-900 leading-relaxed" />
            <button onClick={send} disabled={busy || !batchCount || body.trim().length < 20} className="w-full py-2.5 rounded-lg bg-amber-600 text-white text-sm font-semibold disabled:opacity-40">
              {busy ? '발송 중…' : `발송 (${formatNumber(batchCount)}명)`}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
