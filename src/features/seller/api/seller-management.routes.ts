/**
 * Seller Management Routes — thin aggregator
 *
 * Mounts all seller management sub-routers under a single Hono app.
 * CORS is applied here once for all routes.
 *
 * Sub-routers:
 *   seller-registration.routes.ts  — register, register-from-user, my-seller-status, switch-to-*
 *   seller-profile.routes.ts       — profile, personal-info, change-password, upload-image
 *   seller-business.routes.ts      — business-info CRUD
 *   seller-stats.routes.ts         — stats
 *   seller-public-api.routes.ts    — public/:sellerId, /:sellerId/products-public, /products/:id/options
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ALLOWED_ORIGINS } from '@/shared/constants';
import { type Bindings } from './seller-management-helpers';
import { sellerRegistrationRoutes } from './seller-registration.routes';
import { sellerProfileRoutes } from './seller-profile.routes';
import { sellerBusinessRoutes } from './seller-business.routes';
import { sellerStatsRoutes } from './seller-stats.routes';
import { sellerPublicApiRoutes } from './seller-public-api.routes';

export const sellerManagementRoutes = new Hono<{ Bindings: Bindings }>();

// CORS applied once for all sub-routes
sellerManagementRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

// Mount sub-routers
sellerManagementRoutes.route('/', sellerRegistrationRoutes);
sellerManagementRoutes.route('/', sellerProfileRoutes);
sellerManagementRoutes.route('/', sellerBusinessRoutes);
sellerManagementRoutes.route('/', sellerStatsRoutes);
sellerManagementRoutes.route('/', sellerPublicApiRoutes);
