/**
 * 사용자 탈퇴 서비스
 *
 * 탈퇴 시 처리:
 * 1. 장바구니/찜목록/배송지 삭제
 * 2. 주문 내역 익명화
 * 3. 사용자 정보 익명화 (DELETED 상태로 전환)
 * 4. 탈퇴 기록 저장 (30일간 재가입 제한)
 */

export interface DeleteAccountRequest {
  userId: string;
  reason?: string;
}

export interface DeleteAccountResponse {
  success: boolean;
  message: string;
  deletedAt: string;
}

/**
 * 사용자 계정 탈퇴 처리
 */
export async function deleteUserAccount(
  request: DeleteAccountRequest,
  db: D1Database
): Promise<DeleteAccountResponse> {
  const { userId, reason } = request;

  try {
    const deletedAt = new Date().toISOString();
    const reregisterAvailableAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // 0. Capture the user's original email BEFORE anonymization so we can enforce
    //    the 30-day re-registration restriction by email (checkReregistrationRestriction).
    let originalEmail: string | null = null;
    try {
      const userRow = await db
        .prepare('SELECT email FROM users WHERE id = ?')
        .bind(userId)
        .first<{ email: string | null }>();
      originalEmail = userRow?.email ?? null;
    } catch {
      // Best-effort — proceed even if lookup fails
      originalEmail = null;
    }

    // 1. 병렬 삭제: 장바구니, 찜목록, 배송지
    await db.batch([
      db.prepare('DELETE FROM cart_items WHERE user_id = ?').bind(userId),
      db.prepare('DELETE FROM wishlists WHERE user_id = ?').bind(userId),
      db.prepare('DELETE FROM shipping_addresses WHERE user_id = ?').bind(userId),
    ]);

    // 2. 주문 익명화
    await db
      .prepare(
        `UPDATE orders
         SET shipping_name = '탈퇴 회원',
             shipping_phone = '000-0000-0000',
             shipping_address = '주소 삭제됨',
             shipping_address_detail = NULL
         WHERE user_id = ?`
      )
      .bind(userId)
      .run();

    // 2-1. Additional privacy/cleanup cascades — wrapped defensively so missing
    //      tables in any environment don't break the core flow.
    const userIdStr = String(userId);

    // Privacy: anonymize reviews
    await db
      .prepare("UPDATE reviews SET user_id = 'deleted', user_name = '탈퇴회원' WHERE user_id = ?")
      .bind(userIdStr)
      .run()
      .catch(() => {});

    // Remove follows/subscriptions
    await db
      .prepare('DELETE FROM seller_follows WHERE user_id = ?')
      .bind(userIdStr)
      .run()
      .catch(() => {});
    await db
      .prepare('DELETE FROM broadcast_subscriptions WHERE user_id = ?')
      .bind(userIdStr)
      .run()
      .catch(() => {});
    await db
      .prepare('DELETE FROM push_subscriptions WHERE user_id = ?')
      .bind(userIdStr)
      .run()
      .catch(() => {});

    // Zero out points balance (preserve transaction history for audit)
    await db
      .prepare('UPDATE user_points SET balance = 0 WHERE user_id = ?')
      .bind(userIdStr)
      .run()
      .catch(() => {});

    // Clean coupons
    await db
      .prepare('DELETE FROM user_coupons WHERE user_id = ?')
      .bind(userIdStr)
      .run()
      .catch(() => {});

    // Anonymize donations (keep for accounting but remove PII)
    await db
      .prepare("UPDATE donations SET donor_name = '탈퇴회원' WHERE user_id = ?")
      .bind(userIdStr)
      .run()
      .catch(() => {});

    // Mark referral commissions as inactive (stop future earnings)
    await db
      .prepare(
        "UPDATE referral_commissions SET status = 'cancelled' WHERE user_id = ? AND status = 'granted'"
      )
      .bind(userIdStr)
      .run()
      .catch(() => {});

    // Clean view history
    await db
      .prepare('DELETE FROM live_stream_views WHERE user_id = ?')
      .bind(userIdStr)
      .run()
      .catch(() => {});
    await db
      .prepare('DELETE FROM product_views WHERE user_id = ?')
      .bind(userIdStr)
      .run()
      .catch(() => {});

    // Cancel pending youtube growth requests
    await db
      .prepare(
        "UPDATE youtube_growth_requests SET status = 'cancelled' WHERE user_id = ? AND status IN ('pending', 'processing')"
      )
      .bind(userIdStr)
      .run()
      .catch(() => {});

    // 3. 사용자 정보 익명화
    // NOTE: production users 테이블에는 status, avatar_url, kakao_access_token 컬럼이 없음.
    //       존재하는 컬럼(email, name, phone, firebase_uid)만 업데이트.
    try {
      await db
        .prepare(
          `UPDATE users
           SET email = ?,
               name = '탈퇴 회원',
               phone = NULL,
               firebase_uid = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(`deleted_${Date.now()}@deleted.invalid`, userId)
        .run();
    } catch (e) {
      // If firebase_uid/updated_at columns don't exist, fall back to minimal update
      try {
        await db
          .prepare(
            `UPDATE users SET email = ?, name = '탈퇴 회원', phone = NULL WHERE id = ?`
          )
          .bind(`deleted_${Date.now()}@deleted.invalid`, userId)
          .run();
      } catch {
        // eslint-disable-next-line no-console
        if (typeof console !== 'undefined') console.warn('[delete-account] users anonymize failed', e);
      }
    }

    // 4. 탈퇴 기록 저장 (email 포함 — 30일 재가입 제한에 사용됨)
    await db
      .prepare(
        `INSERT INTO deleted_accounts (user_id, email, reason, deleted_at, reregister_available_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(userId, originalEmail, reason ?? null, deletedAt, reregisterAvailableAt)
      .run();

    return {
      success: true,
      message: '회원 탈퇴가 완료되었습니다.',
      deletedAt,
    };
  } catch (error) {
    throw new Error('회원 탈퇴 처리 중 오류가 발생했습니다.');
  }
}

/**
 * 재가입 제한 확인
 */
export async function checkReregistrationRestriction(
  email: string,
  db: D1Database
): Promise<{ restricted: boolean; availableAt?: string }> {
  try {
    const row = await db
      .prepare(
        `SELECT reregister_available_at FROM deleted_accounts
         WHERE email = ?
         ORDER BY deleted_at DESC
         LIMIT 1`
      )
      .bind(email)
      .first<{ reregister_available_at: string }>();

    if (row && new Date() < new Date(row.reregister_available_at)) {
      return {
        restricted: true,
        availableAt: row.reregister_available_at,
      };
    }

    return { restricted: false };
  } catch {
    return { restricted: false };
  }
}
