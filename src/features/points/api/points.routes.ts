/**
 * 딜 포인트 시스템 API — 집합 라우터
 *
 * GET  /api/points/balance          - 잔액 조회
 * GET  /api/points/charge-options   - 충전 옵션 목록
 * GET  /api/points/history          - 거래 내역
 * POST /api/points/charge/init      - 충전 결제 시작
 * POST /api/points/charge/confirm   - 충전 결제 확인 (토스 승인)
 * POST /api/points/donate           - 딜 후원 (포인트 즉시 차감)
 * POST /api/points/ad-reward        - 광고 시청 완료 후 딜 지급
 * GET  /api/points/ad-reward/status - 오늘 광고 시청 현황
 * POST /api/points/pay              - 딜로 상품 결제
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../../../worker/types/env';
import { ALLOWED_ORIGINS } from '../../../shared/constants';
import { pointsChargeRoutes } from './points-charge.routes';
import { pointsDonateRoutes } from './points-donate.routes';
import { pointsRewardRoutes } from './points-reward.routes';

const pointsRoutes = new Hono<{ Bindings: Env }>();

pointsRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

pointsRoutes.route('/', pointsChargeRoutes);
pointsRoutes.route('/', pointsDonateRoutes);
pointsRoutes.route('/', pointsRewardRoutes);

export { pointsRoutes };
