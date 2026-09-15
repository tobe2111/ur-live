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
 */
import { formatNumber } from '@/utils/format'
import DealUseChooser from './DealUseChooser'
import DealPayButton from './DealPayButton'
import AddToCartButton from './AddToCartButton'
import type { DealPlan } from './DealUseChooser'

export default function DealBottomBar({
  isJoinable, isPrelaunch, isDemoDeal, buyable, joining,
  quantity, total, unitSaving, totalSaving, minReviewLevel,
  dealPlan, dealUse, setDealUse, canPayWithDeal, dealBalance,
  productId, onJoin,
}: {
  isJoinable: boolean
  isPrelaunch: boolean
  isDemoDeal: boolean
  buyable: boolean
  joining: boolean
  quantity: number
  total: number
  unitSaving: number
  totalSaving: number
  minReviewLevel?: number | null
  dealPlan: DealPlan | null
  dealUse: number | null
  setDealUse: (v: number) => void
  canPayWithDeal: boolean
  dealBalance: number
  /** 장바구니 담기에 쓴다. 사전 응모(prelaunch)나 구매 불가 상태에선 버튼이 안 뜬다. */
  productId: number
  onJoin: (withDeal?: boolean) => void
}) {
  return (
    <>
    {/* 🎨 2026-06-16 리디자인 결제 푸터 — 할인중 + 수량 스테퍼 + 안심 카피 + 잉크블랙 '구매하기'.
          fixed (BottomNav z-9999 위). gbd 자손이라 var() 상속.
          🖥️ 2026-07-19 (그루폰식): PC(lg+)는 우측 sticky DealPurchaseBox 가 담당 → 이 바는 모바일 전용. */}
    <footer
      className="fixed bottom-0 inset-x-0 z-[10002] lg:hidden"
      role="contentinfo" aria-label="결제 영역"
    >
    <div
      style={{ background: 'var(--gbd-card)', borderTop: '1px solid var(--gbd-line2)', padding: '7px 16px calc(8px + env(safe-area-inset-bottom))', boxShadow: '0 -8px 30px -18px rgba(0,0,0,.3)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gbd-ink2)', whiteSpace: 'nowrap' }}>
            {isJoinable && totalSaving > 0 ? (quantity > 1 ? `총 ${formatNumber(totalSaving)}원 할인 중` : `${formatNumber(unitSaving)}원 할인 중`) : ''}
          </span>
          {/* 🗺️ 2026-07-02 카카오맵 리뷰 게이미피케이션 — 레벨 전용 이용권 배지 (서버 게이트의 UX 안내) */}
          {minReviewLevel && minReviewLevel > 1 ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gbd-ink)', whiteSpace: 'nowrap' }}>동네 리뷰어 Lv.{minReviewLevel} 전용</span>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 6 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gbd-sub)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
        <span style={{ fontSize: 11.5, color: 'var(--gbd-sub)', fontWeight: 500, whiteSpace: 'nowrap' }}>{isPrelaunch ? '오픈 협의 중 매장 · 응모는 무료, 오픈 시 알림을 드려요' : '토스로 3초 안전결제 · 미사용 시 100% 자동환불'}</span>
      </div>
      {/* 조건은 호출부가 이미 걸어서 넘긴다(`dealPlan` prop) — 여기서 또 걸면 두 곳이 갈린다. */}
      <DealUseChooser plan={dealPlan} value={dealUse ?? dealPlan?.max_deal_usable ?? 0} onChange={setDealUse} />
      <button
        onClick={isPrelaunch ? () => document.getElementById('fcfs-apply-block')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : () => onJoin()}
        disabled={(!isJoinable && !isPrelaunch) || joining}
        aria-label={isPrelaunch ? '사전 응모하기' : isJoinable ? `${formatNumber(total)}원 ${isDemoDeal ? '결제하기' : '구매하기'}` : isDemoDeal ? '결제 불가' : '구매 불가'}
        style={{ width: '100%', height: 50, border: 'none', borderRadius: 14, background: (buyable || isPrelaunch) ? 'var(--gbd-cta-bg)' : 'var(--gbd-sub2)', color: 'var(--gbd-cta-fg)', fontSize: 16, fontWeight: 800, letterSpacing: '-.01em', cursor: (buyable || isPrelaunch) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
      >
        {joining ? '처리 중…' : isPrelaunch ? '사전 응모하기' : !isJoinable ? (isDemoDeal ? '결제 불가' : '구매 불가') : <>{formatNumber(total)}원 {isDemoDeal ? '결제하기' : '구매하기'}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></>}
      </button>
      <DealPayButton show={canPayWithDeal && !isPrelaunch && isJoinable} joining={joining} dealBalance={dealBalance} onPay={() => onJoin(true)} />
      {/* 🧺 2026-09-15 담기 — 결제 버튼 **아래**에 둔다. 위에 두면 주 행동이 둘로 보인다. */}
      <AddToCartButton productId={productId} qty={quantity} show={isJoinable && !isPrelaunch} />
    </div>{/* /bar box */}
    </footer>
    </>
  )
}
