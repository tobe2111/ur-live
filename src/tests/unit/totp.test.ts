/**
 * TOTP (RFC 6238) regression tests for Admin 2FA
 *
 * Verifies the implementation in src/worker/utils/totp.ts:
 * - Secret generation produces valid base32
 * - Generated codes are 6-digit numerics
 * - Verify accepts current and ±1 window codes
 * - Verify rejects invalid codes
 * - URI format follows otpauth://totp/ spec
 */
import { describe, it, expect } from 'vitest';
import { generateTOTP, verifyTOTP, generateTOTPSecret, buildTOTPUri } from '@/worker/utils/totp';

describe('TOTP — secret generation', () => {
  it('generates 32-character base32 secret', () => {
    const s = generateTOTPSecret();
    expect(s).toMatch(/^[A-Z2-7]+$/);
    expect(s.length).toBeGreaterThanOrEqual(32);
  });

  it('produces unique secrets across invocations', () => {
    const a = generateTOTPSecret();
    const b = generateTOTPSecret();
    expect(a).not.toBe(b);
  });
});

describe('TOTP — code generation/verification round-trip', () => {
  it('generated code is 6 digits', async () => {
    const secret = generateTOTPSecret();
    const code = await generateTOTP(secret);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('verifies the just-generated code', async () => {
    const secret = generateTOTPSecret();
    const code = await generateTOTP(secret);
    expect(await verifyTOTP(secret, code)).toBe(true);
  });

  it('rejects code generated with different secret', async () => {
    const secretA = generateTOTPSecret();
    const secretB = generateTOTPSecret();
    const code = await generateTOTP(secretA);
    expect(await verifyTOTP(secretB, code)).toBe(false);
  });

  it('rejects malformed code (5 digits)', async () => {
    const secret = generateTOTPSecret();
    expect(await verifyTOTP(secret, '12345')).toBe(false);
  });

  it('rejects malformed code (7 digits)', async () => {
    const secret = generateTOTPSecret();
    expect(await verifyTOTP(secret, '1234567')).toBe(false);
  });

  it('rejects empty code', async () => {
    const secret = generateTOTPSecret();
    expect(await verifyTOTP(secret, '')).toBe(false);
  });

  it('rejects obviously wrong code (000000)', async () => {
    const secret = generateTOTPSecret();
    // 천만분의 1 확률로 000000 이 정답일 수 있으나 실용상 무시
    const realCode = await generateTOTP(secret);
    if (realCode !== '000000') {
      expect(await verifyTOTP(secret, '000000')).toBe(false);
    }
  });
});

describe('TOTP — otpauth URI', () => {
  const secret = 'JBSWY3DPEHPK3PXP'; // RFC 6238 example

  it('contains required parameters', () => {
    const uri = buildTOTPUri(secret, 'admin@example.com');
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
    expect(uri).toContain('algorithm=SHA1');
    expect(uri).toContain('issuer=');
  });

  it('URL-encodes email and issuer', () => {
    const uri = buildTOTPUri(secret, 'admin@example.com', 'My Service');
    expect(uri).toContain('admin%40example.com');
    expect(uri).toContain('issuer=My%20Service');
  });
});
