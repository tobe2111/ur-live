// ============================================================
// Public Streams Router — thin aggregator
// GET  /api/streams                      → streamsBrowseRouter
// GET  /api/streams/:id                  → streamsBrowseRouter
// GET  /api/streams/:id/products         → streamsProductsRouter
// GET  /api/streams/:id/current-product  → streamsProductsRouter
// POST /api/streams/:id/current-product  → streamsProductsRouter
// GET  /api/streams/:id/viewer-count     → streamsViewersRouter
// PUT  /api/streams/:id/viewer-count     → streamsViewersRouter
// POST /api/streams/:id/viewer/join      → streamsViewersRouter
// POST /api/streams/:id/viewer/leave     → streamsViewersRouter
// POST /api/streams/:id/fake-cart-notification → streamsViewersRouter
//
// NOTE: 판매자 전용 CRUD는 /api/seller/streams에 유지
// ============================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../types/env';
import { streamsBrowseRouter } from './streams-browse.routes';
import { streamsProductsRouter } from './streams-products.routes';
import { streamsViewersRouter } from './streams-viewers.routes';

export const streamsRouter = new Hono<{ Bindings: Env }>();

// ── CORS ──────────────────────────────────────────────────────────────────────
streamsRouter.use('*', cors());

// ── Sub-routers ───────────────────────────────────────────────────────────────
streamsRouter.route('/', streamsBrowseRouter);
streamsRouter.route('/', streamsProductsRouter);
streamsRouter.route('/', streamsViewersRouter);
