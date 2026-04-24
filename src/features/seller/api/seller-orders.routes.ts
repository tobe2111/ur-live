/**
 * Seller Orders & Products API — Aggregator
 *
 * Mounts sub-routers:
 * - seller-orders-management.routes.ts   (order CRUD, status, tracking, bulk)
 * - seller-products-management.routes.ts (product CRUD, stream link, PIN)
 *
 * CORS is applied here (once) so sub-routers don't need it.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';
import { sellerOrdersManagementRoutes } from './seller-orders-management.routes';
import { sellerProductsManagementRoutes } from './seller-products-management.routes';

export const sellerOrdersRoutes = new Hono<{ Bindings: Env }>();

sellerOrdersRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

sellerOrdersRoutes.route('/', sellerOrdersManagementRoutes);
sellerOrdersRoutes.route('/', sellerProductsManagementRoutes);
