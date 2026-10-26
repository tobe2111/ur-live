/**
 * 🎟️ 공구 상세 하단 결제 바 (2026-09-15 추출 — 로직 불변)
 *
 * ## 왜 뺐나
 * `GroupBuyDetailPage.tsx` 가 **파일크기 동결선(944)에 붙어 있었다.** 장바구니 '담기' 버튼을
 * 넣을 자리가 한 줄도 없었고, 규칙이 말하는 처방은 주석 깎기가 아니라 **분리**다.
 * 이 블록은 상태를 만들지 않고 받은 값을 그리기만 해서 가장 깨끗하게 떨어진다.
 *
 * ## 옮기면서 지킨 것
 * **마크업·스타일·조건 전부 그대로다.** 바뀐 것은 ① 들여쓰기 ② `detail?.min_review_level` 을
 * prop 으로 받는 것 ③ 맨 아래 '담기' 한 줄뿐이다. z-index(10002 — BottomNav z-9999 위)·
 * `lg:hidden`(PC 는 우측 sticky 박스가 담당)·safe-area 패딩은 손대지 않았다.
 *
 * ## 2026-10-11 — [가격][구매하기] 바 + **구매 창** (대표 확정 "D안")
 * 바에는 금액과 버튼 하나만 둔다. 구매하기를 누르면 아래에서 창이 올라와 **수량 · 딜 사용 · 결제**를
 * 고른다(큰 쇼핑 앱들이 옵션을 다루는 방식). 수량 카드가 본문 한가운데를 차지하던 것을 여기로 옮겼다.
 * ⚠️ 결제 로직은 그대로다 — 창 안의 결제 버튼이 종전과 **같은** `onJoin` 을 같은 조건으로 부른다.
 *   사전 응모·구매 불가는 창을 열지 않는다(종전 동작 그대로).
 */
import { useFcfsDetail } from '@/features/group-buy/useFcfsDetail'
import { useEffect, useState } from 'react'
import { formatNumber } from '@/utils/format'
import { Z } from '@/constants/z-index'
import { FieldCard, FieldRow } from '@/components/ticket/FieldCard'
import DealUseChooser, { coversAll, defaultDealUse } from './DealUseChooser'
import DealPayButton from './DealPayButton'
import AddToCartButton from './AddToCartButton'
import { VOUCHER_CART_UI_ENABLED } from '@/shared/feature-flags'
import type { DealPlan } from './DealUseChooser'
import OwnerManagePanel from './OwnerManagePanel'
import { BuyBarFrame, BuyBarPrice, BuyBarCta } from '@/components/deal/BuyBar'
import { useAgentHandoff } from './useAgentHandoff'

const arrow = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>

export default function DealBottomBar({
  isJoinable, isPrelaunch, buyable, joining,
  quantity, total, setQuantity, maxQty, maxPerPerson, unitPrice, refPrice, discountPct, minReviewLevel,
  dealPlan, dealUse, setDealUse, canPayWithDeal, dealBalance,
  productId, onJoin, isOwner = false, onManage,
}: {
  isJoinable: boolean
  isPrelaunch: boolean
  buyable: boolean
  joining: boolean
  quantity: number
  total: number
  setQuantity: (fn: (q: number) => number) => void
  maxQty: number
  maxPerPerson?: number | null
  unitPrice: number
  refPrice: number
  discountPct: number
  minReviewLevel?: number | null
  dealPlan: DealPlan | null
  dealUse: number | null
  setDealUse: (v: number) => void
  canPayWithDeal: boolean
  dealBalance: number
  /** 장바구니 담기에 쓴다. 사전 응모(prelaunch)나 구매 불가 상태에선 버튼이 안 뜬다. */
  productId: number
  onJoin: (withDeal?: boolean) => void
  /** 👤 2026-10-18: 주인이면 바가 [구매하기] 대신 [관리하기] 를 낸다 — 누르면 혼나는 버튼을 안 보인다. */
  isOwner?: boolean
  onManage?: () => void
}) {
  const [open, setOpen] = useState(false)
  // 구매가 불가능해지면(품절 등) 열린 창을 닫는다 — 누를 수 없는 결제 버튼만 남지 않게.
  useEffect(() => { if (!isJoinable) setOpen(false) }, [isJoinable])
  // 🛒 2026-10-20: AI 비서가 건넨 결제 링크면 그 수량으로 창을 연다(결제는 손님이 누른다).
  const fromAgent = useAgentHandoff({ ready: isJoinable && buyable && !isPrelaunch && !isOwner, maxQty, setQuantity, setOpen })
  // 🪙 2026-10-06: 딜이 총액을 다 덮으면 카드를 안 탄다 — 버튼도 그렇게 말한다("N딜로 결제하기").
  const allDeal = canPayWithDeal && coversAll(dealPlan, dealUse)
  // 🎭 2026-10-12 (대표 "데모인 것을 티내지마"): 데모만 '결제하기'·'결제 불가' 를 쓰던 분기 제거 —
  //   라벨만 보고 데모를 판별할 수 있었다. 사유·대체 보호는 `DealPurchaseBox` 머리말에 적었다.
  const verb = '구매하기'
  const payLabel = allDeal ? `${formatNumber(total)}딜로 결제하기` : `${formatNumber(total)}원 ${verb}`
  // 🎯 2026-10-27 (대표 "구매하기 보다 응모하기 … 결제하기 눌렀더니 당첨자만 구매할 수 있다고 뜨고 있어"):
  //   추첨 상품이면 당첨자가 아닌 손님에게 결제 창 대신 **응모**를 한다. 상태는 응모 칸과 공유.
  const fcfs = useFcfsDetail(productId)
  const raffle = fcfs.gate && !isPrelaunch && !isOwner
  const ctaOn = raffle ? !(fcfs.applied || fcfs.closed) : buyable || isPrelaunch
  const stepBtn = 'w-9 h-9 rounded-full flex items-center justify-center text-[17px] bg-transparent cursor-pointer disabled:opacity-40'

  return (
    <>
    {/* 📱 모바일 전용 하단 바 — PC 는 우측 sticky `DealPurchaseBox`. z 10002 = BottomNav(9999) 위. */}
    <BuyBarFrame>
        {/* 🗺️ 레벨 전용 배지(서버 게이트의 UX 안내)는 그 자체가 정보라 남긴다 — 값이 있을 때만. */}
        {minReviewLevel && minReviewLevel > 1 ? (
          <div className="mb-2 text-[12px] font-medium whitespace-nowrap" style={{ color: 'var(--gbd-ink)' }}>동네 리뷰어 Lv.{minReviewLevel} 전용</div>
        ) : null}
        {isOwner && onManage ? <OwnerManagePanel onManage={onManage} compact /> : (
        <div className="flex items-center gap-3">
          {!isPrelaunch && <BuyBarPrice strike={refPrice > unitPrice ? refPrice * quantity : null} discountPct={discountPct} amount={total} />}
          <BuyBarCta
            on={ctaOn}
            onClick={raffle ? fcfs.apply : isPrelaunch ? () => document.getElementById('fcfs-apply-block')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : () => setOpen(true)}
            disabled={raffle ? !ctaOn || fcfs.busy : (!isJoinable && !isPrelaunch) || joining}
            aria-haspopup={raffle || isPrelaunch ? undefined : 'dialog'}
          >
            {raffle ? fcfs.ctaLabel : joining ? '처리 중…' : isPrelaunch ? '사전 응모하기' : !isJoinable ? '구매 불가' : verb}
          </BuyBarCta>
        </div>
        )}
    </BuyBarFrame>

    {/* 🧾 구매 창 — 수량 · 딜 사용 · 결제. 결제 버튼은 종전 바의 버튼과 같은 onJoin 을 부른다. */}
    {open && !isPrelaunch && !isOwner && !raffle && (
      <div className="fixed inset-0 lg:hidden" style={{ zIndex: Z.SHEET_BACKDROP }} role="dialog" aria-modal="true" aria-label="구매 옵션">
        <button type="button" aria-label="닫기" onClick={() => setOpen(false)} className="absolute inset-0 w-full h-full border-0 cursor-default" style={{ background: 'rgba(22,24,28,.45)' }} />
        <div className="absolute inset-x-0 bottom-0 rounded-t-3xl" style={{ zIndex: Z.SHEET_BODY, background: 'var(--gbd-bg)', padding: '12px 16px calc(16px + env(safe-area-inset-bottom))' }}>
          <div aria-hidden className="mx-auto mb-4 w-9 h-1 rounded-full" style={{ background: 'var(--gbd-line2)' }} />
          {fromAgent && <p className="mb-3 px-1 text-[13px]" style={{ color: 'var(--gbd-sub)' }}>AI 비서가 고른 수량이에요. 확인하고 결제해 주세요.</p>}
          <FieldCard>
            <FieldRow
              label="수량"
              value={`${quantity}장`}
              hint={maxPerPerson && maxPerPerson > 0 ? `1인당 최대 ${maxPerPerson}개` : undefined}
              right={(
                <span className="flex items-center gap-1" role="group" aria-label="수량 조절">
                  <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={!buyable || quantity <= 1} aria-label="수량 감소" className={stepBtn} style={{ border: '1px solid var(--rule-strong)', color: 'var(--gbd-ink)' }}>−</button>
                  <span className="min-w-[32px] text-center text-[15px] font-medium" style={{ color: 'var(--gbd-ink)' }} aria-live="polite" aria-label={`현재 ${quantity}장`}>{quantity}</span>
                  <button type="button" onClick={() => setQuantity(q => Math.min(maxQty, q + 1))} disabled={!buyable || quantity >= maxQty} aria-label="수량 증가" className={stepBtn} style={{ border: '1px solid var(--rule-strong)', color: 'var(--gbd-ink)' }}>+</button>
                </span>
              )}
            />
          </FieldCard>
          {/* 조건은 호출부가 이미 걸어서 넘긴다(`dealPlan` prop) — 여기서 또 걸면 두 곳이 갈린다. */}
          <div className="mt-3"><DealUseChooser plan={dealPlan} value={dealUse ?? defaultDealUse(dealPlan)} onChange={setDealUse} /></div>
          <div className="mt-4 flex items-baseline justify-between px-1">
            <span className="text-[15px]" style={{ color: 'var(--gbd-ink2)' }}>총 결제 금액</span>
            <span className="text-[24px] font-bold tracking-[-.02em]" style={{ color: 'var(--gbd-ink)' }}>{formatNumber(total)}{allDeal ? '딜' : '원'}</span>
          </div>
          <div className="mt-3 mb-2 flex items-center justify-center gap-1 text-[12px]" style={{ color: 'var(--gbd-sub)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            토스로 3초 안전결제 · 미사용 시 100% 자동환불
          </div>
          <button
            onClick={() => onJoin()}
            disabled={!isJoinable || joining}
            aria-label={isJoinable ? payLabel : '구매 불가'}
            className="w-full h-[52px] border-0 rounded-xl text-[17px] font-bold flex items-center justify-center gap-2"
            style={{ background: buyable ? 'var(--gbd-cta-bg)' : 'var(--gbd-sub2)', color: 'var(--gbd-cta-fg)', cursor: buyable ? 'pointer' : 'default' }}
          >
            {joining ? '처리 중…' : <>{payLabel}{arrow}</>}
          </button>
          {/* 대체물 — 위 고르는 칸이 [전부 딜로] 를 이미 내면 같은 뜻의 버튼을 또 내지 않는다(칸이 안 뜰 때만). */}
          <DealPayButton show={canPayWithDeal && !isPrelaunch && isJoinable && !dealPlan?.can_pay_all_with_deal} joining={joining} dealBalance={dealBalance} onPay={() => onJoin(true)} />
          {/* 🧺 2026-09-15 담기 — 결제 버튼 **아래**에 둔다. 위에 두면 주 행동이 둘로 보인다. */}
          <AddToCartButton productId={productId} qty={quantity} show={VOUCHER_CART_UI_ENABLED && isJoinable && !isPrelaunch} />
        </div>
      </div>
    )}
    </>
  )
}
