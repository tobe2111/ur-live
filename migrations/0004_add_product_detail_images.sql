-- Add detail_images column to products table
-- This will store JSON array of detail image URLs for product detail page

ALTER TABLE products ADD COLUMN detail_images TEXT;

-- Update existing products with dummy detail images
UPDATE products 
SET detail_images = json_array(
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800',
  'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800'
)
WHERE id = 1;

UPDATE products 
SET detail_images = json_array(
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
  'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=800',
  'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800'
)
WHERE id = 2;

UPDATE products 
SET detail_images = json_array(
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800',
  'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800',
  'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800'
)
WHERE id = 3;

UPDATE products 
SET detail_images = json_array(
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800',
  'https://images.unsplash.com/photo-1572635196184-84e35138cf62?w=800',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800'
)
WHERE id = 4;

UPDATE products 
SET detail_images = json_array(
  'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800',
  'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=800',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800'
)
WHERE id = 5;
