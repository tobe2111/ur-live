-- 플랫폼 전역 설정 테이블
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 기본 수수료율 설정
INSERT OR IGNORE INTO platform_settings (key, value, description) VALUES ('commission_rate_default', '15', '일반 상품/후원 수수료율 (%)');
INSERT OR IGNORE INTO platform_settings (key, value, description) VALUES ('commission_rate_meal_voucher', '5', '식사권 공동구매 수수료율 (%)');
