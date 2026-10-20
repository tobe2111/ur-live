/**
 * 🪙 **딜을 얼마나 쓸지 고른다** — 대표 신고 2026-09-13
 *   *"딜을 쓰고 결제할지, 딜 일부만 쓰고 결제할지 등 선택도 안돼."*
 *
 * ## 종전에 무슨 일이 일어나고 있었나
 * 부분결제 게이트는 켜져 있었고(라이브 `voucher_partial_deal_enabled=true`) 서버는 **말없이
 * 가진 딜을 최대한** 카드 청구액에서 뺐다. 사용자는 고를 수 없었고, 그 사실을 **결제창에 가서야**
 * 알았다(16,500원짜리를 눌렀는데 5,300원이 떠 있다). 고를 수 없는 것도 문제지만,
 * **말 안 하고 내 돈을 쓰는 것**이 더 문제다.
 *
 * ## 왜 접힌 한 줄인가 (구매 버튼 **위**에)
 * 처음엔 세 버튼을 항상 펼쳐 CTA 아래에 뒀는데, 두 가지가 틀렸다.
 * ① 모바일 결제 바는 `fixed bottom-0` 이라 **모든 방문자에게 영구히 130px** 를 먹고
 *    (딜이 없는 사람에게도), ② 고르는 자리가 **누르는 버튼 아래**에 있으면 순서가 거꾸로다.
 * ⇒ 기본은 *"딜 11,200 · 카드 5,300원"* 한 줄(≈34px) + `변경`. 그 한 줄이 **누르기 전에**
 *   무슨 일이 일어날지 이미 말해 주므로, 펼치지 않아도 "말 안 하고 쓰는" 문제는 사라진다.
 *
 * ## 🔒 숫자는 전부 서버가 준 것이다
 * 이 레포가 이미 값을 치른 규칙이다(2026-09-04 audit log): *"화면이 잔액으로 추정하면
 * 게이트가 꺼진 순간 그 안내가 거짓말이 된다."* 그래서 잔액·상한·총액을 화면이 계산하지 않고
 * `GET /api/group-buy/deal-plan/:productId` 가 준 값만 쓴다. 게이트가 꺼져 있으면 `enabled=false`
 * 가 와서 **이 블록이 통째로 안 뜬다** — 없는 선택지를 그리지 않는다.
 *
 * ## '전부 딜로' 는 **여기** 있다 (2026-10-06 대표 — 종전 판단을 뒤집는다)
 * 대표: *"오롯이 100%로 딜로 이용권을 구매할 수 있어야 한다는거야."*
 * 종전엔 전부-딜을 형제 `DealPayButton`(주 버튼 **아래** 테두리 버튼)이 따로 냈고, 이 칸은 일부러 그걸
 * 안 냈다("같은 뜻의 버튼이 둘"). 그 결과: 딜이 충분한 사람도 기본값(최대 = 총액 − 카드최소 100원)을
 * 따라 큰 버튼을 누르면 **카드 100원이 붙었다**(라이브 주문 90: 7,500 = 딜 7,400 + 카드 100,
 * 구매 전 잔액 12,100). 부분결제는 `MIN_CARD_AMOUNT` 때문에 **구조적으로 100% 에 도달하지 못한다** —
 * 0원 카드 결제는 PG 가 거절한다. 그리고 PC 구매 박스에는 그 보조 버튼조차 없었다.
 * ⇒ 한 결정(딜을 얼마나 쓰나)은 한 칸에서 한다: 다 덮을 수 있으면 **[전부 딜로] 가 기본**이고,
 *   그 선택이면 카드를 아예 안 타는 흐름(`payment_method='deal'`)으로 간다(`coversAll` 이 판정).
 *   이제 `DealPayButton` 은 이 칸이 안 뜰 때(부분결제 게이트 OFF)의 대체물로만 남는다.
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'

export interface DealPlan {
  enabled: boolean
  balance: number
  total_amount: number
  max_deal_usable: number
  default_deal_used: number
  default_card_amount: number
  can_pay_all_with_deal: boolean
  min_card_amount: number
}

/**
 * 결제 시작 전 딜 계획을 서버에서 읽는다. 로그인 안 했거나 상품/수량이 없으면 부르지 않는다.
 * 실패는 **조용히 없음**으로 둔다 — 조회가 안 된다고 구매를 막으면 그게 더 큰 손해다.
 */
/** 아무것도 안 고른 사람의 딜 사용액 — 다 덮을 수 있으면 **전부**(카드 0원), 아니면 최대(총액 − 카드최소). */
export function defaultDealUse(plan: DealPlan | null): number {
  if (!plan || !plan.enabled) return 0
  return plan.can_pay_all_with_deal ? plan.total_amount : plan.max_deal_usable
}

/** 고른 딜이 총액을 다 덮는가 — 그러면 부분결제가 아니라 카드를 안 타는 **전부-딜** 흐름이다. */
export function coversAll(plan: DealPlan | null, dealUse: number | null): boolean {
  if (!plan || !plan.enabled || !plan.can_pay_all_with_deal || plan.total_amount <= 0) return false
  return (dealUse ?? defaultDealUse(plan)) >= plan.total_amount
}

export function useDealPlan(opts: { productId: number; qty: number; enabled: boolean }): DealPlan | null {
  const [plan, setPlan] = useState<DealPlan | null>(null)
  const { productId, qty, enabled } = opts
  useEffect(() => {
    if (!enabled || !productId || qty < 1) { setPlan(null); return }
    let alive = true
    api.get(`/api/group-buy/deal-plan/${productId}?qty=${qty}`)
      .then((r) => { if (alive && r.data?.success) setPlan(r.data.data as DealPlan) })
      .catch(() => { if (alive) setPlan(null) })
    return () => { alive = false }
  }, [productId, qty, enabled])
  return plan
}

type Mode = 'all' | 'max' | 'part' | 'none'

export default function DealUseChooser({ plan, value, onChange }: {
  plan: DealPlan | null
  /** 이 결제에서 딜로 낼 금액. `/join` 의 `deal_use` 로 그대로 간다. */
  value: number
  onChange: (dealUse: number) => void
}) {
  const [mode, setMode] = useState<Mode | null>(null)
  const [open, setOpen] = useState(false)

  // 게이트가 꺼졌거나 쓸 딜이 없으면 아무것도 그리지 않는다.
  if (!plan || !plan.enabled || plan.max_deal_usable <= 0) return null

  const max = plan.max_deal_usable
  const canAll = plan.can_pay_all_with_deal
  // 전부-딜이면 상한이 총액이다(카드를 안 타므로 카드최소액이 없다). 직접 입력은 여전히 부분결제 상한까지.
  const all = coversAll(plan, value)
  const used = all ? plan.total_amount : Math.min(Math.max(0, value), max)
  const card = Math.max(0, plan.total_amount - used)
  // 고른 적이 없으면 값에서 모드를 읽는다 — 기본값(전부/최대)이 버튼에 그대로 켜져 보이게.
  const current: Mode = mode ?? (all ? 'all' : used === 0 ? 'none' : used === max ? 'max' : 'part')

  const pick = (m: Mode) => {
    setMode(m)
    onChange(m === 'all' ? plan.total_amount : m === 'max' ? max : m === 'none' ? 0 : Math.min(value || max, max))
  }

  const btn = (m: Mode, label: string) => (
    <button
      key={m}
      type="button"
      onClick={() => pick(m)}
      aria-pressed={current === m}
      style={{
        flex: 1, height: 36, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
        border: 'none',
        background: current === m ? 'var(--gbd-cta-bg)' : 'var(--gbd-chip-bg, rgba(127,127,127,.10))',
        color: current === m ? 'var(--gbd-cta-fg, #fff)' : 'var(--gbd-text, var(--gbd-ink))',
      }}
    >{label}</button>
  )

  return (
    <div style={{ marginBottom: 8 }}>
      {/* 접혀 있어도 결과를 못 박는다 — 결제창에 가서야 알게 되는 일이 없도록. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 30 }}>
        <span style={{ flex: 1, fontSize: 12.5, color: 'var(--gbd-sub)', letterSpacing: '-.01em' }}>
          {all
            ? <>딜 <b style={{ color: 'var(--gbd-ink)' }}>{formatNumber(used)}</b>으로 전부 결제</>
            : <>딜 <b style={{ color: 'var(--gbd-ink)' }}>{formatNumber(used)}</b>{' · '}카드 <b style={{ color: 'var(--gbd-ink)' }}>{formatNumber(card)}원</b></>}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{
            border: 'none', background: 'none', padding: '2px 0', cursor: 'pointer',
            fontSize: 12.5, fontWeight: 700, color: 'var(--gbd-ink)', textDecoration: 'underline',
          }}
        >{open ? '접기' : '변경'}</button>
      </div>

      {open && (
        <div style={{ marginTop: 6, padding: 10, borderRadius: 12, background: 'var(--gbd-chip-bg, rgba(127,127,127,.07))' }}>
          <p style={{ fontSize: 12, color: 'var(--gbd-sub)', margin: '0 0 8px' }}>
            보유 딜 {formatNumber(plan.balance)}딜{canAll ? ', 전부 딜로 낼 수 있어요' : `, 이 결제엔 최대 ${formatNumber(max)}딜까지`}
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            {canAll ? btn('all', '전부 딜로') : btn('max', '최대로 쓰기')}
            {btn('part', '직접 입력')}
            {btn('none', '안 쓰기')}
          </div>
          {current === 'part' && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number" inputMode="numeric" min={0} max={max}
                value={String(used)}
                onChange={(e) => onChange(Math.max(0, Math.min(max, Math.floor(Number(e.target.value) || 0))))}
                aria-label="사용할 딜 금액"
                style={{ flex: 1, height: 36, borderRadius: 10, border: 'none', background: 'var(--gbd-card)', color: 'var(--gbd-ink)', padding: '0 10px', fontSize: 14, fontWeight: 700 }}
              />
              <span style={{ fontSize: 13, color: 'var(--gbd-sub)' }}>딜</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
