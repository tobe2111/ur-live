/**
 * Shared Repositories - Canonical Index
 *
 * Single source of truth for repository imports.
 *
 * Rule:
 *  - Use worker-based repositories for Cloudflare Worker runtime (D1 raw queries)
 *  - Drizzle-ORM repositories (base.repository, db/schema) are future-work stubs
 */

// ---- Worker-runtime repositories (active, D1 raw queries) ----
export { OrderRepository } from '../../worker/repositories/order.repository';
export { ProductRepository } from '../../worker/repositories/product.repository';
export { SellerRepository } from '../../worker/repositories/seller.repository';
export { WebhookEventRepository } from '../../worker/repositories/webhook.repository';
export { QueryBuilder } from '../../worker/repositories/query-builder';
