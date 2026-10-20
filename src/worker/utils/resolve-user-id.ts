/**
 * 인증된 유저의 ID를 DB users.id로 변환
 *
 * - 세션 쿠키 유저 (isDbId=true): 이미 DB ID이므로 바로 반환
 * - Firebase 유저 (isDbId=false): firebase_uid로 DB 조회 후 id 반환
 * - fallback: 숫자면 바로 사용, 아니면 firebase_uid로 조회
 */
export async function resolveUserId(
  db: D1Database,
  rawId: string | number,
  isDbId?: boolean
): Promise<number | null> {
  const idStr = String(rawId);

  // 세션 쿠키 유저: 이미 DB ID
  if (isDbId) {
    const num = parseInt(idStr);
    return isNaN(num) ? null : num;
  }

  // 숫자면 바로 사용 (fallback)
  const numId = parseInt(idStr);
  if (!isNaN(numId) && String(numId) === idStr) {
    return numId;
  }

  // Firebase UID로 DB 조회
  try {
    const row = await db
      .prepare('SELECT id FROM users WHERE firebase_uid = ? LIMIT 1')
      .bind(idStr)
      .first<{ id: number }>();
    return row?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * 머니 경로 안전 정규화: 인증 유저의 raw id 를 DB users.id **문자열**로 반환.
 *
 * - 정규화 성공 → 숫자 users.id 의 문자열 (orders INTEGER / vouchers·user_points TEXT 모두 바인딩 OK)
 * - 정규화 실패(firebase_uid 미매칭 등) → **raw id 문자열로 폴백** (기존 `String(user.id)` 동작 보존)
 *
 * 목적: 같은 핸들러의 읽기·쓰기가 동일한 정규화 값을 쓰게 해 user_id 이중키(숫자 vs firebase_uid) 분열을
 * 닫는다. live(카카오 세션 = isDbId) 는 이미 숫자라 **동작 무변화**, Firebase 유저에게만 교정 효과.
 * 절대 null/throw 로 결제를 막지 않는다(실패 시 종전과 동일한 raw 값 사용).
 */
export async function resolveUserIdString(
  db: D1Database,
  rawId: string | number,
  isDbId?: boolean
): Promise<string> {
  try {
    const resolved = await resolveUserId(db, rawId, isDbId);
    if (resolved != null) return String(resolved);
  } catch {
    /* fall through to raw */
  }
  return String(rawId);
}
