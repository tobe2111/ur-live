-- 🛡️ 2026-05-19: KT Alpha 마진 (markup) 정책 + 비즈머니 모니터링.
--
--   KT Alpha 가 우리에게 주는 회원등급할인:
--     - 일반상품: 6% (정가 1만원 → 우리 결제 9,400원)
--     - 상품권: 1%
--   현재 마진 매우 작음 → 셀러에게 markup % 추가 부과 (어드민이 동적 조정).
--
--   예시 (markup_pct = 5):
--     - voucher 정가: 10,000원
--     - KT Alpha 실 결제: 9,400원 (6% 할인)
--     - 셀러 적립금 차감: 9,400 × 1.05 = 9,870원
--     - 우리 마진: 470원 (4.7% 순마진)
--
--   markup_pct 는 어드민이 /admin/kt-alpha 페이지에서 조정.

-- markup 정책.
INSERT OR IGNORE INTO platform_settings (key, value, description) VALUES
  ('kt_alpha_markup_pct', '5', 'KT Alpha voucher 발송 시 셀러 차감액 markup % (정가 위가 아닌 공급가 위)'),
  ('kt_alpha_user_id', '', 'KT Alpha 회원 ID — 사업자 계정 ID (0204/0301 API 호출 필수)'),
  ('kt_alpha_callback_no', '', 'KT Alpha MMS 발신번호 (기본 발송)'),
  ('kt_alpha_biz_money_balance', '0', 'KT Alpha 비즈머니 잔액 (최근 0301 호출 결과)'),
  ('kt_alpha_biz_money_check_at', '', '비즈머니 잔액 마지막 조회 시각');
