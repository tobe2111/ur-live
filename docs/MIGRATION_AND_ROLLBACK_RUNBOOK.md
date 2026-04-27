# 마이그레이션 적용 + 롤백 Runbook (X4 + X6)

> 작성: 2026-04-26
> 대상: 이번 세션에 추가된 0207~0222 마이그레이션
> 시간 예상: 적용 5분 / 롤백 10분

---

## 1. 적용 순서 (의존성 그래프)

```
0207 agency_creator_approvals       (독립)
0208 agency_auto_settle             → agencies, agency_settlements
0209 agency_campaigns               (독립)
0210 agency_incentive_engine        (독립)
0211 auction_winner_history         → live_auctions, auction_holds
0212 agency_tier                    → agencies
0213 agency_creator_evaluation      → agency_creator_approvals (0207)
0214 agency_message_templates       (독립)
0215 agency_monthly_tasks           → agencies
0216 coupons_agency_distribution    → coupons (이미 있음)
0217 agency_members                 → agencies
0218 agency_live_notes              → agencies, live_streams, agency_members (0217)
0219 settlement_invoices            → agencies, agency_settlements (0208)
0220 seller_platform_links          → sellers
0221 tiktok_videos_cache            → sellers
0222 ensure_agency_aux_tables       → agencies (보조 테이블들)
```

**권장 적용 순서**: 번호 순 (0207 → 0222). 각 마이그레이션이 멱등 (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE` 의 컬럼 중복 시 catch).

---

## 2. 적용 방법

### A. 권장 — D1 권한 있는 경우

```bash
# 한 번에 적용
for f in migrations/02{0,1,2}*.sql; do
  echo "=== $f ==="
  npx wrangler d1 execute toss-live-commerce-db --remote --file="$f" || echo "⚠️  $f 일부 실패 (멱등이므로 OK)"
done
```

### B. 응급 처치 — D1 권한 없는 경우 (TD-001 해결 전)

```bash
# 어드민 토큰 + IP 화이트리스트 필요
curl -X GET https://live.ur-team.com/api/_internal/repair-schema \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

`/api/_internal/repair-schema` 가 누락된 컬럼/테이블을 자동 추가.

### C. 단일 마이그레이션 적용

```bash
npx wrangler d1 execute toss-live-commerce-db --remote --file=migrations/0212_agency_tier.sql
```

---

## 3. 적용 검증

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://live.ur-team.com/api/health/migrations | jq '.summary'
```

**기대 응답:**
```json
{ "total": 18, "applied": 18, "missing": 0, "errors": 0 }
```

`missing > 0` 시 응답의 `missing` 배열에 누락된 컬럼/테이블 명시 → 해당 마이그레이션 재적용.

---

## 4. 신규 기능 활성화/비활성화 (X2 — Feature Flags)

이번 세션 신규 cron 7종은 모두 feature flag 로 보호됨. 문제 발생 시 즉시 OFF 가능.

### 단일 flag OFF
```bash
curl -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": false}' \
  https://live.ur-team.com/api/admin/flags/enable_agency_tier_eval
```

### 비상 모드 (모든 신규 기능 OFF)
```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enable": true}' \
  https://live.ur-team.com/api/admin/flags/emergency-mode
```

→ 30초 캐시 후 자동 적용.

### 보호되는 cron 목록
| Flag | Cron | 영향 |
|---|---|---|
| `enable_agency_tier_eval` | 월 1주차 | OFF 시 등급 평가 안 됨 (수동 변경만 가능) |
| `enable_agency_creator_eval` | 매일 | OFF 시 신규 신청 자동 평가 X |
| `enable_agency_monthly_tasks` | 매일 | OFF 시 의무 작업 진행률 갱신 X |
| `enable_agency_auto_settle` | 월 1주차 | OFF 시 자동 정산 X (수동만) |
| `enable_agency_monthly_invoices` | 월 1주차 | OFF 시 송장 자동 발행 X |
| `enable_tiktok_videos_sync` | 매일 | OFF 시 TikTok 비디오 sync X |
| `enable_agency_campaigns_aggregate` | 매일 | OFF 시 캠페인 누적 매출 갱신 X |

**핵심 결제/주문/인증** 흐름은 flag 보호 대상 아님 (always-on).

---

## 5. 롤백 시나리오

### 5.1 신규 기능 즉시 차단 (코드 배포 안 변경)

가장 빠른 복구 — **30초 안에 적용**.

```bash
# 비상 모드 ON
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enable": true}' \
  https://live.ur-team.com/api/admin/flags/emergency-mode
```

### 5.2 코드 롤백 (이전 main 으로)

```bash
# 1. 이전 main 시점 commit 으로 force-revert (권장)
git checkout main
git revert --no-commit 235da5f..HEAD  # 이번 세션 모든 commit 되돌리기
git commit -m "ROLLBACK: revert 2026-04-26 session commits"
git push origin main

# 2. 또는 Cloudflare Pages 에서 이전 deployment 활성화
# Dashboard → Workers & Pages → ur-live → Deployments → 이전 deployment → "Roll back to this deployment"
```

→ 코드 롤백 후에도 마이그레이션은 그대로 (DROP COLUMN 안 함). 새로 추가된 테이블은 **빈 채로 남음** (영향 없음).

### 5.3 마이그레이션 자체 롤백 (위험)

⚠️ **권장 안 함**. 신규 테이블 DROP 은 데이터 손실. 다음 경우만:

```sql
-- 정말 필요할 때만 — 실행 전 백업 필수
DROP TABLE IF EXISTS tiktok_videos_cache;       -- 0221
DROP TABLE IF EXISTS seller_platform_links;     -- 0220
DROP TABLE IF EXISTS agency_settlement_invoices; -- 0219
DROP TABLE IF EXISTS agency_live_notes;         -- 0218
DROP TABLE IF EXISTS agency_members;            -- 0217
DROP TABLE IF EXISTS agency_coupon_distributions; -- 0216 (parent_coupon_id 외래키 주의)
DROP TABLE IF EXISTS agency_monthly_tasks;      -- 0215
DROP TABLE IF EXISTS agency_message_sends;      -- 0214
DROP TABLE IF EXISTS agency_message_templates;  -- 0214
DROP TABLE IF EXISTS agency_incentive_payouts;  -- 0210
DROP TABLE IF EXISTS agency_incentive_rules;    -- 0210
DROP TABLE IF EXISTS agency_campaign_participants; -- 0209
DROP TABLE IF EXISTS agency_campaigns;          -- 0209
DROP TABLE IF EXISTS auction_winner_history;    -- 0211
DROP TABLE IF EXISTS agency_creator_approvals;  -- 0207
-- 컬럼 ALTER ... DROP COLUMN — SQLite 는 직접 지원 X (테이블 재생성 필요)
```

---

## 6. 사고 시나리오별 대응

| 증상 | 진단 | 조치 |
|---|---|---|
| **모든 사용자 401** | JWT_SECRET 변경되면서 기존 토큰 무효 | 정상 — 사용자 재로그인 안내 |
| **에이전시 로그인 500** | 마이그레이션 0217 미적용 | `repair-schema` 호출 또는 0217 적용 |
| **cron 매일 18UTC 후 에러 spike** | 신규 cron 중 하나 문제 | 비상 모드 ON 또는 단일 flag OFF |
| **TikTok 비디오 sync 실패** | TIKTOK_CLIENT_KEY 미설정 | 정상 (graceful skip) — 없어도 다른 기능 영향 X |
| **cron 실행 자체 안 됨** | wrangler.toml triggers 누락 | `crons` 배열 확인 + 재배포 |
| **/api/health/migrations 500** | 0212 (tier) 미적용 시 column 에러 | 0212 적용 |

---

## 7. 사고 후 점검 체크리스트

```
☐ /api/health/migrations → all_applied: true 확인
☐ /api/agency/stats/kpi → 6 필드 모두 숫자 응답
☐ /api/admin/metrics/webhook-failures → 정상 응답
☐ Sentry 에서 'JWT_SECRET is not configured' 0건
☐ Cloudflare Logs 에서 5xx 비율 < 1%
☐ /api/agency/members → 본인 owner row 1개 표시
☐ 결제 flow smoke test (별도 사용자 계정으로)
☐ 셀러 가입 flow smoke test
```

---

## 8. 추가 참고

- **마이그레이션 파일**: `migrations/0207*.sql ~ 0222*.sql`
- **Feature flags 코드**: `src/worker/utils/feature-flags.ts`
- **검증 도구**: `node scripts/verify-schema.mjs`
- **검증 보고서**: `docs/W3_VERIFICATION_REPORT.md`
- **시크릿 rotation**: `docs/SECRET_ROTATION_RUNBOOK.md`
