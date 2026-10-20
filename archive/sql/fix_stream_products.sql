-- Connect products to streams for seller@ur-team.com (seller_id = 3)

-- Stream 20: 지리산 설날 떡국떡
-- Product 21: 국내산 참치 대뱃살 파격 특가!
INSERT OR IGNORE INTO live_stream_products (live_stream_id, product_id, created_at)
VALUES (20, 21, datetime('now'));

-- Stream 19: 국민 참치 전문 대박 할인 중!
-- Product 19: 국민 참치 대뱃살 부위 할인가
INSERT OR IGNORE INTO live_stream_products (live_stream_id, product_id, created_at)
VALUES (19, 19, datetime('now'));

-- Stream 15: 오늘의 팔찌 세트! 특급 할인 중
-- Product 20: 다이아 큐빅 디자인 팔찌
INSERT OR IGNORE INTO live_stream_products (live_stream_id, product_id, created_at)
VALUES (15, 20, datetime('now'));

-- Add more products to each stream for variety
INSERT OR IGNORE INTO live_stream_products (live_stream_id, product_id, created_at)
VALUES 
  (20, 19, datetime('now', '-1 minute')),  -- Stream 20에 참치 추가
  (19, 21, datetime('now', '-1 minute')),  -- Stream 19에 대뱃살 추가
  (15, 17, datetime('now', '-1 minute')),  -- Stream 15에 스투시 후드 추가
  (20, 17, datetime('now', '-2 minutes')), -- Stream 20에 스투시 후드 추가
  (19, 20, datetime('now', '-2 minutes')), -- Stream 19에 팔찌 추가
  (15, 21, datetime('now', '-2 minutes')); -- Stream 15에 대뱃살 추가

-- Verify insertions
SELECT ls.id as stream_id, ls.title, p.id as product_id, p.name as product_name
FROM live_streams ls
INNER JOIN live_stream_products lsp ON ls.id = lsp.live_stream_id
INNER JOIN products p ON lsp.product_id = p.id
WHERE ls.id IN (15, 19, 20)
ORDER BY ls.id, lsp.created_at DESC;
