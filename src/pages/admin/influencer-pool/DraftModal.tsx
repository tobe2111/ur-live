import { toast } from '@/hooks/useToast'

/**
 * ✍ 개인화 제안 초안 뷰어 — 인플루언서 풀 행의 초안(이메일 제목/본문 + DM 버전) 검토·복사·발송 진입.
 *   ⚖️ 발송은 없음 — mailto 열기/복사만(사람이 검토 후 직접 발송, 정보통신망법 준수).
 */
export interface OutreachDraftData { subject: string; body: string; dm: string; generated_at?: string }

interface Props {
  name: string
  email: string | null
  draft: OutreachDraftData
  onClose: () => void
  onOpenMail: () => void // mailto 열기(부모가 컨택함 승격 처리)
}

function copy(text: string, label: string) {
  navigator.clipboard?.writeText(text).then(() => toast.success(`${label} 복사됨`)).catch(() => toast.error('복사 실패'))
}

export default function DraftModal({ name, email, draft, onClose, onOpenMail }: Props) {
  return (
    <div className="fixed inset-0 z-[10500] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">✍ {name} — 제안 초안</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm" aria-label="닫기">✕</button>
        </div>

        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">이메일 제목</span>
          <button onClick={() => copy(draft.subject, '제목')} className="text-xs text-blue-600 hover:underline">복사</button>
        </div>
        <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">{draft.subject}</div>

        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">이메일 본문</span>
          <button onClick={() => copy(draft.body, '본문')} className="text-xs text-blue-600 hover:underline">복사</button>
        </div>
        <div className="mb-3 whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-800">{draft.body}</div>

        {draft.dm && (
          <>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">DM · 쪽지용 짧은 버전</span>
              <button onClick={() => copy(draft.dm, 'DM 버전')} className="text-xs text-blue-600 hover:underline">복사</button>
            </div>
            <div className="mb-3 whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-800">{draft.dm}</div>
          </>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-gray-400">{draft.generated_at ? `생성 ${draft.generated_at.slice(5, 16)}` : ''} · 검토·수정 후 직접 발송하세요(자동 발송 없음)</span>
          {email && <button onClick={onOpenMail} className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">✉ 이 초안으로 메일 열기</button>}
        </div>
      </div>
    </div>
  )
}
