/**
 * 📉 **읽기 증폭 인덱스** — 본진 D1 의 "인덱스가 없어서 매번 전수 스캔하는" 항목만 모은다
 * (`repair-schema.routes.ts` 에서 추출 — 2026-08-27).
 *
 * ## 왜 따로 모으나
 * D1 무료 한도는 저장 용량이 아니라 **읽은 행 수**로 매겨진다. 그래서 "인덱스가 없다"는
 * 성능 얘기가 아니라 **한도 얘기**다 — 그리고 그 사실은 조회가 느려질 뿐 **에러가 안 나서**
 * 아무도 모른다. 이 파일은 그 근거(실측 행 수)를 인덱스 옆에 붙여 두는 자리다.
 *
 * ⚠️ 여기 있는 것은 전부 **`CREATE INDEX IF NOT EXISTS`** 다 — 데이터를 바꾸지 않고,
 *   여러 번 돌아도 안전하며, 되돌리려면 `DROP INDEX` 한 줄이다.
 * ⚠️ 새 인덱스를 넣기 전에 **실측부터** 할 것: 라이브에서 그 쿼리를 돌려 `meta.rows_read` 를 본다.
 *   `EXPLAIN QUERY PLAN` 은 계획만 보여 주고 `rows_read` 는 0 으로 나온다(실행을 안 한다).
 */

export const INDEX_REPAIRS: Array<{ name: string; sql: string }> = [
  // ⭐ **리뷰 조회 인덱스** (2026-08-27 라이브 실측). `product_reviews` 는 본진에서 가장 큰
  //   테이블(119,292행, 다음이 3,790)인데 **인덱스가 하나도 없었다** — `EXPLAIN` 이 `SCAN product_reviews`.
  //   실측: 상품 하나의 리뷰 8건을 얻는 데 `rows_read=119,292 · 17.6ms`. 평점 집계 1건도 같다.
  //   본진 D1 읽기 7,790만 행/일 ÷ 119,292 = **하루 653회 전수 스캔**에 해당한다.
  //   지배적 쿼리 형태가 `WHERE product_id = ? AND is_visible = 1 ORDER BY created_at DESC` 라
  //   그대로 담는다 — 정렬까지 인덱스가 받아 임시 B-트리도 사라진다.
  { name: 'idx_product_reviews_product', sql: `CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id, is_visible, created_at DESC)` },
  // 📉 **요청 경로 2건** (2026-09-02 정적 감사 §2-2 — `docs/handoff/2026-09-02-d1-read-diet.md`).
  //   · products(price) WHERE deal_only=1 AND is_active=1 — `/vouchers` SSR 시드·5분 예열이 치는 `deal_only=1 ORDER BY price LIMIT 21`.
  //     부분 인덱스면 가격순으로 걷다 21건에서 멈춘다(전수 정렬 → 수십 행). created_at DESC 는 기본 정렬(newest) 짝.
  //   ⚠️ 실측 전 추가(D1 이 죽어 있어 rows_read 를 못 쟀다) — products 는 ~3천 행·쓰기 드묾이라 인덱스 비용은 무시할 수준.
  //     효과 판정은 배포 후 `D1_PROFILE_ENABLED` 로.
  { name: 'idx_products_deal_price', sql: `CREATE INDEX IF NOT EXISTS idx_products_deal_price ON products(price) WHERE deal_only = 1 AND is_active = 1` },
  { name: 'idx_products_deal_created', sql: `CREATE INDEX IF NOT EXISTS idx_products_deal_created ON products(created_at DESC) WHERE deal_only = 1 AND is_active = 1` },
  // 📨 **알림톡 재시도 큐** (2026-09-02 정적 감사). `alimtalk_failures` 는 인덱스가 하나도 없는데 5분 cron 이
  //   `resolved=0 AND next_retry_at<=now` 를 288회/일 묻는다. 형제 큐(email/push_failures)는 같은 모양의
  //   `(resolved, next_retry_at)` 를 이미 갖고 있다 — 빠진 쪽만 맞춘다.
  { name: 'idx_alimtalk_failures_retry', sql: `CREATE INDEX IF NOT EXISTS idx_alimtalk_failures_retry ON alimtalk_failures(resolved, next_retry_at)` },
]
