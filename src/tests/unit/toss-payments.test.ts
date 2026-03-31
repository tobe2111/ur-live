import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the constants module before importing the module under test
vi.mock('../../shared/constants', () => ({
  TOSS_PAYMENT_URL: 'https://api.tosspayments.com/v1',
}));

import {
  tossCancelPayment,
  getLatestCancel,
  tossGetPayment,
  type TossPaymentCancelResponse,
} from '../../worker/utils/toss-payments';

// ── helpers ────────────────────────────────────────────────────────
function makeAuthHeader(secretKey: string): string {
  return `Basic ${btoa(secretKey + ':')}`;
}

describe('toss-payments utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── makeTossAuthHeader (tested indirectly via tossCancelPayment) ──
  describe('makeTossAuthHeader (via API calls)', () => {
    it('sends correct Basic auth header with secretKey + colon', async () => {
      const secretKey = 'test_gsk_abc123';
      const expectedAuth = makeAuthHeader(secretKey);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          paymentKey: 'pk_1',
          orderId: 'ord_1',
          status: 'CANCELED',
          cancels: [{ cancelAmount: 1000, cancelReason: 'test', canceledAt: '2026-01-01', transactionKey: 'tk' }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );

      await tossCancelPayment('pk_1', secretKey, 'test reason');

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [, init] = fetchSpy.mock.calls[0];
      expect((init as RequestInit).headers).toMatchObject({
        Authorization: expectedAuth,
      });
    });

    it('base64 encodes "secretKey:" correctly', () => {
      const key = 'test_gsk_mykey';
      const header = makeAuthHeader(key);
      // Decode and verify
      const decoded = atob(header.replace('Basic ', ''));
      expect(decoded).toBe('test_gsk_mykey:');
    });
  });

  // ── getLatestCancel ──────────────────────────────────────────────
  describe('getLatestCancel', () => {
    it('returns the last item in the cancels array', () => {
      const response: TossPaymentCancelResponse = {
        paymentKey: 'pk_1',
        orderId: 'ord_1',
        status: 'PARTIAL_CANCELED',
        cancels: [
          { cancelAmount: 500, cancelReason: 'first', canceledAt: '2026-01-01T00:00:00', transactionKey: 'tk1' },
          { cancelAmount: 300, cancelReason: 'second', canceledAt: '2026-01-02T00:00:00', transactionKey: 'tk2' },
          { cancelAmount: 200, cancelReason: 'latest', canceledAt: '2026-01-03T00:00:00', transactionKey: 'tk3' },
        ],
      };

      const latest = getLatestCancel(response);
      expect(latest).toBeDefined();
      expect(latest!.cancelReason).toBe('latest');
      expect(latest!.cancelAmount).toBe(200);
      expect(latest!.transactionKey).toBe('tk3');
    });

    it('returns the only item when there is exactly one cancel', () => {
      const response: TossPaymentCancelResponse = {
        paymentKey: 'pk_1',
        orderId: 'ord_1',
        status: 'CANCELED',
        cancels: [
          { cancelAmount: 1000, cancelReason: 'only one', canceledAt: '2026-01-01T00:00:00', transactionKey: 'tk1' },
        ],
      };

      const latest = getLatestCancel(response);
      expect(latest?.cancelReason).toBe('only one');
    });

    it('returns undefined when cancels array is empty', () => {
      const response: TossPaymentCancelResponse = {
        paymentKey: 'pk_1',
        orderId: 'ord_1',
        status: 'CANCELED',
        cancels: [],
      };

      expect(getLatestCancel(response)).toBeUndefined();
    });
  });

  // ── tossCancelPayment ────────────────────────────────────────────
  describe('tossCancelPayment', () => {
    const paymentKey = 'pk_test_123';
    const secretKey = 'test_gsk_secret';
    const cancelReason = 'Customer requested';

    it('returns success with data on HTTP 200', async () => {
      const mockData: TossPaymentCancelResponse = {
        paymentKey,
        orderId: 'ord_1',
        status: 'CANCELED',
        cancels: [
          { cancelAmount: 5000, cancelReason, canceledAt: '2026-03-31T10:00:00', transactionKey: 'tk1' },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockData), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );

      const result = await tossCancelPayment(paymentKey, secretKey, cancelReason);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('CANCELED');
        expect(result.data.cancels).toHaveLength(1);
      }
    });

    it('sends cancelAmount in body when provided', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          paymentKey, orderId: 'ord_1', status: 'PARTIAL_CANCELED',
          cancels: [{ cancelAmount: 3000, cancelReason, canceledAt: '2026-03-31', transactionKey: 'tk' }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );

      await tossCancelPayment(paymentKey, secretKey, cancelReason, 3000);

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.cancelAmount).toBe(3000);
      expect(body.cancelReason).toBe(cancelReason);
    });

    it('omits cancelAmount from body when not provided', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          paymentKey, orderId: 'ord_1', status: 'CANCELED',
          cancels: [{ cancelAmount: 5000, cancelReason, canceledAt: '2026-03-31', transactionKey: 'tk' }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );

      await tossCancelPayment(paymentKey, secretKey, cancelReason);

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.cancelAmount).toBeUndefined();
    });

    it('returns error object on HTTP 4xx with Toss error body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ code: 'ALREADY_CANCELED', message: 'Already canceled' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const result = await tossCancelPayment(paymentKey, secretKey, cancelReason);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('ALREADY_CANCELED');
        expect(result.message).toBe('Already canceled');
      }
    });

    it('returns UNKNOWN error when response body is not valid JSON', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Internal Server Error', { status: 500 }),
      );

      const result = await tossCancelPayment(paymentKey, secretKey, cancelReason);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('UNKNOWN');
      }
    });

    it('returns NETWORK_ERROR when fetch throws', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('DNS resolution failed'));

      const result = await tossCancelPayment(paymentKey, secretKey, cancelReason);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('NETWORK_ERROR');
        expect(result.message).toBe('DNS resolution failed');
      }
    });

    it('URL-encodes the paymentKey in the request URL', async () => {
      const specialKey = 'pk/with+special=chars';
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          paymentKey: specialKey, orderId: 'ord_1', status: 'CANCELED',
          cancels: [{ cancelAmount: 1000, cancelReason, canceledAt: '2026-03-31', transactionKey: 'tk' }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );

      await tossCancelPayment(specialKey, secretKey, cancelReason);

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain(encodeURIComponent(specialKey));
      expect(url).not.toContain('pk/with+special=chars/cancel');
    });
  });

  // ── tossGetPayment ───────────────────────────────────────────────
  describe('tossGetPayment', () => {
    it('returns success with payment info on HTTP 200', async () => {
      const mockPayment = {
        paymentKey: 'pk_1',
        orderId: 'ord_1',
        orderName: 'Test Order',
        status: 'DONE',
        totalAmount: 10000,
        method: 'CARD',
        approvedAt: '2026-03-31T10:00:00',
        requestedAt: '2026-03-31T09:59:00',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockPayment), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );

      const result = await tossGetPayment('pk_1', 'test_gsk_secret');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalAmount).toBe(10000);
        expect(result.data.status).toBe('DONE');
      }
    });

    it('returns NETWORK_ERROR when fetch throws', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));

      const result = await tossGetPayment('pk_1', 'test_gsk_secret');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('NETWORK_ERROR');
      }
    });
  });
});
