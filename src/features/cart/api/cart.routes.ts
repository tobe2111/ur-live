/**
 * Cart API Routes (Refactored)
 * 
 * Endpoints:
 * - GET /api/cart - 장바구니 조회
 * - POST /api/cart - 장바구니 추가
 * - PUT /api/cart/:id - 장바구니 수정
 * - DELETE /api/cart/:id - 장바구니 아이템 삭제
 * - POST /api/cart/clear - 장바구니 비우기
 * 
 * Refactored: 2026-03-09
 * - Using validation utilities
 * - Using response formatters
 * - Using database helpers
 * - Using auth middleware
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { 
  requireAuth, 
  getCurrentUser 
} from '@/worker/middleware/auth';
import {
  validateNumber,
  validateOptionalString,
  ValidationError
} from '@/worker/utils/validation';
import {
  successResponse,
  createdResponse,
  notFoundResponse,
  badRequestResponse,
  validationErrorResponse,
  unauthorizedResponse,
  internalServerErrorResponse
} from '@/worker/utils/response';
import { createDbHelper, QueryBuilder } from '@/worker/utils/database';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
};

interface CartAddRequest {
  product_id: number;
  quantity: number;
  options?: string;
}

interface CartUpdateRequest {
  quantity?: number;
  options?: string;
}

interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  options: string | null;
  created_at: string;
  updated_at: string;
  product_name: string;
  product_description: string;
  product_price: number;
  product_image: string;
  product_stock: number;
  seller_id: number;
  seller_name: string;
  item_total: number;
}

export const cartRoutes = new Hono<{ Bindings: Bindings }>();

// CORS 설정
cartRoutes.use('*', cors({
  origin: ['https://live.ur-team.com', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

/**
 * 사용자 DB ID 가져오기 (Helper)
 */
async function getUserDbId(db: D1Database, firebaseUid: string): Promise<number | null> {
  const dbHelper = createDbHelper(db);
  const user = await dbHelper.findOne<{ id: number }>('users', { firebase_uid: firebaseUid });
  return user?.id || null;
}

/**
 * GET /api/cart
 * 장바구니 조회
 */
cartRoutes.get('/', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json(unauthorizedResponse(), 401);
    }

    const db = c.env.DB;
    const userId = await getUserDbId(db, String(user.id));
    
    if (!userId) {
      return c.json(notFoundResponse('User'), 404);
    }

    // QueryBuilder로 복잡한 쿼리 작성
    const cartItems = await new QueryBuilder()
      .select([
        'c.id',
        'c.product_id',
        'c.quantity',
        'c.options',
        'c.created_at',
        'c.updated_at',
        'p.name as product_name',
        'p.description as product_description',
        'p.price as product_price',
        'p.image as product_image',
        'p.stock as product_stock',
        'p.seller_id',
        's.business_name as seller_name'
      ])
      .from('cart c')
      .join('products p', 'c.product_id = p.id')
      .leftJoin('sellers s', 'p.seller_id = s.id')
      .where('c.user_id = ?', userId)
      .orderBy('c.created_at', 'DESC')
      .execute<CartItem>(db);

    // 총 금액 및 아이템 수 계산
    const items = cartItems.map((item) => ({
      ...item,
      item_total: item.product_price * item.quantity
    }));

    const summary = items.reduce(
      (acc, item) => ({
        total_items: acc.total_items + item.quantity,
        total_amount: acc.total_amount + item.item_total
      }),
      { total_items: 0, total_amount: 0 }
    );

    return c.json(successResponse({
      items,
      summary
    }));

  } catch (error: any) {
    console.error('[Cart] Get cart error:', error);
    return c.json(internalServerErrorResponse('Failed to get cart'), 500);
  }
});

/**
 * POST /api/cart
 * 장바구니 추가
 */
cartRoutes.post('/', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json(unauthorizedResponse(), 401);
    }

    const body = await c.req.json<CartAddRequest>();

    // Validation
    const product_id = validateNumber(body.product_id, 'product_id', { min: 1, integer: true });
    const quantity = validateNumber(body.quantity, 'quantity', { min: 1, integer: true });
    const options = validateOptionalString(body.options, 'options', { maxLength: 500 });

    const db = c.env.DB;
    const dbHelper = createDbHelper(db);
    const userId = await getUserDbId(db, String(user.id));
    
    if (!userId) {
      return c.json(notFoundResponse('User'), 404);
    }

    // 상품 존재 여부 및 재고 확인
    const product = await dbHelper.findById<{ id: number; name: string; price: number; stock: number }>(
      'products',
      product_id
    );

    if (!product) {
      return c.json(notFoundResponse('Product'), 404);
    }

    if (product.stock < quantity) {
      return c.json(badRequestResponse('Insufficient stock'), 400);
    }

    // 이미 장바구니에 있는지 확인
    const existingItem = await dbHelper.findOne<{ id: number; quantity: number }>(
      'cart',
      { user_id: userId, product_id }
    );

    if (existingItem) {
      // 기존 아이템 수량 업데이트
      const newQuantity = existingItem.quantity + quantity;
      
      if (product.stock < newQuantity) {
        return c.json(badRequestResponse('Insufficient stock'), 400);
      }

      await dbHelper.update(
        'cart',
        { 
          quantity: newQuantity, 
          options, 
          updated_at: new Date().toISOString() 
        },
        { id: existingItem.id }
      );

      return c.json(successResponse({
        id: existingItem.id,
        product_id,
        quantity: newQuantity,
        options
      }, 'Cart item updated'));
    }

    // 새 아이템 추가
    const result = await dbHelper.insert('cart', {
      user_id: userId,
      product_id,
      quantity,
      options,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return c.json(createdResponse({
      id: result.meta.last_row_id,
      product_id,
      quantity,
      options
    }, 'Item added to cart'), 201);

  } catch (error: any) {
    console.error('[Cart] Add to cart error:', error);
    
    if (error instanceof ValidationError) {
      return c.json(validationErrorResponse(error.message, error.field), 422);
    }
    
    return c.json(internalServerErrorResponse('Failed to add item to cart'), 500);
  }
});

/**
 * PUT /api/cart/:id
 * 장바구니 수정
 */
cartRoutes.put('/:id', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json(unauthorizedResponse(), 401);
    }

    const cartItemId = validateNumber(c.req.param('id'), 'id', { min: 1, integer: true });
    const body = await c.req.json<CartUpdateRequest>();

    // Validation
    const quantity = body.quantity !== undefined 
      ? validateNumber(body.quantity, 'quantity', { min: 1, integer: true })
      : undefined;
    const options = body.options !== undefined
      ? validateOptionalString(body.options, 'options', { maxLength: 500 })
      : undefined;

    if (quantity === undefined && options === undefined) {
      return c.json(badRequestResponse('No fields to update'), 400);
    }

    const db = c.env.DB;
    const dbHelper = createDbHelper(db);
    const userId = await getUserDbId(db, String(user.id));
    
    if (!userId) {
      return c.json(notFoundResponse('User'), 404);
    }

    // 장바구니 아이템이 해당 사용자의 것인지 확인
    const cartItem = await new QueryBuilder()
      .select(['c.*', 'p.stock'])
      .from('cart c')
      .join('products p', 'c.product_id = p.id')
      .where('c.id = ?', cartItemId)
      .where('c.user_id = ?', userId)
      .execute<{ id: number; product_id: number; stock: number }>(db);

    if (cartItem.length === 0) {
      return c.json(notFoundResponse('Cart item'), 404);
    }

    // 재고 확인
    if (quantity !== undefined && cartItem[0].stock < quantity) {
      return c.json(badRequestResponse('Insufficient stock'), 400);
    }

    // 업데이트할 필드 구성
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (quantity !== undefined) updateData.quantity = quantity;
    if (options !== undefined) updateData.options = options;

    await dbHelper.update('cart', updateData, { id: cartItemId });

    // 업데이트된 아이템 조회
    const updatedItem = await new QueryBuilder()
      .select([
        'c.id',
        'c.product_id',
        'c.quantity',
        'c.options',
        'c.updated_at',
        'p.name as product_name',
        'p.price as product_price'
      ])
      .from('cart c')
      .join('products p', 'c.product_id = p.id')
      .where('c.id = ?', cartItemId)
      .execute(db);

    return c.json(successResponse(updatedItem[0], 'Cart item updated'));

  } catch (error: any) {
    console.error('[Cart] Update cart item error:', error);
    
    if (error instanceof ValidationError) {
      return c.json(validationErrorResponse(error.message, error.field), 422);
    }
    
    return c.json(internalServerErrorResponse('Failed to update cart item'), 500);
  }
});

/**
 * DELETE /api/cart/:id
 * 장바구니 아이템 삭제
 */
cartRoutes.delete('/:id', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json(unauthorizedResponse(), 401);
    }

    const cartItemId = validateNumber(c.req.param('id'), 'id', { min: 1, integer: true });

    const db = c.env.DB;
    const dbHelper = createDbHelper(db);
    const userId = await getUserDbId(db, String(user.id));
    
    if (!userId) {
      return c.json(notFoundResponse('User'), 404);
    }

    // 장바구니 아이템이 해당 사용자의 것인지 확인
    const cartItem = await dbHelper.findOne<{ id: number }>(
      'cart',
      { id: cartItemId, user_id: userId }
    );

    if (!cartItem) {
      return c.json(notFoundResponse('Cart item'), 404);
    }

    // 삭제
    await dbHelper.delete('cart', { id: cartItemId });

    return c.json(successResponse(null, 'Cart item deleted'));

  } catch (error: any) {
    console.error('[Cart] Delete cart item error:', error);
    
    if (error instanceof ValidationError) {
      return c.json(validationErrorResponse(error.message, error.field), 422);
    }
    
    return c.json(internalServerErrorResponse('Failed to delete cart item'), 500);
  }
});

/**
 * POST /api/cart/clear
 * 장바구니 비우기
 */
cartRoutes.post('/clear', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json(unauthorizedResponse(), 401);
    }

    const db = c.env.DB;
    const dbHelper = createDbHelper(db);
    const userId = await getUserDbId(db, String(user.id));
    
    if (!userId) {
      return c.json(notFoundResponse('User'), 404);
    }

    // 모든 장바구니 아이템 삭제
    await dbHelper.delete('cart', { user_id: userId });

    return c.json(successResponse(null, 'Cart cleared'));

  } catch (error: any) {
    console.error('[Cart] Clear cart error:', error);
    return c.json(internalServerErrorResponse('Failed to clear cart'), 500);
  }
});
