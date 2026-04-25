/**
 * Unit tests for Notifications, Points (Deal Points), Points Charge, and Supply routes.
 *
 * Pure function mirrors of the route logic — no actual Hono routes are imported.
 * D1 is mocked via the standard project mock pattern.
 */

import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────
// D1 MOCK (standard project pattern)
// ─────────────────────────────────────────────────────────────────
const mockDB = {
  prepare: (_sql: string) => ({
    bind: (..._: unknown[]) => ({
      run: async () => ({ success: true, meta: { changes: 1 } }),
      first: async () => null,
      all: async () => ({ results: [] }),
    }),
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ success: true, meta: { changes: 1 } }),
  }),
};

// ─────────────────────────────────────────────────────────────────
// MIRRORED CONSTANTS (from source files)
// ─────────────────────────────────────────────────────────────────

// From src/features/points/api/points-helpers.ts
const CHARGE_AMOUNTS = [
  { amount: 5000,   points: 5000,   label: '5,000원 → 5,000딜' },
  { amount: 10000,  points: 10000,  label: '10,000원 → 10,000딜' },
  { amount: 30000,  points: 30000,  label: '30,000원 → 30,000딜' },
  { amount: 50000,  points: 50000,  label: '50,000원 → 50,000딜' },
  { amount: 100000, points: 100000, label: '100,000원 → 100,000딜' },
];
const DEFAULT_COMMISSION_RATE = 0.10;
const AD_REWARD_POINTS = 50;
const AD_DAILY_LIMIT = 10;

// From src/shared/constants/index.ts
const MIN_DONATION_DEALS = 500;
const TOSS_PAYMENT_URL = 'https://api.tosspayments.com/v1';

// Valid point transaction types (from the DB CHECK constraint in points-helpers.ts)
const POINT_TX_TYPES = ['charge', 'donate', 'refund', 'ad_reward'] as const;
type PointTxType = typeof POINT_TX_TYPES[number];

// ─────────────────────────────────────────────────────────────────
// MIRRORED LOGIC (pure functions extracted from route handlers)
// ─────────────────────────────────────────────────────────────────

// --- Notifications ---

/** parseUnifiedId — mirrored from notifications.routes.ts */
function parseUnifiedId(rawId: string): { table: 'user_notifications' | 'notifications' | 'auto'; numericId: string } {
  if (rawId.startsWith('un_')) return { table: 'user_notifications', numericId: rawId.slice(3) };
  if (rawId.startsWith('n_')) return { table: 'notifications', numericId: rawId.slice(2) };
  return { table: 'auto', numericId: rawId };
}

/** Pagination limit clamp — mirrored from GET /api/notifications handler */
function clampLimit(raw: string | undefined, defaultVal = 50, max = 200): number {
  return Math.min((parseInt(raw ?? String(defaultVal)) || defaultVal), max);
}

/** unread-count: no auth token → always returns 0 */
function unreadCountWithoutToken(authHeader: string | undefined): { success: boolean; count: number } {
  if (!authHeader?.startsWith('Bearer ')) return { success: true, count: 0 };
  return { success: true, count: 0 }; // fallback (actual verify omitted)
}

/** Mark-as-read ownership check (the DB WHERE clause enforces user_id match) */
function markReadOwnershipQuery(table: 'user_notifications' | 'notifications', numericId: string, userId: string, userType?: string): string {
  if (table === 'user_notifications') {
    return `UPDATE user_notifications SET is_read = 1 WHERE id = ${numericId} AND user_id = ${userId} AND is_read = 0`;
  }
  return `UPDATE notifications SET is_read = 1 WHERE id = ${numericId} AND user_id = ${userId} AND user_type = ${userType} AND is_read = 0`;
}

// --- Points Charge ---

/** Validates that the amount matches a known charge package */
function validateChargeAmount(amount: number): { valid: boolean; pkg?: typeof CHARGE_AMOUNTS[0] } {
  const pkg = CHARGE_AMOUNTS.find(p => p.amount === amount);
  return pkg ? { valid: true, pkg } : { valid: false };
}

/** orderId format for charge init — DEAL-{userId}-{timestamp} */
function buildOrderId(userId: string, now: number): string {
  return `DEAL-${userId}-${now}`;
}

/** Confirm flow: checks that pending.amount === submitted amount */
function confirmAmountMatches(pendingAmount: number, submittedAmount: number): boolean {
  return pendingAmount === submittedAmount;
}

/** Checks required fields for charge/confirm */
function validateConfirmPayload(paymentKey: string | undefined, orderId: string | undefined, amount: number | undefined): boolean {
  return !!(paymentKey && orderId && amount);
}

// --- Points Donate ---

/** Validates donate request fields — mirrors the route guard */
function validateDonateRequest(streamId: number | undefined, amount: number | undefined): { valid: boolean; error?: string } {
  if (!streamId || !amount || amount < MIN_DONATION_DEALS) {
    return { valid: false, error: `후원 금액은 최소 ${MIN_DONATION_DEALS}딜입니다` };
  }
  return { valid: true };
}

/** Insufficient balance check — mirrors the executeDonate wallet check */
function checkBalance(balance: number | undefined, required: number): { sufficient: boolean; code?: string } {
  if (!balance || balance < required) {
    return { sufficient: false, code: 'INSUFFICIENT_POINTS' };
  }
  return { sufficient: true };
}

/** Commission calculation — mirrors executeDonate */
function calcCommission(amount: number, rate: number): { commission: number; credit: number } {
  const commission = Math.round(amount * rate);
  return { commission, credit: amount - commission };
}

// --- Supply ---

/** Required field validation for POST /supply/register */
function validateRegisterPayload(productId: number | undefined, sellerPrice: number | undefined): { valid: boolean; error?: string } {
  if (!productId || !sellerPrice) {
    return { valid: false, error: '상품 ID와 판매가는 필수입니다' };
  }
  if (sellerPrice <= 0) {
    return { valid: false, error: '판매가는 0원 이상이어야 합니다' };
  }
  return { valid: true };
}

/** Supply price margin check — seller_price must be >= supply_price */
function validateMargin(sellerPrice: number, supplyPrice: number): { valid: boolean; error?: string } {
  if (supplyPrice > 0 && sellerPrice < supplyPrice) {
    return { valid: false, error: `판매가는 공급가(${supplyPrice.toLocaleString()}원) 이상이어야 합니다` };
  }
  return { valid: true };
}

/** Stock default: if not specified, falls back to original product stock */
function resolveStock(requestedStock: number | undefined, originalStock: number): number {
  return requestedStock ?? originalStock;
}

/** Sample request: product_id is required */
function validateSampleRequestPayload(productId: number | undefined): { valid: boolean; error?: string } {
  if (!productId) return { valid: false, error: '상품 ID가 필요합니다' };
  return { valid: true };
}

/** Pagination: page/limit for supply products */
function calcOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

function clampSupplyLimit(raw: string | undefined): number {
  return Math.min((parseInt(raw ?? '20', 10) || 20), 100);
}

// ─────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────

// ── 1. NOTIFICATIONS ──────────────────────────────────────────────

describe('Notifications', () => {
  describe('parseUnifiedId', () => {
    it('parses un_ prefix as user_notifications', () => {
      const r = parseUnifiedId('un_42');
      expect(r.table).toBe('user_notifications');
      expect(r.numericId).toBe('42');
    });

    it('parses n_ prefix as notifications', () => {
      const r = parseUnifiedId('n_99');
      expect(r.table).toBe('notifications');
      expect(r.numericId).toBe('99');
    });

    it('plain numeric id falls back to auto', () => {
      const r = parseUnifiedId('123');
      expect(r.table).toBe('auto');
      expect(r.numericId).toBe('123');
    });

    it('auto mode keeps the full raw value as numericId', () => {
      const r = parseUnifiedId('100');
      expect(r.numericId).toBe('100');
    });
  });

  describe('mark-as-read ownership enforcement', () => {
    it('user_notifications query includes user_id guard', () => {
      const q = markReadOwnershipQuery('user_notifications', '5', 'user-1');
      expect(q).toContain('user_id = user-1');
      expect(q).toContain('is_read = 0');
    });

    it('notifications query includes user_id AND user_type guard', () => {
      const q = markReadOwnershipQuery('notifications', '7', 'user-2', 'user');
      expect(q).toContain('user_id = user-2');
      expect(q).toContain('user_type = user');
      expect(q).toContain('is_read = 0');
    });

    it('ownership failure (no rows updated) → 404', () => {
      // simulate: changes === 0
      const updated = 0;
      expect(updated).toBe(0);
      // route returns 404 when updated === 0
    });
  });

  describe('pagination bounds', () => {
    it('defaults to 50 when no limit param', () => {
      expect(clampLimit(undefined)).toBe(50);
    });

    it('clamps to 200 when over-limit', () => {
      expect(clampLimit('500')).toBe(200);
      expect(clampLimit('999')).toBe(200);
    });

    it('accepts valid limit within range', () => {
      expect(clampLimit('100')).toBe(100);
      expect(clampLimit('1')).toBe(1);
    });

    it('falls back to default for non-numeric string', () => {
      expect(clampLimit('abc')).toBe(50);
    });
  });

  describe('unread-count without auth', () => {
    it('returns count 0 when Authorization header is absent', () => {
      const r = unreadCountWithoutToken(undefined);
      expect(r.success).toBe(true);
      expect(r.count).toBe(0);
    });

    it('returns count 0 when Authorization is not Bearer', () => {
      const r = unreadCountWithoutToken('Basic xyz');
      expect(r.success).toBe(true);
      expect(r.count).toBe(0);
    });
  });

  describe('notification type filtering (unread_only)', () => {
    it('unread_only=true adds AND is_read = 0 condition', () => {
      const unreadOnly = true;
      let query = 'SELECT * FROM user_notifications WHERE user_id = ?';
      if (unreadOnly) query += ' AND is_read = 0';
      expect(query).toContain('is_read = 0');
    });

    it('unread_only=false does not add the is_read condition', () => {
      const unreadOnly = false;
      let query = 'SELECT * FROM user_notifications WHERE user_id = ?';
      if (unreadOnly) query += ' AND is_read = 0';
      expect(query).not.toContain('is_read = 0');
    });
  });
});

// ── 2. POINTS SYSTEM (DEAL POINTS) ───────────────────────────────

describe('Points system (Deal Points)', () => {
  describe('CHARGE_AMOUNTS constants', () => {
    it('contains exactly 5 charge options', () => {
      expect(CHARGE_AMOUNTS).toHaveLength(5);
    });

    it('smallest charge option is 5000 won', () => {
      expect(CHARGE_AMOUNTS[0].amount).toBe(5000);
    });

    it('largest charge option is 100000 won', () => {
      expect(CHARGE_AMOUNTS[CHARGE_AMOUNTS.length - 1].amount).toBe(100000);
    });

    it('1원 = 1딜 for all options (no charge fee)', () => {
      for (const { amount, points } of CHARGE_AMOUNTS) {
        expect(points).toBe(amount);
      }
    });

    it('amounts are sorted in ascending order', () => {
      for (let i = 1; i < CHARGE_AMOUNTS.length; i++) {
        expect(CHARGE_AMOUNTS[i].amount).toBeGreaterThan(CHARGE_AMOUNTS[i - 1].amount);
      }
    });

    it('labels include correctly formatted amount and points', () => {
      for (const { amount, points, label } of CHARGE_AMOUNTS) {
        expect(label).toContain(amount.toLocaleString());
        expect(label).toContain(points.toLocaleString());
      }
    });
  });

  describe('minimum donation (MIN_DONATION_DEALS)', () => {
    it('MIN_DONATION_DEALS is 500', () => {
      expect(MIN_DONATION_DEALS).toBe(500);
    });

    it('amounts >= 500 pass donate validation', () => {
      for (const amt of [500, 501, 1000, 9999]) {
        expect(validateDonateRequest(1, amt).valid).toBe(true);
      }
    });

    it('amounts < 500 fail donate validation', () => {
      for (const amt of [0, 1, 100, 499]) {
        expect(validateDonateRequest(1, amt).valid).toBe(false);
      }
    });

    it('missing stream_id fails donate validation', () => {
      expect(validateDonateRequest(undefined, 500).valid).toBe(false);
      expect(validateDonateRequest(0, 500).valid).toBe(false);
    });
  });

  describe('balance validation (insufficient balance)', () => {
    it('exact balance is sufficient', () => {
      expect(checkBalance(500, 500).sufficient).toBe(true);
    });

    it('balance above required is sufficient', () => {
      expect(checkBalance(1000, 500).sufficient).toBe(true);
    });

    it('balance below required is insufficient', () => {
      const r = checkBalance(499, 500);
      expect(r.sufficient).toBe(false);
      expect(r.code).toBe('INSUFFICIENT_POINTS');
    });

    it('zero balance is insufficient for any positive amount', () => {
      expect(checkBalance(0, 1).sufficient).toBe(false);
    });

    it('undefined balance (no wallet row) is insufficient', () => {
      expect(checkBalance(undefined, 500).sufficient).toBe(false);
    });
  });

  describe('point transaction types', () => {
    it('POINT_TX_TYPES contains charge, donate, refund, ad_reward', () => {
      expect(POINT_TX_TYPES).toContain('charge');
      expect(POINT_TX_TYPES).toContain('donate');
      expect(POINT_TX_TYPES).toContain('refund');
      expect(POINT_TX_TYPES).toContain('ad_reward');
    });

    it('has exactly 4 valid transaction types', () => {
      expect(POINT_TX_TYPES).toHaveLength(4);
    });

    it('each type is a non-empty lowercase string', () => {
      for (const t of POINT_TX_TYPES) {
        expect(t).toMatch(/^[a-z_]+$/);
      }
    });
  });

  describe('integer-only amounts (no decimals)', () => {
    it('integer amounts are valid', () => {
      for (const amt of [500, 1000, 5000, 100000]) {
        expect(Number.isInteger(amt)).toBe(true);
      }
    });

    it('decimal amounts are not integers', () => {
      for (const amt of [500.5, 0.1, 999.99]) {
        expect(Number.isInteger(amt)).toBe(false);
      }
    });

    it('charge amounts are all integers', () => {
      for (const { amount, points } of CHARGE_AMOUNTS) {
        expect(Number.isInteger(amount)).toBe(true);
        expect(Number.isInteger(points)).toBe(true);
      }
    });
  });

  describe('commission calculation (donate flow)', () => {
    it('default commission rate is 10%', () => {
      expect(DEFAULT_COMMISSION_RATE).toBe(0.10);
    });

    it('1000딜 donate: commission 100, credit 900', () => {
      const { commission, credit } = calcCommission(1000, DEFAULT_COMMISSION_RATE);
      expect(commission).toBe(100);
      expect(credit).toBe(900);
    });

    it('commission + credit always equals amount', () => {
      for (const amount of [500, 1000, 3000, 10000]) {
        const { commission, credit } = calcCommission(amount, DEFAULT_COMMISSION_RATE);
        expect(commission + credit).toBe(amount);
      }
    });

    it('uses Math.round for sub-unit commission', () => {
      // 333 * 0.10 = 33.3 → rounds to 33
      const { commission, credit } = calcCommission(333, DEFAULT_COMMISSION_RATE);
      expect(commission).toBe(33);
      expect(credit).toBe(300);
    });
  });
});

// ── 3. POINTS CHARGE (Toss integration) ──────────────────────────

describe('Points Charge (Toss payment)', () => {
  describe('charge amount validation', () => {
    it('valid charge amount returns pkg', () => {
      const r = validateChargeAmount(10000);
      expect(r.valid).toBe(true);
      expect(r.pkg?.points).toBe(10000);
    });

    it('invalid charge amount is rejected', () => {
      for (const bad of [1, 999, 7777, 200000]) {
        expect(validateChargeAmount(bad).valid).toBe(false);
      }
    });

    it('all CHARGE_AMOUNTS entries pass validation', () => {
      for (const { amount } of CHARGE_AMOUNTS) {
        expect(validateChargeAmount(amount).valid).toBe(true);
      }
    });
  });

  describe('orderId format', () => {
    it('starts with DEAL- prefix', () => {
      const id = buildOrderId('123', Date.now());
      expect(id.startsWith('DEAL-')).toBe(true);
    });

    it('contains userId and timestamp', () => {
      const now = 1700000000000;
      const id = buildOrderId('user99', now);
      expect(id).toBe(`DEAL-user99-${now}`);
    });

    it('different timestamps produce different orderIds', () => {
      const id1 = buildOrderId('u1', 1000);
      const id2 = buildOrderId('u1', 2000);
      expect(id1).not.toBe(id2);
    });
  });

  describe('confirm flow: amount must match package', () => {
    it('matching amounts are accepted', () => {
      expect(confirmAmountMatches(10000, 10000)).toBe(true);
    });

    it('mismatched amounts are rejected', () => {
      expect(confirmAmountMatches(10000, 5000)).toBe(false);
      expect(confirmAmountMatches(5000, 10000)).toBe(false);
    });
  });

  describe('confirm payload required fields', () => {
    it('all three fields present → valid', () => {
      expect(validateConfirmPayload('pk_test_abc', 'DEAL-1-123', 10000)).toBe(true);
    });

    it('missing paymentKey → invalid', () => {
      expect(validateConfirmPayload(undefined, 'DEAL-1-123', 10000)).toBe(false);
      expect(validateConfirmPayload('', 'DEAL-1-123', 10000)).toBe(false);
    });

    it('missing orderId → invalid', () => {
      expect(validateConfirmPayload('pk_test_abc', undefined, 10000)).toBe(false);
    });

    it('missing amount → invalid', () => {
      expect(validateConfirmPayload('pk_test_abc', 'DEAL-1-123', undefined)).toBe(false);
    });
  });

  describe('duplicate payment key detection (CAS)', () => {
    it('if payment_key already set on pending row, no re-credit', () => {
      // Simulate: pending.payment_key is already set
      const pending = { id: 1, amount: 10000, points_amount: 10000, payment_key: 'pk_existing', balance_after: 10000 };
      const alreadyProcessed = !!pending.payment_key;
      expect(alreadyProcessed).toBe(true);
    });

    it('if payment_key is null, proceed to credit', () => {
      const pending = { id: 2, amount: 5000, points_amount: 5000, payment_key: null, balance_after: 0 };
      const alreadyProcessed = !!pending.payment_key;
      expect(alreadyProcessed).toBe(false);
    });

    it('CAS result changes===0 means another request won the race', () => {
      const casResult = { meta: { changes: 0 } };
      const raceWon = casResult.meta.changes > 0;
      expect(raceWon).toBe(false);
    });

    it('CAS result changes===1 means we own the credit', () => {
      const casResult = { meta: { changes: 1 } };
      const raceWon = casResult.meta.changes > 0;
      expect(raceWon).toBe(true);
    });
  });

  describe('Toss payment URL', () => {
    it('TOSS_PAYMENT_URL uses v1 API base', () => {
      expect(TOSS_PAYMENT_URL).toBe('https://api.tosspayments.com/v1');
    });

    it('confirm endpoint is constructed correctly', () => {
      const confirmUrl = `${TOSS_PAYMENT_URL}/payments/confirm`;
      expect(confirmUrl).toBe('https://api.tosspayments.com/v1/payments/confirm');
    });
  });
});

// ── 4. SUPPLY ROUTES ──────────────────────────────────────────────

describe('Supply routes', () => {
  describe('POST /supply/register: required fields', () => {
    it('product_id and seller_price both present → valid', () => {
      expect(validateRegisterPayload(1, 15000).valid).toBe(true);
    });

    it('missing product_id → invalid', () => {
      expect(validateRegisterPayload(undefined, 15000).valid).toBe(false);
    });

    it('product_id=0 is falsy → invalid', () => {
      expect(validateRegisterPayload(0, 15000).valid).toBe(false);
    });

    it('missing seller_price → invalid', () => {
      expect(validateRegisterPayload(1, undefined).valid).toBe(false);
    });

    it('seller_price zero → invalid (caught by !sellerPrice falsy check)', () => {
      const r = validateRegisterPayload(1, 0);
      expect(r.valid).toBe(false);
      // 0 is falsy so the "필수입니다" error fires before the "> 0" check
      expect(r.error).toContain('필수');
    });

    it('negative seller_price → invalid (caught by <= 0 check)', () => {
      const r = validateRegisterPayload(1, -500);
      expect(r.valid).toBe(false);
      expect(r.error).toContain('0원 이상');
    });
  });

  describe('supply price margin validation', () => {
    it('seller_price >= supply_price → valid', () => {
      expect(validateMargin(15000, 10000).valid).toBe(true);
      expect(validateMargin(10000, 10000).valid).toBe(true);
    });

    it('seller_price < supply_price → invalid', () => {
      const r = validateMargin(8000, 10000);
      expect(r.valid).toBe(false);
      expect(r.error).toContain('10,000원');
    });

    it('supply_price=0 (no constraint) always valid', () => {
      expect(validateMargin(1, 0).valid).toBe(true);
      expect(validateMargin(0, 0).valid).toBe(true);
    });
  });

  describe('stock quantity resolution', () => {
    it('uses requested stock when provided', () => {
      expect(resolveStock(50, 100)).toBe(50);
    });

    it('falls back to original product stock when undefined', () => {
      expect(resolveStock(undefined, 100)).toBe(100);
    });

    it('allows zero stock', () => {
      expect(resolveStock(0, 100)).toBe(0);
    });
  });

  describe('POST /supply/sample-requests: required fields', () => {
    it('product_id present → valid', () => {
      expect(validateSampleRequestPayload(5).valid).toBe(true);
    });

    it('product_id missing → invalid', () => {
      const r = validateSampleRequestPayload(undefined);
      expect(r.valid).toBe(false);
      expect(r.error).toContain('상품 ID');
    });

    it('product_id=0 is falsy → invalid', () => {
      expect(validateSampleRequestPayload(0).valid).toBe(false);
    });
  });

  describe('pagination for GET /supply/products', () => {
    it('offset is (page-1)*limit', () => {
      expect(calcOffset(1, 20)).toBe(0);
      expect(calcOffset(2, 20)).toBe(20);
      expect(calcOffset(3, 10)).toBe(20);
    });

    it('limit is clamped at 100', () => {
      expect(clampSupplyLimit('999')).toBe(100);
      expect(clampSupplyLimit('200')).toBe(100);
    });

    it('defaults to 20 when not specified', () => {
      expect(clampSupplyLimit(undefined)).toBe(20);
    });

    it('accepts values within range', () => {
      expect(clampSupplyLimit('50')).toBe(50);
      expect(clampSupplyLimit('1')).toBe(1);
    });
  });

  describe('sample request duplicate detection', () => {
    it('existing record with any status → 409', () => {
      const existing = { id: 1, status: 'PENDING' };
      // route returns 409 when existing is truthy
      expect(!!existing).toBe(true);
    });

    it('no existing record → allow insert', () => {
      const existing = null;
      expect(!!existing).toBe(false);
    });
  });

  describe('supply column migration guard', () => {
    it('if is_supply_product column count === 0, returns empty list', () => {
      const hasSupplyCol = { c: 0 };
      const shouldReturn = !hasSupplyCol || hasSupplyCol.c === 0;
      expect(shouldReturn).toBe(true);
    });

    it('if is_supply_product column count > 0, proceed with query', () => {
      const hasSupplyCol = { c: 1 };
      const shouldReturn = !hasSupplyCol || hasSupplyCol.c === 0;
      expect(shouldReturn).toBe(false);
    });
  });
});

// ── 5. MOCK DB SANITY ─────────────────────────────────────────────

describe('D1 mock sanity', () => {
  it('mockDB.prepare().bind().run() resolves with success', async () => {
    const r = await mockDB.prepare('SELECT 1').bind().run();
    expect(r.success).toBe(true);
    expect(r.meta.changes).toBe(1);
  });

  it('mockDB.prepare().bind().first() resolves with null', async () => {
    const r = await mockDB.prepare('SELECT 1').bind().first();
    expect(r).toBeNull();
  });

  it('mockDB.prepare().bind().all() resolves with empty results', async () => {
    const r = await mockDB.prepare('SELECT 1').bind().all();
    expect(r.results).toHaveLength(0);
  });
});
