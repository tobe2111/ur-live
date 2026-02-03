-- Add SNS link columns to live_streams table
ALTER TABLE live_streams ADD COLUMN seller_instagram TEXT;
ALTER TABLE live_streams ADD COLUMN seller_youtube TEXT;
ALTER TABLE live_streams ADD COLUMN seller_facebook TEXT;
