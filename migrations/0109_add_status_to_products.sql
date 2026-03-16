-- Migration 0109: Add status column to products table
-- This migration adds the status column that was missing after modularization

-- Add status column if it doesn't exist
ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'DELETED'));

-- Create index for status column
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- Update existing products to have ACTIVE status based on is_active
UPDATE products SET status = CASE 
  WHEN is_active = 1 THEN 'ACTIVE'
  ELSE 'PAUSED'
END WHERE status IS NULL;
