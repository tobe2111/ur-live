/**
 * Orders API Routes (간소화 버전)
 * 
 * Endpoints:
 * - GET  /api/orders         - 주문 목록 조회
 * - GET  /api/orders/:id     - 주문 상세 조회
 * - POST /api/orders         - 주문 생성
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { OrderRepository } from '../repositories/OrderRepository';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { OrderFilter, OrderCreateInput } from '../types';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
};

export const ordersRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * Helper: map Firebase UID → DB integer user id
 */
async function getUserDbIdFromFirebaseUid(db: D1Database, firebaseUid: string): Promise<number | null> {
  const row = await db.prepare('SELECT id FROM users WHERE firebase_uid = ?').bind(firebaseUid).first<{ id: number }>();
  return row?.id ?? null;
}

/**
 * GET /api/orders
 * 주문 목록 조회
 * ✅ BUG #16 FIX: Added requireAuth() — unauthenticated callers could enumerate
 * ALL orders in the DB by hitting this endpoint without a token.
 * ✅ BUG #19 FIX: Previously the route accepted an arbitrary `?user_id=N` query
 * parameter and passed it directly to findAll() without verifying it matched the
 * authenticated user.  Any logged-in user could enumerate another user's orders by
 * passing a different numeric id (classic IDOR).
 * Fix: resolve the authenticated user's DB integer id from their Firebase UID and
 * always scope the query to that id (admins may still pass an explicit user_id).
 */
ordersRoutes.get('/', cors(), requireAuth(), async (c) => {
  const { DB } = c.env;

  try {
    const authUser = getCurrentUser(c);
    if (!authUser) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    // ✅ BUG #19 FIX: Enforce that regular users can only query their own orders.
    // Admins/sellers may pass an explicit user_id or seller_id query param.
    let enforcedUserId: number | undefined;
    if (authUser.type === 'user') {
      // Resolve Firebase UID → DB integer id
      const dbUserId = await getUserDbIdFromFirebaseUid(DB, String(authUser.id));
      if (!dbUserId) {
        return c.json({ success: true, data: [] });
      }
      enforcedUserId = dbUserId;
    }

    const filter: OrderFilter = {
      // For normal users, ignore any ?user_id= in the query and use their own id.
      userId: authUser.type === 'user'
        ? enforcedUserId
        : (c.req.query('user_id') ? Number(c.req.query('user_id')) : undefined),
      sellerId: c.req.query('seller_id') ? Number(c.req.query('seller_id')) : undefined,
      status: c.req.query('status') as any,
    };

    const repository = new OrderRepository(DB);
    const orders = await repository.findAll(filter);

    return c.json({
      success: true,
      data: orders
    });

  } catch (error) {
    console.error('[Orders API] Get list error:', error);
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500);
  }
});

/**
 * GET /api/orders/:id
 * 주문 상세 조회
 * ✅ BUG #16 FIX: Added requireAuth()
 */
ordersRoutes.get('/:id', cors(), requireAuth(), async (c) => {
  const { DB } = c.env;
  
  try {
    const id = Number(c.req.param('id'));
    
    if (isNaN(id)) {
      return c.json({
        success: false,
        error: 'Invalid order ID'
      }, 400);
    }
    
    const repository = new OrderRepository(DB);
    const order = await repository.findById(id);
    
    if (!order) {
      return c.json({
        success: false,
        error: 'Order not found'
      }, 404);
    }
    
    // 주문 아이템도 함께 조회
    const items = await repository.findItems(id);
    
    return c.json({
      success: true,
      data: {
        ...order,
        items
      }
    });
    
  } catch (error) {
    console.error('[Orders API] Get detail error:', error);
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500);
  }
});

/**
 * POST /api/orders
 * 주문 생성
 * ✅ BUG #16 FIX: Added requireAuth() — unauthenticated callers could inject
 * arbitrary orders into the DB.
 */
ordersRoutes.post('/', cors(), requireAuth(), async (c) => {
  const { DB } = c.env;
  
  try {
    const data: OrderCreateInput = await c.req.json();
    
    // 필수 필드 검증
    if (!data.user_id || !data.seller_id || !data.items || data.items.length === 0) {
      return c.json({
        success: false,
        error: 'Missing required fields'
      }, 400);
    }
    
    const repository = new OrderRepository(DB);
    const order = await repository.create(data);
    
    return c.json({
      success: true,
      data: order
    }, 201);
    
  } catch (error) {
    console.error('[Orders API] Create error:', error);
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500);
  }
});

export default ordersRoutes;
