import { describe, it, expect } from 'vitest'
import { isSafeInternalPath, safeInternalPath } from '@/utils/safe-internal-path'

describe('safe-internal-path', () => {
  describe('isSafeInternalPath - 허용', () => {
    it.each([
      '/',
      '/products/123',
      '/live/42',
      '/seller', // /seller/login 은 차단되지만 /seller 는 허용
      '/checkout',
      '/my-orders',
    ])('허용: %s', (path) => {
      expect(isSafeInternalPath(path)).toBe(true)
    })
  })

  describe('isSafeInternalPath - 차단 (open redirect)', () => {
    it.each([
      ['', '빈 문자열'],
      ['https://evil.com', '외부 URL'],
      ['//evil.com', 'protocol-relative'],
      ['evil.com/path', 'no leading slash'],
      ['/path\\..\\..', 'backslash'],
      ['/path\nwith\nnewline', 'newline'],
      ['/path\twith\ttab', 'tab'],
    ])('차단: %s (%s)', (path) => {
      expect(isSafeInternalPath(path)).toBe(false)
    })
  })

  describe('isSafeInternalPath - 차단 (자기참조 OAuth/login 루프)', () => {
    it.each([
      '/login',
      '/login?returnUrl=/products',
      '/login/forgot',
      '/seller/login',
      '/admin/login',
      '/agency/login',
      '/auth/',
      '/auth/kakao/start',
      '/auth/kakao/sync/callback?code=xxx',
      '/oauth/google/callback',
    ])('차단: %s', (path) => {
      expect(isSafeInternalPath(path)).toBe(false)
    })
  })

  describe('isSafeInternalPath - 비문자열', () => {
    it.each([null, undefined, 0, {}, [], true])('차단: %p', (val) => {
      expect(isSafeInternalPath(val)).toBe(false)
    })
  })

  describe('safeInternalPath - 통과시 raw 반환', () => {
    it('안전한 path 는 그대로', () => {
      expect(safeInternalPath('/products/42')).toBe('/products/42')
    })

    it('URL 인코딩된 안전 path 는 디코딩 후 반환', () => {
      expect(safeInternalPath('%2Fproducts%2F42')).toBe('/products/42')
    })
  })

  describe('safeInternalPath - 차단시 fallback', () => {
    it('기본 fallback 은 /', () => {
      expect(safeInternalPath('/login')).toBe('/')
      expect(safeInternalPath('//evil.com')).toBe('/')
      expect(safeInternalPath(null)).toBe('/')
    })

    it('명시적 fallback 사용', () => {
      expect(safeInternalPath('/login', '/seller')).toBe('/seller')
      expect(safeInternalPath(undefined, '/home')).toBe('/home')
    })
  })

  // 🧭 2026-07-11 (감사 §R2): ref/aff/invite 화이트리스트 보존 — 나머지 query/hash 는 계속 제거
  describe('safeInternalPath - 어트리뷰션 화이트리스트 보존', () => {
    it('?ref= 보존 (인플 share_url)', () => {
      expect(safeInternalPath('/group-buy/33?ref=123')).toBe('/group-buy/33?ref=123')
    })
    it('?aff= / ?invite= 보존', () => {
      expect(safeInternalPath('/vouchers/9?aff=45')).toBe('/vouchers/9?aff=45')
      expect(safeInternalPath('/?invite=77')).toBe('/?invite=77')
    })
    it('비화이트리스트 param 은 계속 제거 (에러 누적 방어 불변)', () => {
      expect(safeInternalPath('/user/profile?error=database_error')).toBe('/user/profile')
      expect(safeInternalPath('/group-buy/33?ref=123&error=x&utm_source=y')).toBe('/group-buy/33?ref=123')
    })
    it('hash 는 계속 제거', () => {
      expect(safeInternalPath('/group-buy/33?ref=123#section')).toBe('/group-buy/33?ref=123')
    })
    it('안전하지 않은 값(charset 밖)은 보존 안 함', () => {
      expect(safeInternalPath('/x?ref=<script>')).toBe('/x')
      expect(safeInternalPath('/x?ref=https://evil.com')).toBe('/x')
    })
    it('금지 path 는 ref 있어도 여전히 차단', () => {
      expect(safeInternalPath('/login?ref=123')).toBe('/')
      expect(safeInternalPath('/auth/kakao/start?ref=123')).toBe('/')
    })
    it('외부 URL 은 ref 있어도 여전히 차단', () => {
      expect(safeInternalPath('//evil.com?ref=123')).toBe('/')
    })
  })

  describe('회귀 — 카카오 OAuth 자기참조', () => {
    it('/auth/kakao/start?redirect=... 차단 (OAuth hop 루프)', () => {
      expect(safeInternalPath('/auth/kakao/start?redirect=/auth/kakao/start')).toBe('/')
    })

    it('encoded /auth/* 차단', () => {
      expect(safeInternalPath('%2Fauth%2Fkakao%2Fstart')).toBe('/')
    })

    it('/login?returnUrl=/login 차단 (PublicRoute 자기참조)', () => {
      expect(safeInternalPath('/login?returnUrl=%2Flogin')).toBe('/')
    })
  })
})
