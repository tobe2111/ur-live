/**
 * 🪙 **결제 화면에서 딜을 얼마나 쓸지 고른다** — 대표 확정 "C안" (2026-09-19)
 *
 * > *"나는 여기 페이지에서 딜 결제 내용 변경을 할 수 있으면 좋겠어. 지금은 이용권 상세페이지에다가
 * >  해뒀더만, 원래는 여기서 포인트 사용을 하듯이 원래 하잖아 다른 사이트들도."*
 *
 * ## 왜 독립 카드인가 (C안)
 * 요약 카드 안에 욱여넣으면(A안) 그 카드가 *보여 주는 곳*이자 *고치는 곳*이 되어 역할이 섞인다.
 * 쿠팡·네이버가 쓰는 모양대로 **'딜 사용' 을 자기 카드로** 세우고, 요약 카드는 결과만 읽는다.
 *
 * ## 🔒 숫자는 전부 서버가 준 것이다
 * 잔액도 상한도 화면이 계산하지 않는다 — `deal-plan` 이 계산한 `max_deal_usable` 이 쿼리로 실려 와
 * 그대로 상한이 된다. 이 레포가 이미 값을 치른 규칙이다(2026-09-04):
 * *"화면이 잔액으로 추정하면 게이트가 꺼진 순간 그 안내가 거짓말이 된다."*
 * 서버가 0 을 주면 **이 카드는 아예 안 뜬다** — 없는 선택지를 그리지 않는다.
 *
 * ## 왜 '전액'이 총액이 아닌가
 * 카드로 최소 `MIN_CARD_AMOUNT`(100원)는 나가야 한다 — 0원 결제는 PG 가 거절한다.
 * 딜로 **전부** 내는 것은 부분결제가 아니라 다른 흐름(`/join` payment_method='deal')이고,
 * 그 버튼은 이용권 상세의 `DealPayButton` 이 잔액이 충분할 때만 따로 낸다.
 * 그래서 여기 '전액 사용'은 *이 결제에서 쓸 수 있는 최대*를 뜻한다.
 *
 * ## ⚠️ 이 부품이 하지 않는 것
 *   - 돈을 움직이지 않는다. 고른 값은 **카드 청구액**으로만 바뀌고, 실제 딜 차감은 승인 뒤
 *     서버가 `청구액 = 총액 − 딜` 로 역산해(`derivePartialDeal`) 게이트·최소카드액·잔액을
 *     다시 본 다음 원자 CAS 로 뺀다. 여기 값이 위조돼도 서버가 거절한다.
 */
import { MIN_CARD_AMOUNT } from '@/shared/pay-summary'

export interface DealUseCardProps {
  /** 상품 총액(원) = 카드 청구액 + 딜 사용액. 결제 시작 시 서버가 정한 값. */
  goodsAmount: number
  /** 이 결제에서 딜로 쓸 수 있는 최대(원) — 서버 `max_deal_usable`. */
  dealMax: number
  /** 지금 고른 딜(원). */
  value: number
  onChange: (next: number) => void
  /** 위젯이 준비되기 전엔 못 바꾼다(금액을 다시 넘길 상대가 아직 없다). */
  disabled?: boolean
}

/** 이 결제에서 딜로 낼 수 있는 상한 — 서버 상한과 최소 카드액 중 더 빡빡한 쪽. */
export function dealUseCap(goodsAmount: number, dealMax: number): number {
  const byCard = Math.max(0, Math.round(goodsAmount) - MIN_CARD_AMOUNT)
  return Math.max(0, Math.min(Math.floor(dealMax), byCard))
}

/** 입력값을 0..cap 으로 정규화한다(숫자 아닌 글자는 버린다). */
export function clampDealUse(raw: string | number, cap: number): number {
  const digits = typeof raw === 'number' ? String(raw) : String(raw).replace(/[^0-9]/g, '')
  const n = Math.floor(Number(digits) || 0)
  return Math.max(0, Math.min(cap, n))
}

export default function DealUseCard({ goodsAmount, dealMax, value, onChange, disabled }: DealUseCardProps) {
  const cap = dealUseCap(goodsAmount, dealMax)
  // 서버가 쓸 딜이 없다고 했으면(게이트 OFF·잔액 0·총액이 최소카드액뿐) 아무것도 그리지 않는다.
  if (cap <= 0) return null

  const used = clampDealUse(value, cap)
  const atMax = used === cap

  return (
    <section className="bg-surface rounded-2xl shadow-lift p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-ink">딜 사용</h2>
        <span className="text-[11.5px] text-ink-faint">
          최대 <span className="font-bold text-brand-text">{cap.toLocaleString('ko-KR')}</span>딜
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <label htmlFor="deal-use-input" className="sr-only">사용할 딜</label>
        <input
          id="deal-use-input"
          type="text"
          inputMode="numeric"
          value={used === 0 ? '' : String(used)}
          placeholder="0"
          disabled={disabled}
          onChange={(e) => onChange(clampDealUse(e.target.value, cap))}
          className="flex-1 min-w-0 h-12 px-3.5 rounded-xl bg-warm border border-line text-right text-[17px] font-bold tabular-nums text-ink disabled:opacity-50"
        />
        <span className="text-[13px] text-ink-soft">딜</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(atMax ? 0 : cap)}
          className={`shrink-0 h-12 px-4 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 ${
            atMax
              ? 'bg-warm border border-line text-ink-soft'
              : 'bg-brand hover:bg-brand-dark text-white'
          }`}
        >
          {atMax ? '사용 안 함' : '전액 사용'}
        </button>
      </div>

      <p className="mt-2.5 text-[11.5px] text-ink-faint">
        카드로 최소 {MIN_CARD_AMOUNT.toLocaleString('ko-KR')}원은 결제돼요. 남은 금액만 카드로 청구됩니다.
      </p>
    </section>
  )
}
