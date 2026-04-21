-- ============================================================
-- 0200_add_performance_indexes.sql
-- Performance indexes for high-traffic D1 queries.
--
-- NOTE: Most indexes from the original audit list already exist:
--   - idx_orders_user_id         (0081 / 0024 / 0005)
--   - idx_orders_seller_id       (0005)
--   - idx_orders_status_created  (0081)
--   - idx_products_seller_id     (0024 / 0081)
--   - idx_products_category_active (0081)
--   - idx_live_streams_status    (0024)
--   - idx_live_streams_seller_id (0024)
--   - idx_reviews_product        (0132) — product_reviews(product_id, is_visible)
--   - idx_cart_items_user_id     (pre-existing)
--   - idx_notifications_user     (0100) — (user_type, user_id, is_read)
--
-- Only the indexes below were missing after scanning all 117 migrations.
-- IF NOT EXISTS keeps the migration idempotent even if a column happens to
-- be absent on an older branch (the CREATE is then a no-op via try/catch
-- semantics of the migration runner).
-- ============================================================

-- seller_follows.seller_id is hot:
--   - "List followers of seller X"     (social.routes.ts L125)
--   - "Fanout notifications to seller's followers"  (lib/notifications.ts L77)
-- The UNIQUE(user_id, seller_id) constraint only indexes the composite,
-- not seller_id alone, so seller-side lookups fall back to full scan.
CREATE INDEX IF NOT EXISTS idx_seller_follows_seller_id ON seller_follows(seller_id);

-- coupon_uses.user_id is hot:
--   - "Which coupons has this user already used?"  (coupons.routes.ts L102,
--     scheduled-cleanup.ts L268 "available coupons" filter)
-- The UNIQUE(coupon_id, user_id) leading column is coupon_id, so user-only
-- lookups miss the index.
CREATE INDEX IF NOT EXISTS idx_coupon_uses_user_id ON coupon_uses(user_id);
