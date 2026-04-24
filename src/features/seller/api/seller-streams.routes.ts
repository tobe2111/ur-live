/**
 * Seller Streams API Routes — aggregator
 *
 * Endpoints (all under /api/seller/streams):
 * - GET /                    — 셀러의 라이브 스트림 목록 조회
 * - GET /:id                 — 특정 스트림 상세 조회
 * - POST /                   — 새 스트림 생성
 * - PUT /:id                 — 스트림 정보 수정
 * - DELETE /:id              — 스트림 삭제
 * - GET /:id/analytics       — 특정 스트림 실시간 분석 데이터
 * - GET /analytics/summary   — 셀러 전체 라이브 방송 분석 요약
 * - PUT /:id/product-display — 상품 표시 모드 변경
 * - POST /:id/change-product — 실시간 상품 변경
 * - GET /:id/live-stats      — 라이브 진행 중 실시간 통계
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { KVNamespace } from '@cloudflare/workers-types';
import { ALLOWED_ORIGINS } from '@/shared/constants';
import { sellerStreamsCrudRoutes } from './seller-streams-crud.routes';
import { sellerStreamsAnalyticsRoutes } from './seller-streams-analytics.routes';
import { sellerStreamsLiveRoutes } from './seller-streams-live.routes';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  SESSION_KV?: KVNamespace;
};

export const sellerStreamsRoutes = new Hono<{ Bindings: Bindings }>();

// CORS 설정
sellerStreamsRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

// Mount sub-routers
// Analytics summary must be reachable before any /:id wildcard — handled inside
// sellerStreamsAnalyticsRoutes by registering /analytics/summary first.
sellerStreamsRoutes.route('/', sellerStreamsAnalyticsRoutes);
sellerStreamsRoutes.route('/', sellerStreamsLiveRoutes);
sellerStreamsRoutes.route('/', sellerStreamsCrudRoutes);
