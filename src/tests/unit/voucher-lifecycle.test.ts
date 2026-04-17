import { describe, it, expect } from 'vitest';

/**
 * Voucher lifecycle tests.
 *
 * The voucher system lives in:
 *   - src/features/group-buy/api/group-buy.routes.ts (generateVoucherCode, use endpoint)
 *   - src/pages/VoucherVerifyPage.tsx (client-side verification UI)
 *
 * These tests validate the pure business logic in isolation:
 *   1. Voucher code format (UR-XXXX-XXXX)
 *   2. Status transitions (unused -> used -> can't reuse)
 *   3. Expired voucher rejection
 *   4. PIN verification
 */

// ── Voucher code generator (mirrored from group-buy.routes.ts) ─────

function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'UR-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    if (i === 3) code += '-';
  }
  return code;
}

// ── Voucher status machine ─────────────────────────────────────────

type VoucherStatus = 'unused' | 'used' | 'expired' | 'refunded';

interface Voucher {
  id: number;
  code: string;
  status: VoucherStatus;
  expires_at: string | null;
  used_at: string | null;
  store_verify_pin: string | null;
}

function createVoucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    id: 1,
    code: generateVoucherCode(),
    status: 'unused',
    expires_at: new Date(Date.now() + 90 * 86400000).toISOString(), // 90 days
    used_at: null,
    store_verify_pin: null,
    ...overrides,
  };
}

/**
 * Mirrors the POST /api/vouchers/:code/use handler logic
 */
function useVoucher(
  voucher: Voucher,
  pin: string,
): { success: boolean; error?: string; voucher?: Voucher } {
  if (!voucher) return { success: false, error: 'Voucher not found' };

  if (voucher.status === 'used') {
    return { success: false, error: 'Already used voucher' };
  }

  if (voucher.status === 'expired') {
    return { success: false, error: 'Expired voucher' };
  }

  if (voucher.status === 'refunded') {
    return { success: false, error: 'Refunded voucher' };
  }

  // Check expiration by date
  if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
    return {
      success: false,
      error: 'Expired voucher',
      voucher: { ...voucher, status: 'expired' },
    };
  }

  // PIN verification
  if (voucher.store_verify_pin && voucher.store_verify_pin !== pin) {
    return { success: false, error: 'PIN mismatch' };
  }

  // Success: mark as used
  return {
    success: true,
    voucher: {
      ...voucher,
      status: 'used',
      used_at: new Date().toISOString(),
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────
describe('Voucher lifecycle', () => {

  // ── 1. Voucher code format (UR-XXXX-XXXX) ──────────────────────
  describe('Voucher code format', () => {
    it('matches UR-XXXX-XXXX pattern', () => {
      const code = generateVoucherCode();
      expect(code).toMatch(/^UR-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    });

    it('is exactly 12 characters long (UR- + 4 + - + 4)', () => {
      const code = generateVoucherCode();
      expect(code).toHaveLength(12);
    });

    it('does not contain ambiguous characters (0, O, 1, I)', () => {
      // chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      // Excluded: 0, 1, I, O to avoid confusion
      for (let i = 0; i < 100; i++) {
        const code = generateVoucherCode();
        const payload = code.replace(/^UR-/, '').replace(/-/g, '');
        expect(payload).not.toMatch(/[01IO]/);
      }
    });

    it('starts with UR- prefix', () => {
      const code = generateVoucherCode();
      expect(code.startsWith('UR-')).toBe(true);
    });

    it('has a dash at position 7 (between the two 4-char groups)', () => {
      const code = generateVoucherCode();
      expect(code[7]).toBe('-');
    });

    it('generates unique codes (statistical check over 1000 codes)', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        codes.add(generateVoucherCode());
      }
      // With 32^8 = ~1.1 trillion possibilities, 1000 codes should all be unique
      expect(codes.size).toBe(1000);
    });
  });

  // ── 2. Voucher status transitions ──────────────────────────────
  describe('Status transitions (unused -> used -> can\'t reuse)', () => {
    it('unused voucher can be used', () => {
      const voucher = createVoucher({ store_verify_pin: '1234' });
      const result = useVoucher(voucher, '1234');
      expect(result.success).toBe(true);
      expect(result.voucher!.status).toBe('used');
      expect(result.voucher!.used_at).not.toBeNull();
    });

    it('used voucher cannot be reused', () => {
      const voucher = createVoucher({ status: 'used', used_at: new Date().toISOString() });
      const result = useVoucher(voucher, '');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Already used');
    });

    it('expired voucher cannot be used', () => {
      const voucher = createVoucher({ status: 'expired' });
      const result = useVoucher(voucher, '');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Expired');
    });

    it('refunded voucher cannot be used', () => {
      const voucher = createVoucher({ status: 'refunded' });
      const result = useVoucher(voucher, '');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Refunded');
    });

    it('status transition is one-way: unused -> used (no going back)', () => {
      const voucher = createVoucher({ store_verify_pin: '1234' });
      const result1 = useVoucher(voucher, '1234');
      expect(result1.success).toBe(true);

      // Try to use the same (now used) voucher again
      const result2 = useVoucher(result1.voucher!, '1234');
      expect(result2.success).toBe(false);
    });
  });

  // ── 3. Expired voucher rejection ───────────────────────────────
  describe('Expired voucher rejection', () => {
    it('rejects voucher past its expires_at date', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // yesterday
      const voucher = createVoucher({ expires_at: pastDate });
      const result = useVoucher(voucher, '');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Expired');
    });

    it('auto-marks status as expired when date check fails', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const voucher = createVoucher({ expires_at: pastDate });
      const result = useVoucher(voucher, '');
      expect(result.voucher?.status).toBe('expired');
    });

    it('accepts voucher with future expires_at', () => {
      const futureDate = new Date(Date.now() + 30 * 86400000).toISOString(); // 30 days
      const voucher = createVoucher({ expires_at: futureDate });
      const result = useVoucher(voucher, '');
      expect(result.success).toBe(true);
    });

    it('accepts voucher with null expires_at (no expiration)', () => {
      const voucher = createVoucher({ expires_at: null });
      const result = useVoucher(voucher, '');
      expect(result.success).toBe(true);
    });

    it('default voucher expiry is 90 days from creation', () => {
      const voucher = createVoucher();
      const expiryDate = new Date(voucher.expires_at!);
      const now = new Date();
      const diffDays = Math.round((expiryDate.getTime() - now.getTime()) / 86400000);
      expect(diffDays).toBeGreaterThanOrEqual(89);
      expect(diffDays).toBeLessThanOrEqual(90);
    });
  });

  // ── 4. PIN verification ────────────────────────────────────────
  describe('PIN verification', () => {
    it('accepts correct PIN', () => {
      const voucher = createVoucher({ store_verify_pin: '1234' });
      const result = useVoucher(voucher, '1234');
      expect(result.success).toBe(true);
    });

    it('rejects incorrect PIN', () => {
      const voucher = createVoucher({ store_verify_pin: '1234' });
      const result = useVoucher(voucher, '0000');
      expect(result.success).toBe(false);
      expect(result.error).toContain('PIN mismatch');
    });

    it('rejects empty PIN when store has a PIN set', () => {
      const voucher = createVoucher({ store_verify_pin: '5678' });
      const result = useVoucher(voucher, '');
      expect(result.success).toBe(false);
      expect(result.error).toContain('PIN mismatch');
    });

    it('allows use without PIN when store has no PIN set', () => {
      const voucher = createVoucher({ store_verify_pin: null });
      const result = useVoucher(voucher, '');
      expect(result.success).toBe(true);
    });

    it('PIN comparison is exact (no trimming)', () => {
      const voucher = createVoucher({ store_verify_pin: '1234' });
      const result = useVoucher(voucher, ' 1234 ');
      expect(result.success).toBe(false);
    });

    it('PIN can be alphanumeric', () => {
      const voucher = createVoucher({ store_verify_pin: 'abc123' });
      const result = useVoucher(voucher, 'abc123');
      expect(result.success).toBe(true);
    });
  });

  // ── Combined scenarios ──────────────────────────────────────────
  describe('Combined scenarios', () => {
    it('expired + wrong PIN: expiry check comes first', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const voucher = createVoucher({ expires_at: pastDate, store_verify_pin: '1234' });
      const result = useVoucher(voucher, 'wrong');
      // Expiry is checked before PIN
      expect(result.success).toBe(false);
      expect(result.error).toContain('Expired');
    });

    it('used + expired: used status check comes first', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const voucher = createVoucher({ status: 'used', expires_at: pastDate });
      const result = useVoucher(voucher, '');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Already used');
    });

    it('full lifecycle: create -> verify format -> use -> reject reuse', () => {
      const voucher = createVoucher({ store_verify_pin: 'secret' });

      // 1. Verify code format
      expect(voucher.code).toMatch(/^UR-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(voucher.status).toBe('unused');

      // 2. Use with correct PIN
      const used = useVoucher(voucher, 'secret');
      expect(used.success).toBe(true);
      expect(used.voucher!.status).toBe('used');

      // 3. Attempt reuse
      const reuse = useVoucher(used.voucher!, 'secret');
      expect(reuse.success).toBe(false);
    });
  });
});
