/**
 * Orders API Routes (feature module — complementary routes)
 *
 * 🛡️ 2026-04-22 Dual routing 정리 (배치 112):
 *   GET /, GET /:id, POST / 는 worker/routes/order.routes.ts 의 ordersRouter 가
 *   먼저 마운트되어 우선권을 가짐 → 이 파일의 동일 경로는 dead code 였음 → 삭제.
 *   이 파일은 delivery tracking / 구매확정 / cron 전용으로 축소.
 *
 * Endpoints (unique, non-overlapping with ordersRouter):
 * - GET  /api/orders/:id/tracking          - 실시간 배송 추적
 * - POST /api/orders/:id/confirm           - 구매확정
 * - POST /api/orders/internal/auto-confirm - cron: 자동 구매확정
 * - POST /api/orders/internal/sync-deliveries - cron: 배송 상태 동기화
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { OrderRepository } from '../repositories/OrderRepository';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import { rateLimit } from '@/worker/middleware/rate-limit';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  DELIVERY_TRACKER_API_KEY?: string;
  /**
   * 🛡️ 2026-04-22 배치 120 (TD-008): fail-closed — 이 secret 없으면 cron
   *   엔드포인트가 500 반환. Dashboard/wrangler 로 반드시 세팅 필요.
   *   값: `openssl rand -base64 32`
   */
  INTERNAL_CRON_TOKEN?: string;
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
    // 🛡️ 2026-04-22: 10s timeout — 배송 추적 느릴 때 worker hang 방어
    signal: AbortSignal.timeout(10_000),
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

// 🛡️ 2026-04-22 배치 112: GET /, GET /:id, POST / 는 ordersRouter 로 이관 (dead code 제거).

/**
 * GET /api/orders/:id/tracking
 * 실시간 배송 추적 (DeliveryTracker GraphQL)
 * DELIVERY_TRACKER_API_KEY 환경변수가 없으면 빈 이벤트 반환
 */
ordersRoutes.get('/:id/tracking', cors(), requireAuth(), async (c) => {
  const { DB } = c.env;
  const authUser = getCurrentUser(c);
  if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const rawId = c.req.param('id') ?? '';
  if (!/^\d+$/.test(rawId)) return c.json({ success: false, error: 'Invalid order ID' }, 400);
  const id = Number(rawId);
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
ordersRoutes.post('/:id/confirm', cors(), rateLimit({ action: 'order_confirm', max: 20, windowSec: 60 }), requireAuth(), async (c) => {
  const { DB } = c.env;
  const authUser = getCurrentUser(c);
  if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const rawId = c.req.param('id') ?? '';
  if (!/^\d+$/.test(rawId)) return c.json({ success: false, error: 'Invalid order ID' }, 400);
  const id = Number(rawId);
  if (isNaN(id)) return c.json({ success: false, error: 'Invalid order ID' }, 400);

  const repository = new OrderRepository(DB);
  const order = await repository.findById(id) as any;
  if (!order) return c.json({ success: false, error: 'Order not found' }, 404);

  if (authUser.type === 'user') {
    const dbUserId = await getUserDbIdFromFirebaseUid(DB, String(authUser.id));
    if (order.user_id !== dbUserId) return c.json({ success: false, error: 'Forbidden' }, 403);
  }

  if (!['SHIPPING'].includes(order.status)) {
    return c.json({ success: false, error: '배송중 상태에서만 구매확정이 가능합니다.' }, 400);
  }

  await DB.prepare(`
    UPDATE orders
    SET status = 'DELIVERED', delivered_at = datetime('now'),
        settlement_status = 'confirmed', updated_at = datetime('now')
    WHERE id = ? AND status IN ('SHIPPING')
  `).bind(id).run();

  // 셀러 정산 알림
  try {
    const orderInfo = await DB.prepare('SELECT seller_id, total_amount, order_number FROM orders WHERE id = ?').bind(id).first<{ seller_id: number; total_amount: number; order_number: string }>();
    if (orderInfo?.seller_id) {
      const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes');
      await createDashboardNotification(DB, 'seller', String(orderInfo.seller_id), 'purchase_confirmed',
        '구매 확정', `주문 #${id} 구매 확정 (${orderInfo.total_amount?.toLocaleString()}원) — 정산 가능`, '/seller/settlements');
    }
    // 유저에게 배송 완료 인앱 알림
    if (order.user_id) {
      const { notifyUser } = await import('../../../lib/notifications');
      await notifyUser(DB, String(order.user_id), 'order_status', '\u2705 배송이 완료되었습니다. 상품을 확인해주세요!', `주문번호: ${orderInfo?.order_number || id}`, '/my-orders');
    }
  } catch {} // fire and forget

  return c.json({ success: true, data: { message: '구매확정이 완료되었습니다.' } });
});

/**
 * POST /api/orders/internal/auto-confirm
 * Cron 전용: shipped_at 기준 14일 경과한 배송중 주문 자동 구매확정
 * X-Internal-Token: cron-sync-deliveries 헤더 필요
 */
ordersRoutes.post('/internal/auto-confirm', cors(), async (c) => {
  // 🛡️ 2026-04-22 배치 120 (TD-008): fail-closed — INTERNAL_CRON_TOKEN 필수.
  //   legacy literal fallback 제거. secret 미세팅이면 500 반환 (bruteforce 차단).
  const expectedToken = c.env.INTERNAL_CRON_TOKEN;
  if (!expectedToken) {
    console.error('[CronAuth] INTERNAL_CRON_TOKEN secret not configured');
    return c.json({ success: false, error: 'Server misconfiguration' }, 500);
  }
  if (c.req.header('X-Internal-Token') !== expectedToken) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const { DB } = c.env;

  const { meta } = await DB.prepare(`
    UPDATE orders
    SET status = 'DELIVERED', delivered_at = datetime('now'),
        settlement_status = 'confirmed', updated_at = datetime('now')
    WHERE status IN ('SHIPPING')
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
  // 🛡️ 2026-04-22 배치 120 (TD-008): fail-closed — INTERNAL_CRON_TOKEN 필수.
  //   legacy literal fallback 제거. secret 미세팅이면 500 반환 (bruteforce 차단).
  const expectedToken = c.env.INTERNAL_CRON_TOKEN;
  if (!expectedToken) {
    console.error('[CronAuth] INTERNAL_CRON_TOKEN secret not configured');
    return c.json({ success: false, error: 'Server misconfiguration' }, 500);
  }
  if (c.req.header('X-Internal-Token') !== expectedToken) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const { DB } = c.env;

  // 12시간 이상 배송중인 주문 최대 5개만 처리 (API 한도 절약)
  const { results: rows = [] } = await DB.prepare(`
    SELECT id, order_number, courier, tracking_number
    FROM orders
    WHERE status IN ('SHIPPING')
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
          SET status = 'DELIVERED', delivered_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ? AND status IN ('SHIPPING')
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
