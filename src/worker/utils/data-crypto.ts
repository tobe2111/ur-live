// ============================================================
// Data-at-Rest Encryption (AES-GCM) — DB 저장 전 민감 값 암호화
// ============================================================
// 용도: Cafe24 OAuth tokens, push subscription keys 등 DB 탈취 시
//       즉시 악용 가능한 값 보호. KEK 는 Cloudflare secret 으로 관리.
//
// 포맷: "v1:<base64url(iv)>:<base64url(ciphertext+tag)>"
// - v1 prefix 는 향후 알고리즘 마이그레이션 허용
// - IV 는 12 bytes random (GCM 권장)
// - key 는 KEK 를 SHA-256 한 결과 (raw 32 bytes) 사용
// ============================================================

const VERSION = 'v1';

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(kek: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(kek));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/**
 * 평문 → 암호문 문자열. KEK 없으면 원본 그대로 반환 (개발 환경 backward-compat).
 */
export async function encryptAtRest(plaintext: string, kek: string | undefined): Promise<string> {
  if (!kek || kek.length < 16) return plaintext; // 미설정 시 평문 저장 (legacy)
  if (!plaintext) return plaintext;
  const key = await deriveKey(kek);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)),
  );
  return `${VERSION}:${b64url(iv)}:${b64url(ct)}`;
}

/**
 * 암호문 → 평문. 암호화되지 않은(legacy) 값은 그대로 반환.
 */
export async function decryptAtRest(value: string | null | undefined, kek: string | undefined): Promise<string> {
  if (!value) return '';
  if (!value.startsWith(`${VERSION}:`)) return value; // legacy plaintext
  if (!kek) {
    // KEK 사라졌는데 암호화된 값이 있음 — 복구 불가
    throw new Error('DATA_ENCRYPTION_KEY missing but encrypted value found');
  }
  const [, ivB64, ctB64] = value.split(':');
  if (!ivB64 || !ctB64) throw new Error('Malformed ciphertext');
  const key = await deriveKey(kek);
  const iv = b64urlDecode(ivB64);
  const ct = b64urlDecode(ctB64);
  // TS lib 호환성 — Uint8Array<ArrayBufferLike> → BufferSource 변환
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource);
  return new TextDecoder().decode(pt);
}

/**
 * 암호문인지 빠르게 판단 (마이그레이션 시 유용).
 */
export function isEncryptedAtRest(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(`${VERSION}:`);
}
