/**
 * agency_members.routes.ts 의 effectivePermissions 헬퍼 단위 테스트.
 *
 * 검증 대상: 역할 디폴트 + JSON override 병합 로직.
 * 외부 IO 없음 — 순수 함수.
 *
 * 작성: 2026-04-26 (Q1)
 */

import { describe, it, expect } from 'vitest'
import {
  effectivePermissions,
  ROLE_DEFAULTS,
  type Role,
} from '../../features/agency/api/agency-members.routes'

describe('agency-members: effectivePermissions', () => {
  describe('역할 디폴트', () => {
    it('owner 는 모든 권한 true', () => {
      const p = effectivePermissions('owner')
      expect(p.invite).toBe(true)
      expect(p.settle).toBe(true)
      expect(p.campaign).toBe(true)
      expect(p.message).toBe(true)
      expect(p.coupon).toBe(true)
      expect(p.contract).toBe(true)
      expect(p.members).toBe(true)
      expect(p.view).toBe(true)
    })

    it('manager 는 contract/members 만 false', () => {
      const p = effectivePermissions('manager')
      expect(p.invite).toBe(true)
      expect(p.settle).toBe(true)
      expect(p.campaign).toBe(true)
      expect(p.message).toBe(true)
      expect(p.coupon).toBe(true)
      expect(p.contract).toBe(false)
      expect(p.members).toBe(false)
      expect(p.view).toBe(true)
    })

    it('agent 는 settle/campaign/contract/members false', () => {
      const p = effectivePermissions('agent')
      expect(p.invite).toBe(true)
      expect(p.settle).toBe(false)
      expect(p.campaign).toBe(false)
      expect(p.message).toBe(true)
      expect(p.coupon).toBe(true)
      expect(p.contract).toBe(false)
      expect(p.members).toBe(false)
      expect(p.view).toBe(true)
    })

    it('analyst 는 view 만 true', () => {
      const p = effectivePermissions('analyst')
      expect(p.invite).toBe(false)
      expect(p.settle).toBe(false)
      expect(p.campaign).toBe(false)
      expect(p.message).toBe(false)
      expect(p.coupon).toBe(false)
      expect(p.contract).toBe(false)
      expect(p.members).toBe(false)
      expect(p.view).toBe(true)
    })
  })

  describe('JSON override', () => {
    it('override 없으면 디폴트 그대로', () => {
      expect(effectivePermissions('analyst')).toEqual(ROLE_DEFAULTS.analyst)
    })

    it('override 일부 필드만 변경', () => {
      const p = effectivePermissions('analyst', JSON.stringify({ invite: true }))
      expect(p.invite).toBe(true)        // override
      expect(p.settle).toBe(false)        // 디폴트 유지
      expect(p.view).toBe(true)           // 디폴트 유지
    })

    it('override 가 디폴트 강화 (analyst 에 manager 권한 추가)', () => {
      const p = effectivePermissions('analyst', JSON.stringify({
        invite: true, message: true, coupon: true,
      }))
      expect(p.invite).toBe(true)
      expect(p.message).toBe(true)
      expect(p.coupon).toBe(true)
      // 나머지는 analyst 디폴트
      expect(p.settle).toBe(false)
      expect(p.campaign).toBe(false)
    })

    it('override 가 owner 권한 강등', () => {
      const p = effectivePermissions('owner', JSON.stringify({ settle: false }))
      expect(p.settle).toBe(false)
      expect(p.invite).toBe(true)         // 다른 owner 권한 유지
    })

    it('잘못된 JSON 은 디폴트 fallback', () => {
      const p = effectivePermissions('manager', 'NOT-VALID-JSON')
      expect(p).toEqual(ROLE_DEFAULTS.manager)
    })

    it('null override 는 디폴트', () => {
      expect(effectivePermissions('agent', null)).toEqual(ROLE_DEFAULTS.agent)
    })

    it('undefined override 는 디폴트', () => {
      expect(effectivePermissions('agent', undefined)).toEqual(ROLE_DEFAULTS.agent)
    })
  })

  describe('알 수 없는 role', () => {
    it('미등록 role 은 analyst 권한 (가장 제한적) 으로 fallback', () => {
      const p = effectivePermissions('hacker' as Role)
      expect(p).toEqual(ROLE_DEFAULTS.analyst)
    })
  })

  describe('보안 규칙', () => {
    it('analyst 가 어떤 override 로도 view 외 권한 가질 수 있음', () => {
      // ⚠️ 비즈니스 규칙: 현재 구현은 override 가 디폴트보다 우선.
      // 즉, analyst 가 설정에서 invite=true 받으면 invite 가능.
      // 이게 의도된 디자인 — owner 가 명시적으로 권한 부여 시.
      const p = effectivePermissions('analyst', JSON.stringify({ contract: true }))
      expect(p.contract).toBe(true)
    })

    it('owner 의 members 권한은 owner 만 가능 (디폴트)', () => {
      // analyst 에 members 권한 부여 가능하지만, API 측에서 'members' 권한 검증을
      // 별도로 owner 만 인정하는지 추가 검증 필요. 현재 테스트는 헬퍼 동작만.
      const p = effectivePermissions('analyst', JSON.stringify({ members: true }))
      expect(p.members).toBe(true)  // 헬퍼 레벨 — API 가드 별도
    })
  })
})
