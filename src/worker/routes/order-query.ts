import { Hono } from 'hono';
import { z } from 'zod';
import { rateLimit } from '../middleware/rate-limit';
import type { Env } from '../types/env';
import { OrderRepository } from '../repositories/order.repository';
import { ProductRepository } from '../repositories/product.repository';
import { QueryBuilder } from '../repositories/query-builder';
import { requireAuth, type AuthUser } from '../middleware/auth';
import { calculateShippingFee, generateId } from '../../shared/utils';
import type { CreateOrderRequest } from '../../shared/types';
import { tossCancelPayment } from '../utils/toss-payments';
import { createDashboardNotification } from '../../features/notifications/api/dashboard-notifications.routes';
import { getUserDbId, type AuthVariables } from './order-helpers';

export const orderQueryRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// GET /api/orders
orderQueryRouter.get('/', async (c) => {
  try {
    const firebaseUid = String(c.get('user').id);
    const userId = await getUserDbId(c.env.DB, firebaseUid);
    const { page = '1', limit = '20' } = c.req.query();
    const orderRepo = new OrderRepository(c.env.DB);

    const { orders, total } = await orderRepo.findByUserId(
      userId,
      parseInt(page, 10),
      Math.min(parseInt(limit, 10), 100)
    );

    return c.json({
      success: true,
      data: {
        items: orders,
        total,
        page: parseInt(page, 10),
        limit: Math.min(parseInt(limit, 10), 100),
        has_next: parseInt(page, 10) * Math.min(parseInt(limit, 10), 100) < total,
      },
    });
  } catch (err) {
    console.error('[ORDERS] List error:', err);
    return c.json({ success: false, error: 'Failed to fetch orders' }, 500);
  }
});

// GET /api/orders/:id
orderQueryRouter.get('/:id', async (c) => {
  try {
    const firebaseUid = String(c.get('user').id);
    const userId = await getUserDbId(c.env.DB, firebaseUid);
    const orderId = c.req.param('id')!;
    const orderRepo = new OrderRepository(c.env.DB);

    const order = await orderRepo.findById(orderId);

    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    // Security: only owner can view
    if (order.user_id !== userId && c.get('user').type !== 'admin') {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    return c.json({ success: true, data: order });
  } catch (err) {
    console.error('[ORDERS] Detail error:', err);
    return c.json({ success: false, error: 'Failed to fetch order' }, 500);
  }
});

