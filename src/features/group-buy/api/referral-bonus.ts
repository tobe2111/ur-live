/**
 * 💸 공구 참여 시 추천 보너스(양쪽 0.5%) — `group-buy.routes` 에서 추출(2026-08-02).
 *
 * 옮긴 이유는 `referral-commission-revoke.ts` 와 같다: **CAS 없이 잔액과 원장이 한 세트로 맞아야 하는
 * 코드**라 한자리에 모여 있어야 읽힌다. 라우트 파일은 이미 god 파일이고, 여기에 한 줄 더 얹는 게 반복됐다.
 *
 * ## 이 함수가 지키는 것
 *
 * 1. **원장 행 = 중복 방지 키.** 바로 아래 `alreadyRewarded` 는 별도 테이블이 아니라
 *    `point_transactions` 의 description(`from:{추천인}`)을 LIKE 로 읽어 재지급을 막는다.
 *    ⇒ 원장 INSERT 가 실패하면 단순 불일치가 아니라 **같은 조합이 매번 다시 보상**받는다.
 *    그래서 확장 컬럼 INSERT 가 실패하면 **최소 컬럼으로 다시 쓴다**(2026-08-01 전수조사 후속 —
 *    거기서 나온 3,000딜 2건이 정확히 "잔액만 늘고 기록 없음" 모양이었다).
 * 2. **폴백은 description 을 바꾸지 않는다.** 문구를 바꾸면 위 dedup 이 못 찾아 1번이 무너진다.
 * 3. **self-refer 차단** · 추천인 실재 확인.
 *
 * ⚠️ 이 함수는 **fail-soft** 다 — 보너스 실패가 공구 참여를 되돌리지 않는다(호출부가 이미 결제를 끝냈다).
 *    대신 실패는 `swallow(label)` 로 라벨과 함께 남는다(silent 금지).
 */
import { swallow } from '@/worker/utils/swallow'
import { recordPointTxMinimal } from '../../../worker/utils/point-ledger'

interface Params {
  DB: D1Database
  /** `X-Affiliate-Ref` 원문 — 숫자만 유효로 본다. */
  refRaw: string
  /** 참여자(초대받은 쪽). */
  userId: string | number
  /** 보너스 산정 기준액. */
  totalAmount: number
  productName: string
  orderNumber: string | null
}

/** 잔액 적립(무상 딜 — 출금 제외·우선 차감 대상). */
async function creditBoth(DB: D1Database, uid: string, bonus: number, label: string) {
  await DB.prepare(
    'UPDATE user_points SET balance = balance + ?, free_balance = COALESCE(free_balance, 0) + ? WHERE user_id = ?',
  ).bind(bonus, bonus, uid).run().catch(swallow(label))
}

/** 원장 기록 — 실패 시 최소 컬럼 폴백(§1). description 은 그대로 유지해야 한다(§2). */
async function recordBonusTx(
  DB: D1Database, uid: string, bonus: number, desc: string, orderNumber: string | null, label: string,
) {
  await DB.prepare(
    `INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description, order_id, free_delta)
     VALUES (?, 'referral_bonus', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?, ?, ?)`,
  ).bind(uid, bonus, bonus, uid, desc, orderNumber, bonus).run()
    .catch(async (e) => {
      swallow(label)(e)
      await recordPointTxMinimal(DB, uid, 'referral_bonus', bonus, desc)
    })
}

/** @returns 지급한 1인당 보너스 금액(0 이면 미지급). */
export async function grantGroupBuyReferralBonus(p: Params): Promise<number> {
  const { DB, refRaw, userId, totalAmount, productName, orderNumber } = p
  try {
    const refUserId = refRaw && /^\d+$/.test(refRaw) ? refRaw : null
    if (!refUserId || refUserId === String(userId)) return 0

    const refExists = await DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(refUserId).first().catch(() => null)
    if (!refExists) return 0

    // first-time-only — 같은 (추천인, 참여자) 조합은 1회만. 키가 원장 행이다(§1).
    const alreadyRewarded = await DB.prepare(
      `SELECT 1 FROM point_transactions
       WHERE type = 'referral_bonus'
         AND user_id = ?
         AND description LIKE '%' || ? || '%'
       LIMIT 1`,
    ).bind(userId, `from:${refUserId}`).first().catch(() => null)
    if (alreadyRewarded) return 0

    // 🛡️ 2026-05-22 정책 중앙화 — 비율은 코드가 아니라 정책 상수에서.
    const { COMMISSION_DEFAULTS } = await import('../../../shared/constants/policy')
    const bonus = Math.round(totalAmount * COMMISSION_DEFAULTS.REFERRAL_BONUS_BOTHSIDES_PCT / 100)
    if (bonus <= 0) return 0

    const refDesc = `공구 추천 보상 (to:${userId}): ${productName}`
    const inviteeDesc = `친구 추천 가입 보상 (from:${refUserId}): ${productName}`

    await creditBoth(DB, String(refUserId), bonus, 'group-buy:referral-bonus:referrer-balance')
    await recordBonusTx(DB, String(refUserId), bonus, refDesc, orderNumber, 'group-buy:referral-bonus:referrer-tx')
    await creditBoth(DB, String(userId), bonus, 'group-buy:referral-bonus:invitee-balance')
    await recordBonusTx(DB, String(userId), bonus, inviteeDesc, orderNumber, 'group-buy:referral-bonus:invitee-tx')

    // 🔔 2026-07-01: 적립 알림 — 이전엔 무통보라 유저가 딜 받은 줄 몰랐다.
    try {
      const { notifyUser } = await import('../../../lib/notifications')
      const bonusStr = Number(bonus).toLocaleString('ko-KR')
      await notifyUser(DB, String(refUserId), 'referral_bonus', '🎉 추천 보상 딜 적립',
        `공구 추천 보상으로 ${bonusStr}딜이 적립됐어요.`, '/my-deal-history')
        .catch(swallow('group-buy:referral-bonus:notify-referrer'))
      await notifyUser(DB, String(userId), 'referral_bonus', '🎉 친구 추천 보상 딜 적립',
        `친구 추천 가입 보상으로 ${bonusStr}딜이 적립됐어요.`, '/my-deal-history')
        .catch(swallow('group-buy:referral-bonus:notify-invitee'))
    } catch { /* best-effort */ }

    return bonus
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[group-buy referral]', e)
    return 0
  }
}
