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

    // ✅ BUG #4 FIX: Map DB column (total_price) to API field (total_amount)
    const mappedOrders = orders.map((order: any) => ({
      ...order,
      total_amount: order.total_price,
    }));

    return c.json({
      success: true,
      data: mappedOrders
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
    // ✅ BUG #9 FIX: Add permission check
    const authUser = getCurrentUser(c);
    if (!authUser) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    
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
    
    // ✅ Permission check: Users can only view their own orders
    if (authUser.type === 'user') {
      const dbUserId = await getUserDbIdFromFirebaseUid(DB, String(authUser.id));
      if (order.user_id !== dbUserId) {
        return c.json({ success: false, error: 'Forbidden' }, 403);
      }
    }
    // Sellers and admins can view all orders (existing behavior)
    
    // 주문 아이템도 함께 조회
    const items = await repository.findItems(id);
    
    // ✅ BUG #4 FIX: Map DB column (total_price) to API field (total_amount)
    const mappedOrder = {
      ...order,
      total_amount: (order as any).total_price,
      items
    };
    
    return c.json({
      success: true,
      data: mappedOrder
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
    console.log('[Orders] POST /api/orders - Start');
    
    // ✅ BUG #2 FIX: Get authenticated user's DB ID automatically
    const authUser = getCurrentUser(c);
    if (!authUser) {
      console.error('[Orders] No user found in context');
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    console.log('[Orders] User authenticated:', { id: authUser.id, email: authUser.email });
    
    console.log('[Orders] DB connected:', !!DB);
    if (!DB) {
      console.error('[Orders] ❌ DB binding not found');
      return c.json({
        success: false,
        error: 'Database not configured',
        debug: { envKeys: Object.keys(c.env), dbBinding: !!c.env.DB }
      }, 500);
    }
    
    // ✅ Firebase UID → DB ID conversion
    console.log('[Orders] Converting Firebase UID to DB ID:', authUser.id);
    const dbUserId = await getUserDbIdFromFirebaseUid(DB, String(authUser.id));
    console.log('[Orders] User DB ID:', dbUserId);
    
    if (!dbUserId) {
      console.error('[Orders] User not found in DB');
      return c.json({ success: false, error: 'User not found' }, 404);
    }
    
    const data: OrderCreateInput = await c.req.json();
    console.log('[Orders] Request body:', JSON.stringify(data));
    
    // ✅ Automatically set user_id from auth context (security)
    data.user_id = dbUserId;
    
    // 필수 필드 검증 (user_id는 자동 설정되므로 제외)
    if (!data.seller_id || !data.items || data.items.length === 0) {
      console.error('[Orders] Missing required fields:', { seller_id: data.seller_id, items_count: data.items?.length });
      return c.json({
        success: false,
        error: 'Missing required fields'
      }, 400);
    }
    
    console.log('[Orders] Creating order with repository');
    const repository = new OrderRepository(DB);
    const order = await repository.create(data);
    console.log('[Orders] Order created:', { id: (order as any).id });
    
    // ✅ BUG #2 FIX: Map DB column (total_price) to API field (total_amount)
    const mappedOrder = {
      ...order,
      total_amount: (order as any).total_price,
    };
    
    return c.json({
      success: true,
      data: mappedOrder
    }, 201);
    
  } catch (error: any) {
    console.error('[Orders] ❌ Create error:', error);
    console.error('[Orders] Error stack:', error.stack);
    console.error('[Orders] Error name:', error.name);
    console.error('[Orders] Error message:', error.message);
    
    return c.json({
      success: false,
      error: error.message || 'Failed to create order',
      debug: {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      }
    }, 500);
  }
});

export default ordersRoutes;
