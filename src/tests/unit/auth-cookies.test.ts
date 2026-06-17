import { describe, it, expect } from 'vitest';
import { authTokenSetCookie, authTokenClearCookie, readAuthTokenCookie } from '@/worker/utils/auth-cookies';

/**
 * 🔐 쿠키 전환 Phase 1 — ud_* httpOnly 토큰 쿠키 헬퍼 (4개 대시보드 역할).
 * 값 = 기존 JWT, 읽기는 GET 전용(미들웨어), 쓰기는 Bearer 전용(CSRF 표면 0).
 */
const ROLES = ['ud_seller_token', 'ud_agency_token', 'ud_admin_token', 'ud_supplier_token'] as const;

describe('authTokenSetCookie', () => {
  it('produces HttpOnly + Secure + SameSite=Lax cookie for all 4 roles', () => {
    for (const name of ROLES) {
      const c = authTokenSetCookie(name, 'jwt.tok.en', 'live.ur-team.com');
      expect(c).toContain(`${name}=jwt.tok.en`);
      expect(c).toContain('HttpOnly');
      expect(c).toContain('Secure');
      expect(c).toContain('SameSite=Lax');
      expect(c).toContain('Path=/');
      expect(c).toContain('Max-Age=2592000'); // 30d default
    }
  });

  it('attaches Domain=.ur-team.com only for ur-team.com hosts (host-only otherwise)', () => {
    expect(authTokenSetCookie('ud_admin_token', 'x', 'live.ur-team.com')).toContain('Domain=.ur-team.com');
    expect(authTokenSetCookie('ud_admin_token', 'x', 'beta.ur-team.com')).toContain('Domain=.ur-team.com');
    // 도매 도메인 / pages.dev → host-only (Domain 속성 없음)
    expect(authTokenSetCookie('ud_supplier_token', 'x', 'utongstart.com')).not.toContain('Domain=');
    expect(authTokenSetCookie('ud_seller_token', 'x', 'ur-live.pages.dev')).not.toContain('Domain=');
  });
});

describe('authTokenClearCookie', () => {
  it('produces Max-Age=0 for all 4 roles', () => {
    for (const name of ROLES) {
      expect(authTokenClearCookie(name, 'live.ur-team.com')).toContain(`${name}=; HttpOnly`);
      expect(authTokenClearCookie(name, 'live.ur-team.com')).toContain('Max-Age=0');
    }
  });
});

describe('readAuthTokenCookie', () => {
  it('returns null when no cookie header / no ud_* token', () => {
    expect(readAuthTokenCookie(null)).toBeNull();
    expect(readAuthTokenCookie('foo=bar; baz=qux')).toBeNull();
  });

  it('extracts each of the 4 ud_* role tokens', () => {
    expect(readAuthTokenCookie('ud_seller_token=AAA')).toBe('AAA');
    expect(readAuthTokenCookie('other=1; ud_agency_token=BBB; x=2')).toBe('BBB');
    expect(readAuthTokenCookie('ud_admin_token=CCC')).toBe('CCC');
    expect(readAuthTokenCookie('ud_supplier_token=DDD')).toBe('DDD');
  });
});
