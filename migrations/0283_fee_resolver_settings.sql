-- 0283_fee_resolver_settings.sql
-- 단일 수수료 리졸버(src/worker/utils/fee-resolver.ts)의 정책 요율 등록.
-- 대표 확정 정책 2026-06-25 (docs/design/product-ownership-model.md).
--
-- 전용 네임스페이스 `fee_*` — 기존 산재 키(commission_rate_default / agency_commission_pct 등)와
-- 충돌 없음. loadFeeRates() 가 이 키를 읽고, 미설정 시 DEFAULT_FEE_RATES 로 폴백(hardcode 금지).
-- INSERT OR IGNORE — 이미 어드민이 조정한 값은 덮어쓰지 않음(멱등).

INSERT OR IGNORE INTO platform_settings (key, value, description) VALUES
  ('fee_platform_pct_3p',    '5',  '3P(셀러) 플랫폼 수수료 % — 공구권+쇼핑 공통. 1P(유어딜 직판)은 항상 0(코드 강제).'),
  ('fee_agency_pct',         '1',  '에이전시 GMV % — 플랫폼 수수료에서 분배(가게 추가부담 0), ≤플랫폼 가드.'),
  ('fee_agency_term_months', '24', '에이전시 지속배분 시한(개월) — 가게 활성화 후 이 기간까지만 적립.');
