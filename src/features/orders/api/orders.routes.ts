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
  DELIVERY_TRACKER_API_KEY?: string;
};

export const ordersRoutes = new Hono<{ Bindings: Bindings }>();

// ─── 택배사 이름 → DeliveryTracker carrier ID 매핑 ───────────────────────────
const CARRIER_ID_MAP: Record<string, string> = {
  'CJ대한통운':       'kr.cjlogistics',
  '우체국택배':        'kr.epost',
  '한진택배':         'kr.hanjin',
  '로젠택배':         'kr.logen',
  '롯데택배':         'kr.lotte',
  'GS택배':          'kr.gs',
  'GS Postbox 택배':  'kr.gs',
  '쿠팡로켓배송':      'kr.coupanglogistics',
  '홈픽':            'kr.homepick',
};

const TRACKING_GQL = `
  query Track($carrierId: ID!, $trackId: ID!) {
    track(carrierId: $carrierId, trackId: $trackId) {
      lastEvent {
        time
        status { code name }
        description
        location { name }
      }
      events(last: 30) {
        edges {
          node {
            time
            status { code name }
            description
            location { name }
          }
        }
      }
    }
  }
`;

async function fetchDeliveryTracker(
  carrierId: string,
  trackId: string,
  apiKey?: string
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch('https://apis.tracker.delivery/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: TRACKING_GQL, variables: { carrierId, trackId } }),
  });
  return res.json() as Promise<any>;
}

/**
 * Helper: map Firebase UID → DB integer user id
 */
async function getUserDbIdFromFirebaseUid(db: D1Database, idOrUid: string): Promise<number | null> {
  // 숫자 ID면 바로 사용 (세션 쿠키 유저)
  const numId = parseInt(idOrUid);
  if (!isNaN(numId) && String(numId) === idOrUid) return numId;
  // Firebase UID로 조회
  const row = await db.prepare('SELECT id FROM users WHERE firebase_uid = ?').bind(idOrUid).first<{ id: number }>();
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
    // ✅ BUG #2 FIX: Get authenticated user's DB ID automatically
    const authUser = getCurrentUser(c);
    if (!authUser) {
      console.error('[Orders] No user found in context');
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    if (!DB) {
      console.error('[Orders] ❌ DB binding not found');
      return c.json({
        success: false,
        error: 'Database not configured',
        debug: { envKeys: Object.keys(c.env), dbBinding: !!c.env.DB }
      }, 500);
    }

    // ✅ Firebase UID → DB ID conversion
    const dbUserId = await getUserDbIdFromFirebaseUid(DB, String(authUser.id));
    
    if (!dbUserId) {
      console.error('[Orders] User not found in DB');
      return c.json({ success: false, error: 'User not found' }, 404);
    }
    
    const rawData = await c.req.json();

    // ✅ 타입 안전 변환 (프론트에서 String으로 올 수 있음)
    const data: OrderCreateInput = {
      ...rawData,
      user_id: dbUserId,
      seller_id: Number(rawData.seller_id),
      total_amount: Number(rawData.total_amount) || 0,
      items: (rawData.items || []).map((item: any) => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
      })),
    };

    // total_amount가 0이면 아이템 합산으로 계산
    if (!data.total_amount) {
      data.total_amount = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }

    // 필수 필드 검증 (user_id는 자동 설정되므로 제외)
    if (!data.seller_id || !data.items || data.items.length === 0) {
      return c.json({
        success: false,
        error: 'Missing required fields'
      }, 400);
    }
    
    const repository = new OrderRepository(DB);
    const order = await repository.create(data);
    
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

/**
 * GET /api/orders/:id/tracking
 * 실시간 배송 추적 (DeliveryTracker GraphQL)
 * DELIVERY_TRACKER_API_KEY 환경변수가 없으면 빈 이벤트 반환
 */
ordersRoutes.get('/:id/tracking', cors(), requireAuth(), async (c) => {
  const { DB } = c.env;
  const authUser = getCurrentUser(c);
  if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ success: false, error: 'Invalid order ID' }, 400);

  const repository = new OrderRepository(DB);
  const order = await repository.findById(id) as any;
  if (!order) return c.json({ success: false, error: 'Order not found' }, 404);

  if (authUser.type === 'user') {
    const dbUserId = await getUserDbIdFromFirebaseUid(DB, String(authUser.id));
    if (order.user_id !== dbUserId) return c.json({ success: false, error: 'Forbidden' }, 403);
  }

  const { courier, tracking_number } = order;
  if (!courier || !tracking_number) {
    return c.json({ success: true, data: { events: [], orderStatus: order.status } });
  }

  const carrierId = CARRIER_ID_MAP[courier];
  if (!carrierId) {
    return c.json({
      success: true,
      data: {
        events: [], orderStatus: order.status,
        courier, trackingNumber: tracking_number, unsupported: true,
      },
    });
  }

  try {
    const json = await fetchDeliveryTracker(carrierId, tracking_number, c.env.DELIVERY_TRACKER_API_KEY);

    if (json.errors?.length) {
      return c.json({
        success: true,
        data: { events: [], orderStatus: order.status, courier, trackingNumber: tracking_number, apiError: json.errors[0].message },
      });
    }

    const track = json.data?.track;
    const events = ((track?.events?.edges ?? []) as any[])
      .map((e: any) => ({
        time: e.node.time,
        statusCode: e.node.status?.code ?? '',
        statusName: e.node.status?.name ?? '',
        description: e.node.description ?? '',
        location: e.node.location?.name ?? '',
      }))
      .reverse();

    return c.json({
      success: true,
      data: {
        events,
        lastStatusCode: track?.lastEvent?.status?.code ?? '',
        lastStatusName: track?.lastEvent?.status?.name ?? '',
        orderStatus: order.status,
        courier,
        trackingNumber: tracking_number,
      },
    });
  } catch (err) {
    console.error('[Tracking] fetch error:', err);
    return c.json({
      success: true,
      data: { events: [], orderStatus: order.status, courier, trackingNumber: tracking_number, apiError: '배송 조회 서비스 연결 실패' },
    });
  }
});

/**
 * POST /api/orders/:id/confirm
 * 구매확정: 유저가 직접 배송완료 처리 (배송중 상태에서만 가능)
 */
ordersRoutes.post('/:id/confirm', cors(), requireAuth(), async (c) => {
  const { DB } = c.env;
  const authUser = getCurrentUser(c);
  if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ success: false, error: 'Invalid order ID' }, 400);

  const repository = new OrderRepository(DB);
  const order = await repository.findById(id) as any;
  if (!order) return c.json({ success: false, error: 'Order not found' }, 404);

  if (authUser.type === 'user') {
    const dbUserId = await getUserDbIdFromFirebaseUid(DB, String(authUser.id));
    if (order.user_id !== dbUserId) return c.json({ success: false, error: 'Forbidden' }, 403);
  }

  if (!['shipping', 'SHIPPING'].includes(order.status)) {
    return c.json({ success: false, error: '배송중 상태에서만 구매확정이 가능합니다.' }, 400);
  }

  await DB.prepare(`
    UPDATE orders
    SET status = 'delivered', delivered_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ? AND status IN ('shipping', 'SHIPPING')
  `).bind(id).run();

  return c.json({ success: true, data: { message: '구매확정이 완료되었습니다.' } });
});

/**
 * POST /api/orders/internal/auto-confirm
 * Cron 전용: shipped_at 기준 14일 경과한 배송중 주문 자동 구매확정
 * X-Internal-Token: cron-sync-deliveries 헤더 필요
 */
ordersRoutes.post('/internal/auto-confirm', cors(), async (c) => {
  if (c.req.header('X-Internal-Token') !== 'cron-sync-deliveries') {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const { DB } = c.env;

  const { meta } = await DB.prepare(`
    UPDATE orders
    SET status = 'delivered', delivered_at = datetime('now'), updated_at = datetime('now')
    WHERE status IN ('shipping', 'SHIPPING')
      AND shipped_at < datetime('now', '-14 days')
  `).run();

  const confirmed = meta.changes ?? 0;

  return c.json({ success: true, data: { confirmed } });
});

/**
 * POST /api/orders/internal/sync-deliveries
 * Cron 전용: 배송중 주문을 DeliveryTracker로 확인해 자동 완료 처리
 * X-Internal-Token: cron-sync-deliveries 헤더 필요
 */
ordersRoutes.post('/internal/sync-deliveries', cors(), async (c) => {
  if (c.req.header('X-Internal-Token') !== 'cron-sync-deliveries') {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const { DB } = c.env;

  // 12시간 이상 배송중인 주문 최대 5개만 처리 (API 한도 절약)
  const { results: rows = [] } = await DB.prepare(`
    SELECT id, order_number, courier, tracking_number
    FROM orders
    WHERE status IN ('shipping', 'SHIPPING')
      AND tracking_number IS NOT NULL
      AND shipped_at < datetime('now', '-12 hours')
    ORDER BY shipped_at ASC
    LIMIT 5
  `).all<{ id: number; order_number: string; courier: string; tracking_number: string }>();

  let delivered = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const carrierId = CARRIER_ID_MAP[row.courier];
    if (!carrierId) continue;

    try {
      const json = await fetchDeliveryTracker(carrierId, row.tracking_number, c.env.DELIVERY_TRACKER_API_KEY);
      const lastStatus = json.data?.track?.lastEvent?.status?.code;

      if (lastStatus === 'DELIVERED') {
        await DB.prepare(`
          UPDATE orders
          SET status = 'delivered', delivered_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ? AND status IN ('shipping', 'SHIPPING')
        `).bind(row.id).run();
        delivered++;
      }
    } catch (err) {
      errors.push(`${row.order_number}: ${(err as Error).message}`);
    }
  }

  return c.json({ success: true, data: { processed: rows.length, delivered, errors } });
});

export default ordersRoutes;
