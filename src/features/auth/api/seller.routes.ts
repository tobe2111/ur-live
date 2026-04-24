/**
 * Seller Auth Routes — thin aggregator
 *
 * Mounts:
 *   POST /login            → seller-auth-login.routes.ts
 *   POST /refresh          → seller-auth-refresh.routes.ts
 *   POST /forgot-password  → seller-auth-password.routes.ts
 *   POST /reset-password   → seller-auth-password.routes.ts
 */

import { Hono } from 'hono';
import type { Bindings } from './seller-auth-helpers';
import { sellerAuthLoginRoutes } from './seller-auth-login.routes';
import { sellerAuthRefreshRoutes } from './seller-auth-refresh.routes';
import { sellerAuthPasswordRoutes } from './seller-auth-password.routes';

export const sellerRoutes = new Hono<{ Bindings: Bindings }>();

sellerRoutes.route('/', sellerAuthLoginRoutes);
sellerRoutes.route('/', sellerAuthRefreshRoutes);
sellerRoutes.route('/', sellerAuthPasswordRoutes);

export default sellerRoutes;
