// 🛡️ 2026-06-10: SellerSettlementsPage 분해 — 순수 이동 (동작 변화 0).
// 🛡️ 2026-05-18: 사업자등록 검증 상태 배너 — 현금 정산 가능 여부 안내.
export default function BizRegStatusBanner({ status, imageUrl, rejectReason, onOpenModal }: {
  status: string
  imageUrl: string | null
  rejectReason: string | null
  onOpenModal: () => void
}) {
  if (status === 'verified' || status === 'exempt') return null
  return (
    <div className={`rounded-xl p-4 border ${
      status === 'rejected' ? 'bg-red-50 border-red-200' :
      status === 'pending' && imageUrl ? 'bg-amber-50 border-amber-200' :
      'bg-blue-50 border-blue-200'
    }`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">
          {status === 'rejected' ? '⚠️' : imageUrl ? '⏳' : '📋'}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm ${
            status === 'rejected' ? 'text-red-900' :
            imageUrl ? 'text-amber-900' : 'text-blue-900'
          }`}>
            {status === 'rejected' ? '사업자등록 반려됨 — 재제출 필요 (현재: 🎁 교환권 정산만 가능)' :
             imageUrl ? '사업자등록 검증 대기 중 (현재: 🎁 교환권 정산만 가능)' :
             '비사업자 셀러 → 🎁 KT 교환권으로 정산 가능 / 💰 현금 정산은 사업자등록 필요'}
          </p>
          {status === 'rejected' && rejectReason && (
            <p className="text-xs text-red-700 mt-1.5 bg-red-100 px-2 py-1 rounded">
              반려 사유: {rejectReason}
            </p>
          )}
          <p className="text-xs text-gray-600 mt-1.5">
            {imageUrl && status === 'pending'
              ? '어드민 검증 후 알려드립니다 (보통 1-3 영업일)'
              : '미등록 상태 — 현재는 딜(포인트) / 교환권으로만 수령 가능 · 딜은 플랫폼 내 사용만 가능 (현금화 불가)'}
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={onOpenModal}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md ${
                status === 'rejected'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {imageUrl ? '다시 제출하기' : '사업자등록증 등록하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
