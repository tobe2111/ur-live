/**
 * 🛍️ 이용권 상세 '옵션 선택' 카드 — 모바일 전용 (2026-10-24 대표 승인 "그루폰식으로 하자")
 *
 * 그루폰 상세의 옵션 카드 문법: 고른 옵션이 **파란 테두리**로 서 있고, 그 안에 [이렇게 써요 3줄],
 * 아래 회색 칸에 [정가 · 판매가 · 할인] + [수량 · 구매하기]. PC 는 우측 `DealPurchaseBox` 가 이 일을 한다.
 *
 * ## 지킨 것
 * - **구매하기는 하단 바와 같은 구매 창을 연다**(`onOpen`). 이 카드가 결제를 따로 부르면 딜 사용 칸이
 *   빠진 두 번째 결제 경로가 생긴다. 수량은 페이지 상태 하나를 둘이 같이 쓴다.
 * - **'이렇게 써요' 는 사실만**: 결제하면 지갑에 담김 · 매장에서 이용권 화면 · 기간 안에 못 쓰면 자동 환불
 *   (`cron/auto-settlement` — 미사용 만료 100% 환불). 그루폰의 '포함 내역' 은 데이터가 없어 지어내게 되므로 안 가져왔다.
 * - 카운트다운·프로모 코드·선물하기는 없다 — 마감이 없고(2026-09-04), 쿠폰도 이용권 선물 흐름도 이 화면에 없다.
 * - 주인 · 사전 응모는 그리지 않는다(하단 바가 [관리하기]·[사전 응모하기] 를 낸다).
 */
import { formatNumber } from '@/utils/format'
import { Check } from 'lucide-react'

const USE_STEPS = ['결제하면 바로 내 이용권에 담겨요', '매장에서 이용권 화면을 보여주면 끝', '기간 안에 못 쓰면 자동으로 환불돼요']

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
    <section aria-labelledby="pass-option-title" className="lg:hidden mx-3 mb-3">
      <h2 id="pass-option-title" className="m-0 mb-3 px-1 text-[17px] font-bold" style={{ color: 'var(--gbd-ink)' }}>옵션 선택</h2>
      <div className="rounded-2xl overflow-hidden border-2 border-brand" style={{ background: 'var(--gbd-card)' }}>
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="text-[17px] font-medium leading-[1.35]" style={{ color: 'var(--gbd-ink)' }}>{name}</div>
            <span aria-label="선택됨" className="shrink-0 w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center"><Check size={16} /></span>
          </div>
          <div className="my-3 h-px" style={{ background: 'var(--gbd-line2)' }} />
          <div className="mb-2 text-[15px] font-medium" style={{ color: 'var(--gbd-ink)' }}>이렇게 써요</div>
          <ul className="m-0 p-0 list-none grid gap-2">
            {USE_STEPS.map(t => (
              <li key={t} className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--gbd-ink2)' }}>
                <Check size={16} className="text-brand-text shrink-0" />{t}
              </li>
            ))}
          </ul>
        </div>
        <div className="px-4 pt-3 pb-4" style={{ background: 'var(--gbd-chip)' }}>
          <div className="flex items-baseline flex-wrap gap-x-2">
            {refPrice > unitPrice && <span className="text-[13px] line-through" style={{ color: 'var(--gbd-sub)' }}>{formatNumber(refPrice)}원</span>}
            <span className="text-[24px] font-bold tracking-[-.02em]" style={{ color: 'var(--gbd-ink)' }}>{formatNumber(unitPrice)}원</span>
            {discountPct > 0 && <span className="text-[13px] font-medium" style={{ color: 'var(--sale)' }}>-{discountPct}%</span>}
          </div>
          <div className="mt-3 flex items-center gap-3">
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
        </div>
      </div>
    </section>
  )
}
