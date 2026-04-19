-- 셀러 전환 기능: linked_user_id + seller_type 컬럼 추가
-- 유저가 마이페이지에서 같은 카카오 계정으로 셀러 전환 가능

-- linked_user_id: users.id와 연결 (1:1)
ALTER TABLE sellers ADD COLUMN linked_user_id INTEGER;

-- seller_type: influencer / store_owner / both
-- (이미 존재할 수 있으므로 실패 시 무시)
-- ALTER TABLE sellers ADD COLUMN seller_type TEXT DEFAULT 'influencer';

-- UNIQUE 인덱스: 유저 1명당 셀러 계정 1개만 허용
CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_linked_user_id
  ON sellers(linked_user_id) WHERE linked_user_id IS NOT NULL;

-- 조회 성능용 인덱스
CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(status);
