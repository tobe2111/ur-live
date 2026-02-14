-- Update product 18 with dummy images
UPDATE products 
SET 
  image_url = 'https://images.unsplash.com/photo-1587334207216-f2b78f29bfd3?w=800',
  detail_images = json_array(
    'https://images.unsplash.com/photo-1587334207216-f2b78f29bfd3?w=800',
    'https://images.unsplash.com/photo-1609501676725-7186f017a4b7?w=800',
    'https://images.unsplash.com/photo-1516684732162-798a0062be99?w=800'
  )
WHERE id = 18;
