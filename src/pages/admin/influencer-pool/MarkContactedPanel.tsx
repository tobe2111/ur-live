import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

/**
 * ✅ 수기 발송 후 '보냄' 일괄 처리 — 2026-07-29.
 *   대표가 「📇 연락 대상만 받기」로 목록을 받아 **직접** 메일을 보내는 워크플로(Resend 미사용 확정)에서,
 *   보낸 사실을 시스템이 알 방법이 없었다. 그러면 다음 내보내기에 **같은 사람이 또 나온다**
 *   (목록은 `contacted_at IS NULL` 로 거른다) → 중복 발송으로 상대가 짜증나고 브랜드가 깎인다.
 *
 *   엑셀 **ID 열**을 그대로 복사해 붙여넣으면 닫힌다. 구분자는 아무거나(줄바꿈·쉼표·공백·탭).
 *   서버가 멱등 처리(이미 보낸 건 최초 발송일 보존) — 두 번 눌러도 안전하다.
 */
export default function MarkContactedPanel() {
  const [open, setOpen] = useState(false)
  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)

  const ids = Array.from(new Set(
    raw.split(/[^0-9]+/).map(x => Number(x)).filter(n => Number.isFinite(n) && n > 0),
  ))

  async function submit() {
    if (!ids.length) return
    if (!window.confirm(`${formatNumber(ids.length)}명을 '발송 완료'로 표시합니다.\n\n다음 목록에서 제외되어 중복 발송을 막습니다. 진행할까요?`)) return
    setBusy(true)
    try {
      // 서버 상한 500 — 초과분은 나눠 보낸다.
      let updated = 0
      for (let i = 0; i < ids.length; i += 500) {
        const r = await api.post('/api/admin/ads/influencer-pool/mark-contacted', { ids: ids.slice(i, i + 500), channel: 'email' })
        if (r.data?.success) updated += r.data.updated || 0
        else { toast.error(r.data?.error || '처리 실패'); break }
      }
      if (updated) { toast.success(`✅ ${formatNumber(updated)}명 발송 완료 처리 — 다음 목록에서 제외됩니다`); setRaw(''); setOpen(false) }
      else toast.info('변경된 리드가 없습니다 (이미 처리됐거나 없는 ID)')
    } catch (e) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '처리 실패')
    } finally { setBusy(false) }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="px-4 py-2 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 text-sm font-medium"
        title="직접 보낸 뒤 엑셀 ID 열을 붙여넣으면 '발송 완료'로 표시 — 다음 목록에서 제외돼 중복 발송을 막습니다">
        ✅ 발송 완료 처리
      </button>
      {open && (
        <div className="fixed inset-0 z-[10500] flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">✅ 발송 완료 처리 (수기 발송분)</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 text-sm" aria-label="닫기">✕</button>
            </div>
            <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800 leading-relaxed">
              내려받은 엑셀의 <b>ID 열</b>에서 실제로 보낸 행만 복사해 붙여넣으세요. 구분자는 아무거나 됩니다(줄바꿈·쉼표·공백).
              <div className="mt-1 text-[11px] text-blue-700">이미 처리된 리드는 최초 발송일이 유지됩니다 — 두 번 눌러도 안전합니다.</div>
            </div>
            <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={8} placeholder={'1234\n1235\n1236'}
              className="w-full mb-2 px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-900 font-mono" />
            <div className="mb-3 text-[12px] text-gray-500">인식된 ID: <b className="text-gray-800">{formatNumber(ids.length)}</b>개</div>
            <button onClick={submit} disabled={busy || !ids.length}
              className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-40">
              {busy ? '처리 중…' : `${formatNumber(ids.length)}명 발송 완료로 표시`}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
