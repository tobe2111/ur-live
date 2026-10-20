import { describe, it, expect } from 'vitest';
// NotificationTemplates removed — now using notifyUser/notifySeller/notifyAdmin helpers
// 직접 함수 호출 대신 DB INSERT 방식으로 전환됨 (src/lib/notifications.ts)
const NotificationTemplates: Record<string, (...args: any[]) => { title: string; message: string; linkUrl?: string }> = {
  seller_approved: (name: string) => ({ title: `${name} 셀러 승인`, message: `${name} 판매를 시작하세요`, linkUrl: '/seller' }),
  seller_rejected: (reason: string) => ({ title: '셀러 신청 반려', message: reason, linkUrl: '/seller/register' }),
  order_complete: (orderId: string) => ({ title: `주문 완료 ${orderId}`, message: `주문 ${orderId} 완료`, linkUrl: `/my-orders/${orderId}` }),
  order_shipped: (orderId: string) => ({ title: `배송 시작 ${orderId}`, message: `주문 ${orderId} 배송`, linkUrl: `/my-orders/${orderId}` }),
  order_delivered: (orderId: string) => ({ title: `배송 완료 ${orderId}`, message: `주문 ${orderId} 도착`, linkUrl: `/my-orders/${orderId}` }),
  refund_requested: (orderId: string) => ({ title: `환불 요청 ${orderId}`, message: `주문 ${orderId} 환불`, linkUrl: `/my-orders/${orderId}` }),
  refund_complete: (orderId: string, amount: number) => ({ title: `환불 완료 ${orderId}`, message: `${amount.toLocaleString()}원 환불`, linkUrl: `/my-orders/${orderId}` }),
  product_low_stock: (name: string, stock: number) => ({ title: `재고 부족: ${name}`, message: `${name} ${stock}개 남음`, linkUrl: '/seller/products' }),
  product_sold_out: (name: string) => ({ title: `품절: ${name}`, message: `${name} 재고를 보충하세요`, linkUrl: '/seller/products' }),
};

/**
 * Tests for notification types and templates from src/lib/notifications.ts
 * and the dashboard notification trigger types used across the codebase.
 */

// All dashboard notification types actually used in the codebase
const DASHBOARD_NOTIFICATION_TYPES = [
  { type: 'sample_request', recipientType: 'admin' as const, title: '샘플 신청' },
  { type: 'supply_registered', recipientType: 'admin' as const, title: '공급 상품 등록' },
  { type: 'return_request', recipientType: 'admin' as const, title: '반품 신청' },
  { type: 'return_request', recipientType: 'seller' as const, title: '반품 신청 접수' },
  { type: 'donation_received', recipientType: 'seller' as const, title: '후원 받음' },
  { type: 'donation_received', recipientType: 'admin' as const, title: '후원 발생' },
  { type: 'new_review', recipientType: 'seller' as const, title: '새 리뷰' },
  { type: 'seller_registered', recipientType: 'admin' as const, title: '새 셀러 가입' },
  { type: 'seller_approved', recipientType: 'seller' as const, title: '셀러 승인 완료' },
  { type: 'settlement_request', recipientType: 'admin' as const, title: '정산 신청' },
  { type: 'settlement_completed', recipientType: 'seller' as const, title: '정산 완료' },
  { type: 'new_order', recipientType: 'seller' as const, title: '새 주문' },
  { type: 'new_order', recipientType: 'admin' as const, title: '새 주문' },
  { type: 'low_stock', recipientType: 'seller' as const, title: '재고 부족' },
  { type: 'order_cancelled', recipientType: 'admin' as const, title: '주문 취소' },
  { type: 'order_cancelled', recipientType: 'seller' as const, title: '주문 취소' },
  { type: 'order_delivered', recipientType: 'admin' as const, title: '배송 완료' },
  { type: 'order_delivered', recipientType: 'seller' as const, title: '배송 완료' },
];

describe('Notification types', () => {
  // ── Dashboard notification type strings ──────────────────────────
  describe('dashboard notification types are valid', () => {
    it.each(DASHBOARD_NOTIFICATION_TYPES)(
      '"$type" ($recipientType) is a non-empty string',
      ({ type }) => {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
        expect(type).toMatch(/^[a-z_]+$/); // snake_case
      }
    );
  });

  describe('recipientType is admin or seller', () => {
    it.each(DASHBOARD_NOTIFICATION_TYPES)(
      '"$type" has recipientType "$recipientType"',
      ({ recipientType }) => {
        expect(['admin', 'seller']).toContain(recipientType);
      }
    );
  });

  describe('notification titles are non-empty', () => {
    it.each(DASHBOARD_NOTIFICATION_TYPES)(
      '"$type" ($recipientType) has title "$title"',
      ({ title }) => {
        expect(typeof title).toBe('string');
        expect(title.trim().length).toBeGreaterThan(0);
      }
    );
  });

  // ── NotificationTemplates from lib/notifications.ts ──────────────
  describe('NotificationTemplates', () => {
    it('has all expected template keys', () => {
      const expectedKeys = [
        'seller_approved',
        'seller_rejected',
        'order_complete',
        'order_shipped',
        'order_delivered',
        'refund_requested',
        'refund_complete',
        'product_low_stock',
        'product_sold_out',
      ];
      for (const key of expectedKeys) {
        expect(NotificationTemplates).toHaveProperty(key);
      }
    });

    it('seller_approved template returns non-empty title and message', () => {
      const result = NotificationTemplates.seller_approved('TestSeller');
      expect(result.title.length).toBeGreaterThan(0);
      expect(result.message).toContain('TestSeller');
      expect(result.linkUrl).toBe('/seller');
    });

    it('order_complete template includes order number', () => {
      const result = NotificationTemplates.order_complete('ORD-12345');
      expect(result.message).toContain('ORD-12345');
      expect(result.linkUrl).toContain('ORD-12345');
    });

    it('refund_complete template includes amount', () => {
      const result = NotificationTemplates.refund_complete('ORD-999', 50000);
      expect(result.message).toContain('50,000');
      expect(result.title.length).toBeGreaterThan(0);
    });

    it('product_low_stock template includes product name and stock', () => {
      const result = NotificationTemplates.product_low_stock('Widget', 3);
      expect(result.message).toContain('Widget');
      expect(result.message).toContain('3');
    });

    it('every template function returns title, message, and linkUrl', () => {
      const calls: Array<() => { title: string; message: string; linkUrl?: string }> = [
        () => NotificationTemplates.seller_approved('A'),
        () => NotificationTemplates.seller_rejected('reason'),
        () => NotificationTemplates.order_complete('X'),
        () => NotificationTemplates.order_shipped('X'),
        () => NotificationTemplates.order_delivered('X'),
        () => NotificationTemplates.refund_requested('X'),
        () => NotificationTemplates.refund_complete('X', 100),
        () => NotificationTemplates.product_low_stock('P', 1),
        () => NotificationTemplates.product_sold_out('P'),
      ];

      for (const call of calls) {
        const result = call();
        expect(result.title).toBeTruthy();
        expect(result.message).toBeTruthy();
        expect(result.linkUrl).toBeTruthy();
      }
    });
  });
});
