/**
 * 사용자 탈퇴 서비스 — Option B (soft delete + 30일 복원 동의)
 *
 * 탈퇴 시 처리:
 * 1. 장바구니/찜목록/배송지 삭제 (PII)
 * 2. 주문 내역 익명화 (audit 보존)
 * 3. 사용자 정보 익명화 + deleted_at 기록 (soft delete)
 * 4. kakao_id 는 prefix 'deleted_' 추가 → 즉시 재가입 시 매칭 X
 * 5. 탈퇴 기록 저장 (kakao_id 도 보존 — 재가입 시 복원 동의 표시용)
 *
 * 재가입 시:
 *   30일 이내 → 사용자에게 "이전 계정 복원" 동의 화면 표시
 *     동의 → restoreUser 호출 → kakao_id prefix 제거, deleted_at NULL, 익명화 정보 갱신
 *     거부 → 신규 계정 생성 (옛 계정은 30일 후 hard purge)
 *   30일 경과 → 자동으로 hard purge (별도 cron 예정), 신규 계정 생성
 */

/**
 * Optional cleanup step that logs in DEV but never throws in PROD.
 * Used for best-effort deletion of rows in tables that may not exist in
 * all environments (see section 2-1 below).
 */
function swallow(tag: string) {
  return (e: unknown) => {
    if (import.meta.env.DEV) console.warn(`[deleteAccount] ${tag}:`, e);
  };
}

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

    // 0. Capture the user's original email + kakao_id BEFORE anonymization.
    //    재가입 시 복원 동의 표시 + 30일 차단 enforcement 에 사용.
    let originalEmail: string | null = null;
    let originalKakaoId: string | null = null;
    let originalName: string | null = null;
    try {
      const userRow = await db
        .prepare('SELECT email, kakao_id, name FROM users WHERE id = ?')
        .bind(userId)
        .first<{ email: string | null; kakao_id: string | null; name: string | null }>();
      originalEmail = userRow?.email ?? null;
      originalKakaoId = userRow?.kakao_id ?? null;
      originalName = userRow?.name ?? null;
    } catch {
      // Best-effort — proceed even if lookup fails
    }

    // 1. 개별 삭제 (테이블 누락 환경 보호 — db.batch 는 하나라도 fail 하면 전체 fail).
    //    🛡️ 2026-05-01: 사용자 신고 "회원탈퇴 중 오류" — batch 실패가 원인 가능성.
    await db.prepare('DELETE FROM cart_items WHERE user_id = ?').bind(userId).run().catch(swallow('cart_items'));
    await db.prepare('DELETE FROM wishlists WHERE user_id = ?').bind(userId).run().catch(swallow('wishlists'));
    await db.prepare('DELETE FROM shipping_addresses WHERE user_id = ?').bind(userId).run().catch(swallow('shipping_addresses'));

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
      .catch(swallow("cleanup"));

    // Remove follows/subscriptions
    await db
      .prepare('DELETE FROM seller_follows WHERE user_id = ?')
      .bind(userIdStr)
      .run()
      .catch(swallow("cleanup"));
    await db
      .prepare('DELETE FROM broadcast_subscriptions WHERE user_id = ?')
      .bind(userIdStr)
      .run()
      .catch(swallow("cleanup"));
    await db
      .prepare('DELETE FROM push_subscriptions WHERE user_id = ?')
      .bind(userIdStr)
      .run()
      .catch(swallow("cleanup"));

    // Zero out points balance (preserve transaction history for audit)
    await db
      .prepare('UPDATE user_points SET balance = 0 WHERE user_id = ?')
      .bind(userIdStr)
      .run()
      .catch(swallow("cleanup"));

    // Clean coupons
    await db
      .prepare('DELETE FROM user_coupons WHERE user_id = ?')
      .bind(userIdStr)
      .run()
      .catch(swallow("cleanup"));

    // Anonymize donations (keep for accounting but remove PII)
    await db
      .prepare("UPDATE donations SET donor_name = '탈퇴회원' WHERE user_id = ?")
      .bind(userIdStr)
      .run()
      .catch(swallow("cleanup"));

    // Mark referral commissions as inactive (stop future earnings)
    await db
      .prepare(
        "UPDATE referral_commissions SET status = 'cancelled' WHERE user_id = ? AND status = 'granted'"
      )
      .bind(userIdStr)
      .run()
      .catch(swallow("cleanup"));

    // Clean view history
    await db
      .prepare('DELETE FROM live_stream_views WHERE user_id = ?')
      .bind(userIdStr)
      .run()
      .catch(swallow("cleanup"));
    await db
      .prepare('DELETE FROM product_views WHERE user_id = ?')
      .bind(userIdStr)
      .run()
      .catch(swallow("cleanup"));

    // Cancel pending youtube growth requests
    await db
      .prepare(
        "UPDATE youtube_growth_requests SET status = 'cancelled' WHERE user_id = ? AND status IN ('pending', 'processing')"
      )
      .bind(userIdStr)
      .run()
      .catch(swallow("cleanup"));

    // 🛡️ 2026-04-22: GDPR 추가 PII 정리 — 누락 테이블 보강
    // 채팅 메시지 익명화 (기록은 유지, user_name만 변경)
    await db
      .prepare("UPDATE chat_messages SET user_name = '탈퇴회원', user_avatar = NULL WHERE user_id = ?")
      .bind(userIdStr)
      .run()
      .catch(swallow("cleanup"));
    // 알림 삭제
    await db.prepare('DELETE FROM notifications WHERE user_id = ?').bind(userIdStr).run().catch(swallow("cleanup"));
    await db.prepare('DELETE FROM user_notifications WHERE user_id = ?').bind(userIdStr).run().catch(swallow("cleanup"));
    // 네이티브 푸시 토큰 삭제
    await db.prepare('DELETE FROM native_push_tokens WHERE user_id = ?').bind(Number(userId) || 0).run().catch(swallow("cleanup"));
    // 검색 기록 삭제 (테이블 존재 시)
    await db.prepare('DELETE FROM search_history WHERE user_id = ?').bind(userIdStr).run().catch(swallow("cleanup"));
    // 계정 잠금 기록 삭제
    await db.prepare("DELETE FROM account_lockouts WHERE user_type = 'user' AND user_id = ?").bind(userIdStr).run().catch(swallow("cleanup"));
    // refresh token 삭제
    await db.prepare("DELETE FROM auth_refresh_tokens WHERE user_type = 'user' AND user_id = ?").bind(userIdStr).run().catch(swallow("cleanup"));

    // 3. 사용자 정보 익명화 + soft delete
    //    🛡️ 2026-05-01: kakao_id 에 'deleted_<ts>_' prefix 추가 → 즉시 재가입 시 SELECT 매칭 X.
    //    deleted_at 컬럼 set 하면 soft delete (30일 후 cron 이 hard purge).
    //    NOTE: 컬럼 없는 환경 대비 — 단계별 fallback (full → no deleted_at → no firebase_uid → minimal).
    const tsToken = `deleted_${Date.now()}_`
    const newKakaoId = originalKakaoId ? `${tsToken}${originalKakaoId}` : null
    const anonymizedEmail = `deleted_${Date.now()}@deleted.invalid`
    await db.prepare('ALTER TABLE users ADD COLUMN deleted_at DATETIME').run().catch(() => null) // 옛 schema 보강

    let anonymizeOk = false
    // Try 1: full UPDATE (deleted_at + firebase_uid 포함)
    try {
      await db
        .prepare(
          `UPDATE users SET email = ?, kakao_id = ?, name = '탈퇴 회원', phone = NULL,
                            firebase_uid = NULL, profile_image = NULL, deleted_at = ?,
                            updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        )
        .bind(anonymizedEmail, newKakaoId, deletedAt, userId)
        .run()
      anonymizeOk = true
    } catch (_e1) {
      // Try 2: firebase_uid 제거 (production 에 컬럼 없음 가능)
      try {
        await db
          .prepare(
            `UPDATE users SET email = ?, kakao_id = ?, name = '탈퇴 회원', phone = NULL,
                              profile_image = NULL, deleted_at = ?,
                              updated_at = CURRENT_TIMESTAMP WHERE id = ?`
          )
          .bind(anonymizedEmail, newKakaoId, deletedAt, userId)
          .run()
        anonymizeOk = true
      } catch (_e2) {
        // Try 3: deleted_at + firebase_uid 둘 다 제거
        try {
          await db
            .prepare(
              `UPDATE users SET email = ?, kakao_id = ?, name = '탈퇴 회원', phone = NULL,
                                profile_image = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
            )
            .bind(anonymizedEmail, newKakaoId, userId)
            .run()
          anonymizeOk = true
        } catch (_e3) {
          // Try 4: 최소 컬럼만 (kakao_id prefix 만 적용해서 재로그인 시 매칭 차단)
          try {
            await db
              .prepare(`UPDATE users SET kakao_id = ?, name = '탈퇴 회원' WHERE id = ?`)
              .bind(newKakaoId, userId)
              .run()
            anonymizeOk = true
          } catch (e4) {
            if (import.meta.env.DEV) console.error('[delete-account] all UPDATE attempts failed:', e4)
          }
        }
      }
    }
    if (!anonymizeOk) {
      throw new Error('users 테이블 익명화 실패 — 모든 컬럼 조합 시도 실패')
    }

    // 4. 탈퇴 기록 저장 — kakao_id 도 보존 (재가입 시 복원 동의 화면용).
    //    🛡️ 2026-05-01: deleted_accounts 테이블 자동 생성 (production 에 없을 수 있음).
    //                   ALTER 로 누락 컬럼 보강 후 INSERT.
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS deleted_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        email TEXT,
        kakao_id TEXT,
        original_name TEXT,
        reason TEXT,
        deleted_at DATETIME,
        reregister_available_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ).run().catch(() => null)
    // 옛 schema 보강
    await db.prepare('ALTER TABLE deleted_accounts ADD COLUMN kakao_id TEXT').run().catch(() => null)
    await db.prepare('ALTER TABLE deleted_accounts ADD COLUMN original_name TEXT').run().catch(() => null)
    await db.prepare('ALTER TABLE deleted_accounts ADD COLUMN reregister_available_at DATETIME').run().catch(() => null)

    await db
      .prepare(
        `INSERT INTO deleted_accounts (user_id, email, kakao_id, original_name, reason, deleted_at, reregister_available_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(userId, originalEmail, originalKakaoId, originalName, reason ?? null, deletedAt, reregisterAvailableAt)
      .run()
      .catch(swallow('deleted_accounts INSERT (non-fatal — soft delete 자체는 성공)'));

    return {
      success: true,
      message: '회원 탈퇴가 완료되었습니다.',
      deletedAt,
    };
  } catch (error) {
    // 🛡️ 2026-05-01: 원본 에러 메시지 노출 — 진단 가능성. 사용자 신고 "회원탈퇴 중 오류" 의 원인 추적용.
    const detail = (error as Error)?.message || 'unknown'
    if (import.meta.env.DEV) console.error('[delete-account] FAILED:', error)
    throw new Error(`회원 탈퇴 처리 중 오류가 발생했습니다: ${detail}`);
  }
}

/**
 * 🛡️ 2026-05-01: 재가입 시 옛 계정 복원 (Option B — 동의 기반).
 * 카카오 OAuth 후 같은 kakao_id 가 deleted_accounts 에 있으면 사용자에게 동의 표시 후 호출.
 *
 * 동작:
 *   1. deleted_accounts row 찾기 (kakao_id 매칭, reregister_available_at 30일 내)
 *   2. users 테이블 옛 row 찾기 (kakao_id LIKE 'deleted_%_<originalId>')
 *   3. UPDATE: kakao_id 원복, name/email 새 값으로, deleted_at = NULL
 *   4. deleted_accounts row 삭제 (복원 완료)
 */
export async function restoreUser(
  kakaoId: string,
  newName: string,
  newEmail: string | null,
  newProfileImage: string | null,
  db: D1Database
): Promise<{ success: boolean; userId?: number; error?: string }> {
  try {
    // 1. 30일 내 탈퇴 기록 찾기
    const deletedRow = await db
      .prepare(
        `SELECT user_id, reregister_available_at FROM deleted_accounts
         WHERE kakao_id = ? AND datetime(reregister_available_at) > datetime('now')
         ORDER BY deleted_at DESC LIMIT 1`
      )
      .bind(kakaoId)
      .first<{ user_id: number; reregister_available_at: string }>()

    if (!deletedRow) {
      return { success: false, error: '복원 가능한 탈퇴 기록이 없습니다 (30일 경과 또는 미존재)' }
    }

    const userId = deletedRow.user_id

    // 2. users row 복원 — kakao_id prefix 제거, 익명화 정보 갱신
    await db
      .prepare(
        `UPDATE users
         SET kakao_id = ?,
             name = ?,
             email = ?,
             profile_image = ?,
             deleted_at = NULL,
             updated_at = CURRENT_TIMESTAMP,
             last_login_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(kakaoId, newName, newEmail, newProfileImage, userId)
      .run()

    // 3. deleted_accounts 기록 삭제 (복원 완료)
    await db.prepare('DELETE FROM deleted_accounts WHERE user_id = ?').bind(userId).run().catch(swallow('restore'))

    return { success: true, userId }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * 옛 계정 복원 가능 여부 체크 (UI 안내용).
 * Returns null if no eligible record (or already expired).
 */
export async function findRestorableAccount(
  kakaoId: string,
  db: D1Database
): Promise<{ user_id: number; original_name: string | null; deleted_at: string; reregister_available_at: string } | null> {
  try {
    const row = await db
      .prepare(
        `SELECT user_id, original_name, deleted_at, reregister_available_at
         FROM deleted_accounts
         WHERE kakao_id = ? AND datetime(reregister_available_at) > datetime('now')
         ORDER BY deleted_at DESC LIMIT 1`
      )
      .bind(kakaoId)
      .first<{ user_id: number; original_name: string | null; deleted_at: string; reregister_available_at: string }>()
    return row ?? null
  } catch {
    return null
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
