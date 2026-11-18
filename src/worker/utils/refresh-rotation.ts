/**
 * Refresh 토큰 회전(rotation) 유예 — admin/seller/supplier refresh 공용 (2026-07-04).
 *
 * 배경(대표 "수시로 로그아웃" 실사고): 회전이 '사용 즉시 삭제'라, 여러 탭이 같은 refresh 로
 *   동시 갱신하면 진 쪽이 'not recognized' 401 → 강제 로그아웃 + clearAuthData 가 이긴 탭의
 *   새 토큰까지 삭제 → 전 탭 연쇄 로그아웃. (클라 짝: api.ts 인터셉터의 '저장소 변화 감지 재시도'.)
 *
 * 해법: 사용한 refresh 행을 즉시 삭제하지 않고 expires_at 을 짧은 유예(60초)로 당김.
 *   - 유예 내 재사용(동시 탭) = 각자 새 토큰 발급(경합 무해화)
 *   - 유예 후 재사용(탈취/재사용 공격) = filterAliveRefreshRows 가 차단 → 기존 회전 의미 보존
 *
 * ⚠️ 이 필터를 우회(행 만료 미검사)하거나 유예를 무한정 늘리면 회전-탐지 보안이 무력화된다.
 */

export const REFRESH_ROTATION_GRACE_MS = 60_000

/** 행 단위 만료 강제 — 유예 지난(또는 만료된) refresh 행 제외. 파싱 불가(레거시 행)는 관대 통과. */
export function filterAliveRefreshRows<T extends { expires_at?: string | null }>(
  rows: readonly T[],
  nowMs: number,
): T[] {
  return rows.filter((r) => {
    const t = Date.parse(r.expires_at || '')
    return !Number.isFinite(t) || t > nowMs
  })
}

/** 회전 시 사용-행에 부여할 유예 만료 시각(ISO). */
export function rotationGraceExpiryIso(nowMs: number): string {
  return new Date(nowMs + REFRESH_ROTATION_GRACE_MS).toISOString()
}

/**
 * 🔐 2026-11-18 — 그 계정의 재발급 토큰을 **실제로** 전부 끊는다(비밀번호 변경·재설정·관리자 초기화).
 *
 * 종전엔 행을 `DELETE` 만 했다. 그런데 재발급 경로는 "저장된 행이 **하나도 없으면** 서명만 보고 통과" 한다
 * (옛 이행기 호환) ⇒ 전부 지우는 순간 오히려 **아무 옛 토큰이나 통하는 상태**가 됐다 — 비밀번호를 바꾸기 전에
 * 새어 나간 재발급 토큰이 30일 동안 새 접속 토큰을 계속 찍어냈다.
 * 지금은 지운 뒤 **묘비 행**(어떤 토큰과도 안 맞는 값)을 하나 남긴다 → 행이 있으니 대조가 돌고, 옛 토큰은 전부 떨어진다.
 * 새로 로그인하면 새 행이 옆에 생겨 정상 동작한다. 묘비는 재발급 토큰 수명(30일)보다 하루 더 산다.
 */
export const REFRESH_TOMBSTONE_HASH = 'revoked'
export async function revokeAllRefreshTokens(
  DB: D1Database, userType: 'admin' | 'seller', userId: number,
): Promise<void> {
  await DB.prepare('DELETE FROM auth_refresh_tokens WHERE user_type = ? AND user_id = ?').bind(userType, userId).run()
  await DB.prepare('INSERT INTO auth_refresh_tokens (user_type, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .bind(userType, userId, REFRESH_TOMBSTONE_HASH, new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString()).run()
}
