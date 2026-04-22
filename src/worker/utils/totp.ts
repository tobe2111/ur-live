// ============================================================
// TOTP (Time-based One-Time Password) — RFC 6238 / RFC 4226
// Admin 2FA 용. Web Crypto API 만으로 구현 (외부 의존성 없음).
// ============================================================

const DIGITS = 6;
const PERIOD = 30; // seconds

/**
 * Base32 decode (RFC 4648). TOTP secret 은 base32 로 교환됨.
 */
function base32Decode(encoded: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const stripped = encoded.replace(/[=\s]/g, '').toUpperCase();
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const c of stripped) {
    const idx = alphabet.indexOf(c);
    if (idx < 0) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

function base32Encode(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += alphabet[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 0x1f];
  return out;
}

/**
 * HMAC-SHA1 (TOTP spec 은 SHA-1). Web Crypto 사용.
 */
async function hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data as BufferSource);
  return new Uint8Array(sig);
}

/**
 * HOTP (RFC 4226) — counter 기반.
 */
async function hotp(secret: Uint8Array, counter: number): Promise<string> {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(4, counter, false); // big-endian 64bit, 상위 32bit 는 0
  const mac = await hmacSha1(secret, new Uint8Array(buf));
  const offset = mac[mac.length - 1] & 0x0f;
  const code =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, '0');
}

/**
 * 현재 TOTP 코드 생성 (주로 테스트용).
 */
export async function generateTOTP(secretBase32: string): Promise<string> {
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / PERIOD);
  return hotp(secret, counter);
}

/**
 * TOTP 검증 — ±1 윈도우 (총 90초 tolerance, replay 방지는 호출측에서).
 */
export async function verifyTOTP(secretBase32: string, code: string): Promise<boolean> {
  if (!code || code.length !== DIGITS) return false;
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / PERIOD);
  for (let i = -1; i <= 1; i++) {
    const expected = await hotp(secret, counter + i);
    if (expected === code) return true;
  }
  return false;
}

/**
 * 새 TOTP secret 생성 (20 bytes → 160 bit).
 */
export function generateTOTPSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return base32Encode(bytes);
}

/**
 * otpauth:// URI (QR 코드용).
 */
export function buildTOTPUri(secret: string, email: string, issuer = '유어딜 Admin'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD}`;
}
