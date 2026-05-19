-- 🛡️ 2026-05-19: KT Alpha MMS 카드 ID + 배너 ID 설정.
--
--   sendCoupon (0204) 호출 시 brand-specific 카드/배너를 MMS 에 포함:
--     - template_id: 카드 ID (KT Alpha 콘솔에서 사전 등록한 카드 디자인)
--     - banner_id: 배너 ID (브랜드 배너 이미지)
--
--   미설정 시 KT Alpha 기본 카드/배너 사용 (브랜딩 없음).

INSERT OR IGNORE INTO platform_settings (key, value, description) VALUES
  ('kt_alpha_template_id', '', 'KT Alpha MMS 카드 ID (sendCoupon template_id) — KT Alpha 콘솔에서 발급'),
  ('kt_alpha_banner_id', '', 'KT Alpha MMS 배너 ID (sendCoupon banner_id) — KT Alpha 콘솔에서 발급');
