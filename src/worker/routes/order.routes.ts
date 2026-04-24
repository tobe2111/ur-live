// ============================================================
// Order Routes — aggregator
// POST /api/orders            - Create order for one seller
// GET  /api/orders            - List user's orders
// GET  /api/orders/:id        - Get order detail
// POST /api/orders/refund     - Refund
// POST /api/orders/:id/cancel - Cancel order
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth, type AuthUser } from '../middleware/auth';
import { orderCreateRouter } from './order-create';
import { orderQueryRouter } from './order-query';
import { orderActionsRouter } from './order-actions';

type AuthVariables = { user: AuthUser };
const ordersRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// All order routes require authentication
ordersRouter.use('*', requireAuth());

ordersRouter.route('/', orderCreateRouter);
ordersRouter.route('/', orderQueryRouter);
ordersRouter.route('/', orderActionsRouter);

export { ordersRouter };
