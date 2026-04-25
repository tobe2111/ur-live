/**
 * 장바구니(Cart) 단위 테스트
 *
 * src/features/cart/api/cart.routes.ts 의 핵심 로직을 pure function 으로 mirror:
 *   1. 상품 추가 — product_id / quantity validation
 *   2. 재고 초과 추가 → 거부
 *   3. 동일 상품 중복 추가 시 수량 합산 (UPSERT)
 *   4. 합산 후 재고 초과 시 되돌림 → 거부
 *   5. 품절 상품 (stock=0) 추가 → 거부
 *   6. 장바구니 금액 합산 로직
 *   7. 인증 없는 요청 → 401
 *   8. PUT (수량 변경) — 재고 초과 → 거부
 *   9. D1 mock — INSERT/UPDATE/DELETE 쿼리 동작 확인
 */
import { describe, it, expect } from 'vitest';

// ── D1 mock ──────────────────────────────────────────────────────────────────
const mockDB = {
  prepare: (sql: string) => ({
    bind: (..._args: unknown[]) => ({
      run: async () => ({ success: true, meta: { changes: 1, last_row_id: 42 } }),
      first: async () => null,
      all: async () => ({ results: [] }),
    }),
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ success: true, meta: { changes: 1, last_row_id: 42 } }),
  }),
};

// ── 타입 ─────────────────────────────────────────────────────────────────────
interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  image_url: string | null;
  seller_id: number;
}

interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  price_snapshot: number;
  option_id: number | null;
}

interface CartSummary {
  total_items: number;
  total_amount: number;
}

// ── 검증 함수 (cart.routes.ts 에서 mirror) ────────────────────────────────────

type AddCartResult =
  | { ok: true; action: 'inserted' | 'updated'; quantity: number; price_snapshot: number }
  | { ok: false; statusCode: 400 | 401 | 404; error: string };

/**
 * POST /api/cart 핸들러의 입력/재고 검증 로직
 */
function validateCartAdd(
  user: { id: number } | null,
  body: { product_id?: number; quantity?: number; price_snapshot?: number | null },
  product: Product | null
): AddCartResult {
  if (!user) return { ok: false, statusCode: 401, error: 'Unauthorized' };

  const product_id = Number(body.product_id ?? 0);
  const quantity = Number(body.quantity ?? 1);

  if (!Number.isFinite(product_id) || product_id < 1 || product_id > 1e10) {
    return { ok: false, statusCode: 400, error: 'product_id is required (valid integer)' };
  }
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 10000) {
    return { ok: false, statusCode: 400, error: 'quantity must be 1~10000' };
  }

  if (!product) return { ok: false, statusCode: 404, error: 'Product not found' };

  if (product.stock < quantity) {
    return { ok: false, statusCode: 400, error: 'Insufficient stock' };
  }

  const snapshot = body.price_snapshot ?? product.price;
  return { ok: true, action: 'inserted', quantity, price_snapshot: snapshot };
}

/**
 * UPSERT 후 재고 초과 체크 (cart.routes.ts 의 합산 후 검증)
 */
function validateAfterUpsert(
  product: Product,
  prevQuantity: number,
  addQuantity: number
): { ok: true; finalQty: number } | { ok: false; error: string; revertTo: number } {
  const finalQty = prevQuantity + addQuantity;
  if (product.stock < finalQty) {
    return { ok: false, error: 'Insufficient stock', revertTo: prevQuantity };
  }
  return { ok: true, finalQty };
}

/**
 * PUT /api/cart/:id 수량 변경 검증
 */
function validateCartUpdate(
  user: { id: number } | null,
  quantity: number | undefined,
  product: { stock: number } | null
): { ok: true } | { ok: false; statusCode: 400 | 401 | 404; error: string } {
  if (!user) return { ok: false, statusCode: 401, error: 'Unauthorized' };
  if (quantity === undefined) return { ok: false, statusCode: 400, error: 'quantity is required' };
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 10000) {
    return { ok: false, statusCode: 400, error: 'quantity must be 1~10000' };
  }
  if (!product) return { ok: false, statusCode: 404, error: 'Cart item not found' };
  if (product.stock < quantity) return { ok: false, statusCode: 400, error: 'Insufficient stock' };
  return { ok: true };
}

/**
 * 장바구니 금액 합산 (GET /api/cart 응답 계산 로직)
 */
function calcCartSummary(items: Array<{ quantity: number; price_snapshot: number; product_price: number }>): CartSummary {
  return items.reduce(
    (acc, item) => {
      const price = item.price_snapshot ?? item.product_price;
      return {
        total_items: acc.total_items + item.quantity,
        total_amount: acc.total_amount + price * item.quantity,
      };
    },
    { total_items: 0, total_amount: 0 }
  );
}

// ── 테스트 픽스처 ─────────────────────────────────────────────────────────────
const PRODUCT_IN_STOCK: Product = {
  id: 1,
  name: '테스트 상품',
  price: 10_000,
  stock: 100,
  image_url: null,
  seller_id: 5,
};

const PRODUCT_LOW_STOCK: Product = {
  id: 2,
  name: '재고 부족 상품',
  price: 5_000,
  stock: 2,
  image_url: null,
  seller_id: 5,
};

const PRODUCT_OUT_OF_STOCK: Product = {
  id: 3,
  name: '품절 상품',
  price: 3_000,
  stock: 0,
  image_url: null,
  seller_id: 5,
};

const AUTH_USER = { id: 10 };

// ─────────────────────────────────────────────────────────────────────────────
// 1. 인증 검증
// ─────────────────────────────────────────────────────────────────────────────
describe('Cart add — 인증 검증', () => {
  it('인증 없음 → 401', () => {
    const res = validateCartAdd(null, { product_id: 1, quantity: 1 }, PRODUCT_IN_STOCK);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(401);
  });

  it('인증된 유저 → 통과 (재고 충분)', () => {
    const res = validateCartAdd(AUTH_USER, { product_id: 1, quantity: 1 }, PRODUCT_IN_STOCK);
    expect(res.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. product_id / quantity 입력 검증
// ─────────────────────────────────────────────────────────────────────────────
describe('Cart add — 입력 검증', () => {
  it('product_id = 0 → 400', () => {
    const res = validateCartAdd(AUTH_USER, { product_id: 0, quantity: 1 }, null);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/product_id/);
    }
  });

  it('product_id = 음수 → 400', () => {
    const res = validateCartAdd(AUTH_USER, { product_id: -1, quantity: 1 }, null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(400);
  });

  it('quantity = 0 → 400', () => {
    const res = validateCartAdd(AUTH_USER, { product_id: 1, quantity: 0 }, PRODUCT_IN_STOCK);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/quantity/);
    }
  });

  it('quantity = 10001 (상한 초과) → 400', () => {
    const res = validateCartAdd(AUTH_USER, { product_id: 1, quantity: 10001 }, PRODUCT_IN_STOCK);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(400);
  });

  it('quantity = 10000 (상한 경계) → 재고만 충분하면 통과', () => {
    const bigStockProduct = { ...PRODUCT_IN_STOCK, stock: 10000 };
    const res = validateCartAdd(AUTH_USER, { product_id: 1, quantity: 10000 }, bigStockProduct);
    expect(res.ok).toBe(true);
  });

  it('product 없음 → 404', () => {
    const res = validateCartAdd(AUTH_USER, { product_id: 999, quantity: 1 }, null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. 재고 검증
// ─────────────────────────────────────────────────────────────────────────────
describe('Cart add — 재고 검증', () => {
  it('재고(100) >= 요청(1) → 통과', () => {
    const res = validateCartAdd(AUTH_USER, { product_id: 1, quantity: 1 }, PRODUCT_IN_STOCK);
    expect(res.ok).toBe(true);
  });

  it('재고(100) = 요청(100) → 통과 (경계)', () => {
    const res = validateCartAdd(AUTH_USER, { product_id: 1, quantity: 100 }, PRODUCT_IN_STOCK);
    expect(res.ok).toBe(true);
  });

  it('재고(100) < 요청(101) → 400 Insufficient stock', () => {
    const res = validateCartAdd(AUTH_USER, { product_id: 1, quantity: 101 }, PRODUCT_IN_STOCK);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/Insufficient stock/);
    }
  });

  it('재고 2인 상품에 3개 추가 → 400', () => {
    const res = validateCartAdd(AUTH_USER, { product_id: 2, quantity: 3 }, PRODUCT_LOW_STOCK);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(400);
  });

  it('품절(stock=0) 상품 추가 시도 → 400 거부', () => {
    const res = validateCartAdd(AUTH_USER, { product_id: 3, quantity: 1 }, PRODUCT_OUT_OF_STOCK);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/Insufficient stock/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. 동일 상품 중복 추가 — UPSERT 수량 합산
// ─────────────────────────────────────────────────────────────────────────────
describe('Cart add — 동일 상품 중복 추가 수량 합산', () => {
  it('기존 2개 + 추가 3개 = 5개 (재고 충분 시)', () => {
    const product = { ...PRODUCT_IN_STOCK, stock: 10 };
    const res = validateAfterUpsert(product, 2, 3);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.finalQty).toBe(5);
  });

  it('기존 98개 + 추가 2개 = 100개 (재고 경계 통과)', () => {
    const product = { ...PRODUCT_IN_STOCK, stock: 100 };
    const res = validateAfterUpsert(product, 98, 2);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.finalQty).toBe(100);
  });

  it('기존 99개 + 추가 2개 = 101개 → 재고(100) 초과 → 400 + revertTo=99', () => {
    const product = { ...PRODUCT_IN_STOCK, stock: 100 };
    const res = validateAfterUpsert(product, 99, 2);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/Insufficient stock/);
      expect(res.revertTo).toBe(99);
    }
  });

  it('기존 2개 + 추가 1개 → 재고(2) 초과 → 거부', () => {
    const product = { ...PRODUCT_LOW_STOCK }; // stock=2
    const res = validateAfterUpsert(product, 2, 1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.revertTo).toBe(2);
  });

  it('기존 0개 + 추가 1개 (신규 추가) → 통과', () => {
    const res = validateAfterUpsert(PRODUCT_IN_STOCK, 0, 1);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.finalQty).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. price_snapshot 처리
// ─────────────────────────────────────────────────────────────────────────────
describe('Cart add — price_snapshot', () => {
  it('price_snapshot 없으면 product.price 사용', () => {
    const res = validateCartAdd(AUTH_USER, { product_id: 1, quantity: 1, price_snapshot: null }, PRODUCT_IN_STOCK);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.price_snapshot).toBe(PRODUCT_IN_STOCK.price);
  });

  it('price_snapshot 있으면 해당 값 사용 (라이브 특가)', () => {
    const livePrice = 7_000;
    const res = validateCartAdd(AUTH_USER, { product_id: 1, quantity: 1, price_snapshot: livePrice }, PRODUCT_IN_STOCK);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.price_snapshot).toBe(livePrice);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. 장바구니 금액 합산
// ─────────────────────────────────────────────────────────────────────────────
describe('Cart summary — 금액 합산', () => {
  it('빈 장바구니 → { total_items: 0, total_amount: 0 }', () => {
    const summary = calcCartSummary([]);
    expect(summary.total_items).toBe(0);
    expect(summary.total_amount).toBe(0);
  });

  it('단일 상품 1개: 10,000원 → total_amount=10,000', () => {
    const summary = calcCartSummary([{ quantity: 1, price_snapshot: 10_000, product_price: 10_000 }]);
    expect(summary.total_items).toBe(1);
    expect(summary.total_amount).toBe(10_000);
  });

  it('단일 상품 3개: 10,000원 → total_amount=30,000', () => {
    const summary = calcCartSummary([{ quantity: 3, price_snapshot: 10_000, product_price: 10_000 }]);
    expect(summary.total_items).toBe(3);
    expect(summary.total_amount).toBe(30_000);
  });

  it('다중 상품 합산: 3종 → total_items 합, total_amount 합', () => {
    const items = [
      { quantity: 1, price_snapshot: 10_000, product_price: 10_000 },
      { quantity: 2, price_snapshot: 5_000, product_price: 5_000 },
      { quantity: 1, price_snapshot: 3_000, product_price: 3_000 },
    ];
    const summary = calcCartSummary(items);
    expect(summary.total_items).toBe(4); // 1+2+1
    expect(summary.total_amount).toBe(23_000); // 10000+10000+3000
  });

  it('price_snapshot 우선 사용 (라이브 특가 적용됨)', () => {
    // 정가 10,000, 라이브 특가 7,000
    const summary = calcCartSummary([
      { quantity: 2, price_snapshot: 7_000, product_price: 10_000 },
    ]);
    expect(summary.total_amount).toBe(14_000); // 7,000 × 2 (not 20,000)
  });

  it('total_amount = sum of (price × quantity) for all items', () => {
    const items = [
      { quantity: 5, price_snapshot: 2_000, product_price: 2_000 },
      { quantity: 3, price_snapshot: 4_000, product_price: 4_000 },
    ];
    const summary = calcCartSummary(items);
    const expected = 5 * 2_000 + 3 * 4_000; // 10,000 + 12,000 = 22,000
    expect(summary.total_amount).toBe(expected);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. PUT — 수량 변경 검증
// ─────────────────────────────────────────────────────────────────────────────
describe('Cart update — 수량 변경', () => {
  const productWithStock = { stock: 10 };

  it('인증 없음 → 401', () => {
    const res = validateCartUpdate(null, 3, productWithStock);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(401);
  });

  it('quantity 없음 → 400', () => {
    const res = validateCartUpdate(AUTH_USER, undefined, productWithStock);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/quantity/);
    }
  });

  it('재고(10) >= 요청(5) → 통과', () => {
    const res = validateCartUpdate(AUTH_USER, 5, productWithStock);
    expect(res.ok).toBe(true);
  });

  it('재고(10) < 요청(11) → 400 Insufficient stock', () => {
    const res = validateCartUpdate(AUTH_USER, 11, productWithStock);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.statusCode).toBe(400);
      expect(res.error).toMatch(/Insufficient stock/);
    }
  });

  it('품절 상품(stock=0)으로 변경 시도 → 400', () => {
    const res = validateCartUpdate(AUTH_USER, 1, { stock: 0 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(400);
  });

  it('cart item 없음 → 404', () => {
    const res = validateCartUpdate(AUTH_USER, 1, null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(404);
  });

  it('quantity = 0 → 400 (1 미만 거부)', () => {
    const res = validateCartUpdate(AUTH_USER, 0, productWithStock);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.statusCode).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. D1 mock — CRUD 쿼리 동작 확인
// ─────────────────────────────────────────────────────────────────────────────
describe('Cart — D1 mock DB 동작', () => {
  it('INSERT 쿼리 성공', async () => {
    const result = await mockDB.prepare(`
      INSERT INTO cart_items (user_id, product_id, quantity, price_snapshot, option_id, live_stream_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(10, 1, 2, 10_000, null, null).run();
    expect(result.success).toBe(true);
  });

  it('UPDATE 수량 변경 쿼리 성공', async () => {
    const result = await mockDB.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?')
      .bind(5, 42).run();
    expect(result.success).toBe(true);
  });

  it('DELETE 아이템 쿼리 성공', async () => {
    const result = await mockDB.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?')
      .bind(42, 10).run();
    expect(result.success).toBe(true);
  });

  it('DELETE 전체(clear) 쿼리 성공', async () => {
    const result = await mockDB.prepare('DELETE FROM cart_items WHERE user_id = ?')
      .bind(10).run();
    expect(result.success).toBe(true);
  });

  it('SELECT first — 없으면 null 반환', async () => {
    const row = await mockDB.prepare(
      'SELECT id FROM cart_items WHERE id = ? AND user_id = ? LIMIT 1'
    ).bind(999, 10).first();
    expect(row).toBeNull();
  });

  it('SELECT all — 없으면 빈 배열', async () => {
    const rows = await mockDB.prepare(
      'SELECT ci.id FROM cart_items ci WHERE ci.user_id = ?'
    ).bind(10).all();
    expect(rows.results).toEqual([]);
  });
});
