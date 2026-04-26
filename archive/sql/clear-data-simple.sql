-- Delete data in correct order (reverse of foreign key dependencies)

DELETE FROM tax_invoice_auto_issue_log;
DELETE FROM tax_invoice_items;
DELETE FROM tax_invoices;
DELETE FROM settlement_items;
DELETE FROM settlements;
DELETE FROM order_items;
DELETE FROM cart_items;
DELETE FROM orders;
DELETE FROM shipping_addresses;
DELETE FROM product_options;
DELETE FROM products;
DELETE FROM live_streams;
DELETE FROM seller_business_info;
DELETE FROM sellers;
DELETE FROM admin_sessions;
DELETE FROM admins;
DELETE FROM users;
