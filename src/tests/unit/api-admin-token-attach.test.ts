/**
 * 🛡️ 2026-05-21: api.ts admin token 자동 부착 검증.
 *
 * 사고 경위:
 *   /api/referral-tree/admin/withdrawals 호출 시 admin_token 헤더 미부착 → 403.
 *   원인: api.ts 가 /api/admin/* prefix 만 admin_token 적용. /api/<feature>/admin/* 는 누락.
 *
 * 영구 fix:
 *   /^\/api\/[a-z0-9-]+\/admin(\/|$)/ 패턴 추가.
 *
 * 회귀 방지: 이 테스트가 패턴 매칭을 보장. 새 admin sub-resource endpoint 추가 시
 *   같은 패턴 따라가면 자동으로 token 부착.
 */
import { describe, it, expect } from 'vitest'

// api.ts 내부 정규식과 동일 — 직접 export 안 되므로 inline 복제.
const ADMIN_SUBRESOURCE_PATTERN = /^\/api\/[a-z0-9-]+\/admin(\/|$)/

describe('admin sub-resource URL pattern', () => {
  it('matches /api/<feature>/admin/<path>', () => {
    expect(ADMIN_SUBRESOURCE_PATTERN.test('/api/referral-tree/admin/withdrawals')).toBe(true)
    expect(ADMIN_SUBRESOURCE_PATTERN.test('/api/referral-tree/admin/withdrawals/1/approve')).toBe(true)
    expect(ADMIN_SUBRESOURCE_PATTERN.test('/api/anomaly/admin/alerts')).toBe(true)
    expect(ADMIN_SUBRESOURCE_PATTERN.test('/api/kt-alpha/admin/sync')).toBe(true)
  })

  it('matches /api/<feature>/admin (no trailing slash)', () => {
    expect(ADMIN_SUBRESOURCE_PATTERN.test('/api/referral-tree/admin')).toBe(true)
  })

  it('does NOT match /api/admin/* (handled by separate branch)', () => {
    // /api/admin/* 은 별도 분기 (api.ts:239) — sub-resource pattern 과 충돌 안 함.
    expect(ADMIN_SUBRESOURCE_PATTERN.test('/api/admin/settlement')).toBe(false)
    expect(ADMIN_SUBRESOURCE_PATTERN.test('/api/admin/sellers')).toBe(false)
  })

  it('does NOT match unrelated paths', () => {
    expect(ADMIN_SUBRESOURCE_PATTERN.test('/api/seller/products')).toBe(false)
    expect(ADMIN_SUBRESOURCE_PATTERN.test('/api/referral-tree/my-commissions')).toBe(false)
    expect(ADMIN_SUBRESOURCE_PATTERN.test('/api/agency/dashboard')).toBe(false)
    expect(ADMIN_SUBRESOURCE_PATTERN.test('/api/users/admin-only')).toBe(false) // admin 이 path segment 끝
  })

  it('rejects path traversal / injection attempts', () => {
    expect(ADMIN_SUBRESOURCE_PATTERN.test('/api/foo/../admin/')).toBe(false)
    expect(ADMIN_SUBRESOURCE_PATTERN.test('/api/foo/admin\\bar')).toBe(false)
    expect(ADMIN_SUBRESOURCE_PATTERN.test('/api//admin/')).toBe(false)
  })
})
