-- Migration: Add commission_rate to sellers table
-- Created: 2026-02-06
-- Description: Add commission_rate column to sellers table with default 10.00%

-- Add commission_rate column with default value 10.00
ALTER TABLE sellers ADD COLUMN commission_rate REAL DEFAULT 10.00;

-- Update existing sellers to have 10.00% commission rate
UPDATE sellers SET commission_rate = 10.00 WHERE commission_rate IS NULL;
