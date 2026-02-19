-- Add KakaoTalk fields to sellers table
ALTER TABLE sellers ADD COLUMN kakaotalk_url TEXT;
ALTER TABLE sellers ADD COLUMN kakaotalk_name TEXT;
ALTER TABLE sellers ADD COLUMN instagram_handle TEXT;

-- Add address to sellers table for business info
ALTER TABLE sellers ADD COLUMN address TEXT;
ALTER TABLE sellers ADD COLUMN address_detail TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON order_items(seller_id);
