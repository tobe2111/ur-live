-- Update products 17-21 with dummy detail images

-- Product 17: 스투시 그레이 후드
UPDATE products 
SET 
  image_url = 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800',
  detail_images = json_array(
    'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800',
    'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800',
    'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800'
  )
WHERE id = 17;

-- Product 18: 지리산 설날 떡국떡 파격 할인가 (already updated, keep current)

-- Product 19: 국민 참치 대뱃살 부위 할인가
UPDATE products 
SET 
  image_url = 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
  detail_images = json_array(
    'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
    'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?w=800',
    'https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=800'
  )
WHERE id = 19;

-- Product 20: 다이아 큐빅 디자인 팔찌
UPDATE products 
SET 
  image_url = 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800',
  detail_images = json_array(
    'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800',
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800',
    'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=800'
  )
WHERE id = 20;

-- Product 21: 국내산 참치 대뱃살 파격 특가!
UPDATE products 
SET 
  image_url = 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
  detail_images = json_array(
    'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
    'https://images.unsplash.com/photo-1580822184713-fc5400e7fe10?w=800',
    'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=800'
  )
WHERE id = 21;
