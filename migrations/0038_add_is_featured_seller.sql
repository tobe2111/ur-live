-- Add is_featured_seller column to sellers table
ALTER TABLE sellers ADD COLUMN is_featured_seller INTEGER DEFAULT 0;

-- Set seller@ur-team.com as featured seller
UPDATE sellers SET is_featured_seller = 1 WHERE email = 'seller@ur-team.com';

-- Create index for featured sellers
CREATE INDEX IF NOT EXISTS idx_sellers_featured ON sellers(is_featured_seller);
