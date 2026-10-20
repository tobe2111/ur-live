# 2026-09-02 — 유어딜 요청 경로 D1 읽기 다이어트 (PR-C)

> 감사표·계획: `docs/handoff/2026-09-02-d1-read-diet.md`(PR #1299) · cron 수리: `2026-09-02-urdeal-d1-diet.md`(PR #1300).

| 감사 § | 수리 | 롤백 |
|---|---|---|
| 2-2 #4 | `/sitemap.xml` `publicCache(3600)` — 마운트는 `worker/index.ts`(라우트 모듈에 걸면 `sitemap-mall-scope.test` 가 `caches.default` 없이 깨진다) | 미들웨어 1줄 |
| 2-2 #1 | 봇 OG 셀러 조회 `slug=? OR username=?` → `username=?` 하나 (`worker/index.ts`, [UNLOCK_LOADING]). 🩸 **`sellers.slug` 는 없는 컬럼** — 종전 문장은 늘 예외→catch→기본 OG 였다(크롤러가 셀러 카드 대신 홈 카드를 받아 옴). pre-commit `check-schema-refs` 가 잡았다 | OR 환원 |
| 2-2 #13 | `/api/group-buy/products/*` TTL 30→120 (`worker/index.ts`) | 30 |
| 2-2 #8 | `/api/flash-deals` PRAGMA D1 당 1회 메모(WeakMap) + `publicCache(300)` | — |
| 2-2 #2 | `AdminHealthPage` 폴링 10s→60s | — |
| 2-2 #3 | 부분 인덱스 `products(price / created_at) WHERE deal_only=1 AND is_active=1` | DROP INDEX |

**틀렸던 판단**: 감사가 "`sellers WHERE slug=? OR username=?` 전수 스캔" 이라 했고 나도 그대로 믿고 `idx_sellers_slug` 까지 넣었다. 컬럼이 없었다. **인덱스는 붙이기 전에 컬럼부터 확인**(가드가 잡아 줬지만 사람이 먼저 봤어야 했다).

**안 한 것(이유)**: 봇 OG 블록 **제거**(크롤러가 받는 HTML 이 바뀌어 SEO 회귀 위험 — 쿼리만 싸게) · `/api/mall/*` 캐시(운영자 미리보기 분기 여부 미확인) ·
`edge-cache` `Cookie.includes('session')` 완화(소유자 판정이 핸들러에 있어 미들웨어에서 못 가른다) · `ProductRepository` NOT EXISTS→LEFT JOIN
(SELECT 목록·ORDER BY 가 비한정 컬럼이라 sellers 와 모호 — 부분 인덱스로 대신) · 섹션 ROW_NUMBER·홈 카테고리 materialized·검색 자동완성 FTS(별도).

**판정**: 배포 후 `D1_PROFILE_ENABLED='true'`(대표 env) → `GET /api/admin/d1-profile` 로 SQL 패턴별 rows_read.
