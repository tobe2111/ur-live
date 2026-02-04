-- 전자세금계산서 테이블 추가
-- 인플루언서 사업자 정보
CREATE TABLE IF NOT EXISTS seller_business_info (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  business_number TEXT UNIQUE NOT NULL, -- 사업자등록번호
  business_name TEXT NOT NULL, -- 상호명
  ceo_name TEXT NOT NULL, -- 대표자명
  business_type TEXT, -- 업태
  business_category TEXT, -- 업종
  postal_code TEXT, -- 우편번호
  address TEXT, -- 사업장 주소
  phone TEXT, -- 전화번호
  email TEXT, -- 이메일
  
  -- 바로빌/팝빌 연동 정보
  tax_api_id TEXT, -- 전자세금계산서 API 아이디
  tax_api_key TEXT, -- API 키
  
  is_verified BOOLEAN DEFAULT 0, -- 사업자 인증 여부
  verified_at DATETIME,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

-- 전자세금계산서 발행 내역
CREATE TABLE IF NOT EXISTS tax_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- 연관 정보
  seller_id INTEGER NOT NULL,
  order_no TEXT NOT NULL,
  settlement_id INTEGER, -- 정산서 연결
  
  -- 발행 정보
  invoice_type TEXT NOT NULL CHECK(invoice_type IN ('tax', 'credit_note')), -- 세금계산서, 수정세금계산서
  invoice_number TEXT UNIQUE, -- 승인번호
  issue_date DATE NOT NULL, -- 작성일자
  
  -- 공급자 정보 (인플루언서)
  supplier_business_number TEXT NOT NULL,
  supplier_business_name TEXT NOT NULL,
  supplier_ceo_name TEXT NOT NULL,
  supplier_address TEXT,
  supplier_business_type TEXT,
  supplier_business_category TEXT,
  
  -- 공급받는자 정보 (고객)
  buyer_business_number TEXT, -- 사업자번호 (개인은 NULL)
  buyer_name TEXT NOT NULL, -- 상호/성명
  buyer_ceo_name TEXT, -- 대표자명
  buyer_address TEXT,
  buyer_email TEXT,
  
  -- 금액 정보
  supply_price INTEGER NOT NULL, -- 공급가액
  tax_amount INTEGER NOT NULL, -- 세액 (10%)
  total_amount INTEGER NOT NULL, -- 합계
  
  -- 발행 상태
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'issued', 'sent', 'failed', 'cancelled')),
  
  -- 외부 API 정보
  api_provider TEXT, -- barobill, popbill 등
  api_invoice_id TEXT, -- API 서비스의 세금계산서 ID
  api_response TEXT, -- API 응답 (JSON)
  
  -- 국세청 전송
  nts_sent_at DATETIME, -- 국세청 전송일시
  nts_confirm_number TEXT, -- 국세청 승인번호
  
  error_message TEXT, -- 발행 실패시 에러 메시지
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (seller_id) REFERENCES sellers(id),
  FOREIGN KEY (order_no) REFERENCES orders(order_no),
  FOREIGN KEY (settlement_id) REFERENCES settlements(id)
);

-- 세금계산서 품목 (여러 상품이 한 세금계산서에 포함)
CREATE TABLE IF NOT EXISTS tax_invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tax_invoice_id INTEGER NOT NULL,
  
  order_item_id INTEGER, -- 주문 상품 ID
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL, -- 단가
  supply_price INTEGER NOT NULL, -- 공급가액
  tax_amount INTEGER NOT NULL, -- 세액
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tax_invoice_id) REFERENCES tax_invoices(id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_seller_business_info_seller_id ON seller_business_info(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_business_info_business_number ON seller_business_info(business_number);

CREATE INDEX IF NOT EXISTS idx_tax_invoices_seller_id ON tax_invoices(seller_id);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_order_no ON tax_invoices(order_no);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_settlement_id ON tax_invoices(settlement_id);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_issue_date ON tax_invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_status ON tax_invoices(status);

CREATE INDEX IF NOT EXISTS idx_tax_invoice_items_tax_invoice_id ON tax_invoice_items(tax_invoice_id);

-- 시드 데이터 (테스트용)
INSERT INTO seller_business_info (seller_id, business_number, business_name, ceo_name, business_type, business_category, address, phone, email, is_verified, verified_at)
VALUES 
  (1, '123-45-67890', '토스 패션몰', '김판매', '도매 및 소매업', '의류 소매업', '서울시 강남구 테헤란로 123', '02-1234-5678', 'seller1@example.com', 1, CURRENT_TIMESTAMP);
