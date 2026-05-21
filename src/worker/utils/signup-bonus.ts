/**
 * 🛡️ 2026-05-20: 신규 가입 보너스 (3000딜).
 *
 * 사용자 요청: 신규 가입자에게 3000딜 (= ₩3,000) 자동 적립.
 *
 * 정책:
 *   - 카카오 신규 가입 시 1회 자동 적립.
 *   - 이미 가입된 사용자 재로그인 시 미적립 (isNewUser=false).
 *   - 이중 적립 방지: point_transactions 에 type='signup_bonus' 동일 user_id 존재 시 skip.
 *   - fail-soft: 적립 실패해도 로그인 자체는 진행.
 *
 * 호출 시점: KakaoAuthService.upsertUser() 가 isNewUser=true 반환 직후 (kakao.routes.ts).
 */

const SIGNUP_BONUS_AMOUNT = 3000

export async function grantSignupBonus(DB: D1Database, userId: string | number): Promise<{
  granted: boolean
  amount?: number
  reason?: string
}> {
  try {
    const uid = String(userId)

    // 이중 적립 방지 — 이미 signup_bonus 받았으면 skip.
    const existing = await DB.prepare(
      `SELECT id FROM point_transactions
        WHERE user_id = ? AND type = 'signup_bonus' LIMIT 1`
    ).bind(uid).first().catch(() => null)
    if (existing) return { granted: false, reason: 'already_granted' }

    // user_points UPSERT — 잔액에 가산.
    await DB.prepare(`
      INSERT INTO user_points (user_id, balance, total_charged)
      VALUES (?, ?, 0)
      ON CONFLICT(user_id) DO UPDATE SET
        balance = balance + ?,
        updated_at = datetime('now')
    `).bind(uid, SIGNUP_BONUS_AMOUNT, SIGNUP_BONUS_AMOUNT).run()

    // 잔액 조회 (balance_after 기록용).
    const row = await DB.prepare(
      `SELECT balance FROM user_points WHERE user_id = ? LIMIT 1`
    ).bind(uid).first<{ balance: number }>().catch(() => null)
    const balanceAfter = row?.balance ?? SIGNUP_BONUS_AMOUNT

    // point_transactions ledger 기록.
    await DB.prepare(`
      INSERT INTO point_transactions
        (user_id, type, amount, points_amount, balance_after, description)
      VALUES (?, 'signup_bonus', ?, ?, ?, '신규 가입 환영 보너스')
    `).bind(uid, SIGNUP_BONUS_AMOUNT, SIGNUP_BONUS_AMOUNT, balanceAfter).run().catch(() => null)

    return { granted: true, amount: SIGNUP_BONUS_AMOUNT }
  } catch {
    // fail-soft — 로그인 흐름 막지 않음.
    return { granted: false, reason: 'error' }
  }
}
