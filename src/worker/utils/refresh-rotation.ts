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
