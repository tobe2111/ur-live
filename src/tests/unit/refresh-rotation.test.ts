import { describe, it, expect } from 'vitest'
import {
  filterAliveRefreshRows,
  rotationGraceExpiryIso,
  REFRESH_ROTATION_GRACE_MS,
} from '@/worker/utils/refresh-rotation'

/**
 * 🛡️ 2026-07-04 실사고 회귀 방지: "수시로 로그아웃" (다중 탭 동시 refresh 연쇄 로그아웃).
 *
 * 원인: refresh 회전이 '사용 즉시 삭제'라, 여러 탭이 같은 refresh 토큰으로 동시 갱신하면
 *   진 쪽이 'not recognized' 401 → 강제 로그아웃 + clearAuthData 가 이긴 탭의 새 토큰까지
 *   삭제 → 전 탭 연쇄 로그아웃. 해법 = 60초 회전 유예(admin/seller/supplier refresh 공용).
 *
 * 🔒 핵심 불변식 2개:
 *   1. 유예 내 재사용 = 통과 (동시 탭 경합 무해화) — 유예가 사라지면 사건 재발.
 *   2. 유예 후 재사용 = 차단 (rotation/재사용-탐지 보안 보존) — 이게 풀리면 탈취 토큰이 영생.
 */

const NOW = 1_800_000_000_000

describe('refresh-rotation · filterAliveRefreshRows', () => {
  it('🔒 유예 내(만료 전) 행은 통과 — 동시 탭 재사용 허용', () => {
    const rows = [{ id: 1, expires_at: new Date(NOW + 30_000).toISOString() }]
    expect(filterAliveRefreshRows(rows, NOW)).toHaveLength(1)
  })

  it('🔒 유예 지난(만료된) 행은 차단 — 재사용 탐지 보존', () => {
    const rows = [{ id: 1, expires_at: new Date(NOW - 1_000).toISOString() }]
    expect(filterAliveRefreshRows(rows, NOW)).toHaveLength(0)
  })

  it('경계: 정확히 now = 만료(차단)', () => {
    const rows = [{ id: 1, expires_at: new Date(NOW).toISOString() }]
    expect(filterAliveRefreshRows(rows, NOW)).toHaveLength(0)
  })

  it('레거시 행(expires_at 파싱 불가/누락)은 관대 통과 — 마이그레이션 호환', () => {
    expect(filterAliveRefreshRows([{ expires_at: 'not-a-date' }], NOW)).toHaveLength(1)
    expect(filterAliveRefreshRows([{ expires_at: null }], NOW)).toHaveLength(1)
    expect(filterAliveRefreshRows([{}], NOW)).toHaveLength(1)
  })

  it('혼합 행에서 산 것만 남김', () => {
    const rows = [
      { id: 1, expires_at: new Date(NOW - 1).toISOString() },   // dead
      { id: 2, expires_at: new Date(NOW + 60_000).toISOString() }, // alive
      { id: 3, expires_at: null },                                  // legacy → alive
    ]
    expect(filterAliveRefreshRows(rows, NOW).map((r) => r.id)).toEqual([2, 3])
  })
})

describe('refresh-rotation · rotationGraceExpiryIso', () => {
  it('🔒 유예 = now + 60초 (짧게 유지 — 무한정 늘리면 회전 보안 무력화)', () => {
    expect(REFRESH_ROTATION_GRACE_MS).toBe(60_000)
    expect(Date.parse(rotationGraceExpiryIso(NOW))).toBe(NOW + 60_000)
  })

  it('유예 만료 행은 filterAliveRefreshRows 가 차단 (두 헬퍼의 정합)', () => {
    const graceExpiry = rotationGraceExpiryIso(NOW)
    // 유예 내 재사용(59초 후) → 통과
    expect(filterAliveRefreshRows([{ expires_at: graceExpiry }], NOW + 59_000)).toHaveLength(1)
    // 유예 후 재사용(61초 후) → 차단
    expect(filterAliveRefreshRows([{ expires_at: graceExpiry }], NOW + 61_000)).toHaveLength(0)
  })
})
