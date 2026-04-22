/**
 * Data-at-rest encryption (AES-GCM) regression tests
 *
 * Verifies src/worker/utils/data-crypto.ts behaves correctly:
 * - encrypt → decrypt round-trip
 * - missing KEK = passthrough (legacy plaintext compat)
 * - tampered ciphertext rejected
 * - non-deterministic encryption (different IV each call)
 * - format prefix v1: present
 */
import { describe, it, expect } from 'vitest';
import { encryptAtRest, decryptAtRest, isEncryptedAtRest } from '@/worker/utils/data-crypto';

const KEK = 'test-data-encryption-key-with-enough-entropy-32chars';

describe('encryptAtRest / decryptAtRest — round-trip', () => {
  it('roundtrips plaintext', async () => {
    const plain = 'cafe24-access-token-abc123';
    const cipher = await encryptAtRest(plain, KEK);
    expect(cipher).not.toBe(plain);
    expect(cipher.startsWith('v1:')).toBe(true);
    const decrypted = await decryptAtRest(cipher, KEK);
    expect(decrypted).toBe(plain);
  });

  it('roundtrips empty string', async () => {
    const cipher = await encryptAtRest('', KEK);
    expect(cipher).toBe(''); // empty stays empty
  });

  it('roundtrips Korean / multi-byte chars', async () => {
    const plain = '한글토큰🔐';
    const cipher = await encryptAtRest(plain, KEK);
    const decrypted = await decryptAtRest(cipher, KEK);
    expect(decrypted).toBe(plain);
  });

  it('roundtrips long values (push subscription key)', async () => {
    const plain = 'A'.repeat(2048);
    const cipher = await encryptAtRest(plain, KEK);
    const decrypted = await decryptAtRest(cipher, KEK);
    expect(decrypted).toBe(plain);
  });
});

describe('encryptAtRest — KEK missing (legacy passthrough)', () => {
  it('returns plaintext when KEK undefined', async () => {
    const result = await encryptAtRest('plain-token', undefined);
    expect(result).toBe('plain-token');
  });

  it('returns plaintext when KEK too short (<16 chars)', async () => {
    const result = await encryptAtRest('plain-token', 'short');
    expect(result).toBe('plain-token');
  });

  it('decryptAtRest returns legacy plaintext as-is (no v1: prefix)', async () => {
    const decrypted = await decryptAtRest('legacy-plaintext-value', KEK);
    expect(decrypted).toBe('legacy-plaintext-value');
  });
});

describe('encryptAtRest — non-determinism', () => {
  it('produces different ciphertexts for same input (random IV)', async () => {
    const plain = 'same-input';
    const a = await encryptAtRest(plain, KEK);
    const b = await encryptAtRest(plain, KEK);
    expect(a).not.toBe(b); // different IV → different ciphertext
    expect(await decryptAtRest(a, KEK)).toBe(plain);
    expect(await decryptAtRest(b, KEK)).toBe(plain);
  });
});

describe('decryptAtRest — error paths', () => {
  it('throws when KEK missing but encrypted value provided', async () => {
    const cipher = await encryptAtRest('plain', KEK);
    await expect(decryptAtRest(cipher, undefined)).rejects.toThrow(/DATA_ENCRYPTION_KEY/);
  });

  it('throws on malformed ciphertext (wrong v1: format)', async () => {
    await expect(decryptAtRest('v1:garbage', KEK)).rejects.toThrow();
  });

  it('throws when wrong KEK used to decrypt', async () => {
    const cipher = await encryptAtRest('plain', KEK);
    await expect(decryptAtRest(cipher, 'wrong-key-with-enough-entropy-too')).rejects.toThrow();
  });
});

describe('isEncryptedAtRest', () => {
  it('returns true for v1: prefix', async () => {
    const cipher = await encryptAtRest('plain', KEK);
    expect(isEncryptedAtRest(cipher)).toBe(true);
  });

  it('returns false for plaintext', () => {
    expect(isEncryptedAtRest('plain-text')).toBe(false);
    expect(isEncryptedAtRest('')).toBe(false);
    expect(isEncryptedAtRest(null)).toBe(false);
    expect(isEncryptedAtRest(undefined)).toBe(false);
  });
});
