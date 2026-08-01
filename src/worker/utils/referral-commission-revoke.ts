/**
 * 💸 주문 환불/취소 시 추천 커미션 회수 — `order.routes` 에서 추출(2026-08-01).
 *
 * 라우트 안에 있던 머니 로직을 옮겼다. 옮긴 이유는 두 가지다:
 *   ① 라우트 파일이 이미 god 파일이라 여기에 한 줄 더 얹는 게 반복됐다
 *   ② 이 블록은 **CAS + 잔액 + 원장**이 한 세트로 맞아야 하는 코드다 — 한자리에 모여 있어야 읽힌다
 *
 * ## 이 함수가 지키는 것
 *   1. **CAS 선점 후 차감** — `status='granted'` → `'withdrawn'` 이 성공한 건만 잔액을 줄인다.
 *      (동시 요청/재시도가 같은 커미션을 두 번 회수하지 못한다. 머니 룰 #1)
 *   2. **잔액과 원장을 함께** — 잔액만 줄이면 `잔액 < 거래합` 이 되어 정합 검사가 영구 불일치로 잡는다.
 *      2026-08-01 전수조사에서 여기가 정확히 그 상태였고, 라이브 user 3(차이 −22,480)의 유력한 출처다.
 *
 * ⚠️ 미성숙(pending) 커미션은 **잔액에 적립된 적이 없으므로** 여기서 건드리지 않는다 —
 *    상태만 닫는 것은 호출부(성숙 cron 과의 이중 안전망)가 계속 담당한다.
 */
import { recordPointTransaction } from './point-ledger'

interface RevokeRow { id: number; beneficiary_id: string; commission_amount: number }

/**
 * @returns 실제로 회수된 건수(CAS 를 이긴 것만).
 */
export async function revokeReferralCommissionsForOrder(
  DB: D1Database,
  orderId: string | number,
  onError?: (e: unknown) => void,
): Promise<number> {
  const revokeTs = new Date().toISOString()
  // 🛡️ 2026-06-01 머니플로우 감사 fix: 잘못된 컬럼(user_id/amount)으로 항상 0건 매칭 →
  //   회수가 조용히 무효였다. 실제 스키마 컬럼(beneficiary_id/commission_amount)으로 정정된 상태.
  const toRevoke = await DB.prepare(
    "SELECT id, beneficiary_id, commission_amount FROM referral_commissions WHERE order_id = ? AND status = 'granted'",
  ).bind(orderId).all<RevokeRow>().catch(() => ({ results: [] as RevokeRow[] }))

  let revoked = 0
  for (const co of toRevoke.results || []) {
    const cas = await DB.prepare(
      "UPDATE referral_commissions SET status = 'withdrawn', withdrawn_at = ? WHERE id = ? AND status = 'granted'",
    ).bind(revokeTs, co.id).run().catch(() => null)
    // CAS 를 이긴 요청만 잔액을 건드린다(다른 요청이 이미 처리했으면 skip).
    if (!cas || (cas.meta?.changes ?? 0) === 0) continue

    const amount = Math.abs(Number(co.commission_amount) || 0)
    await DB.prepare('UPDATE user_points SET balance = MAX(0, balance - ?) WHERE user_id = ?')
      .bind(amount, co.beneficiary_id).run().catch(onError)
    await recordPointTransaction(DB, {
      userId: co.beneficiary_id,
      delta: -amount,
      type: 'referral_commission_revoked',
      description: '주문 취소 — 추천 커미션 회수',
      orderId: String(orderId),
    }).catch(onError)
    revoked++
  }
  return revoked
}
