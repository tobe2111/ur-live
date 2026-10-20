-- 🛡️ 2026-04-28: MD 위탁 판매 (Consignment Partnerships)
--
-- 비즈니스 컨셉:
--   셀러 A(host) 가 셀러 B(owner) 의 상품을 자기 라이브에서 판매 → 매출의 N% 가 A에게.
--   B 의 입장: 새 청중 확보 + 판매 채널 다변화. A 의 입장: 상품 라인업 확장 + 수수료 수익.
--
-- 핵심 모델:
--   파트너십 = (host_seller, owner_seller, product) 트리플. owner 가 host 에게 권한 부여.
--   주문 시 order_items.consignment_id 로 해당 파트너십 식별.
--   정산 시 매출 X 원 → host 에게 host_commission_rate% 분배.

CREATE TABLE IF NOT EXISTS consignment_partnerships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  host_seller_id INTEGER NOT NULL,        -- 라이브 진행 셀러 (B 상품 판매)
  owner_seller_id INTEGER NOT NULL,       -- 상품 소유 셀러
  product_id INTEGER NOT NULL,            -- 위탁 대상 상품
  host_commission_rate REAL NOT NULL DEFAULT 10.0  -- host 수수료율 (%, 0~50)
    CHECK (host_commission_rate >= 0 AND host_commission_rate <= 50),
  status TEXT NOT NULL DEFAULT 'pending'  -- pending/active/paused/ended
    CHECK (status IN ('pending', 'active', 'paused', 'ended')),
  invited_by TEXT NOT NULL DEFAULT 'host' -- host(A 가 신청) / owner(B 가 신청)
    CHECK (invited_by IN ('host', 'owner')),
  message TEXT,                           -- 신청/응답 메시지
  approved_at DATETIME,                   -- owner 승인 시각
  ended_at DATETIME,                      -- 종료 시각
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_seller_id) REFERENCES sellers(id),
  FOREIGN KEY (owner_seller_id) REFERENCES sellers(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  -- 같은 (host, product) 파트너십은 1개만 active
  UNIQUE (host_seller_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_consignment_host ON consignment_partnerships(host_seller_id, status);
CREATE INDEX IF NOT EXISTS idx_consignment_owner ON consignment_partnerships(owner_seller_id, status);
CREATE INDEX IF NOT EXISTS idx_consignment_product ON consignment_partnerships(product_id);

-- order_items 에 consignment_id 추가 (해당 주문이 위탁판매를 통해 발생했는지)
-- 컬럼이 이미 존재하면 ALTER 가 실패하므로 try-catch 패턴은 코드에서 처리.
-- 여기서는 idempotent 보장을 위해 별도 마이그레이션 0118 패턴 따름.
ALTER TABLE order_items ADD COLUMN consignment_id INTEGER REFERENCES consignment_partnerships(id);

CREATE INDEX IF NOT EXISTS idx_order_items_consignment ON order_items(consignment_id);

-- 정산 분배 기록 (감사 + 분쟁 해결용)
CREATE TABLE IF NOT EXISTS consignment_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consignment_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  order_item_id INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,           -- 해당 order_item 총 매출 (원)
  host_amount INTEGER NOT NULL,            -- host 에게 분배된 금액
  owner_amount INTEGER NOT NULL,           -- owner 에게 분배된 금액
  platform_amount INTEGER NOT NULL,        -- 플랫폼 수수료
  rate_snapshot REAL NOT NULL,             -- 정산 시점 host 수수료율 (변동 대비)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (consignment_id) REFERENCES consignment_partnerships(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (order_item_id) REFERENCES order_items(id)
);

CREATE INDEX IF NOT EXISTS idx_consignment_settlements_consignment ON consignment_settlements(consignment_id);
CREATE INDEX IF NOT EXISTS idx_consignment_settlements_order ON consignment_settlements(order_id);
