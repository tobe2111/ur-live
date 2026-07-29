/**
 * Worker `safeRedirect()` 단위 테스트.
 *
 * 프론트엔드 `safe-internal-path.ts` 와 동일한 규칙을 갖지만, Worker 코드라
 * path alias 못 쓰고 인라인 유지. 양쪽 spec 이 동기화돼 있는지 회귀 테스트.
 *
 * frontend 헬퍼는 별도 36 테스트 (`safe-internal-path.test.ts`) 로 검증.
 */

import { describe, it, expect } from 'vitest'
import { __safeRedirectForTest as safeRedirect } from '@/features/auth/api/kakao.routes'

describe('Worker safeRedirect (kakao.routes.ts)', () => {
  describe('허용 — 안전한 내부 path', () => {
    it.each([
      ['/'],
      ['/products/123'],
      ['/live/42'],
      ['/seller'], // /seller/login 은 차단되지만 /seller 자체는 허용
      ['/my-orders'],
    ])('허용: %s', (path) => {
      expect(safeRedirect(path)).toBe(path)
    })

    // 🛡️ 2026-05-01: query / hash 제거 (URL 누적 방어 — ?error=...?error=... 차단)
    it('query string 제거: /checkout?step=2 → /checkout', () => {
      expect(safeRedirect('/checkout?step=2')).toBe('/checkout')
    })
    it('hash 제거: /products/1#section → /products/1', () => {
      expect(safeRedirect('/products/1#section')).toBe('/products/1')
    })
    it('error param 제거: /user/profile?error=database_error → /user/profile', () => {
      expect(safeRedirect('/user/profile?error=database_error&detail=foo')).toBe('/user/profile')
    })
  })

  describe('차단 — open redirect', () => {
    it.each([
      ['', '빈 문자열'],
      ['https://evil.com', '외부 URL'],
      ['//evil.com', 'protocol-relative'],
      ['evil.com/path', 'no leading slash'],
      ['/path\\..\\..', 'backslash'],
      ['/x\nNL', 'newline'],
      ['/x\tTAB', 'tab'],
    ])('차단(/로 fallback): %s (%s)', (path) => {
      expect(safeRedirect(path)).toBe('/')
    })
  })

  describe('차단 — 자기참조 OAuth hop 루프 (이번 사고의 핵심)', () => {
    it.each([
      '/login',
      '/login?returnUrl=/products',
      '/seller/login',
      '/admin/login',
      '/agency/login',
      '/auth/',
      '/auth/kakao/start',
      '/auth/kakao/start?redirect=/auth/kakao/start',
      '/auth/kakao/sync/callback?code=xxx',
      '/oauth/google/callback',
    ])('차단(/로 fallback): %s', (path) => {
      expect(safeRedirect(path)).toBe('/')
    })
  })

  describe('차단 — null/undefined/비문자열', () => {
    it.each([null, undefined, '', 0 as any, {} as any])('차단: %p', (val) => {
      expect(safeRedirect(val)).toBe('/')
    })
  })

  // 🧭 2026-07-11 (감사 §R2): ref/aff/invite 화이트리스트 보존 — frontend 와 동일 spec
  describe('어트리뷰션 화이트리스트 보존 (ref/aff/invite)', () => {
    it('?ref= 보존', () => {
      expect(safeRedirect('/group-buy/33?ref=123')).toBe('/group-buy/33?ref=123')
    })
    it('?aff= / ?invite= 보존', () => {
      expect(safeRedirect('/vouchers/9?aff=45')).toBe('/vouchers/9?aff=45')
      expect(safeRedirect('/?invite=77')).toBe('/?invite=77')
    })
    it('비화이트리스트 param 은 계속 제거', () => {
      expect(safeRedirect('/checkout?step=2')).toBe('/checkout')
      expect(safeRedirect('/group-buy/33?ref=123&error=x')).toBe('/group-buy/33?ref=123')
    })
    it('hash 는 계속 제거', () => {
      expect(safeRedirect('/group-buy/33?ref=123#h')).toBe('/group-buy/33?ref=123')
    })
    it('안전하지 않은 값은 보존 안 함', () => {
      expect(safeRedirect('/x?ref=<script>')).toBe('/x')
    })
    it('금지 path 는 ref 있어도 여전히 / fallback', () => {
      expect(safeRedirect('/login?ref=123')).toBe('/')
      expect(safeRedirect('/auth/kakao/start?ref=123')).toBe('/')
      expect(safeRedirect('//evil.com?ref=123')).toBe('/')
    })
  })

  describe('frontend safeInternalPath 와 양쪽 spec 동기화 회귀', () => {
    // 양쪽이 동일하게 차단해야 함. 만약 어느 한 쪽만 빼먹으면 OAuth hop 루프 재발 가능.
    it('양쪽 동일하게 차단: /auth/* 모든 경로', () => {
      ;['/auth/', '/auth/kakao', '/auth/kakao/start', '/auth/kakao/sync/callback', '/auth/foo/bar'].forEach((p) => {
        expect(safeRedirect(p)).toBe('/')
      })
    })

    it('양쪽 동일하게 차단: /login 변형', () => {
      ;['/login', '/login/', '/login?x=1', '/login#hash'].forEach((p) => {
        expect(safeRedirect(p)).toBe('/')
      })
    })
  })
})
