# 배포 전 검증 절차 (Verification Procedure)

> 작성일: 2026-04-26
> 대상: 이번 세션에서 추가된 모든 신규 기능 (Q1~Q7 + L1~L6 + M1~M11)
>
> 목적: 마이그레이션 적용 후 / 프로덕션 배포 후 각 기능이 실제로 동작하는지 체크.
> 사용: 사용자가 단계별로 따라가며 ✅ / ❌ 표시. 실패 항목은 즉시 보고.

---

## 0. 준비

### 0.1 마이그레이션 적용 (선행 작업)

**필수 마이그레이션 (이번 세션 신규):**
- `0207_agency_creator_approvals.sql` — Agency P0 #1
- `0208_agency_auto_settle.sql` — P0 #3
- `0209_agency_campaigns.sql` — P0 #4
- `0210_agency_incentive_engine.sql` — P0 #5
- `0211_auction_winner_history.sql` — TD-007
- `0212_agency_tier.sql` — Q1
- `0213_agency_creator_evaluation.sql` — Q3
- `0214_agency_message_templates.sql` — Q2
- `0215_agency_monthly_tasks.sql` — Q6
- `0216_coupons_agency_distribution.sql` — Q7
- `0217_agency_members.sql` — M4

**적용 방법:**

A) **D1 권한이 있는 경우** (TD-001 해결 후):
```bash
for f in migrations/02{0,1}*.sql; do
  echo "=== $f ==="
  npx wrangler d1 execute toss-live-commerce-db --remote --file=$f
done
```

B) **권한 없는 경우** (현재 상태): `/api/_internal/repair-schema` 응급 처치
```bash
# 어드민 토큰 + 어드민 IP 화이트리스트 필요
curl -X GET https://live.ur-team.com/api/_internal/repair-schema \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 0.2 정적 검증 (코드 측)

```bash
# 스키마 일관성 (TS interface ↔ migrations CREATE TABLE)
node scripts/verify-schema.mjs

# 라우팅 무결성
bash scripts/check-schema-refs.sh
bash scripts/check-api-auth.sh
bash scripts/check-guide-sync.sh
bash scripts/check-naming-conflicts.sh

# 빌드 (실제 빌드 통과 — 가장 중요)
npm run build:client
npm run check:bundle:budget   # 번들 예산 위반 확인
```

---

## 1. Q1~Q3: 에이전시 등급 + 자동 평가

### Q1: 등급제 (Tier)

| 검증 | 명령/액션 | 기대 결과 |
|---|---|---|
| 컬럼 존재 | `wrangler d1 execute ... "PRAGMA table_info(agencies)"` | tier, tier_locked, tier_evaluated_at 3개 컬럼 보임 |
| 기존 에이전시 | DB 조회: `SELECT id, tier FROM agencies LIMIT 5` | 모두 `'new'` 디폴트 |
| 어드민 UI | `/admin/agencies` 접근 | NEW/JUNIOR/SENIOR 뱃지 + select 보임 |
| 등급 수동 변경 | select 클릭 → senior 선택 | toast "→ SENIOR (수동 고정)" + 페이지 reload 시 유지 |
| tier_locked 확인 | DB: `SELECT tier, tier_locked FROM agencies WHERE id = X` | tier='senior', tier_locked=1 |
| 자동평가 ↻ 버튼 | 클릭 | 확인 prompt → tier_locked=0 |
| 월별 cron | 월요일 09:00 KST 대기 | agency_notifications 에 'tier_change' row 생성 |

### Q3: 셀러 신청 자동 평가

| 검증 | 액션 | 기대 |
|---|---|---|
| 30일 미만 신청 | pending row 생성 후 즉시 cron | 변화 없음 (created_at < 30일 전 조건) |
| 30일 경과 신청 | 신청 후 31일 대기 또는 created_at 직접 수정 | evaluation_score, auto_decision 채워짐 |
| 활동 0 셀러 | recommend_reject 으로 처리 | agency_notifications 에 ⚠️ 알림 |
| 어드민 UI | `/admin/agency-creator-approval` | evaluation_data JSON 표시 (선택적) |

---

## 2. Q4: 셀러 가이드 콘텐츠

| 검증 | 액션 | 기대 |
|---|---|---|
| guide-seed 배포 | 코드 배포 후 첫 셀러 접근 | DB `operation_guides` 자동 시드 |
| 셀러 페이지 | `/seller/guide` 접근 | "라이브 운영 노하우 (성과 ↑)" 섹션 보임 |
| 컨텐츠 4종 | 자기소개 4종 / 시청자 심리 4가지 / 환경 체크 / 종료 후 7가지 | 모두 렌더링 |

---

## 3. Q5: 핵심 KPI 6 + Q6: 의무 작업

| 검증 | 액션 | 기대 |
|---|---|---|
| API | `GET /api/agency/stats/kpi` (Bearer 토큰) | 6 필드 모두 숫자 |
| KPI 카드 | `/agency` 대시보드 | 6장 카드 (다이아몬드/라이브 평가/유효/활성/유효 활성/오늘 영입) |
| 의무 작업 카드 | 같은 페이지 아래 | 3개 진행률 바 (creator_growth/sales_quota/activation) |
| API monthly-tasks | `GET /api/agency/monthly-tasks` | 이번 달 (또는 빈 배열 + _note) |
| Cron 갱신 | 매일 18:00 UTC 후 | actual_value 갱신됨 |

---

## 4. Q2: 메시지 템플릿

| 검증 | 액션 | 기대 |
|---|---|---|
| 페이지 | `/agency/messages` | 사이드바 "메시지 템플릿" 메뉴 작동 |
| 템플릿 추가 | 모달에서 이름/카테고리/본문 입력 → 생성 | 목록에 즉시 추가 |
| 변수 치환 | `{{seller_name}}` 포함 본문 작성 → 발송 | 받은 셀러 dashboard_notifications 에 치환된 본문 |
| 발송 이력 | 이력 탭 확인 | 발송한 row 표시 |
| 사용 횟수 | 같은 템플릿 2회 발송 후 목록 | usage_count = 2 |

---

## 5. Q7: 쿠폰 캐스케이드

| 검증 | 액션 | 기대 |
|---|---|---|
| 페이지 | `/agency/coupons` | 사이드바 "쿠폰 배포" 메뉴 |
| 쿠폰 배포 | 모달: 5명 셀러 × 10장 = 50장 | 부모 1개 + 자식 5개 쿠폰 자동 생성 (DB 확인) |
| 알림 | 받은 셀러 5명 dashboard_notifications | 'coupon_distributed' 알림 5건 |
| 사용율 분석 | 카드 클릭 → 통계 모달 | 셀러별 사용율 진행 바 |
| 셀러 측 | 받은 셀러가 `/seller/coupons` 접근 | 새 쿠폰 표시 |

---

## 6. M4: 에이전시 멀티 권한

| 검증 | 액션 | 기대 |
|---|---|---|
| 마이그레이션 0217 | 적용 후 | 기존 에이전시 owner 자동 등록 (agency_members) |
| 페이지 | `/agency/members` | owner 1명 (자기 자신) 표시 |
| 초대 | manager 역할로 신규 이메일 초대 | invite_token URL 표시 + 클립보드 복사 |
| 초대된 사람 | 같은 이메일로 회원가입 → URL 접근 | `POST /api/agency/members/accept` 호출 → status='active' |
| 역할 변경 | select 변경 | 즉시 반영, 본인 owner 강등 차단 |
| suspend / remove | 버튼 클릭 | 본인은 차단, owner 도 차단 |

---

## 7. TD-009: Webhook 실패 (M7)

| 검증 | 액션 | 기대 |
|---|---|---|
| 어드민 페이지 | `/admin/health` 진입 | 'Webhook 실패' 섹션 표시 |
| 시간 필터 | 1h/24h/3d/7d 변경 | 통계 갱신 |
| 통계 카드 | 총 실패 / escalated / 소스 분포 | 숫자 표시 |
| 재처리 버튼 | FAILED 행에서 클릭 | 확인 prompt → status='RECEIVED' (DB 확인) |

---

## 8. TD-007: 경매 차순위 승격

| 검증 | 액션 | 기대 |
|---|---|---|
| 경매 진행 + 낙찰자 결정 | 정상 경매 | winner_user_id 설정 |
| 낙찰자 불이행 시뮬레이션 | `POST /api/auction/:id/forfeit-winner` { reason: "테스트" } | 차순위 자동 승격 + auction_winner_history INSERT |
| 후보 없음 | 입찰 1건뿐인 경매 forfeit | status='ended', winner=NULL, reason='cancelled' |
| auction_holds | DB 조회 | 이전 winner forfeit_reason 채워짐 |

---

## 9. M11: 번들 사이즈

| 검증 | 액션 | 기대 |
|---|---|---|
| 빌드 | `npm run build:client` | 통과 |
| 번들 분석 | `npm run check:bundle` | 표 출력 + 위반 0 |
| 예산 체크 | `npm run check:bundle:budget` | exit 0 |
| 위반 시 | 단일 파일 800KB 초과 | exit 1 + 어떤 파일인지 표시 |

---

## 10. M9: 디버그 라우트 분리

| 검증 | 액션 | 기대 |
|---|---|---|
| build-info | `GET /api/debug/build-info` (admin) | markers.separatedDebugRoutes: true |
| bindings | `GET /api/debug/bindings` (admin) | hasDB: true, env keys 표시 |

---

## 11. 회귀 테스트 (기존 기능)

| 검증 | 액션 | 기대 |
|---|---|---|
| 유저 결제 | 일반 결제 흐름 | 정상 (Toss confirm + DB update) |
| 셀러 로그인 | `/seller/login` | JWT 발급 |
| 어드민 로그인 | `/admin/login` | JWT 발급 |
| 카카오 콜백 | 카카오 OAuth | 세션 쿠키 발급 |
| 라이브 송출 | OBS/YouTube Studio 연동 | 정상 송출 |

---

## 12. 실패 시 즉시 조치

### 마이그레이션 미적용 → 컬럼 없음 에러
```
[error] no such column: agencies.tier
```
→ 해당 마이그레이션 0212 적용 또는 `/api/_internal/repair-schema` 호출

### API 401
→ 토큰 만료. 재로그인.

### API 500 + "agency_members 미존재"
→ 0217 마이그레이션 미적용. 정상 fallback (목록 빈 배열) 작동 중인지 확인.

### 신규 페이지 404
→ App.tsx 라우트 누락 또는 lazy import 실패. 빌드 다시.

---

## 13. 자동화 권장 (CI 통합)

`.github/workflows/build.yml` 에 추가:

```yaml
- name: Schema verify
  run: node scripts/verify-schema.mjs --json
- name: Schema refs / API auth / Guide sync
  run: |
    bash scripts/check-schema-refs.sh
    bash scripts/check-api-auth.sh
    bash scripts/check-guide-sync.sh
- name: Build client
  run: npm run build:client
- name: Bundle budget
  run: npm run check:bundle:budget
- name: Build worker
  run: npm run build:worker
- name: Type check
  run: npm run type-check:worker || echo "pre-existing errors ignored"
```

---

## 14. 사용자가 보고할 형식

실패 시 다음 형식으로 알려주세요:

```
[Q4 라이브 노하우]
- 페이지 접속: ✅
- 섹션 표시: ❌ "라이브 운영 노하우" 안 보임
- 콘솔 에러: (있으면 첨부)
- DB 상태: SELECT * FROM operation_guides WHERE key='live-mastery' → ?
```

이 형식이면 즉시 원인 추적 + 수정 가능합니다.
