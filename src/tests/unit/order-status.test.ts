import { describe, it, expect } from 'vitest';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from '@/shared/constants';

/**
 * Order status transition and display constant tests.
 *
 * Transition rules from src/features/orders/services/OrderService.ts
 * Display constants from src/shared/constants/index.ts
 */

// ── Status transition map (mirrored from OrderService) ───────────
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped:    ['delivered', 'returned'],
  delivered:  ['returned'],
  cancelled:  [],
  returned:   [],
};

function isValidTransition(from: string, to: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

// ── Display constants status list ────────────────────────────────
const ALL_DISPLAY_STATUSES = [
  'PENDING', 'AWAITING_PAYMENT', 'PAID', 'DONE',
  'PREPARING', 'SHIPPING', 'DELIVERED',
  'CANCELLED', 'FAILED', 'REFUNDED',
];

// ── Tests ──────────────────────────────────────────────────────────
describe('Order status system', () => {

  // ── Valid transitions ──────────────────────────────────────────
  describe('Valid transitions', () => {
    it('pending -> confirmed', () => {
      expect(isValidTransition('pending', 'confirmed')).toBe(true);
    });

    it('pending -> cancelled', () => {
      expect(isValidTransition('pending', 'cancelled')).toBe(true);
    });

    it('confirmed -> processing', () => {
      expect(isValidTransition('confirmed', 'processing')).toBe(true);
    });

    it('confirmed -> cancelled', () => {
      expect(isValidTransition('confirmed', 'cancelled')).toBe(true);
    });

    it('processing -> shipped', () => {
      expect(isValidTransition('processing', 'shipped')).toBe(true);
    });

    it('processing -> cancelled', () => {
      expect(isValidTransition('processing', 'cancelled')).toBe(true);
    });

    it('shipped -> delivered', () => {
      expect(isValidTransition('shipped', 'delivered')).toBe(true);
    });

    it('shipped -> returned', () => {
      expect(isValidTransition('shipped', 'returned')).toBe(true);
    });

    it('delivered -> returned', () => {
      expect(isValidTransition('delivered', 'returned')).toBe(true);
    });
  });

  // ── Invalid (backward) transitions ─────────────────────────────
  describe('Invalid transitions (cannot go backwards)', () => {
    it('confirmed -> pending (backward)', () => {
      expect(isValidTransition('confirmed', 'pending')).toBe(false);
    });

    it('processing -> confirmed (backward)', () => {
      expect(isValidTransition('processing', 'confirmed')).toBe(false);
    });

    it('shipped -> processing (backward)', () => {
      expect(isValidTransition('shipped', 'processing')).toBe(false);
    });

    it('delivered -> shipped (backward)', () => {
      expect(isValidTransition('delivered', 'shipped')).toBe(false);
    });

    it('delivered -> pending (backward)', () => {
      expect(isValidTransition('delivered', 'pending')).toBe(false);
    });
  });

  // ── Terminal states ────────────────────────────────────────────
  describe('Terminal states', () => {
    it('cancelled has no further transitions', () => {
      expect(ALLOWED_TRANSITIONS['cancelled']).toEqual([]);
    });

    it('returned has no further transitions', () => {
      expect(ALLOWED_TRANSITIONS['returned']).toEqual([]);
    });

    it('cancelled -> confirmed is invalid', () => {
      expect(isValidTransition('cancelled', 'confirmed')).toBe(false);
    });

    it('returned -> shipped is invalid', () => {
      expect(isValidTransition('returned', 'shipped')).toBe(false);
    });
  });

  // ── Unknown status ─────────────────────────────────────────────
  describe('Unknown status handling', () => {
    it('unknown status has no valid transitions', () => {
      expect(isValidTransition('nonexistent', 'pending')).toBe(false);
    });
  });

  // ── ORDER_STATUS_LABELS ────────────────────────────────────────
  describe('ORDER_STATUS_LABELS', () => {
    it('has labels for all display statuses', () => {
      for (const status of ALL_DISPLAY_STATUSES) {
        expect(ORDER_STATUS_LABELS[status]).toBeDefined();
        expect(typeof ORDER_STATUS_LABELS[status]).toBe('string');
        expect(ORDER_STATUS_LABELS[status].length).toBeGreaterThan(0);
      }
    });

    it('PENDING label is 결제 대기', () => {
      expect(ORDER_STATUS_LABELS['PENDING']).toBe('결제 대기');
    });

    it('DONE label is 결제 완료', () => {
      expect(ORDER_STATUS_LABELS['DONE']).toBe('결제 완료');
    });

    it('PREPARING label is 상품 준비중', () => {
      expect(ORDER_STATUS_LABELS['PREPARING']).toBe('상품 준비중');
    });

    it('SHIPPING label is 배송중', () => {
      expect(ORDER_STATUS_LABELS['SHIPPING']).toBe('배송중');
    });

    it('DELIVERED label is 배송 완료', () => {
      expect(ORDER_STATUS_LABELS['DELIVERED']).toBe('배송 완료');
    });

    it('CANCELLED label is 취소됨', () => {
      expect(ORDER_STATUS_LABELS['CANCELLED']).toBe('취소됨');
    });

    it('FAILED label is 결제 실패', () => {
      expect(ORDER_STATUS_LABELS['FAILED']).toBe('결제 실패');
    });

    it('REFUNDED label is 환불 완료', () => {
      expect(ORDER_STATUS_LABELS['REFUNDED']).toBe('환불 완료');
    });
  });

  // ── ORDER_STATUS_COLORS ────────────────────────────────────────
  describe('ORDER_STATUS_COLORS', () => {
    it('has colors for all display statuses', () => {
      for (const status of ALL_DISPLAY_STATUSES) {
        expect(ORDER_STATUS_COLORS[status]).toBeDefined();
        expect(typeof ORDER_STATUS_COLORS[status]).toBe('string');
      }
    });

    it('PENDING uses yellow styling', () => {
      expect(ORDER_STATUS_COLORS['PENDING']).toBe('text-yellow-600 bg-yellow-50');
    });

    it('DONE uses green styling', () => {
      expect(ORDER_STATUS_COLORS['DONE']).toBe('text-green-600 bg-green-50');
    });

    it('PREPARING uses indigo styling', () => {
      expect(ORDER_STATUS_COLORS['PREPARING']).toBe('text-indigo-600 bg-indigo-50');
    });

    it('SHIPPING uses purple styling', () => {
      expect(ORDER_STATUS_COLORS['SHIPPING']).toBe('text-purple-600 bg-purple-50');
    });

    it('DELIVERED uses teal styling', () => {
      expect(ORDER_STATUS_COLORS['DELIVERED']).toBe('text-teal-600 bg-teal-50');
    });

    it('CANCELLED uses red styling', () => {
      expect(ORDER_STATUS_COLORS['CANCELLED']).toBe('text-red-600 bg-red-50');
    });

    it('FAILED uses red styling (same as CANCELLED)', () => {
      expect(ORDER_STATUS_COLORS['FAILED']).toBe('text-red-600 bg-red-50');
      expect(ORDER_STATUS_COLORS['FAILED']).toBe(ORDER_STATUS_COLORS['CANCELLED']);
    });

    it('REFUNDED uses gray styling', () => {
      expect(ORDER_STATUS_COLORS['REFUNDED']).toBe('text-gray-600 bg-gray-50');
    });

    it('all colors contain text- and bg- classes', () => {
      for (const status of ALL_DISPLAY_STATUSES) {
        expect(ORDER_STATUS_COLORS[status]).toMatch(/^text-\S+ bg-\S+$/);
      }
    });
  });

  // ── Status style mapping consistency ───────────────────────────
  describe('Labels and colors consistency', () => {
    it('every status with a label also has a color', () => {
      for (const status of Object.keys(ORDER_STATUS_LABELS)) {
        expect(ORDER_STATUS_COLORS[status]).toBeDefined();
      }
    });

    it('every status with a color also has a label', () => {
      for (const status of Object.keys(ORDER_STATUS_COLORS)) {
        expect(ORDER_STATUS_LABELS[status]).toBeDefined();
      }
    });

    it('PAID and DONE share the same color', () => {
      expect(ORDER_STATUS_COLORS['PAID']).toBe(ORDER_STATUS_COLORS['DONE']);
    });
  });
});
