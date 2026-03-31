# 마이그레이션 가이드

## 스키마 기반
프로덕션 DB는 `0001_initial_schema.sql` (구 스키마) 기반 + 이후 마이그레이션으로 구성됩니다.

⚠️ `001_initial.sql` (신 스키마)은 프로덕션에 적용되지 않았습니다. 참조하지 마세요.

## 실제 프로덕션 스키마 정의
`src/shared/db/production-schema.ts` 파일이 Single Source of Truth입니다.

## 주요 마이그레이션 이력

| 파일 | 설명 |
|---|---|
| 0001_initial_schema.sql | 초기 스키마 (users, products, orders, cart_items) |
| 0003_add_admin_seller.sql | sellers, admins 테이블 |
| 0005_add_kakao_login_and_shipping.sql | 카카오 로그인, 배송 관련 컬럼 |
| 0007_add_settlements.sql | 정산 테이블 |
| 0010_admin_dashboard_backend.sql | 어드민 대시보드 관련 |
| 0024_add_version_and_indexes.sql | 성능 인덱스 대량 추가 |
| 0044_add_product_type.sql | 상품 타입 (product_type) |
| 0050_add_alimtalk_system.sql | 알림톡(브랜드메시지) 시스템 |
| 0060_add_settlement_system.sql | 정산 시스템 확장 |
| 0105_add_seller_youtube_oauth.sql | 셀러 YouTube OAuth |
| 0118_fix_order_schema_columns.sql | 주문 스키마 컬럼 수정 |
| 0120_add_supply_chain.sql | 공급망 테이블 |
| 0122_add_alimtalk_credits.sql | 브랜드메시지 크레딧 |
| 0124_add_donations.sql | 후원 시스템 |
| 0128_add_missing_production_columns.sql | 프로덕션 누락 컬럼 보완 |
| **0130_add_user_points_system.sql** | 팀 포인트 충전/후원 |
| **0131_add_performance_indexes.sql** | 성능 인덱스 7개 |
| **0132_add_product_reviews.sql** | 상품 리뷰/평점 |
| **0133_add_wishlist.sql** | 위시리스트 |
| **0134_add_seller_tiers.sql** | 셀러 등급 시스템 |

## 주의사항
- 마이그레이션 파일을 삭제/이동하지 마세요 (wrangler가 추적합니다)
- 새 마이그레이션은 0135부터 시작
- 테이블 자동 생성(ensureTable)이 있어 마이그레이션 없이도 동작하지만, 인덱스는 수동 적용 필요
