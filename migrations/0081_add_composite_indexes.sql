-- =====================================================
-- Migration: 0081_add_composite_indexes.sql
-- Purpose: Add composite indexes for performance optimization
-- Expected Impact: 2-5x query speed improvement
-- Date: 2026-02-22
-- =====================================================

-- =====================================================
-- 1. Orders Table Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_orders_user_status 
ON orders(user_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_status_created 
ON orders(status, created_at DESC);


-- =====================================================
-- 2. Products Table Indexes  
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_products_category_active 
ON products(category, is_active);

CREATE INDEX IF NOT EXISTS idx_products_seller_active 
ON products(seller_id, is_active);


-- =====================================================
-- 3. Live Streams Table Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_live_seller_status_time 
ON live_streams(seller_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_status_time 
ON live_streams(status, created_at DESC);


-- =====================================================
-- 4. Chat Messages Table Index
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_chat_stream_time 
ON chat_messages(live_stream_id, created_at DESC);


-- =====================================================
-- 5. Order Items Table Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_order_items_order 
ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product 
ON order_items(product_id);


-- =====================================================
-- 6. Product Options Table Index
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_product_options_product 
ON product_options(product_id);


-- =====================================================
-- 7. Cart Items Table Index
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_cart_user 
ON cart_items(user_id);


-- =====================================================
-- 8. Admin Sessions Table Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token 
ON admin_sessions(session_token);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin 
ON admin_sessions(admin_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_seller 
ON admin_sessions(seller_id, expires_at DESC);


-- =====================================================
-- 9. Notifications Table Index
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
ON notifications(user_id, is_read, created_at DESC);


-- =====================================================
-- 10. Wishlists Table Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_wishlists_user 
ON wishlists(user_id);

CREATE INDEX IF NOT EXISTS idx_wishlists_product 
ON wishlists(product_id);


-- =====================================================
-- Summary
-- =====================================================
-- Total Indexes Created: 17
-- Expected Performance Improvement: 2-5x faster queries
-- Storage Overhead: ~2-5% of table size
-- =====================================================
