/**
 * 🏪 2026-10-18 — 주인이 자기 이용권을 볼 때 구매 버튼 자리에 서는 것.
 *
 * 대표 신고: *"구매하기 버튼이 헷갈린다"* — 주인이 "30,000원 구매하기" 를 누르면 서버가
 * "본인의 공동구매 상품에는 참여할 수 없습니다" 로 막았다. 누를 수 없는 버튼을 보여 주고 누른 뒤에
 * 혼내는 것이 결함이다 ⇒ 처음부터 **할 수 있는 일**(관리)을 보여 준다.
 * PC 구매 상자(`DealPurchaseBox`)와 모바일 하단 바(`DealBottomBar`)가 같은 부품을 쓴다.
 */
export default function OwnerManagePanel({ onManage, compact = false }: { onManage: () => void; compact?: boolean }) {
  return (
    <div className={compact ? 'flex items-center gap-3' : 'mt-4'}>
      <div className={compact ? 'flex-1 min-w-0' : 'mb-3'}>
        <p className="text-[15px] font-bold" style={{ color: 'var(--gbd-ink)' }}>내 가게 이용권이에요</p>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--gbd-sub)' }}>{compact ? '주인은 구매할 수 없어요' : '주인은 구매할 수 없어요. 판매·사용 현황은 관리에서 봐요.'}</p>
      </div>
      <button
        type="button"
        onClick={onManage}
        className={`${compact ? 'shrink-0 px-5' : 'w-full'} h-[52px] border-0 rounded-xl text-[15px] font-bold bg-brand text-white cursor-pointer`}
      >
        관리하기
      </button>
    </div>
  )
}
