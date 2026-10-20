-- ============================================================
-- Migration 0230: 캐스팅 마켓플레이스 (광고주 ↔ 셀러)
-- ============================================================
-- 컨셉: 외부 광고주(브랜드/제조사) 가 셀러에게 광고 캠페인 캐스팅 신청.
--   - 광고주 = 어드민이 별도 등록 또는 셀프 가입 (어드민 승인)
--   - 캐스팅 신청서 → 셀러 수락/거절 → 거래 성사 시 수수료
--
-- 정책: 어드민 검토 후 게재. 결제는 별도 (수동 송금 또는 PG 통합 추후).
--
-- 작성: 2026-04-27 (Phase 3-6)
-- ============================================================

CREATE TABLE IF NOT EXISTS advertisers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  contact_name TEXT,
  phone TEXT,
  business_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS casting_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  advertiser_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  campaign_title TEXT NOT NULL,
  campaign_brief TEXT,
  product_category TEXT,                                -- 카테고리 매칭용
  proposed_fee INTEGER NOT NULL,                        -- 제안 비용 (원)
  expected_revenue INTEGER,                             -- 예상 매출 (선택)
  proposed_live_date DATE,                              -- 제안 라이브 일자
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'admin_review', 'sent_to_seller', 'accepted', 'rejected', 'completed', 'cancelled')),
  admin_review_at DATETIME,
  seller_response_at DATETIME,
  seller_response TEXT,                                 -- 'accept' | 'reject'
  rejection_reason TEXT,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_casting_seller ON casting_requests(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_casting_advertiser ON casting_requests(advertiser_id, status);
