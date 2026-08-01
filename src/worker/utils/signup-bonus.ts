/**
 * 🛡️ 2026-05-20: 신규 가입 보너스.
 *
 * 🔴 **2026-08-01 대표 지시 "신규 가입 보너스 없애자 3000딜 너무 세다" → 기본 중단(0딜).**
 *   금액을 코드에 박지 않고 `platform_settings.signup_bonus_amount` 로 옮겼다 —
 *   CLAUDE.md 가 "수치(%·기간·금액)는 어드민(platform_settings) 조정 대상" 이라고 규정한다.
 *   **미설정/0/음수 = 지급 안 함**(현재 상태). 나중에 500 이든 1000 이든 배포 없이 되살릴 수 있다.
 *   지급하지 않으면 `granted:false` 라 `kakao.routes` 가 `?bonus=` 를 안 붙이고,
 *   환영 모달의 보너스 카드도 `bonusAmount > 0` 조건이라 **자동으로 사라진다**(UI 수정 불필요).
 *
 * 정책:
 *   - 카카오 신규 가입 시 1회 자동 적립.
 *   - 이미 가입된 사용자 재로그인 시 미적립 (isNewUser=false).
 *   - 이중 적립 방지: point_transactions 에 type='signup_bonus' 동일 user_id 존재 시 skip.
 *   - fail-soft: 적립 실패해도 로그인 자체는 진행.
 *
 * 호출 시점: KakaoAuthService.upsertUser() 가 isNewUser=true 반환 직후 (kakao.routes.ts).
 */

/** 미설정 시 지급 안 함. 어드민이 `platform_settings.signup_bonus_amount` 로 켠다. */
const SIGNUP_BONUS_DEFAULT = 0

async function resolveBonusAmount(DB: D1Database): Promise<number> {
  const row = await DB.prepare(
    `SELECT value FROM platform_settings WHERE key = 'signup_bonus_amount' LIMIT 1`,
  ).first<{ value: string }>().catch(() => null)
  const n = Math.round(Number(row?.value))
  return Number.isFinite(n) && n > 0 ? n : SIGNUP_BONUS_DEFAULT
}

export async function grantSignupBonus(DB: D1Database, userId: string | number, kakaoId?: string | null): Promise<{
  granted: boolean
  amount?: number
  reason?: string
}> {
  try {
    const uid = String(userId)

    // 🔴 2026-08-01: 기본 0 = 지급 중단(대표 지시). 잔액도 원장도 건드리지 않고 즉시 종료.
    const SIGNUP_BONUS_AMOUNT = await resolveBonusAmount(DB)
    if (SIGNUP_BONUS_AMOUNT <= 0) return { granted: false, reason: 'disabled' }

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
    // 🔴 2026-08-01: 여기가 **잔액만 3,000 있고 거래 기록이 0 인 유저**를 만든 자리다.
    //   위 UPSERT 로 잔액은 이미 늘었는데 이 INSERT 를 `.catch(() => null)` 로 삼켰다.
    //   확장 컬럼(points_amount·balance_after·free_delta)이 base CREATE 에 없고 repair-schema 에도
    //   free_delta 만 등록돼 있어, 컬럼이 없는 배포 창에서는 이 INSERT 가 통째로 실패한다.
    //   라이브 실측: 정확히 이 모양인 유저 2명(user 32·33, 각 3,000딜 = SIGNUP_BONUS_AMOUNT).
    //   ⚠️ 원장 행이 없으면 **위쪽 이중적립 dedup(`type='signup_bonus'` 조회)도 무력화**된다 —
    //      기록이 없으니 "이미 받았다"를 알 수 없다. 그래서 폴백은 정합성뿐 아니라 중복지급 방어이기도 하다.
    //   → 실패하면 base CREATE 가 보장하는 최소 컬럼으로 반드시 한 번 더 남긴다.
    try {
      await DB.prepare(`
        INSERT INTO point_transactions
          (user_id, type, amount, points_amount, balance_after, description, free_delta)
        VALUES (?, 'signup_bonus', ?, ?, ?, '신규 가입 환영 보너스', ?)
      `).bind(uid, SIGNUP_BONUS_AMOUNT, SIGNUP_BONUS_AMOUNT, balanceAfter, SIGNUP_BONUS_AMOUNT).run()
    } catch {
      const { recordPointTxMinimal } = await import('./point-ledger')
      await recordPointTxMinimal(DB, uid, 'signup_bonus', SIGNUP_BONUS_AMOUNT, '신규 가입 환영 보너스')
    }

    return { granted: true, amount: SIGNUP_BONUS_AMOUNT }
  } catch {
    // fail-soft — 로그인 흐름 막지 않음.
    return { granted: false, reason: 'error' }
  }
}
