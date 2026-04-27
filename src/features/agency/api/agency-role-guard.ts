/**
 * Agency Role Guard 미들웨어 (R1 — Phase 2)
 *
 * 사용:
 *   import { requireAgencyRole, requireAgencyPermission } from '@/features/agency/api/agency-role-guard'
 *
 *   // 특정 role 만:
 *   app.post('/settlements/request', requireAgencyRole('owner', 'manager'), handler)
 *
 *   // 특정 권한만:
 *   app.post('/messages/send', requireAgencyPermission('message'), handler)
 *
 * 호환성:
 *   - 기존 토큰 (member_role 없음) → 'owner' 로 fallback (모든 권한)
 *   - 마이그레이션 0217 미적용 → 'owner' fallback
 *   - JWT 갱신 후 새 토큰부터 진짜 role 사용
 *
 * 작성: 2026-04-26 (R1)
 */

import type { Next } from 'hono'
import { effectivePermissions, ROLE_DEFAULTS, type Role, type Permissions } from './agency-members.routes'

/**
 * 특정 role(s) 만 허용. 토큰의 member_role 이 명시 role 중 하나여야 통과.
 *
 * @example
 *   app.post('/settlements/request', requireAgencyRole('owner', 'manager'), handler)
 */
export function requireAgencyRole(...allowedRoles: Role[]) {
  return async (c: any, next: Next) => {
    const agency = c.get('agency') as { member_role?: string } | undefined
    if (!agency) {
      return c.json({ success: false, error: '인증이 필요합니다.' }, 401)
    }
    const role = (agency.member_role as Role) || 'owner'
    if (!allowedRoles.includes(role)) {
      return c.json({
        success: false,
        error: `권한 부족 — 필요: ${allowedRoles.join('/')} / 현재: ${role}`,
        code: 'INSUFFICIENT_ROLE',
      }, 403)
    }
    return next()
  }
}

/**
 * 특정 권한 (Permissions key) 보유 시만 통과.
 * member_role 의 디폴트 권한 사용 (DB 의 override 는 1차 미적용).
 *
 * Phase 3 (별도): DB 의 agency_members.permissions 도 조회해서 effective merge.
 *
 * @example
 *   app.post('/coupons/distribute', requireAgencyPermission('coupon'), handler)
 */
export function requireAgencyPermission(permission: keyof Permissions) {
  return async (c: any, next: Next) => {
    const agency = c.get('agency') as { member_role?: string } | undefined
    if (!agency) {
      return c.json({ success: false, error: '인증이 필요합니다.' }, 401)
    }
    const role = (agency.member_role as Role) || 'owner'
    const perms = ROLE_DEFAULTS[role] || ROLE_DEFAULTS.analyst
    if (!perms[permission]) {
      return c.json({
        success: false,
        error: `권한 부족 — '${permission}' 필요 / 현재 role: ${role}`,
        code: 'INSUFFICIENT_PERMISSION',
      }, 403)
    }
    return next()
  }
}

/**
 * 현재 토큰의 effective permissions 반환 (디버그/UI 용).
 */
export function currentAgencyPermissions(c: any): Permissions {
  const agency = c.get('agency') as { member_role?: string } | undefined
  const role = (agency?.member_role as Role) || 'owner'
  return effectivePermissions(role)
}
