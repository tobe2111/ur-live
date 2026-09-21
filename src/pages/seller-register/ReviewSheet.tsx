/**
 * 🧾 제출 전 확인 — 대표 참고 시안 ④ *"제출 전 확인해주세요"*.
 *
 * 2026-09-16. 사장님이 [가입 신청하기] 를 누르면 **바로 보내지 않고** 무엇이 나가는지 한 번 보여 준다.
 *
 * ## 왜 화면을 하나 더 만들지 않았나
 * 시안은 별도 페이지지만 여기선 시트다. 이 가입은 한 스크롤이고, 대표가 이미
 * *"복잡해서도 안되긴 하는데"* 라고 선을 그었다 — 라우트를 하나 더 만들면 뒤로가기·새로고침·
 * 진행 복원이 전부 새 문제가 된다. 시트는 그 넷을 하나도 만들지 않으면서 같은 일을 한다.
 *
 * ## 이 시트가 실제로 막는 것
 * OCR 이 잘못 읽은 값을 그대로 보내는 것. 사진에서 채운 칸은 사장님이 한 번도 안 읽었을 수 있다 —
 * 보내기 직전에 **글자로** 다시 보여 주는 자리가 여기뿐이다.
 *
 * 색 정보상자 0 · 이모지 0 — 🎫 규칙 ⑥.
 */
import { useEffect, useRef } from 'react'
import { Loader2, X } from 'lucide-react'
import { Z } from '@/constants/z-index'

export interface ReviewRow {
  label: string
  value: string
  /** 비어 있으면 '아직' 로 흐리게 — 필수는 애초에 여기 못 온다(제출 버튼이 5칸을 요구한다) */
  muted?: boolean
}

export default function ReviewSheet({ open, rows, later, fromPhoto, loading, onClose, onConfirm }: {
  open: boolean
  rows: ReviewRow[]
  /** 사진에서 채운 칸 수 — 0 이면 그 얘기를 아예 꺼내지 않는다(안 한 일을 했다고 하면 안 된다) */
  fromPhoto: number
  /** 지금 안 내도 되는 것들 — 제출 뒤에 무엇이 남는지 여기서 한 번 더 말해 준다 */
  later: string[]
  loading: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, loading, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 flex items-end justify-center sm:items-center" style={{ zIndex: Z.SHEET_BODY }}>
      <button type="button" aria-label="닫기" onClick={() => { if (!loading) onClose() }}
        className="absolute inset-0 bg-black/40" />
      <div role="dialog" aria-modal="true" aria-labelledby="review-sheet-title"
        className="relative w-full max-w-[560px] rounded-t-[20px] bg-white sm:rounded-[20px]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center gap-2 px-4 pb-1 pt-4 sm:px-5">
          <h2 id="review-sheet-title" className="flex-1 text-[19px] font-extrabold leading-snug tracking-[-.02em] text-gray-900">
            제출 전 확인해 주세요
          </h2>
          <button type="button" onClick={() => { if (!loading) onClose() }} aria-label="닫기"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="px-4 text-[12.5px] text-gray-500 sm:px-5">
          {fromPhoto > 0
            ? `${fromPhoto}칸은 사진에서 읽은 값이에요. 틀린 곳이 있으면 닫고 고쳐 주세요.`
            : '이대로 신청합니다. 틀린 곳이 있으면 닫고 고쳐 주세요.'}
        </p>

        <dl className="mt-3 max-h-[46dvh] overflow-y-auto px-4 sm:px-5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-start justify-between gap-4 border-t border-rule py-2.5 first:border-t-0">
              <dt className="shrink-0 text-[12.5px] font-semibold text-gray-500">{r.label}</dt>
              <dd className={`min-w-0 text-right text-[13.5px] font-bold ${r.muted ? 'text-gray-400' : 'text-gray-900'}`}>
                {r.value || '아직'}
              </dd>
            </div>
          ))}
        </dl>

        {later.length > 0 && (
          <p className="mt-3 border-t border-rule px-4 pt-3 text-[12px] leading-relaxed text-gray-500 sm:px-5">
            제출 뒤에 남는 것: <strong className="font-bold text-gray-700">{later.join(', ')}</strong>.
            대시보드에서 채우면 심사가 시작돼요.
          </p>
        )}

        <div className="flex gap-2 px-4 pb-4 pt-3 sm:px-5">
          <button type="button" onClick={onClose} disabled={loading}
            className="ur-btn ur-btn-lg flex-1 border border-rule bg-white text-gray-700 disabled:opacity-50">
            고칠게요
          </button>
          <button ref={confirmRef} type="button" onClick={onConfirm} disabled={loading}
            className="ur-btn ur-btn-lg ur-btn-primary flex-[1.6] disabled:opacity-50">
            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            {loading ? '신청 중...' : '이대로 제출'}
          </button>
        </div>
      </div>
    </div>
  )
}
