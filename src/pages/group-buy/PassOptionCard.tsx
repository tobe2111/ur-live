/**
 * 🛍️ 이용권 상세 '옵션 선택' 카드 — 모바일 전용 (2026-10-24 대표 승인 "그루폰식으로 하자")
 *
 * 그루폰 상세의 옵션 카드 문법: 고른 옵션이 **파란 테두리**로 서 있고, 그 아래 [수량 · 구매하기].
 * PC 는 우측 `DealPurchaseBox` 가 이 일을 한다.
 *
 * 🔤 2026-10-25 대표 확정 **D안**: 큰 가격·정가·할인은 머리(`PassHeadCard`)로 올라갔다 — 여기엔 옵션 이름과
 *   그 옵션 값만 작게 남긴다(한 화면에 큰 가격은 한 번). '이렇게 써요' 3줄도 뺐다 — 바로 아래 이용권 정보
 *   (`UsageGuide`)의 사용 단계가 같은 말을 이미 한다.
 *
 * ## 지킨 것
 * - **구매하기는 하단 바와 같은 구매 창을 연다**(`onOpen`). 이 카드가 결제를 따로 부르면 딜 사용 칸이
 *   빠진 두 번째 결제 경로가 생긴다. 수량은 페이지 상태 하나를 둘이 같이 쓴다.
 * - 카운트다운·프로모 코드·선물하기는 없다 — 마감이 없고(2026-09-04), 쿠폰도 이용권 선물 흐름도 이 화면에 없다.
 * - 주인 · 사전 응모는 그리지 않는다(하단 바가 [관리하기]·[사전 응모하기] 를 낸다).
 */
import { formatNumber } from '@/utils/format'
import { Check } from 'lucide-react'


export default function PassOptionCard({
  name, unitPrice, refPrice, discountPct, quantity, setQuantity, maxQty,
  buyable, isJoinable, joining, onOpen,
}: {
  name: string
  unitPrice: number
  refPrice: number
  discountPct: number
  quantity: number
  setQuantity: (fn: (q: number) => number) => void
  maxQty: number
  buyable: boolean
  isJoinable: boolean
  joining: boolean
  onOpen: () => void
}) {
  const step = 'w-9 h-9 rounded-full border-0 flex items-center justify-center text-[17px] cursor-pointer disabled:opacity-40 disabled:cursor-default'
  return (
    <section aria-labelledby="pass-option-title" className="lg:hidden mx-3 mb-3 px-1">
      <h2 id="pass-option-title" className="m-0 mb-3 text-[17px] font-bold" style={{ color: 'var(--gbd-ink)' }}>옵션</h2>
      <div className="rounded-2xl border-2 border-brand px-4 py-4" style={{ background: 'var(--gbd-card)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[15px] font-medium leading-[1.4]" style={{ color: 'var(--gbd-ink)' }}>{name}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[15px] font-bold" style={{ color: 'var(--gbd-ink)' }}>{formatNumber(unitPrice)}원</span>
              {refPrice > unitPrice && <span className="text-[13px] line-through" style={{ color: 'var(--gbd-sub)' }}>{formatNumber(refPrice)}원</span>}
              {discountPct > 0 && <span className="text-[13px] font-medium" style={{ color: 'var(--sale)' }}>{discountPct}%</span>}
            </div>
          </div>
          <span aria-label="선택됨" className="shrink-0 w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center"><Check size={14} /></span>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="flex items-center gap-1 shrink-0" role="group" aria-label="수량 조절">
          <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={!buyable || quantity <= 1} aria-label="수량 감소" className={step} style={{ background: 'var(--gbd-card)', color: 'var(--gbd-ink)' }}>−</button>
          <span className="min-w-[24px] text-center text-[15px] font-medium" style={{ color: 'var(--gbd-ink)' }} aria-live="polite" aria-label={`현재 ${quantity}장`}>{quantity}</span>
          <button type="button" onClick={() => setQuantity(q => Math.min(maxQty, q + 1))} disabled={!buyable || quantity >= maxQty} aria-label="수량 증가" className={step} style={{ background: 'var(--gbd-card)', color: 'var(--gbd-ink)' }}>+</button>
        </span>
        <button type="button" onClick={onOpen} disabled={!buyable || joining} aria-haspopup="dialog"
          className="flex-1 h-12 rounded-full border-0 text-[15px] font-bold disabled:cursor-default"
          style={{ background: buyable ? 'var(--gbd-cta-bg)' : 'var(--gbd-sub2)', color: 'var(--gbd-cta-fg)', cursor: buyable ? 'pointer' : 'default' }}>
          {joining ? '처리 중…' : isJoinable ? '구매하기' : '구매 불가'}
        </button>
      </div>
    </section>
  )
}
