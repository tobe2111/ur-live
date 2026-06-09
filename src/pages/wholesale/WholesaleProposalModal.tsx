// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-09 Wave 2 — 도매몰 제안/신고 (유통사 → 운영팀).
//   헤더 아이콘에서 모달로, 또는 /wholesale/proposals 페이지로 동일 컨텐츠 노출.
//   라이트 고정 B2B 서피스 (WT 토큰) — dark: variant 없음.
// ──────────────────────────────────────────────────────────────
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { X, Lightbulb, Flag, Loader2, Send } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import {
  useWholesaleFeedbacks,
  useWholesaleFeedbackMutation,
  type WholesaleFeedbackType,
  type WholesaleFeedbackStatus,
} from '@/hooks/queries/useWholesale'
import { WT } from './wholesale-theme'

const STATUS_LABEL: Record<WholesaleFeedbackStatus, { label: string; bg: string; fg: string }> = {
  open: { label: '접수', bg: '#FFF6E5', fg: '#B7791F' },
  in_review: { label: '검토중', bg: '#EAF1FF', fg: '#2B5CE6' },
  resolved: { label: '처리완료', bg: '#EAF6EF', fg: '#11875A' },
  rejected: { label: '반려', bg: '#FDECEC', fg: '#CC2929' },
}

const hasSellerToken = () => typeof window !== 'undefined' && !!localStorage.getItem('seller_token')

/** 제안/신고 본문 — 폼 + 내 내역. 모달/페이지 공용. */
export function WholesaleProposalForm({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation()
  const [type, setType] = useState<WholesaleFeedbackType>('proposal')
  const [target, setTarget] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const listQ = useWholesaleFeedbacks()
  const submitM = useWholesaleFeedbackMutation()
  const list = listQ.data ?? []

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !body.trim()) {
      toast.error(t('wholesale.proposal.required', { defaultValue: '제목과 내용을 입력해 주세요' }))
      return
    }
    try {
      const r = await submitM.mutateAsync({ type, target: target.trim() || undefined, subject: subject.trim(), body: body.trim() })
      if (r?.success) {
        toast.success(type === 'report'
          ? t('wholesale.proposal.reportSent', { defaultValue: '신고가 접수되었어요 — 운영팀이 확인할게요' })
          : t('wholesale.proposal.proposalSent', { defaultValue: '제안이 접수되었어요 — 검토 후 회신드릴게요' }))
        setTarget(''); setSubject(''); setBody('')
      } else {
        toast.error(r?.error || t('wholesale.proposal.failed', { defaultValue: '접수에 실패했어요' }))
      }
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('wholesale.proposal.failed', { defaultValue: '접수에 실패했어요' }))
    }
  }

  return (
    <div>
      {/* 타입 토글 */}
      <div className="flex gap-2 mb-4">
        {([['proposal', '제안', Lightbulb], ['report', '신고', Flag]] as const).map(([id, label, Icon]) => {
          const on = type === id
          return (
            <button key={id} type="button" onClick={() => setType(id)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl h-11 text-[14px] font-bold transition-colors"
              style={on ? { background: WT.brand, color: '#fff' } : { background: WT.fill, color: WT.ink2 }}>
              <Icon className="w-4 h-4" /> {t(`wholesale.proposal.type.${id}`, { defaultValue: label })}
            </button>
          )
        })}
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-[13px] font-bold mb-1.5" style={{ color: WT.ink2 }}>
            {t('wholesale.proposal.target', { defaultValue: '대상 (선택)' })}
          </label>
          <input value={target} onChange={(e) => setTarget(e.target.value)} maxLength={120}
            placeholder={t('wholesale.proposal.targetPh', { defaultValue: '상품명·공급사·주문번호 등' })}
            className="w-full h-11 px-3.5 rounded-xl text-[14px] outline-none" style={{ background: WT.fill, color: WT.ink }} />
        </div>
        <div>
          <label className="block text-[13px] font-bold mb-1.5" style={{ color: WT.ink2 }}>
            {t('wholesale.proposal.subject', { defaultValue: '제목' })} <span style={{ color: WT.brand }}>*</span>
          </label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120}
            placeholder={t('wholesale.proposal.subjectPh', { defaultValue: '한 줄로 요약해 주세요' })}
            className="w-full h-11 px-3.5 rounded-xl text-[14px] outline-none" style={{ background: WT.fill, color: WT.ink }} />
        </div>
        <div>
          <label className="block text-[13px] font-bold mb-1.5" style={{ color: WT.ink2 }}>
            {t('wholesale.proposal.body', { defaultValue: '내용' })} <span style={{ color: WT.brand }}>*</span>
          </label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={2000}
            placeholder={type === 'report'
              ? t('wholesale.proposal.bodyReportPh', { defaultValue: '어떤 문제가 있었는지 자세히 적어 주세요' })
              : t('wholesale.proposal.bodyPh', { defaultValue: '필요한 상품·개선 아이디어를 자유롭게 적어 주세요' })}
            className="w-full px-3.5 py-3 rounded-xl text-[14px] outline-none resize-none" style={{ background: WT.fill, color: WT.ink }} />
        </div>
        <button type="submit" disabled={submitM.isPending}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl h-12 text-[15px] font-bold text-white disabled:opacity-60" style={{ background: WT.brand }}>
          {submitM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {t('wholesale.proposal.submit', { defaultValue: '접수하기' })}
        </button>
      </form>

      {/* 내 제안/신고 내역 */}
      <div className="mt-6">
        <div className="text-[14px] font-extrabold mb-2.5" style={{ color: WT.ink }}>
          {t('wholesale.proposal.myList', { defaultValue: '내 제안/신고 내역' })}
        </div>
        {listQ.isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: WT.ink4 }} /></div>
        ) : list.length === 0 ? (
          <p className="text-center py-8 text-[13px]" style={{ color: WT.ink4 }}>
            {t('wholesale.proposal.empty', { defaultValue: '아직 접수한 내역이 없어요' })}
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((f) => {
              const st = STATUS_LABEL[f.status] || STATUS_LABEL.open
              return (
                <li key={f.id} className="rounded-xl p-3.5" style={{ border: '1px solid ' + WT.line, background: '#fff' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: f.type === 'report' ? '#FDECEC' : WT.brandSoft, color: f.type === 'report' ? '#CC2929' : WT.brand }}>
                      {f.type === 'report'
                        ? t('wholesale.proposal.type.report', { defaultValue: '신고' })
                        : t('wholesale.proposal.type.proposal', { defaultValue: '제안' })}
                    </span>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                    <span className="ml-auto text-[11px]" style={{ color: WT.ink4 }}>{f.created_at ? new Date(f.created_at).toLocaleDateString('ko-KR') : ''}</span>
                  </div>
                  <div className="text-[13px] font-bold" style={{ color: WT.ink }}>{f.subject}</div>
                  {f.target && <div className="text-[12px] mt-0.5" style={{ color: WT.ink3 }}>대상: {f.target}</div>}
                  {f.admin_memo && (
                    <div className="mt-2 rounded-lg px-3 py-2 text-[12px]" style={{ background: WT.fill, color: WT.ink2 }}>
                      <span className="font-bold" style={{ color: WT.ink }}>운영팀: </span>{f.admin_memo}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {onClose && (
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-xl h-11 text-[14px] font-bold" style={{ background: WT.fill, color: WT.ink2 }}>
          {t('common.close', { defaultValue: '닫기' })}
        </button>
      )}
    </div>
  )
}

/** 헤더 아이콘에서 띄우는 모달. 비로그인 시 로그인 유도. */
export default function WholesaleProposalModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const loggedIn = hasSellerToken()

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center" style={{ background: 'rgba(20,22,28,0.42)' }} onClick={onClose}>
      <div className="w-full lg:max-w-lg bg-white rounded-t-3xl lg:rounded-3xl p-5 pb-7 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[18px] font-extrabold" style={{ color: WT.ink }}>
            {t('wholesale.proposal.title', { defaultValue: '제안 / 신고' })}
          </h3>
          <button onClick={onClose} aria-label={t('common.close', { defaultValue: '닫기' })}><X className="w-5 h-5" style={{ color: WT.ink3 }} /></button>
        </div>
        <p className="text-[13px] mb-4" style={{ color: WT.ink3 }}>
          {t('wholesale.proposal.desc', { defaultValue: '필요한 상품 제안이나 불편/문제를 운영팀에 전달해 주세요' })}
        </p>
        {loggedIn ? (
          <WholesaleProposalForm onClose={onClose} />
        ) : (
          <div className="py-6 text-center">
            <p className="text-[14px] mb-4" style={{ color: WT.ink2 }}>
              {t('wholesale.proposal.loginNeeded', { defaultValue: '로그인하면 제안/신고를 보낼 수 있어요' })}
            </p>
            <button onClick={() => { onClose(); navigate('/wholesale/login') }} className="rounded-xl px-5 py-3 text-[14px] font-bold text-white" style={{ background: WT.brand }}>
              {t('wholesale.login', { defaultValue: '유통회원 로그인' })}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
