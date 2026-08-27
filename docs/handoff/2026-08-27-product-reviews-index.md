# 2026-08-27 — 본진 최대 테이블에 인덱스가 없었다 (`product_reviews`)

`#1222` 로 유어애즈 두 DB(1.63억 + 3.78억)를 고친 뒤, 대표 *"그럼 무료로 여유롭게 가능한거야?"* 에
**"아니오"** 라고 답하며 짚은 남은 항목 — 본진 7,790만/일 — 을 판 결과.

## 실측

```
본진 테이블 314개 중 크기 순:
   product_reviews    119,292   ← 압도적 1위
   product_supply_meta  3,790
   products             2,668
   ...
product_reviews 인덱스: 0개        EXPLAIN → SCAN product_reviews
리뷰 8건 조회  → rows_read 119,292 · 17.6ms
평점 집계 1건  → rows_read 119,292 · 21.4ms
본진 7,790만/일 ÷ 119,292 = 하루 653회 전수 스캔
```

⚠️ **본진은 데이터가 작다**(orders 88 · users 17 · sellers 11). 그런데 읽기는 7,790만이었다 —
**크기가 아니라 인덱스 부재**가 원인이라는 신호였고, 그래서 "가장 큰 테이블"을 먼저 찾는 방법이 통했다.

## 수리

`repair-schema.routes.ts` 에 `idx_product_reviews_product (product_id, is_visible, created_at DESC)`.
지배적 쿼리 형태(`WHERE product_id = ? AND is_visible = 1 ORDER BY created_at DESC`)를 그대로 담아
탐색과 정렬을 한 인덱스가 받는다.

## 다음 세션의 첫 액션 — 배포 후 판정

⚠️ **인덱스는 `repair-schema` 가 돌아야 생성된다**(즉시 아님). 그 뒤에 재측정.

```
Cloudflare GraphQL: d1AnalyticsAdaptiveGroups → rowsRead (databaseId 별)
  기준선(08-27)  urads-leads 377,997,696 · urads-company 163,050,837 · 본진 77,882,273 = 618,931,025/일
  기대           urads-leads 수천만 이하  · urads-company 약 2만      · 본진 수백만 이하
```
그리고 라이브에서 직접:
```sql
EXPLAIN QUERY PLAN SELECT AVG(rating) FROM product_reviews WHERE product_id = 2846;
  → SEARCH ... USING INDEX idx_product_reviews_product  (지금은 SCAN)
```

## 이번에 배운 방법 (재사용 가치 있음)

읽기 낭비를 찾는 절차가 확립됐다 — **추측하지 말고 라이브에 던져 본다**(전부 읽기 전용):
1. `d1AnalyticsAdaptiveGroups` 로 DB별 `rowsRead`/`readQueries` → **쿼리당 평균 행**을 낸다.
2. 그 값이 크면 큰 테이블을 찾는다(`sqlite_master` → 배치 COUNT). ⚠️ **D1 은 compound SELECT 항 수가
   매우 빡빡하다 — UNION ALL 은 4개까지**(5개부터 `too many terms`). 10개로 묶었다가 52배치가 통째로 실패했다.
3. 그 테이블의 인덱스를 보고, **실제 쿼리를 던져 `meta.rows_read` 를 읽는다**. `EXPLAIN QUERY PLAN` 은
   실행을 안 해서 `rows_read=0` 이라 비용을 못 보여준다 — **둘 다 필요하다**(계획은 SCAN 여부, 실행은 비용).

## 남은 것

- **무료 한도의 124배인데 왜 안 멎는지** 여전히 미해결. 대시보드 D1 사용량 화면이 필요하다(내 토큰은 요금제를 못 읽는다).
  ① 한도가 다르다 ② 실은 유료다 ③ **이미 조용히 제한 중이다** — ③이면 수집량이 원래보다 적다는 뜻이고
  이번 수정들의 효과도 그만큼 가려진다.
- 세 수정이 다 먹은 뒤 남는 읽기가 있으면 위 절차를 그대로 반복하면 된다.
