-- Add tax invoice auto issue log table
-- This table tracks automatic tax invoice issuance attempts

CREATE TABLE IF NOT EXISTS tax_invoice_auto_issue_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL,
  seller_id INTEGER NOT NULL,
  tax_invoice_id INTEGER,
  status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'pending', 'retry')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (seller_id) REFERENCES sellers(id),
  FOREIGN KEY (tax_invoice_id) REFERENCES tax_invoices(id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_tax_auto_log_order_no ON tax_invoice_auto_issue_log(order_no);
CREATE INDEX IF NOT EXISTS idx_tax_auto_log_seller_id ON tax_invoice_auto_issue_log(seller_id);
CREATE INDEX IF NOT EXISTS idx_tax_auto_log_status ON tax_invoice_auto_issue_log(status);
CREATE INDEX IF NOT EXISTS idx_tax_auto_log_next_retry ON tax_invoice_auto_issue_log(next_retry_at);
