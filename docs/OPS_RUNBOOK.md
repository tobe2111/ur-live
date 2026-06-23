# 운영 Runbook — 사용자 액션 필요 항목

## 1. D1 Migration CI 자동화 (TD-001)

워크플로우: `.github/workflows/d1-migrate.yml` 이미 존재. **GitHub Secrets 등록만 필요.**

### 필요한 Secrets

| 이름 | 설명 | 권한 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | D1 Edit 권한 | Account > D1 > Edit |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID | (Dashboard 우측 사이드바) |
| `D1_DATABASE_NAME` | DB 이름 (default `ur-live`) | optional |
| `ADMIN_REPAIR_TOKEN` | `/api/_internal/repair-schema` 호출용 | optional |
| `DISCORD_WEBHOOK_URL` | 결과 알림 | optional |

### 설정 절차

1. Cloudflare Dashboard → My Profile → API Tokens → Create Token
2. Custom Token 생성:
   - Account permissions: `D1 — Edit`
   - Zone permissions: (불필요)
3. GitHub repo → Settings → Secrets and variables → Actions → New secret
4. 위 secrets 등록
5. 다음 `migrations/` 변경 commit 시 자동 실행

---

## 2. Secret 회전 (주기 6개월)

마지막 회전: **2026-04-27**. 다음 도래: **2026-10-27**.

### 회전 대상

| Secret | 회전 절차 |
|---|---|
| `JWT_SECRET` | Cloudflare Dashboard → Workers & Pages → ur-live → Settings → Variables. 새 값 등록 후 기존 JWT 자동 만료 (refresh 시 재발급). |
| `DATA_ENCRYPTION_KEY` | 카카오 access_token / refresh_token 암호화 키. **회전 시 기존 토큰 복호화 불가** — 미리 plain re-encrypt 마이그레이션 필요 (별도 PR). |
| `KAKAO_REST_API_KEY` | Kakao Developers → 앱 → 보안 → REST API 키 → 재발급. Cloudflare env 동시 업데이트. |
| `TOSS_*_KEY` | Toss Payments 대시보드 → 개발자 센터 → 키 → 재발급. live/test 분리. |
| `RESEND_API_KEY` | Resend dashboard → API Keys → revoke + create. |
| `TURNSTILE_SECRET` | Cloudflare Turnstile → site → settings. |

### 회전 후 검증
- 카카오 로그인 → 정상 동작
- 결제 confirm → 정상 동작
- 이메일 발송 → 정상 동작
- `/api/_internal/repair-schema` → 200

---

## 3. 운영 대시보드 통합 status

`GET /api/admin/ops-status` (requireAdmin):
- 최근 schema-repair 실행 시각
- 활성 상품 수
- 24h 주문 수
- 최근 frontend_errors 패턴 5건
- 24h KT Alpha 발송 상태별 카운트

`GET /api/admin/csp-violations?range=1d|7d` (requireAdmin):
- CSP violation 패턴 카운트 + 마지막 발생 시각

향후 admin UI 페이지로 시각화 권고.

---

## 4. KV 사용량 모니터링

2026-05-27 부로 `publicCache` 가 KV 안 씀 (`useKv: false`). KV write 거의 0.
**남은 KV 사용처**: `SESSION_KV` (rate-limit), `CACHE_KV` (외부 명시 사용 시).

월 1회 Cloudflare Dashboard → Workers & Pages → KV → Analytics 에서 write/read 카운트 확인.
1000 write/일 무료 한도 초과 시 발견.

---

## 5. 카카오 OAuth audit 체크리스트

- [x] state CSRF cookie (kakao_oauth_state)
- [x] access_token / refresh_token DB 저장 시 encryptAtRest
- [x] safeRedirect (open redirect 방어)
- [x] sellers.linked_user_id UNIQUE index
- [x] users.kakao_id UNIQUE partial index
- [x] same-email seller auto-link (2026-05-27)
- [x] kakaotalk:// scheme redirect sessionStorage 가드

---

## 6. Cron 스케줄 (자동 실행) — 📌 기록 2026-06-23

SSOT: `wrangler.toml` `[triggers] crons` + 분배 로직 `src/worker/scheduled.ts`.
시각은 **UTC**(한국시간 KST = UTC+9). 모든 cron 은 `safeCron` 래핑 → 실패 시 logError + Discord 알림.

| Cron (UTC) | 한국시간(KST) | 주기 | 핵심 작업 |
|---|---|---|---|
| `*/2 * * * *` | — | 2분마다 | 고빈도 tick |
| `*/5 * * * *` | — | 5분마다 | 단기 작업 (알림/드레인 등) |
| `0 * * * *` | 매시 정각 | 매시간 | 이상치/어뷰징 탐지 (anomaly-detect) |
| `0 3 * * *` | 12:00 | 매일 | 일일 작업 |
| `0 9 * * *` | 18:00 | 매일 | 일일 작업 |
| **`0 18 * * *`** | **03:00** | **매일** | **heavy: 정산·교환권 환불·에이전시 배치 + 🔧 `schema-repair-daily`(runSchemaRepair — 누락 컬럼/테이블 자동 ADD, 멱등)** |
| `0 19 * * *` | 04:00 | 매일 | reconciliation(대사) |
| **`0 20 * * 0`** | **월 05:00** | **주 1회(일)** | **💾 D1 백업 → R2 (`handleD1Backup`)** |
| `0 0 * * 1` | 월 09:00 | 주 1회(월) | 주간 에이전시 배치(정산/인센티브/등급/인보이스) |

> ✅ **repair-schema 는 매일 03:00 KST 자동 실행** — 운영자가 수동으로 `/api/_internal/repair-schema` 누를 필요 없음. 즉시 보강이 필요하면 어드민이 `GET /api/_internal/repair-schema` 수동 호출 가능(선택). 가입 INSERT 는 자가치유(2026-06-23 wholesale/register)라 cron 사이 공백도 커버.

---

## 7. DB 백업 현황 — 📌 기록 2026-06-23 (⚠️ 바인딩 확인 필요)

**2겹 백업 구조:**

| 레이어 | 무엇 | 주기/보관 | 설정 |
|---|---|---|---|
| **① Cloudflare D1 Time Travel** (기본 제공) | D1 전체 point-in-time 복구(초 단위) | **최근 30일 자동** | **설정 불필요 — 항상 켜짐**. 1차 안전망 |
| **② 커스텀 SQL 덤프 → R2** (`d1-backup.ts`) | 전 테이블 schema+data → `backups/d1-YYYY-MM-DD.sql` | **주 1회(일 20:00 UTC)**, R2 lifecycle 30일 | **`BACKUP_BUCKET` R2 바인딩 필요** (대시보드) |

**복구(restore):**
- ① Time Travel: `wrangler d1 time-travel restore ur-live --timestamp=<ISO>` (또는 대시보드) → 30일 내 임의 시점.
- ② R2 덤프: `backups/d1-*.sql` 다운로드 → `wrangler d1 execute ur-live --file=dump.sql` (DROP+CREATE+INSERT 전체 복원).

**⚠️ 운영자(대표) 확인 필요 — 이것만 해주세요:**
1. Cloudflare Dashboard → R2 → 버킷 **`ur-live-backups`** 존재 확인 (없으면 생성).
2. Workers & Pages → ur-live → Settings → **Bindings 에 `BACKUP_BUCKET` → `ur-live-backups`** 바인딩 확인.
   - **미바인딩이면 주간 R2 백업이 매번 throw(0건).** (단, ①Time Travel 30일은 그래도 항상 동작 → 데이터 손실 위험은 낮음.) 실패 시 `DISCORD_WEBHOOK_URL` 알림.
3. R2 버킷에 `backups/d1-YYYY-MM-DD.sql` 파일이 매주 쌓이는지 1회 확인.

**개선 여지(선택)**: 주 1회 → 일 1회로 늘리면 R2 덤프 granularity ↑ (Time Travel 이 이미 초단위 30일 커버라 필수는 아님). 필요 시 `wrangler.toml` crons 에 일일 트리거 + `scheduled.ts` 분기 추가.

