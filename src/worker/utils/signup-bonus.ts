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

export async function grantSignupBonus(DB: D1Database, userId: string | number, kakaoId?: string | null): Promise<{
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

    // 🛡️ 2026-07-12 (가입·탈퇴 감사 ②): 탈퇴→재가입 무한 3000딜 루프 차단.
    //   기존 dedup 은 user_id 기준이라 재가입(새 user_id)마다 재지급 → 카카오 1개로도 무한 반복.
    //   탈퇴 시 익명화된 옛 users row 는 kakao_id='deleted_<ts>_<원본>' 로 **영구 잔존**(purge 는
    //   deleted_accounts 만 삭제)이므로, 같은 카카오로 과거 가입 이력이 있으면(=이미 환영보너스 수령)
    //   재지급을 skip. ESCAPE 로 `deleted_%_<id>` 꼴만 정확 매칭(카카오 id 는 숫자 → 언더스코어 없음).
    if (kakaoId) {
      const prior = await DB.prepare(
        `SELECT 1 FROM users
          WHERE id != ? AND kakao_id LIKE ? ESCAPE '\\' LIMIT 1`
      ).bind(uid, `deleted\\_%\\_${kakaoId}`).first().catch(() => null)
      if (prior) return { granted: false, reason: 'kakao_reregister' }
    }

    // user_points UPSERT — 잔액에 가산.
    // 💸 2026-07-05 버킷: 가입 보너스 = 무상 딜 (free_balance 동시 증가 — 출금 제외·우선 차감).
    const { ensureDealBuckets } = await import('./point-buckets')
    await ensureDealBuckets(DB)
    await DB.prepare(`
      INSERT INTO user_points (user_id, balance, free_balance, total_charged)
      VALUES (?, ?, ?, 0)
      ON CONFLICT(user_id) DO UPDATE SET
        balance = balance + ?,
        free_balance = COALESCE(free_balance, 0) + ?,
        updated_at = datetime('now')
    `).bind(uid, SIGNUP_BONUS_AMOUNT, SIGNUP_BONUS_AMOUNT, SIGNUP_BONUS_AMOUNT, SIGNUP_BONUS_AMOUNT).run()

    // 잔액 조회 (balance_after 기록용).
    const row = await DB.prepare(
      `SELECT balance FROM user_points WHERE user_id = ? LIMIT 1`
    ).bind(uid).first<{ balance: number }>().catch(() => null)
    const balanceAfter = row?.balance ?? SIGNUP_BONUS_AMOUNT

    // point_transactions ledger 기록.
    await DB.prepare(`
      INSERT INTO point_transactions
        (user_id, type, amount, points_amount, balance_after, description, free_delta)
      VALUES (?, 'signup_bonus', ?, ?, ?, '신규 가입 환영 보너스', ?)
    `).bind(uid, SIGNUP_BONUS_AMOUNT, SIGNUP_BONUS_AMOUNT, balanceAfter, SIGNUP_BONUS_AMOUNT).run().catch(() => null)

    return { granted: true, amount: SIGNUP_BONUS_AMOUNT }
  } catch {
    // fail-soft — 로그인 흐름 막지 않음.
    return { granted: false, reason: 'error' }
  }
}
