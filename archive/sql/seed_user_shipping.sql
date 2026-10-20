-- 테스트용 사용자 및 배송지
INSERT OR IGNORE INTO users (id, name, email, phone, created_at)
VALUES (1, '테스트 구매자', 'buyer@example.com', '010-1234-5678', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at)
VALUES (1, '테스트 구매자', '010-1234-5678', '06236', '서울시 강남구 테헤란로 123', '10층', 1, CURRENT_TIMESTAMP);
