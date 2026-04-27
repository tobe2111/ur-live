-- Clear all dummy data from production database
-- Keep table structures, only delete data

-- Temporarily disable foreign key constraints
PRAGMA foreign_keys = OFF;

-- Delete all data from all tables
DELETE FROM tax_invoice_items;
DELETE FROM tax_invoices;
DELETE FROM tax_invoice_auto_issue_log;
DELETE FROM settlement_items;
DELETE FROM settlements;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM cart_items;
DELETE FROM shipping_addresses;
DELETE FROM product_options;
DELETE FROM products;
DELETE FROM live_streams;
DELETE FROM seller_business_info;
DELETE FROM sellers;
DELETE FROM admin_sessions;
DELETE FROM admins;
DELETE FROM users;
DELETE FROM _cf_KV;

-- Reset auto-increment counters
DELETE FROM sqlite_sequence;

-- Re-enable foreign key constraints
PRAGMA foreign_keys = ON;

