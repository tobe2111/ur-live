/**
 * API Documentation routes (OpenAPI / Swagger UI)
 *
 * GET /api/openapi.json — OpenAPI spec JSON
 * GET /docs            — Swagger UI
 * GET /api/docs        — Swagger UI (alternative path)
 *
 * 🛡️ 2026-04-27: TD-006 partial split — worker/index.ts 인라인 핸들러 제거.
 */
import { Hono } from 'hono';
import { swaggerUI } from '@hono/swagger-ui';
import type { Env } from '@/worker/types/env';
import { openApiSpec } from '../openapi';

const docsRoutes = new Hono<{ Bindings: Env }>();

docsRoutes.get('/api/openapi.json', (c) => c.json(openApiSpec));
docsRoutes.get('/docs', swaggerUI({ url: '/api/openapi.json' }));
docsRoutes.get('/api/docs', swaggerUI({ url: '/api/openapi.json' }));

export { docsRoutes };
