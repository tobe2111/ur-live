/**
 * 🏨 숙소 이용권 '이용 방법' 문구 (2026-11-04 대표 *"이용 안내도 알려주고, 근데 숙소는 그냥 예약자 이름 숙소에다가 얘기하면 되려나?
 *  근데 그러면 사용 처리는 어떻게 하지?"*). 그림·움직임은 이용권 상세의 `RedeemHowTo` 그대로, 문구만 숙소 말로.
 *
 * 숙소 이용권은 **직원 스캔으로만** 쓴다(손님 셀프·확인코드 거절 — `stay-voucher-unify.ts` 불변식). 휴대폰이 없으면
 * 사장님이 예약 목록에서 이름으로 [체크인] 을 누르고, 그때 이용권도 같이 사용 처리·정산 기록된다
 * (`settleStayVoucherAfterManual` → `redeemVoucherForStore`). 그래서 갈래가 '확인코드' 가 아니라 '예약자 이름' 이다.
 */
export const STAY_STEPS: readonly { n: string; t: string; d: string }[] = [
  { n: '1', t: '체크인 QR 열기', d: '마이 → 내 숙소 예약' },
  { n: '2', t: '프런트에 보여주기', d: '직원이 스캔해요' },
  { n: '3', t: '체크인 완료', d: '따로 누를 건 없어요' },
]
export const STAY_FALLBACK_LABEL = '휴대폰이 없으면?'
export const STAY_REDEEM_FALLBACK = '예약자 이름을 말해도 돼요. 숙소가 예약 목록에서 확인해 체크인하면 사용 처리까지 끝나요.'
