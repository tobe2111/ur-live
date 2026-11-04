/**
 * 🏨 숙소 이용권 = 이용권과 같은 움직임·이용 안내 (2026-11-04)
 * 대표 *"기존 이용권 상세페이지처럼 모션그래픽들 설정된 것처럼 숙소 이용권에도 다 적용되어야하는거 아니야? 이용 안내도 알려주고,
 *  근데 숙소는 그냥 예약자 이름 숙소에다가 얘기하면 되려나? 근데 그러면 사용 처리는 어떻게 하지?"*
 *
 * 고정하는 것:
 *  ① 숙소 상세에 이용권과 같은 '이용 방법' 그림 셋(같은 부품 `RedeemHowTo`·같은 움직임), 숙소 말로
 *  ② 휴대폰이 없을 때의 길 = 예약자 이름 → 사장님 [체크인] 이 이용권 사용 처리까지 한다(거짓 안내가 아니게 서버 쪽도 본다)
 *  ③ 숙소 결제 완료 = 이용권과 같은 티켓(`PaymentCompleteTicket`, 금액 올라가는 움직임) — 서버가 상품 id 를 준다
 * ⚠️ 못 보는 것: 움직임이 실제로 보기 좋은지(그려서 본다) · 실결제 왕복.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
const read = (p: string) => readFileSync(p, 'utf-8')

describe('숙소 이용 방법 · 결제 완료 움직임', () => {
  it('① 상세에 이용권과 같은 이용 방법 부품(숙소판)', () => {
    const page = read('src/pages/StayDetailPage.tsx')
    expect(page).toContain('<RedeemHowTo steps={STAY_STEPS} fallbackLabel={STAY_FALLBACK_LABEL} fallback={STAY_REDEEM_FALLBACK} />')
    expect(read('src/pages/stay-detail/stay-howto.ts')).toContain("{ n: '2', t: '프런트에 보여주기', d: '직원이 스캔해요' }")
    expect(read('src/pages/group-buy/RedeemHowTo.tsx')).toContain('{steps.map(({ n, t, d }, i) => (')
  })
  it('② 예약자 이름 → 사장님 체크인이 이용권 사용 처리까지', () => {
    expect(read('src/pages/stay-detail/stay-howto.ts')).toContain('예약자 이름을 말해도 돼요')
    expect(read('src/features/seller/api/seller-stays.routes.ts')).toContain("if (targetStatus === 'checked_in') await (await import('../../group-buy/api/stay-voucher-unify')).settleStayVoucherAfterManual(")
    expect(read('src/features/group-buy/api/stay-voucher-unify.ts')).toContain("path: 'seller_scan', waitUntil: opts.waitUntil, stayAfterManual: true")
  })
  it('③ 결제 완료 = 이용권과 같은 티켓', () => {
    const ret = read('src/pages/StayCheckoutReturnPage.tsx')
    expect(ret).toContain('<PaymentCompleteTicket productId={done.productId} qty={done.rooms} amount={amountDone} stay={{ rooms: done.rooms }} />')
    expect(read('src/features/group-buy/api/stays-public.routes.ts')).toContain('order_id: orderId, product_id: firstClaimed.product_id,')
    const t = read('src/pages/group-buy/PaymentCompleteTicket.tsx')
    expect(t).toContain("navigate('/my-stays')}>체크인 QR 보기")
    expect(t).toContain('const pct = stay ? null :') // 숙소엔 상품 정가 기준 할인율이 맞지 않는다
  })
})
