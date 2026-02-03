-- Update stream 4 with SNS links
UPDATE live_streams 
SET 
  seller_instagram = 'gaming_pro_official',
  seller_youtube = '@GamingProOfficial',
  seller_facebook = 'GamingProOfficial'
WHERE id = 4;
