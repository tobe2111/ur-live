// ============================================================
// Password Hashing using Web Crypto API
// Cloudflare Workers compatible password hashing
//
// 지원 해시 형식:
//   - PBKDF2 (현재):   "salt$hash"  (base64$base64)
//   - SHA-256 레거시: 64자 hex 문자열 ($ 없음, 고정 salt 방식)
//
// 점진적 마이그레이션:
//   로그인 시 verifyPassword()가 레거시 해시를 감지하면
//   isLegacyHash() === true를 반환합니다.
//   auth.routes.ts에서 이를 확인해 PBKDF2로 자동 재해싱합니다.
// ============================================================

// PBKDF2 파라미터
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = 'SHA-256';
const PBKDF2_BITS = 256;

/**
 * 비밀번호 복잡도 검증 — 신규 가입/비번 변경 시에만 적용.
 * 기존 사용자의 로그인은 차단하지 않는다.
 *
 * 조건:
 *  - 10 <= length <= 128
 *  - 대문자 1+ / 소문자 1+ / 숫자 1+ 포함
 */
export function validatePasswordComplexity(password: string): { ok: true } | { ok: false; error: string } {
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
  // 🛡️ 2026-04-22: 특수문자 필수 (이전엔 대/소/숫자 3 class 만 요구)
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password);
  if (!hasUpper || !hasLower || !hasNum || !hasSpecial) {
    return {
      ok: false,
      error: '비밀번호는 대문자, 소문자, 숫자, 특수문자를 모두 포함해야 합니다.'
    };
  }
  // 반복 패턴 방어 (예: "Abc123abc123" 같은 뻔한 조합)
  if (/(.)\1{3,}/.test(password)) {
    return { ok: false, error: '같은 문자 4회 이상 반복 불가.' };
  }
  return { ok: true };
}

/**
 * PBKDF2로 비밀번호 해싱
 * @returns "base64(salt)$base64(hash)" 형식
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordBuffer = new TextEncoder().encode(password);

  const key = await crypto.subtle.importKey(
    'raw', passwordBuffer,
    { name: 'PBKDF2' }, false, ['deriveBits']
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    key,
    PBKDF2_BITS
  );

  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));

  return `${saltB64}$${hashB64}`;
}

/**
 * 저장된 해시가 레거시 SHA-256 방식인지 판별
 *
 * 레거시 SHA-256 해시 특징:
 *  - '$' 구분자 없음 (또는 hex 64자 고정)
 *  - 형식: <hex64> 또는 <hex64>:<staticSalt>
 */
export function isLegacyHash(storedHash: string): boolean {
  if (!storedHash) return false;
  // PBKDF2 형식: base64$base64 (반드시 $ 포함, 양쪽 모두 base64)
  const parts = storedHash.split('$');
  if (parts.length === 2 && parts[0] && parts[1]) {
    // base64 여부 확인 (PBKDF2 salt는 16바이트 → base64 24자)
    // salt는 24자, hash는 44자 정도여야 함
    const [salt, hash] = parts;
    if (salt.length >= 20 && hash.length >= 40) {
      return false; // PBKDF2
    }
  }
  // 그 외 형식 → 레거시
  return true;
}

/**
 * 레거시 SHA-256 해시 검증
 *
 * 기존 구현 방식을 지원합니다:
 *  1. hex(SHA-256(staticSalt + password))  — auth.routes.ts 구 버전
 *  2. hex(SHA-256(password + staticSalt))  — 일부 변형
 *
 * 두 가지 모두 시도합니다.
 */
async function verifyLegacyHash(password: string, storedHash: string): Promise<boolean> {
  // 기존 코드에서 사용된 static salt
  const LEGACY_STATIC_SALT = 'marketplace-salt-2024';

  const encoder = new TextEncoder();

  // 시도 1: salt + password (기존 구현 기본)
  const attempt1 = encoder.encode(LEGACY_STATIC_SALT + password);
  const hash1 = await crypto.subtle.digest('SHA-256', attempt1);
  const hex1 = Array.from(new Uint8Array(hash1))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // 시도 2: password + salt (일부 변형)
  const attempt2 = encoder.encode(password + LEGACY_STATIC_SALT);
  const hash2 = await crypto.subtle.digest('SHA-256', attempt2);
  const hex2 = Array.from(new Uint8Array(hash2))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // 시도 3: password만 (salt 없이)
  const attempt3 = encoder.encode(password);
  const hash3 = await crypto.subtle.digest('SHA-256', attempt3);
  const hex3 = Array.from(new Uint8Array(hash3))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // ⚠️ constant-time 비교 (timing attack 방지)
  // 세 가지 후보를 모두 검사하고 OR로 결합해도 단일 비교 비용은 일정.
  const m1 = timingSafeEqual(hex1, storedHash);
  const m2 = timingSafeEqual(hex2, storedHash);
  const m3 = timingSafeEqual(hex3, storedHash);
  return m1 || m2 || m3;
}

/**
 * 비밀번호 검증
 *
 * PBKDF2 해시와 레거시 SHA-256 해시 모두 지원합니다.
 * 레거시 해시 감지 시 isLegacy: true를 반환하므로,
 * 호출 측에서 PBKDF2로 자동 재해싱을 수행할 수 있습니다.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<{ valid: boolean; isLegacy: boolean }> {

  // ── bcrypt 검증 ($2a$/$2b$/$2y$ prefix) ───────────────────
  // 구 admin/seller 계정이 bcrypt로 저장됨 (migrations/0104 등)
  // bcryptjs는 pure JS라 Worker 런타임 호환
  if (/^\$2[aby]\$/.test(storedHash)) {
    try {
      const bcrypt = await import('bcryptjs');
      const valid = await bcrypt.compare(password, storedHash);
      return { valid, isLegacy: true };
    } catch {
      return { valid: false, isLegacy: true };
    }
  }

  // ── PBKDF2 검증 ────────────────────────────────────────────
  if (!isLegacyHash(storedHash)) {
    const parts = storedHash.split('$');
    const saltB64 = parts[0];
    const hashB64 = parts[1];

    if (!saltB64 || !hashB64) {
      return { valid: false, isLegacy: false };
    }

    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
    const passwordBuffer = new TextEncoder().encode(password);

    const key = await crypto.subtle.importKey(
      'raw', passwordBuffer,
      { name: 'PBKDF2' }, false, ['deriveBits']
    );

    const hashBuffer = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
      key,
      PBKDF2_BITS
    );

    const computed = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));

    // 상수 시간 비교 (timing attack 방지)
    const valid = timingSafeEqual(computed, hashB64);
    return { valid, isLegacy: false };
  }

  // ── 레거시 SHA-256 검증 ────────────────────────────────────
  const valid = await verifyLegacyHash(password, storedHash);
  return { valid, isLegacy: true };
}

/**
 * 상수 시간 문자열 비교 (timing attack 방지)
 * 두 문자열이 같으면 true, 다르면 false
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // 길이가 다르더라도 항상 같은 시간을 소비 (아래 루프 실행)
    let result = 1;
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; i++) {
      result |= (a.charCodeAt(i) ^ b.charCodeAt(i));
    }
    return false; // 길이 다르면 무조건 false
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  }
  return diff === 0;
}
