/**
 * Cart API Routes
 * 
 * Endpoints:
 * - GET /api/cart - 장바구니 조회
 * - POST /api/cart - 장바구니 추가
 * - PUT /api/cart/:id - 장바구니 수정
 * - DELETE /api/cart/:id - 장바구니 아이템 삭제
 * - POST /api/cart/clear - 장바구니 비우기
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verify } from 'hono/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
};

type CartAddRequest = {
  product_id: number;
  quantity: number;
  options?: string;
};

type CartUpdateRequest = {
  quantity?: number;
  options?: string;
};

export const cartRoutes = new Hono<{ Bindings: Bindings }>();

// CORS 설정
cartRoutes.use('*', cors({
  origin: ['https://live.ur-team.com', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

/**
 * Firebase 토큰에서 사용자 ID 추출
 */
async function getUserIdFromToken(authorization: string | undefined): Promise<string | null> {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authorization.substring(7);
    // Firebase 토큰 검증 로직 (간단한 버전)
    // 실제로는 Firebase Admin SDK로 검증해야 함
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = JSON.parse(atob(parts[1]));
    return payload.user_id || payload.sub || null;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * 사용자 DB ID 가져오기
 */
async function getUserDbId(db: D1Database, firebaseUid: string): Promise<number | null> {
  try {
    const user = await db.prepare('SELECT id FROM users WHERE firebase_uid = ?').bind(firebaseUid).first();
    return user?.id as number || null;
  } catch (error) {
    console.error('Get user DB ID error:', error);
    return null;
  }
}

/**
 * GET /api/cart
 * 장바구니 조회
 */
cartRoutes.get('/', async (c) => {
  try {
    const firebaseUid = await getUserIdFromToken(c.req.header('Authorization'));
    if (!firebaseUid) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 401);
    }

    const db = c.env.DB;
    const userId = await getUserDbId(db, firebaseUid);
    if (!userId) {
      return c.json({
        success: false,
        error: 'User not found'
      }, 404);
    }

    // 장바구니 아이템 조회 (상품 정보 포함)
    const cartItems = await db.prepare(`
      SELECT 
        c.id,
        c.product_id,
        c.quantity,
        c.options,
        c.created_at,
        c.updated_at,
        p.name as product_name,
        p.description as product_description,
        p.price as product_price,
        p.image as product_image,
        p.stock as product_stock,
        p.seller_id,
        s.business_name as seller_name
      FROM cart c
      JOIN products p ON c.product_id = p.id
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `).bind(userId).all();

    // 총 금액 계산
    let totalAmount = 0;
    let totalItems = 0;

    const items = (cartItems.results || []).map((item: any) => {
      const itemTotal = item.product_price * item.quantity;
      totalAmount += itemTotal;
      totalItems += item.quantity;

      return {
        ...item,
        item_total: itemTotal
      };
    });

    return c.json({
      success: true,
      cart: {
        items,
        summary: {
          total_items: totalItems,
          total_amount: totalAmount
        }
      }
    });

  } catch (error: any) {
    console.error('Get cart error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to get cart'
    }, 500);
  }
});

/**
 * POST /api/cart
 * 장바구니 추가
 */
cartRoutes.post('/', async (c) => {
  try {
    const firebaseUid = await getUserIdFromToken(c.req.header('Authorization'));
    if (!firebaseUid) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 401);
    }

    const body = await c.req.json<CartAddRequest>();
    const { product_id, quantity, options } = body;

    // 필수 필드 검증
    if (!product_id || !quantity || quantity < 1) {
      return c.json({
        success: false,
        error: 'Invalid product_id or quantity'
      }, 400);
    }

    const db = c.env.DB;
    const userId = await getUserDbId(db, firebaseUid);
    if (!userId) {
      return c.json({
        success: false,
        error: 'User not found'
      }, 404);
    }

    // 상품 존재 여부 및 재고 확인
    const product = await db.prepare('SELECT id, name, price, stock FROM products WHERE id = ?').bind(product_id).first();
    if (!product) {
      return c.json({
        success: false,
        error: 'Product not found'
      }, 404);
    }

    if (product.stock < quantity) {
      return c.json({
        success: false,
        error: 'Insufficient stock'
      }, 400);
    }

    // 이미 장바구니에 있는지 확인
    const existingItem = await db.prepare(`
      SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?
    `).bind(userId, product_id).first();

    if (existingItem) {
      // 기존 아이템 수량 업데이트
      const newQuantity = (existingItem.quantity as number) + quantity;
      
      if (product.stock < newQuantity) {
        return c.json({
          success: false,
          error: 'Insufficient stock'
        }, 400);
      }

      await db.prepare(`
        UPDATE cart
        SET quantity = ?, options = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(newQuantity, options || null, existingItem.id).run();

      return c.json({
        success: true,
        message: 'Cart item updated',
        cart_item: {
          id: existingItem.id,
          product_id,
          quantity: newQuantity,
          options
        }
      });
    }

    // 새 아이템 추가
    const result = await db.prepare(`
      INSERT INTO cart (user_id, product_id, quantity, options, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(userId, product_id, quantity, options || null).run();

    if (!result.success) {
      throw new Error('Failed to add item to cart');
    }

    return c.json({
      success: true,
      message: 'Item added to cart',
      cart_item: {
        id: result.meta.last_row_id,
        product_id,
        quantity,
        options
      }
    }, 201);

  } catch (error: any) {
    console.error('Add to cart error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to add item to cart'
    }, 500);
  }
});

/**
 * PUT /api/cart/:id
 * 장바구니 수정
 */
cartRoutes.put('/:id', async (c) => {
  try {
    const firebaseUid = await getUserIdFromToken(c.req.header('Authorization'));
    if (!firebaseUid) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 401);
    }

    const cartItemId = parseInt(c.req.param('id'));
    const body = await c.req.json<CartUpdateRequest>();
    const { quantity, options } = body;

    if (quantity !== undefined && quantity < 1) {
      return c.json({
        success: false,
        error: 'Quantity must be at least 1'
      }, 400);
    }

    const db = c.env.DB;
    const userId = await getUserDbId(db, firebaseUid);
    if (!userId) {
      return c.json({
        success: false,
        error: 'User not found'
      }, 404);
    }

    // 장바구니 아이템이 해당 사용자의 것인지 확인
    const cartItem = await db.prepare(`
      SELECT c.*, p.stock
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.id = ? AND c.user_id = ?
    `).bind(cartItemId, userId).first();

    if (!cartItem) {
      return c.json({
        success: false,
        error: 'Cart item not found'
      }, 404);
    }

    // 재고 확인
    if (quantity !== undefined && cartItem.stock < quantity) {
      return c.json({
        success: false,
        error: 'Insufficient stock'
      }, 400);
    }

    // 업데이트
    const updates: string[] = [];
    const params: any[] = [];

    if (quantity !== undefined) {
      updates.push('quantity = ?');
      params.push(quantity);
    }
    if (options !== undefined) {
      updates.push('options = ?');
      params.push(options);
    }

    if (updates.length === 0) {
      return c.json({
        success: false,
        error: 'No fields to update'
      }, 400);
    }

    updates.push('updated_at = datetime(\'now\')');
    params.push(cartItemId);

    const result = await db.prepare(`
      UPDATE cart
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...params).run();

    if (!result.success) {
      throw new Error('Failed to update cart item');
    }

    // 업데이트된 아이템 조회
    const updatedItem = await db.prepare(`
      SELECT 
        c.id,
        c.product_id,
        c.quantity,
        c.options,
        c.updated_at,
        p.name as product_name,
        p.price as product_price
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.id = ?
    `).bind(cartItemId).first();

    return c.json({
      success: true,
      message: 'Cart item updated',
      cart_item: updatedItem
    });

  } catch (error: any) {
    console.error('Update cart item error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to update cart item'
    }, 500);
  }
});

/**
 * DELETE /api/cart/:id
 * 장바구니 아이템 삭제
 */
cartRoutes.delete('/:id', async (c) => {
  try {
    const firebaseUid = await getUserIdFromToken(c.req.header('Authorization'));
    if (!firebaseUid) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 401);
    }

    const cartItemId = parseInt(c.req.param('id'));

    const db = c.env.DB;
    const userId = await getUserDbId(db, firebaseUid);
    if (!userId) {
      return c.json({
        success: false,
        error: 'User not found'
      }, 404);
    }

    // 장바구니 아이템이 해당 사용자의 것인지 확인
    const cartItem = await db.prepare('SELECT id FROM cart WHERE id = ? AND user_id = ?').bind(cartItemId, userId).first();
    if (!cartItem) {
      return c.json({
        success: false,
        error: 'Cart item not found'
      }, 404);
    }

    // 삭제
    const result = await db.prepare('DELETE FROM cart WHERE id = ?').bind(cartItemId).run();

    if (!result.success) {
      throw new Error('Failed to delete cart item');
    }

    return c.json({
      success: true,
      message: 'Cart item deleted'
    });

  } catch (error: any) {
    console.error('Delete cart item error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to delete cart item'
    }, 500);
  }
});

/**
 * POST /api/cart/clear
 * 장바구니 비우기
 */
cartRoutes.post('/clear', async (c) => {
  try {
    const firebaseUid = await getUserIdFromToken(c.req.header('Authorization'));
    if (!firebaseUid) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 401);
    }

    const db = c.env.DB;
    const userId = await getUserDbId(db, firebaseUid);
    if (!userId) {
      return c.json({
        success: false,
        error: 'User not found'
      }, 404);
    }

    // 모든 장바구니 아이템 삭제
    const result = await db.prepare('DELETE FROM cart WHERE user_id = ?').bind(userId).run();

    if (!result.success) {
      throw new Error('Failed to clear cart');
    }

    return c.json({
      success: true,
      message: 'Cart cleared'
    });

  } catch (error: any) {
    console.error('Clear cart error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to clear cart'
    }, 500);
  }
});
