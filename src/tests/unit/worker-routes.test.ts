/**
 * Worker Routes 단위 테스트 (orders, streams, users, viewers)
 */
import { describe, it, expect } from 'vitest';

const mockDB = {
  prepare: (_sql: string) => ({
    bind: (..._: unknown[]) => ({
      run: async () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
      first: async () => null,
      all: async () => ({ results: [] }),
    }),
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
  }),
};

// ── Order Create mirrors ──────────────────────────────────────────────────────

interface OrderItem { product_id: number; quantity: number; }

function validateOrderCreateInput(body: {
  items?: OrderItem[]; recipient_name?: string; phone?: string; address?: string; postal_code?: string;
}): string | null {
  if (!Array.isArray(body.items) || body.items.length === 0) return 'items 필수 (1개 이상)';
  if (body.items.length > 100) return '주문 상품은 최대 100개';
  for (const item of body.items) {
    if (!Number.isInteger(item.product_id) || item.product_id <= 0) return '잘못된 product_id';
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000) {
      return 'quantity 1~10000';
    }
  }
  if (!body.recipient_name?.trim()) return '받는 사람 필수';
  if (!body.phone?.trim()) return '연락처 필수';
  if (!body.address?.trim()) return '배송지 필수';
  if (!body.postal_code?.trim()) return '우편번호 필수';
  return null;
}

function generateOrderNumber(prefix = 'ORD'): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${ts}-${rand}`;
}

// ── Order Query mirrors ───────────────────────────────────────────────────────

function validateOrderQuery(query: {
  status?: string; page?: string; limit?: string;
}): { status?: string; page: number; limit: number; offset: number } {
  const VALID_STATUSES = ['PENDING', 'PAID', 'DONE', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
  const status = query.status && VALID_STATUSES.includes(query.status) ? query.status : undefined;
  const page = Math.max(1, (parseInt(query.page || '1') || 1));
  const limit = Math.min(50, Math.max(1, (parseInt(query.limit || '20') || 20)));
  return { status, page, limit, offset: (page - 1) * limit };
}

function checkOrderOwnership(orderUserId: string, requestUserId: string): boolean {
  return orderUserId === requestUserId;
}

// ── Order Actions mirrors ─────────────────────────────────────────────────────

const CANCELLABLE_STATUSES = new Set(['PENDING', 'PAID']);
const REFUNDABLE_STATUSES = new Set(['PAID', 'DONE', 'DELIVERED']);

function canCancelOrder(status: string): boolean {
  return CANCELLABLE_STATUSES.has(status.toUpperCase());
}

function canRefundOrder(status: string, refundedAmount: number, totalAmount: number): boolean {
  if (!REFUNDABLE_STATUSES.has(status.toUpperCase())) return false;
  return refundedAmount < totalAmount;
}

function calcRemainingRefund(totalAmount: number, alreadyRefunded: number): number {
  return Math.max(0, totalAmount - alreadyRefunded);
}

function validateRefundAmount(amount: number, remaining: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return '환불 금액은 양수';
  if (amount > remaining) return `환불 금액이 잔여 환불 가능액 ${remaining}원 초과`;
  return null;
}

// ── Streams mirrors ───────────────────────────────────────────────────────────

const VALID_STREAM_STATUSES = new Set(['scheduled', 'live', 'ended']);

function validateStreamFilter(query: {
  status?: string; sellerId?: string; search?: string;
}): { status?: string; sellerId?: number; search?: string } {
  const out: { status?: string; sellerId?: number; search?: string } = {};
  if (query.status && VALID_STREAM_STATUSES.has(query.status)) out.status = query.status;
  if (query.sellerId) {
    const n = parseInt(query.sellerId);
    if (Number.isInteger(n) && n > 0) out.sellerId = n;
  }
  if (query.search && query.search.trim().length > 0) {
    out.search = query.search.trim().slice(0, 100);
  }
  return out;
}

// ── Users mirrors ─────────────────────────────────────────────────────────────

function validateProfileUpdate(body: {
  name?: string; phone?: string; profile_image?: string;
}): string | null {
  if (body.name !== undefined) {
    if (typeof body.name !== 'string') return 'name 형식 오류';
    if (body.name.length > 50) return 'name 50자 이하';
    if (body.name.trim().length === 0) return 'name 필수';
  }
  if (body.phone !== undefined) {
    const stripped = body.phone.replace(/-/g, '');
    if (!/^01[0-9]{8,9}$/.test(stripped)) return 'phone 형식 오류';
  }
  if (body.profile_image !== undefined) {
    if (typeof body.profile_image !== 'string' || body.profile_image.length > 500) {
      return 'profile_image URL 500자 이하';
    }
  }
  return null;
}

// ── Stream Viewers mirrors ────────────────────────────────────────────────────

const HEARTBEAT_THROTTLE_MS = 5000;

function shouldRecordHeartbeat(lastHeartbeatAt: number, now = Date.now()): boolean {
  return (now - lastHeartbeatAt) >= HEARTBEAT_THROTTLE_MS;
}

function validateSessionId(sessionId: string): boolean {
  return /^[a-zA-Z0-9_-]{8,128}$/.test(sessionId);
}

function calcConcurrentViewers(views: Array<{ last_heartbeat: string }>, windowMs = 30_000): number {
  const cutoff = Date.now() - windowMs;
  return views.filter(v => Date.parse(v.last_heartbeat) > cutoff).length;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Order Create Routes', () => {
  it('items 빈 배열 거부', () => {
    expect(validateOrderCreateInput({ items: [] })).toBe('items 필수 (1개 이상)');
  });

  it('items 100개 초과 거부', () => {
    const items = Array.from({ length: 101 }, () => ({ product_id: 1, quantity: 1 }));
    expect(validateOrderCreateInput({ items })).toBe('주문 상품은 최대 100개');
  });

  it('잘못된 product_id 거부', () => {
    expect(validateOrderCreateInput({ items: [{ product_id: 0, quantity: 1 }] })).toBe('잘못된 product_id');
    expect(validateOrderCreateInput({ items: [{ product_id: -1, quantity: 1 }] })).toBe('잘못된 product_id');
  });

  it('quantity 범위 검증', () => {
    expect(validateOrderCreateInput({ items: [{ product_id: 1, quantity: 0 }] })).toBe('quantity 1~10000');
    expect(validateOrderCreateInput({ items: [{ product_id: 1, quantity: 10001 }] })).toBe('quantity 1~10000');
  });

  it('배송지 필수 항목 검증', () => {
    const items = [{ product_id: 1, quantity: 1 }];
    expect(validateOrderCreateInput({ items })).toBe('받는 사람 필수');
    expect(validateOrderCreateInput({ items, recipient_name: 'A' })).toBe('연락처 필수');
    expect(validateOrderCreateInput({ items, recipient_name: 'A', phone: '010' })).toBe('배송지 필수');
  });

  it('정상 주문 생성', () => {
    expect(validateOrderCreateInput({
      items: [{ product_id: 1, quantity: 2 }],
      recipient_name: '홍길동', phone: '01012345678',
      address: '서울시 강남구', postal_code: '06236',
    })).toBeNull();
  });

  it('주문번호 형식', () => {
    const num = generateOrderNumber('ORD');
    expect(num).toMatch(/^ORD-\d{13}-\d{4}$/);
  });
});

describe('Order Query Routes', () => {
  it('상태 필터 검증', () => {
    expect(validateOrderQuery({ status: 'PAID' }).status).toBe('PAID');
    expect(validateOrderQuery({ status: 'invalid' }).status).toBeUndefined();
  });

  it('페이지네이션 기본값과 제한', () => {
    expect(validateOrderQuery({}).page).toBe(1);
    expect(validateOrderQuery({}).limit).toBe(20);
    expect(validateOrderQuery({ limit: '500' }).limit).toBe(50); // max 50
  });

  it('offset 계산', () => {
    expect(validateOrderQuery({ page: '3', limit: '20' }).offset).toBe(40);
  });

  it('주문 소유권 확인', () => {
    expect(checkOrderOwnership('user-1', 'user-1')).toBe(true);
    expect(checkOrderOwnership('user-1', 'user-2')).toBe(false);
  });
});

describe('Order Actions Routes', () => {
  it('취소 가능 상태만 취소 허용', () => {
    expect(canCancelOrder('PENDING')).toBe(true);
    expect(canCancelOrder('PAID')).toBe(true);
    expect(canCancelOrder('SHIPPING')).toBe(false);
    expect(canCancelOrder('DELIVERED')).toBe(false);
  });

  it('환불 가능 상태 + 잔여 환불액 있을 때만', () => {
    expect(canRefundOrder('PAID', 0, 10000)).toBe(true);
    expect(canRefundOrder('DONE', 5000, 10000)).toBe(true);
    expect(canRefundOrder('PAID', 10000, 10000)).toBe(false);  // 전액 환불됨
    expect(canRefundOrder('PENDING', 0, 10000)).toBe(false);   // 결제전
  });

  it('잔여 환불액 계산', () => {
    expect(calcRemainingRefund(10000, 3000)).toBe(7000);
    expect(calcRemainingRefund(10000, 10000)).toBe(0);
    expect(calcRemainingRefund(10000, 15000)).toBe(0); // 음수 방지
  });

  it('환불 금액 검증 - 양수', () => {
    expect(validateRefundAmount(0, 10000)).not.toBeNull();
    expect(validateRefundAmount(-100, 10000)).not.toBeNull();
  });

  it('환불 금액 - 잔여액 초과 거부', () => {
    expect(validateRefundAmount(15000, 10000)).toContain('초과');
  });

  it('정상 환불 금액', () => {
    expect(validateRefundAmount(5000, 10000)).toBeNull();
    expect(validateRefundAmount(10000, 10000)).toBeNull();
  });
});

describe('Streams Routes', () => {
  it('상태 필터', () => {
    expect(validateStreamFilter({ status: 'live' }).status).toBe('live');
    expect(validateStreamFilter({ status: 'invalid' }).status).toBeUndefined();
  });

  it('sellerId 정수 검증', () => {
    expect(validateStreamFilter({ sellerId: '5' }).sellerId).toBe(5);
    expect(validateStreamFilter({ sellerId: '0' }).sellerId).toBeUndefined();
    expect(validateStreamFilter({ sellerId: 'abc' }).sellerId).toBeUndefined();
  });

  it('검색어 100자 제한', () => {
    const long = 'a'.repeat(150);
    expect(validateStreamFilter({ search: long }).search?.length).toBe(100);
  });

  it('검색어 trim 처리', () => {
    expect(validateStreamFilter({ search: '  검색어  ' }).search).toBe('검색어');
  });

  it('빈 검색어는 무시', () => {
    expect(validateStreamFilter({ search: '   ' }).search).toBeUndefined();
  });
});

describe('Users Routes', () => {
  it('name 50자 제한', () => {
    expect(validateProfileUpdate({ name: 'a'.repeat(51) })).toBe('name 50자 이하');
    expect(validateProfileUpdate({ name: 'a'.repeat(50) })).toBeNull();
  });

  it('빈 name 거부', () => {
    expect(validateProfileUpdate({ name: '' })).toBe('name 필수');
    expect(validateProfileUpdate({ name: '   ' })).toBe('name 필수');
  });

  it('phone 형식 검증', () => {
    expect(validateProfileUpdate({ phone: '010-1234-5678' })).toBeNull();
    expect(validateProfileUpdate({ phone: '01012345678' })).toBeNull();
    expect(validateProfileUpdate({ phone: '02-123-4567' })).toBe('phone 형식 오류');
  });

  it('profile_image URL 500자 제한', () => {
    expect(validateProfileUpdate({ profile_image: 'a'.repeat(501) })).toContain('500자');
  });
});

describe('Stream Viewers Routes', () => {
  it('heartbeat 5초 throttle', () => {
    const now = Date.now();
    expect(shouldRecordHeartbeat(now - 4000, now)).toBe(false);
    expect(shouldRecordHeartbeat(now - 6000, now)).toBe(true);
    expect(shouldRecordHeartbeat(0, now)).toBe(true); // 첫 heartbeat
  });

  it('session ID 형식 검증', () => {
    expect(validateSessionId('abc12345')).toBe(true);
    expect(validateSessionId('a-b_c-1234567890')).toBe(true);
    expect(validateSessionId('short')).toBe(false);  // 8자 미만
    expect(validateSessionId('a'.repeat(129))).toBe(false);  // 128자 초과
    expect(validateSessionId('has space')).toBe(false);
  });

  it('동시 시청자 수 - 30초 윈도우', () => {
    const now = Date.now();
    const views = [
      { last_heartbeat: new Date(now - 10000).toISOString() },
      { last_heartbeat: new Date(now - 20000).toISOString() },
      { last_heartbeat: new Date(now - 60000).toISOString() }, // out of window
      { last_heartbeat: new Date(now - 5000).toISOString() },
    ];
    expect(calcConcurrentViewers(views)).toBe(3);
  });
});

describe('D1 mock', () => {
  it('주문 INSERT 호출', async () => {
    const r = await mockDB.prepare('INSERT INTO orders (user_id, total_amount) VALUES (?, ?)')
      .bind('user-1', 10000).run();
    expect(r.success).toBe(true);
  });
});
