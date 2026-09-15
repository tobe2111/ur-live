// 🛡️ 2026-06-10: SellerSettlementsPage 분해 — 순수 이동 (동작 변화 0).
// 🛡️ 2026-05-18: 사업자등록 검증 상태 배너 — 현금 정산 가능 여부 안내.
// 📱 2026-09-15 모바일 특화 + 🎫 규칙 ⑥: 이모지 3종·색깔 상자 3종을 걷어냈다. 흰 카드 하나에 **상태는 글자 톤 한 곳**으로만
//   (반려 = tone-bad · 대기 = tone-warn · 미등록 = 잉크). 폰에선 버튼이 한 줄을 다 쓴다.
import { FileCheck2 } from 'lucide-react'

export default function BizRegStatusBanner({ status, imageUrl, rejectReason, onOpenModal }: {
  status: string
  imageUrl: string | null
  rejectReason: string | null
  onOpenModal: () => void
}) {
  if (status === 'verified' || status === 'exempt') return null
  const rejected = status === 'rejected'
  const waiting = status === 'pending' && !!imageUrl
  const tone = rejected ? 'text-tone-bad' : waiting ? 'text-tone-warn' : 'text-gray-900'
  const title = rejected
    ? '사업자등록 반려됨. 다시 제출해 주세요 (지금은 교환권 정산만 가능)'
    : waiting
      ? '사업자등록 검증 대기 중 (지금은 교환권 정산만 가능)'
      : '비사업자 셀러는 KT 교환권으로 정산됩니다. 현금 정산은 사업자등록이 필요해요'
  return (
    <div className="rounded-[var(--dash-radius,16px)] border border-rule bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 rounded-lg bg-gray-100 p-2 text-gray-500"><FileCheck2 size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className={`text-[13px] font-bold leading-snug ${tone}`}>{title}</p>
          {rejected && rejectReason && (
            <p className="mt-1.5 text-[12px] text-tone-bad">반려 사유: {rejectReason}</p>
          )}
          <p className="mt-1.5 text-[12px] leading-relaxed text-gray-500">
            {waiting
              ? '어드민 검증 후 알려드립니다 (보통 1~3 영업일)'
              : '미등록 상태에서는 딜(포인트)과 교환권으로만 받을 수 있고, 딜은 플랫폼 안에서만 쓸 수 있습니다 (현금화 불가)'}
          </p>
          <button
            type="button"
            onClick={onOpenModal}
            className={`mt-3 w-full sm:w-auto ${rejected ? 'ur-btn ur-btn-sm ur-btn-danger' : 'ur-btn ur-btn-sm ur-btn-primary'}`}
          >
            {imageUrl ? '다시 제출하기' : '사업자등록증 등록하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
