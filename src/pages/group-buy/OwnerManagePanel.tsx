/**
 * 🏪 2026-10-18 — 주인이 자기 이용권을 볼 때 구매 버튼 자리에 서는 것.
 *
 * 대표 신고: *"구매하기 버튼이 헷갈린다"* — 주인이 "30,000원 구매하기" 를 누르면 서버가
 * "본인의 공동구매 상품에는 참여할 수 없습니다" 로 막았다. 누를 수 없는 버튼을 보여 주고 누른 뒤에
 * 혼내는 것이 결함이다 ⇒ 처음부터 **할 수 있는 일**(관리)을 보여 준다.
 * PC 구매 상자(`DealPurchaseBox`)와 모바일 하단 바(`DealBottomBar`)가 같은 부품을 쓴다.
 * 2026-10-19: 숙소·쇼핑 상품 상세도 같은 부품을 쓴다(대표 *"숙소 및 쇼핑 상품에도 관리하기를 넣자"*) —
 *   문구만 `OWNER_PANEL_COPY` 에서 고른다. 색은 이용권 상세의 `--gbd-*` 가 없으면 사이트 토큰으로 떨어진다.
 */
export const OWNER_PANEL_COPY = {
  pass: { title: '내 가게 이용권이에요', sub: '주인은 구매할 수 없어요' },
  stay: { title: '내 숙소예요', sub: '주인은 예약할 수 없어요' },
  product: { title: '내 가게 상품이에요', sub: '주인은 구매할 수 없어요' },
} as const

export default function OwnerManagePanel({ onManage, compact = false, kind = 'pass' }: { onManage: () => void; compact?: boolean; kind?: keyof typeof OWNER_PANEL_COPY }) {
  const copy = OWNER_PANEL_COPY[kind]
  return (
    <div className={compact ? 'flex items-center gap-3' : 'mt-4'}>
      <div className={compact ? 'flex-1 min-w-0' : 'mb-3'}>
        <p className="text-[15px] font-bold" style={{ color: 'var(--gbd-ink, var(--ink))' }}>{copy.title}</p>
        <p className="text-[13px] mt-1" style={{ color: 'var(--gbd-sub, var(--ink-soft))' }}>{compact ? copy.sub : `${copy.sub}. 판매 현황은 관리에서 봐요.`}</p>
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
