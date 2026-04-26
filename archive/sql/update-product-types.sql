-- Update existing products to set proper types
-- Live stream products (from live_streams table)
UPDATE products 
SET product_type = 'live' 
WHERE id IN (SELECT current_product_id FROM live_streams WHERE current_product_id IS NOT NULL);

-- Featured products (from featured sellers)
UPDATE products 
SET product_type = 'featured'
WHERE seller_id IN (SELECT id FROM sellers WHERE is_featured_seller = 1)
  AND product_type IS NULL OR product_type = 'featured';
