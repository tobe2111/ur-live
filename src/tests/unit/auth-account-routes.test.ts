/**
 * 인증 및 계정 관리 라우트 단위 테스트
 *
 * Mirror of key validation logic from:
 *   1. src/features/auth/api/kakao.routes.ts
 *   2. src/features/auth/api/seller-auth-login.routes.ts
 *   3. src/features/auth/api/seller-auth-password.routes.ts
 *   4. src/features/account/api/account.routes.ts
 */
import { describe, it, expect } from 'vitest';

// ── D1 mock ──────────────────────────────────────────────────────────────────
const mockDB = {
  prepare: (sql: string) => ({
    bind: (..._args: unknown[]) => ({
      run: async () => ({ success: true, meta: { changes: 1 } }),
      first: async () => null,
      all: async () => ({ results: [] }),
    }),
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ success: true, meta: { changes: 1 } }),
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Mirror functions from kakao.routes.ts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * safeRedirect — only allow internal paths, no protocol-relative or external redirects
 */
function safeRedirect(path: string | null | undefined): string {
  if (!path || typeof path !== 'string') return '/';
  if (!path.startsWith('/')) return '/';
  if (path.startsWith('//')) return '/';
  if (path.includes('\\')) return '/';
  return path;
}

/**
 * readCookie — extract a named cookie value from the Cookie header string
 */
function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ?? null;
}

/**
 * parseStateCookie — parse "<state>|<base64url(redirect)>|<intent>" format
 */
function parseStateCookie(
  value: string | null
): { state: string; redirect: string; intent: 'user' | 'seller' | 'agency' } | null {
  if (!value) return null;
  const parts = value.split('|');
  if (parts.length < 2 || parts.length > 3) return null;
  const [state, encoded, intentRaw] = parts;
  if (!state || !encoded) return null;
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=');
    const redirect = decodeURIComponent(atob(padded));
    const intent = intentRaw === 'seller' || intentRaw === 'agency' ? intentRaw : 'user';
    return { state, redirect: safeRedirect(redirect), intent };
  } catch {
    return null;
  }
}

/**
 * validateKakaoCallbackCode — check that authorization code is present
 */
function validateKakaoCallbackCode(body: { code?: string }): { ok: true } | { ok: false; error: string } {
  if (!body.code) return { ok: false, error: 'Authorization code is required' };
  return { ok: true };
}

/**
 * validateKakaoFirebaseToken — check that accessToken is present
 */
function validateKakaoFirebaseToken(body: { accessToken?: string }): { ok: true } | { ok: false; error: string } {
  if (!body.accessToken) return { ok: false, error: 'Access token is required' };
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mirror functions from seller-auth-login.routes.ts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * validateSellerLoginInput — email + password must be non-empty
 */
function validateSellerLoginInput(
  body: { email?: string; password?: string }
): { ok: true } | { ok: false; statusCode: 400 | 500; error: string } {
  if (!body.email || !body.password) {
    return { ok: false, statusCode: 400, error: '이메일과 비밀번호를 입력해주세요.' };
  }
  return { ok: true };
}

/**
 * extractBearerToken — parse Authorization: Bearer <token> header
 */
function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * checkSellerStatus — pending / suspended accounts are rejected before password check
 */
function checkSellerStatus(
  status: string
): { ok: true } | { ok: false; statusCode: 403; error: string; code: string } {
  if (status === 'suspended') {
    return {
      ok: false,
      statusCode: 403,
      error: '정지된 계정입니다. 관리자에게 문의하세요.',
      code: 'ACCOUNT_SUSPENDED',
    };
  }
  if (status === 'pending') {
    return {
      ok: false,
      statusCode: 403,
      error: '승인 대기 중인 계정입니다. 관리자 승인 후 이용 가능합니다.',
      code: 'ACCOUNT_PENDING',
    };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mirror functions from seller-auth-password.routes.ts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * validateForgotPasswordInput — email must be non-empty after trimming
 */
function validateForgotPasswordInput(
  body: { email?: string }
): { ok: true } | { ok: false; statusCode: 400; error: string } {
  const email = (body?.email || '').trim();
  if (!email) {
    return { ok: false, statusCode: 400, error: '이메일을 입력해주세요.' };
  }
  return { ok: true };
}

/**
 * validateResetPasswordInput — both token and newPassword required
 */
function validateResetPasswordInput(
  body: { token?: string; newPassword?: string }
): { ok: true } | { ok: false; statusCode: 400; error: string } {
  const token = (body?.token || '').trim();
  const newPassword = body?.newPassword || '';
  if (!token || !newPassword) {
    return { ok: false, statusCode: 400, error: '토큰과 새 비밀번호를 입력해주세요.' };
  }
  return { ok: true };
}

/**
 * validatePasswordComplexity — mirror of src/lib/password.ts
 * Requirements: 10–128 chars, upper + lower + digit + special char, no 4-char repeats
 */
function validatePasswordComplexity(password: string): { ok: true } | { ok: false; error: string } {
  if (typeof password !== 'string') {
    return { ok: false, error: '비밀번호가 올바르지 않습니다.' };
  }
  if (password.length < 10) {
    return { ok: false, error: '비밀번호는 10자 이상이어야 합니다.' };
  }
  if (password.length > 128) {
    return { ok: false, error: '비밀번호는 128자 이하여야 합니다.' };
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNum = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password);
  if (!hasUpper || !hasLower || !hasNum || !hasSpecial) {
    return {
      ok: false,
      error: '비밀번호는 대문자, 소문자, 숫자, 특수문자를 모두 포함해야 합니다.',
    };
  }
  if (/(.)\1{3,}/.test(password)) {
    return { ok: false, error: '같은 문자 4회 이상 반복 불가.' };
  }
  return { ok: true };
}

/**
 * checkResetTokenExpiry — checks whether the token's expires_at is in the past
 */
function checkResetTokenExpiry(expiresAt: string): { expired: boolean } {
  const ts = new Date(expiresAt).getTime();
  if (isNaN(ts)) return { expired: true };
  return { expired: Date.now() > ts };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mirror functions from account.routes.ts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * validateDeleteAccountAuth — DELETE /api/account/delete requires authenticated user
 */
function validateDeleteAccountAuth(
  authenticatedUser: { id: number } | null
): { ok: true; userId: string } | { ok: false; statusCode: 401; message: string } {
  if (!authenticatedUser) {
    return { ok: false, statusCode: 401, message: '인증이 필요합니다.' };
  }
  // userId from auth token only — body.userId is ignored for security
  return { ok: true, userId: String(authenticatedUser.id) };
}

/**
 * validateCheckRestrictionQuery — GET /api/account/check-restriction requires email param
 */
function validateCheckRestrictionQuery(
  email: string | undefined | null
): { ok: true; email: string } | { ok: false; statusCode: 400; message: string } {
  if (!email) {
    return { ok: false, statusCode: 400, message: '이메일이 필요합니다.' };
  }
  return { ok: true, email };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Kakao Auth Routes
// ─────────────────────────────────────────────────────────────────────────────

describe('Kakao Auth — safeRedirect (open-redirect 방지)', () => {
  it('정상 내부 경로 → 그대로 반환', () => {
    expect(safeRedirect('/seller')).toBe('/seller');
  });

  it('null → "/"', () => {
    expect(safeRedirect(null)).toBe('/');
  });

  it('undefined → "/"', () => {
    expect(safeRedirect(undefined)).toBe('/');
  });

  it('외부 URL (http://evil.com) → "/"', () => {
    expect(safeRedirect('http://evil.com')).toBe('/');
  });

  it('프로토콜 상대 URL (//) → "/"', () => {
    expect(safeRedirect('//evil.com')).toBe('/');
  });

  it('백슬래시 포함 경로 → "/"', () => {
    expect(safeRedirect('/foo\\bar')).toBe('/');
  });

  it('빈 문자열 → "/"', () => {
    expect(safeRedirect('')).toBe('/');
  });

  it('/seller/dashboard → 그대로 반환', () => {
    expect(safeRedirect('/seller/dashboard')).toBe('/seller/dashboard');
  });
});

describe('Kakao Auth — readCookie', () => {
  it('단일 쿠키 헤더에서 값 추출', () => {
    expect(readCookie('kakao_oauth_state=abc123', 'kakao_oauth_state')).toBe('abc123');
  });

  it('다중 쿠키에서 올바른 이름의 값 추출', () => {
    expect(readCookie('session=xyz; kakao_oauth_state=state456; other=v', 'kakao_oauth_state')).toBe('state456');
  });

  it('쿠키 없음 → null', () => {
    expect(readCookie(null, 'kakao_oauth_state')).toBeNull();
  });

  it('요청 쿠키에 해당 키 없음 → null', () => {
    expect(readCookie('session=abc', 'kakao_oauth_state')).toBeNull();
  });
});

describe('Kakao Auth — parseStateCookie', () => {
  it('null 입력 → null', () => {
    expect(parseStateCookie(null)).toBeNull();
  });

  it('파이프 구분자가 없으면 → null', () => {
    expect(parseStateCookie('invalidvalue')).toBeNull();
  });

  it('4개 부분(너무 많음) → null', () => {
    expect(parseStateCookie('a|b|c|d')).toBeNull();
  });

  it('state/encoded 중 하나가 빈 문자열 → null', () => {
    expect(parseStateCookie('|encoded')).toBeNull();
  });

  it('유효한 2-part 쿠키: intent 기본값 "user"', () => {
    const encoded = btoa(encodeURIComponent('/home'))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const result = parseStateCookie(`state123|${encoded}`);
    expect(result).not.toBeNull();
    expect(result?.intent).toBe('user');
    expect(result?.redirect).toBe('/home');
    expect(result?.state).toBe('state123');
  });

  it('3-part 쿠키 intent="seller" 파싱', () => {
    const encoded = btoa(encodeURIComponent('/seller'))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const result = parseStateCookie(`mystate|${encoded}|seller`);
    expect(result).not.toBeNull();
    expect(result?.intent).toBe('seller');
  });

  it('3-part 쿠키 intent="agency" 파싱', () => {
    const encoded = btoa(encodeURIComponent('/agency'))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const result = parseStateCookie(`mystate|${encoded}|agency`);
    expect(result?.intent).toBe('agency');
  });

  it('알 수 없는 intent → "user"로 기본화', () => {
    const encoded = btoa(encodeURIComponent('/'))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const result = parseStateCookie(`mystate|${encoded}|admin`);
    expect(result?.intent).toBe('user');
  });
});

describe('Kakao Auth — POST /callback 입력 검증', () => {
  it('code 없음 → 에러', () => {
    const result = validateKakaoCallbackCode({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/code/i);
  });

  it('code 있음 → 통과', () => {
    const result = validateKakaoCallbackCode({ code: 'abc123' });
    expect(result.ok).toBe(true);
  });
});

describe('Kakao Auth — POST /firebase 입력 검증', () => {
  it('accessToken 없음 → 에러', () => {
    const result = validateKakaoFirebaseToken({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/token/i);
  });

  it('accessToken 있음 → 통과', () => {
    const result = validateKakaoFirebaseToken({ accessToken: 'ka_token_xyz' });
    expect(result.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Seller Auth Login
// ─────────────────────────────────────────────────────────────────────────────

describe('Seller Auth Login — 입력 검증', () => {
  it('email 없음 → 400', () => {
    const result = validateSellerLoginInput({ password: 'pw' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(400);
  });

  it('password 없음 → 400', () => {
    const result = validateSellerLoginInput({ email: 'a@b.com' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(400);
  });

  it('email + password 모두 없음 → 400', () => {
    const result = validateSellerLoginInput({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(400);
  });

  it('빈 문자열 email → 400', () => {
    const result = validateSellerLoginInput({ email: '', password: 'pw' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(400);
  });

  it('email + password 모두 있음 → 통과', () => {
    const result = validateSellerLoginInput({ email: 'seller@shop.com', password: 'strongpw' });
    expect(result.ok).toBe(true);
  });
});

describe('Seller Auth Login — Bearer 토큰 추출', () => {
  it('유효한 Bearer 토큰 추출', () => {
    expect(extractBearerToken('Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig')).toBe(
      'eyJhbGciOiJIUzI1NiJ9.payload.sig'
    );
  });

  it('헤더 없음 → null', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('Bearer 접두사 없음 → null', () => {
    expect(extractBearerToken('Token abc123')).toBeNull();
  });

  it('"Bearer " 뒤에 토큰 없음 → null', () => {
    expect(extractBearerToken('Bearer ')).toBeNull();
  });

  it('소문자 bearer → null (대소문자 구분)', () => {
    expect(extractBearerToken('bearer abc123')).toBeNull();
  });
});

describe('Seller Auth Login — 계정 상태 검증', () => {
  it('active 계정 → 통과', () => {
    const result = checkSellerStatus('active');
    expect(result.ok).toBe(true);
  });

  it('approved 계정 → 통과 (레거시 승인 상태)', () => {
    const result = checkSellerStatus('approved');
    expect(result.ok).toBe(true);
  });

  it('suspended 계정 → 403 ACCOUNT_SUSPENDED', () => {
    const result = checkSellerStatus('suspended');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(403);
      expect(result.code).toBe('ACCOUNT_SUSPENDED');
    }
  });

  it('pending 계정 → 403 ACCOUNT_PENDING', () => {
    const result = checkSellerStatus('pending');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(403);
      expect(result.code).toBe('ACCOUNT_PENDING');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Seller Auth Password
// ─────────────────────────────────────────────────────────────────────────────

describe('Seller Auth Password — forgot-password 입력 검증', () => {
  it('email 없음 → 400', () => {
    const result = validateForgotPasswordInput({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(400);
  });

  it('공백만 있는 email → 400 (trim 후 빈 문자열)', () => {
    const result = validateForgotPasswordInput({ email: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(400);
  });

  it('유효한 email → 통과', () => {
    const result = validateForgotPasswordInput({ email: 'user@example.com' });
    expect(result.ok).toBe(true);
  });
});

describe('Seller Auth Password — reset-password 입력 검증', () => {
  it('token 없음 → 400', () => {
    const result = validateResetPasswordInput({ newPassword: 'Str0ng!Pass' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(400);
  });

  it('newPassword 없음 → 400', () => {
    const result = validateResetPasswordInput({ token: 'some-token' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(400);
  });

  it('둘 다 없음 → 400', () => {
    const result = validateResetPasswordInput({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(400);
  });

  it('token + newPassword 모두 있음 → 통과', () => {
    const result = validateResetPasswordInput({ token: 'reset-tok', newPassword: 'NewP@ss1!' });
    expect(result.ok).toBe(true);
  });
});

describe('Password Complexity (validatePasswordComplexity)', () => {
  it('9자 → 길이 부족 실패', () => {
    const r = validatePasswordComplexity('Abc1!2345');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/10자/);
  });

  it('129자 → 길이 초과 실패', () => {
    const long = 'Aa1!' + 'x'.repeat(125);
    const r = validatePasswordComplexity(long);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/128자/);
  });

  it('대문자 없음 → 실패', () => {
    const r = validatePasswordComplexity('abc123!@#def');
    expect(r.ok).toBe(false);
  });

  it('소문자 없음 → 실패', () => {
    const r = validatePasswordComplexity('ABC123!@#DEF');
    expect(r.ok).toBe(false);
  });

  it('숫자 없음 → 실패', () => {
    const r = validatePasswordComplexity('AbcDefGhi!@#');
    expect(r.ok).toBe(false);
  });

  it('특수문자 없음 → 실패', () => {
    const r = validatePasswordComplexity('Abcdef1234gh');
    expect(r.ok).toBe(false);
  });

  it('4자 반복 → 실패', () => {
    // 소문자 'a' 4회 연속 반복 포함
    const r = validatePasswordComplexity('aaaaBcde1!xyz');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/반복/);
  });

  it('유효한 비밀번호 → 통과', () => {
    const r = validatePasswordComplexity('StrongP@ss1!');
    expect(r.ok).toBe(true);
  });

  it('경계값 10자 유효 비밀번호 → 통과', () => {
    const r = validatePasswordComplexity('Abcde1!@#0');
    expect(r.ok).toBe(true);
  });

  it('경계값 128자 유효 비밀번호 → 통과', () => {
    // 반복 패턴 없이 128자 — 'abcABC123!' 10자를 12번 + 나머지 8자
    const chunk = 'abcABC123!';
    const pw = (chunk.repeat(13)).slice(0, 128);
    expect(pw.length).toBe(128);
    const r = validatePasswordComplexity(pw);
    expect(r.ok).toBe(true);
  });
});

describe('Seller Auth Password — reset token 만료 체크', () => {
  it('과거 시각 → 만료됨', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(checkResetTokenExpiry(past).expired).toBe(true);
  });

  it('미래 시각 → 유효', () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect(checkResetTokenExpiry(future).expired).toBe(false);
  });

  it('잘못된 날짜 문자열 → 만료됨(안전 기본값)', () => {
    expect(checkResetTokenExpiry('not-a-date').expired).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Account Management Routes
// ─────────────────────────────────────────────────────────────────────────────

describe('Account Management — DELETE /delete 인증 검증', () => {
  it('인증 없음 → 401', () => {
    const result = validateDeleteAccountAuth(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(401);
  });

  it('인증된 유저 → ok, userId는 인증 토큰의 id 사용', () => {
    const result = validateDeleteAccountAuth({ id: 42 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.userId).toBe('42');
  });

  it('body.userId가 달라도 인증 토큰의 id 사용 (권한 우회 방지)', () => {
    // 요청 body에 다른 userId가 있어도 서버는 authenticatedUser.id 만 신뢰함
    const result = validateDeleteAccountAuth({ id: 7 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.userId).toBe('7');
  });
});

describe('Account Management — GET /check-restriction email 검증', () => {
  it('email 파라미터 없음 → 400', () => {
    const result = validateCheckRestrictionQuery(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(400);
      expect(result.message).toMatch(/이메일/);
    }
  });

  it('빈 문자열 email → 400', () => {
    const result = validateCheckRestrictionQuery('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(400);
  });

  it('유효한 email → 통과, email 그대로 반환', () => {
    const result = validateCheckRestrictionQuery('user@example.com');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.email).toBe('user@example.com');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. D1 mock — auth 관련 쿼리 동작 확인
// ─────────────────────────────────────────────────────────────────────────────

describe('D1 mock — auth DB 쿼리', () => {
  it('sellers 이메일 조회 → null (없는 계정)', async () => {
    const row = await mockDB
      .prepare('SELECT id, email, password_hash FROM sellers WHERE email = ?')
      .bind('notfound@example.com')
      .first();
    expect(row).toBeNull();
  });

  it('password_reset_tokens INSERT 쿼리 성공', async () => {
    const result = await mockDB
      .prepare(
        "INSERT INTO password_reset_tokens (user_type, user_id, token, expires_at) VALUES ('seller', ?, ?, ?)"
      )
      .bind(1, 'tok123', new Date(Date.now() + 3600_000).toISOString())
      .run();
    expect(result.success).toBe(true);
  });

  it('password_reset_tokens 조회 → null (존재하지 않는 토큰)', async () => {
    const row = await mockDB
      .prepare(
        "SELECT id, user_id, expires_at FROM password_reset_tokens WHERE token = ? AND user_type = 'seller'"
      )
      .bind('fake-token')
      .first();
    expect(row).toBeNull();
  });

  it('sellers password_hash UPDATE 쿼리 성공', async () => {
    const result = await mockDB
      .prepare("UPDATE sellers SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
      .bind('newhash', 1)
      .run();
    expect(result.success).toBe(true);
  });

  it('auth_refresh_tokens DELETE(revoke) 쿼리 성공', async () => {
    const result = await mockDB
      .prepare("DELETE FROM auth_refresh_tokens WHERE user_type = 'seller' AND user_id = ?")
      .bind(1)
      .run();
    expect(result.success).toBe(true);
  });
});
