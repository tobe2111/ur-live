/**
 * 유어딜 공동구매 (Community Group Buy) — 메인 라우터 (thin aggregator)
 *
 * POST   /api/community-group-buy/create          - 공동구매 생성 (딜 보증금 차감)
 * POST   /api/community-group-buy/join/:code       - 초대코드로 참여
 * GET    /api/community-group-buy/detail/:code     - 공동구매 상세 + 멤버 목록
 * GET    /api/community-group-buy/list             - 활성 공동구매 목록 (페이지네이션)
 * GET    /api/community-group-buy/my               - 내 공동구매 (생성 + 참여)
 * PATCH  /api/community-group-buy/:id/confirm      - 식당/어드민 딜 확정
 * POST   /api/community-group-buy/:id/refund       - 보증금 환불 (실패/만료)
 * PATCH  /api/community-group-buy/:id/status       - 어드민 상태 변경
 * GET    /api/community-group-buy/popular           - 50명 이상 그룹 (어드민 대시보드)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';
import { communityGroupBuyBrowseRoutes } from './community-group-buy-browse.routes';
import { communityGroupBuyActionsRoutes } from './community-group-buy-actions.routes';

const communityGroupBuyRoutes = new Hono<{ Bindings: Env }>();

communityGroupBuyRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

communityGroupBuyRoutes.route('/', communityGroupBuyActionsRoutes);
communityGroupBuyRoutes.route('/', communityGroupBuyBrowseRoutes);

export { communityGroupBuyRoutes };
