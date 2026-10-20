-- Check seller account
SELECT id, email, business_name FROM sellers WHERE email = 'seller@ur-team.com';

-- Check live streams for seller_id = 3
SELECT id, title, seller_id, status FROM live_streams WHERE seller_id = 3;

-- Check all live streams to see seller_id distribution
SELECT id, title, seller_id, status FROM live_streams ORDER BY id DESC LIMIT 10;
