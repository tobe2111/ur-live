/**
 * 💰 소개비 마진 계산기 (2026-07-05 인플루언서 이용권 공구 엔진 §1.3)
 *
 * 매장이 딜을 "할인 + 소개비"라는 하나의 마케팅 예산으로 설계하도록, 판매가에서
 *   플랫폼 5% → 소개비(promo%) → 매장 실수령을 실시간 표시.
 * 슬라이스 산술 SSOT = resolveOrderFees(owner-funded promo 모델). 이 계산기는 표시 전용(돈 무영향).
 *
 * 셀러 대시보드 = 라이트 테마 고정 (dark: variant 금지).
 */
import { resolveOrderFees } from '@/worker/utils/fee-resolver'
import { formatNumber } from '@/utils/format'

/** 카테고리별 권장 소개비 상한 (§5 버티컬 가이드 — 한계비용 기반). */
export const PROMO_VERTICAL_GUIDE: Record<string, { label: string; min: number; max: number; note: string }> = {
  stay_voucher: { label: '숙소', min: 20, max: 30, note: '빈 객실은 한계비용 0 — 전국 팔로워가 잠재고객이라 높은 소개비도 감당돼요.' },
  health_voucher: { label: '헬스·PT', min: 20, max: 30, note: '빈 시간은 한계비용 0 — 지역 인플루언서에게 높은 소개비가 유효해요.' },
  activity_voucher: { label: '액티비티', min: 20, max: 30, note: '빈 자리는 한계비용이 낮아 소개비 여력이 커요.' },
  beauty_voucher: { label: '미용·시술', min: 15, max: 25, note: '빈 의자 채우기 — 지역 인플루언서 중심으로 설계하세요.' },
  pet_voucher: { label: '펫', min: 15, max: 25, note: '예약형 서비스는 빈 시간 채우기 관점으로 소개비를 잡으세요.' },
  meal_voucher: { label: '식당', min: 10, max: 15, note: '원가율(35~40%)이 있어 10~15% 권장. 그 이상은 체험단(협찬격)으로 여세요.' },
}

export function promoGuideFor(category: string) {
  return PROMO_VERTICAL_GUIDE[category] ?? PROMO_VERTICAL_GUIDE.meal_voucher
}

interface Props {
  /** 판매가(공구가) = 소비자 결제액. */
  price: number
  /** 정가(원가) — 할인율 표시용(선택). */
  originalPrice?: number
  /** 소개비 % (0~50). */
  promoPct: number
  category: string
}

export default function PromoMarginCalculator({ price, originalPrice, promoPct, category }: Props) {
  const amount = Number.isFinite(price) && price > 0 ? Math.floor(price) : 0
  const guide = promoGuideFor(category)

  // owner-funded promo 모델: 판매가 → 플랫폼 5% → 소개비(주인 몫에서) → 매장 실수령.
  const b = resolveOrderFees({
    amount,
    ownership: '3P',
    productKind: 'voucher',
    promo: promoPct > 0 ? { promoterId: 'preview', pct: promoPct } : null,
  })

  const discountPct = originalPrice && originalPrice > amount
    ? Math.round((1 - amount / originalPrice) * 100)
    : 0

  const Row = ({ label, value, sign, strong, muted }: { label: string; value: number; sign?: '−' | '='; strong?: boolean; muted?: boolean }) => (
    <div className={`flex items-center justify-between py-1.5 ${strong ? 'border-t border-gray-200 mt-1 pt-2.5' : ''}`}>
      <span className={`text-[13px] ${muted ? 'text-gray-500' : strong ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
        {sign && <span className="inline-block w-3 text-gray-400">{sign}</span>} {label}
      </span>
      <span className={`font-mono text-[13px] ${strong ? 'font-bold text-emerald-700' : muted ? 'text-gray-500' : 'text-gray-800'}`}>
        {sign === '−' ? '-' : ''}{formatNumber(value)}원
      </span>
    </div>
  )

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-bold text-gray-900">💰 매장 실수령 계산기</p>
        <span className="text-[11px] text-gray-400">건당 기준</span>
      </div>
      <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
        {guide.label} 권장 소개비 <strong className="text-gray-700">{guide.min}~{guide.max}%</strong> · {guide.note}
      </p>

      {amount > 0 ? (
        <div>
          <Row label={`판매가${discountPct > 0 ? ` (정가 대비 ${discountPct}% 할인)` : ''}`} value={amount} />
          <Row label="플랫폼 수수료 5% (결제·사용확인·정산)" value={b.platform} sign="−" muted />
          <Row label={`소개비 ${promoPct || 0}% → 인플루언서`} value={b.promo} sign="−" muted />
          <Row label="매장 실수령" value={b.ownerNet} sign="=" strong />
          {promoPct > 0 && (
            <p className="text-[11px] text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-2 mt-2.5 leading-relaxed">
              추천 판매 1건당 인플루언서에게 <strong>{formatNumber(b.promo)}원</strong>이 지급돼요. 소개비는
              추천 링크로 <strong>실제 판매가 확정된 건에만</strong> 발생하며, 소비자 결제액에 추가되지 않아요.
            </p>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-gray-400 py-2">판매가를 입력하면 실수령이 계산돼요.</p>
      )}
    </div>
  )
}
