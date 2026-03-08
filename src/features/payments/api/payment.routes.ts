/**
 * Payment API Routes
 * 
 * Endpoints:
 * - POST /api/payments/confirm - 결제 승인
 * - POST /api/payments/rollback - 결제 취소/환불
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  TOSS_SECRET_KEY?: string;
};

type PaymentConfirmRequest = {
  paymentKey: string;
  orderId: string;
  amount: number;
};

type PaymentRollbackRequest = {
  paymentKey: string;
  cancelReason: string;
  cancelAmount?: number;
};

export const paymentRoutes = new Hono<{ Bindings: Bindings }>();

// CORS 설정
paymentRoutes.use('*', cors({
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
 * Toss Payments API 호출 (결제 승인)
 */
async function confirmTossPayment(paymentKey: string, orderId: string, amount: number, secretKey: string) {
  try {
    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(secretKey + ':')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Toss payment confirmation failed');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Toss payment confirmation error:', error);
    throw error;
  }
}

/**
 * Toss Payments API 호출 (결제 취소)
 */
async function cancelTossPayment(paymentKey: string, cancelReason: string, cancelAmount: number | undefined, secretKey: string) {
  try {
    const body: any = { cancelReason };
    if (cancelAmount !== undefined) {
      body.cancelAmount = cancelAmount;
    }

    const response = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(secretKey + ':')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Toss payment cancellation failed');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Toss payment cancellation error:', error);
    throw error;
  }
}

/**
 * POST /api/payments/confirm
 * 결제 승인
 */
paymentRoutes.post('/confirm', async (c) => {
  try {
    const firebaseUid = await getUserIdFromToken(c.req.header('Authorization'));
    if (!firebaseUid) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 401);
    }

    const body = await c.req.json<PaymentConfirmRequest>();
    const { paymentKey, orderId, amount } = body;

    // 필수 필드 검증
    if (!paymentKey || !orderId || !amount) {
      return c.json({
        success: false,
        error: 'Missing required fields'
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

    // orderId로 주문 조회 (orderId는 일반적으로 order.id + timestamp 형식)
    // 여기서는 간단하게 orderId를 파싱하거나 별도 테이블에서 조회
    // 실제로는 payments 테이블이나 orders 테이블에 toss_order_id 컬럼이 필요
    const order = await db.prepare(`
      SELECT o.*, p.seller_id
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.id = ? AND o.user_id = ?
    `).bind(parseInt(orderId.split('-')[0] || orderId), userId).first();

    if (!order) {
      return c.json({
        success: false,
        error: 'Order not found'
      }, 404);
    }

    // 금액 검증
    if (order.total_price !== amount) {
      return c.json({
        success: false,
        error: 'Amount mismatch'
      }, 400);
    }

    // 이미 결제 완료된 주문인지 확인
    if (order.status === 'confirmed' || order.status === 'shipped' || order.status === 'delivered') {
      return c.json({
        success: false,
        error: 'Order already confirmed'
      }, 400);
    }

    // Toss Payments API 호출
    const tossSecretKey = c.env.TOSS_SECRET_KEY || 'test_sk_fake_secret_key';
    const tossPayment = await confirmTossPayment(paymentKey, orderId, amount, tossSecretKey);

    // 주문 상태 업데이트
    await db.prepare(`
      UPDATE orders
      SET 
        status = 'confirmed',
        payment_key = ?,
        payment_method = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(paymentKey, tossPayment.method || 'card', order.id).run();

    // 결제 내역 저장 (별도 payments 테이블이 있다면)
    // await db.prepare(`
    //   INSERT INTO payments (order_id, payment_key, amount, method, status, created_at)
    //   VALUES (?, ?, ?, ?, 'confirmed', datetime('now'))
    // `).bind(order.id, paymentKey, amount, tossPayment.method).run();

    // 업데이트된 주문 조회
    const updatedOrder = await db.prepare(`
      SELECT 
        o.id,
        o.user_id,
        o.product_id,
        o.quantity,
        o.total_price,
        o.status,
        o.payment_key,
        o.payment_method,
        o.shipping_address,
        o.created_at,
        o.updated_at,
        p.name as product_name
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.id = ?
    `).bind(order.id).first();

    return c.json({
      success: true,
      message: 'Payment confirmed successfully',
      payment: tossPayment,
      order: updatedOrder
    });

  } catch (error: any) {
    console.error('Payment confirmation error:', error);
    return c.json({
      success: false,
      error: error.message || 'Payment confirmation failed'
    }, 500);
  }
});

/**
 * POST /api/payments/rollback
 * 결제 취소/환불
 */
paymentRoutes.post('/rollback', async (c) => {
  try {
    const firebaseUid = await getUserIdFromToken(c.req.header('Authorization'));
    if (!firebaseUid) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 401);
    }

    const body = await c.req.json<PaymentRollbackRequest>();
    const { paymentKey, cancelReason, cancelAmount } = body;

    // 필수 필드 검증
    if (!paymentKey || !cancelReason) {
      return c.json({
        success: false,
        error: 'Missing required fields'
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

    // paymentKey로 주문 조회
    const order = await db.prepare(`
      SELECT o.*, p.seller_id
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.payment_key = ? AND o.user_id = ?
    `).bind(paymentKey, userId).first();

    if (!order) {
      return c.json({
        success: false,
        error: 'Order not found'
      }, 404);
    }

    // 이미 취소된 주문인지 확인
    if (order.status === 'cancelled') {
      return c.json({
        success: false,
        error: 'Order already cancelled'
      }, 400);
    }

    // 취소 불가능한 상태인지 확인
    if (order.status === 'delivered') {
      return c.json({
        success: false,
        error: 'Cannot cancel delivered order'
      }, 400);
    }

    // Toss Payments API 호출
    const tossSecretKey = c.env.TOSS_SECRET_KEY || 'test_sk_fake_secret_key';
    const tossPayment = await cancelTossPayment(paymentKey, cancelReason, cancelAmount, tossSecretKey);

    // 주문 상태 업데이트
    await db.prepare(`
      UPDATE orders
      SET 
        status = 'cancelled',
        cancel_reason = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(cancelReason, order.id).run();

    // 취소 내역 저장 (별도 refunds 테이블이 있다면)
    // await db.prepare(`
    //   INSERT INTO refunds (order_id, payment_key, amount, reason, status, created_at)
    //   VALUES (?, ?, ?, ?, 'completed', datetime('now'))
    // `).bind(order.id, paymentKey, cancelAmount || order.total_price, cancelReason).run();

    // 업데이트된 주문 조회
    const updatedOrder = await db.prepare(`
      SELECT 
        o.id,
        o.user_id,
        o.product_id,
        o.quantity,
        o.total_price,
        o.status,
        o.payment_key,
        o.payment_method,
        o.cancel_reason,
        o.shipping_address,
        o.created_at,
        o.updated_at,
        p.name as product_name
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.id = ?
    `).bind(order.id).first();

    return c.json({
      success: true,
      message: 'Payment cancelled successfully',
      payment: tossPayment,
      order: updatedOrder
    });

  } catch (error: any) {
    console.error('Payment rollback error:', error);
    return c.json({
      success: false,
      error: error.message || 'Payment rollback failed'
    }, 500);
  }
});
