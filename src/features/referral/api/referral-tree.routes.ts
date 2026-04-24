/**
 * Multi-Tier Referral Commission System — aggregator
 *
 * Tables:
 *   referral_tree        — user hierarchy (parent / grandparent / great_grandparent)
 *   referral_commissions — per-order commission ledger
 *
 * Endpoints (Hono, mounted at /api/referral-tree):
 *   POST /register               — register user in referral tree
 *   POST /calculate-commission   — calculate & grant multi-tier commissions for an order
 *   GET  /my-network             — current user's referral network stats
 *   GET  /my-commissions         — current user's commission history (paginated)
 *   GET  /stats                  — admin: overall referral network stats
 *
 * Exported helpers (for internal use, avoid HTTP round-trip):
 *   calculateMultiTierCommission(DB, orderId, orderAmount, buyerUserId)
 *   registerInReferralTree(DB, userId, userType, referrerId?)
 *
 * Sub-modules:
 *   referral-tree-helpers.ts  — shared DB helpers (table creation, rates, resolvers)
 *   referral-tree-core.ts     — core exported functions (commission calc, register)
 *   referral-tree-user.routes.ts  — user-facing + internal commission endpoints
 *   referral-tree-admin.routes.ts — admin stats endpoint
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import { referralTreeUserRoutes } from './referral-tree-user.routes'
import { referralTreeAdminRoutes } from './referral-tree-admin.routes'

// Re-export core functions for internal use by other modules
export { calculateMultiTierCommission } from './referral-tree-core'
export { registerInReferralTree } from './referral-tree-core'

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const referralTreeRoutes = new Hono<{ Bindings: Env }>()

referralTreeRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}))

referralTreeRoutes.route('/', referralTreeUserRoutes)
referralTreeRoutes.route('/', referralTreeAdminRoutes)

export { referralTreeRoutes }
