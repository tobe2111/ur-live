# 2026-11-18 alias 없는 SELECT 의 없는 칸 — 42건 발견 · 사람 쓰는 기능 10곳 수리

대표 *"남은 과제도 다 해주고 개선할 것들 더 찾아줘"*. 라이브 텔레메트리 조사(5xx 1위 `GET /api/seller/public/:id`)에서 출발.

## 무엇이 고장이었나 (전부 라이브 D1 `EXPLAIN` 으로 `no such column` 확인)
| 곳 | 없는 칸 → 라이브 칸 | 사람에게 보인 것 |
|---|---|---|
| `worker/utils/order-refund.ts` `refundOrderFully` | `orders.amount` → 삭제 | **전액 환불이 매번 실패**(손님·어드민·셀러) — 라이브 주문에 REFUNDED 0건. 대표 승인 "고침" · S-REFUNDCOL |
| `seller-management.routes.ts` ×2 | `kakao_chat_link` → `kakao_chat_url AS …` | 셀러 공개 API 언제나 500 |
| `auth.routes.ts` ×2 | `users.avatar_url` → `profile_image AS …` | 전화번호 입력창: 저장은 되고 응답 500 |
| `products.routes.ts` 옵션 | `stock_quantity` → `stock AS …` | 상품 옵션 늘 빈 목록 |
| `group-buy.routes.ts` 영수증 | `users.display_name` → `name AS …` | 공구 영수증 메일 0통 |
| `experience-campaign.routes.ts` | `voucher_validity_days` → `NULL AS …` | 조회 전체 null(셀러 id 까지) |
| `faq-bot.routes.ts` | `title/content` → `section_title/content_md` | FAQ 봇이 DB 를 못 읽음 |
| admin 유저 쿠폰 · 후원 자기차단 · 후원 정산 정렬 | 각 라이브 칸 | 어드민 화면 빈칸 등 |

## 가드
`check-sql-column-exists.mjs` 에 `scanSelectBare`(alias 없는 단일 표 SELECT, 라이브 사진 표만, 목록에 괄호·점·따옴표 있으면 건너뜀) 추가.
남은 17건은 `live-columns-baseline.json` 에 동결 — tiktok·sse-realtime(라이브커머스 중단)·wholesale(철거)·`deleted_accounts`(0행, 복구 규칙이 제품 결정)·`seller-tier-limits`(고치면 셀러 월 한도가 실제로 걸리기 시작 — 결정 필요)·`webhook.routes.ts` 추천 회수(잠금 파일 · **고치면 안 된다**: `refundOrderFully` 가 `beneficiary_id` 로 이미 회수하므로 살리면 이중 차감).
시험 `bare-select-columns-2026-11-18.test.ts` · 주입 2건(`bareselect`).

## 틀렸던 판단
- 처음엔 5xx 1건짜리 버그로 봤다. 같은 모양을 전수로 찾자 환불 전체가 죽어 있었다 — **하나를 고치면 같은 클래스를 전수로 볼 것.**

## 이어서 (같은 날, 텔레메트리 조사 후속) — 머지 #2417 = `c4ab9ec`
- 교환권 사진 옮기기: 연속 3회 0장이면 24시간 쉰다(`voucher_rehost_lane`). 판정: 하트비트가 `paused=LANE_BLOCKED` 로 바뀌는지.
- 쿼리 플래너 통계: 매일 청소 28번 `PRAGMA optimize=0x10002`(거절 시 ANALYZE). 판정: 배포 다음 날 메인 D1 `SELECT tbl, idx, stat FROM sqlite_stat1 WHERE tbl='products'` 의 첫 숫자가 2,000 이상 · 결과 `stats_refresh` 값(1=optimize, 2=ANALYZE, -1=둘 다 거절).
- 리뷰 이름 백필 부분 색인 `idx_product_reviews_name_missing`. 판정: sqlite_master 에 생겼는지.
- 남은 것: `/api/home/bundle` 예열 제거(쓰는 화면 0 · 로딩 잠금 → 대표 승인 필요) · KT 충전 잔액 7,680원(운영) · `seller-tier-limits` 등급 조회 고장(고치면 월 한도가 걸리기 시작 — 결정 필요) · 원격에 남은 실수 브랜치 `fix-seller-public-500`(삭제 403).
