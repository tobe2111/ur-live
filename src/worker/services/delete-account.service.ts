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

    // 3. 사용자 정보 익명화
    await db
      .prepare(
        `UPDATE users
         SET email = ?,
             name = '탈퇴 회원',
             phone = NULL,
             firebase_uid = NULL,
             kakao_access_token = NULL,
             avatar_url = NULL,
             profile_image = NULL,
             status = 'DELETED',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(`deleted_${Date.now()}@deleted.invalid`, userId)
      .run();

    // 4. 탈퇴 기록 저장
    await db
      .prepare(
        `INSERT INTO deleted_accounts (user_id, reason, deleted_at, reregister_available_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(userId, reason ?? null, deletedAt, reregisterAvailableAt)
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
