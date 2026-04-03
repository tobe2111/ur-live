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
