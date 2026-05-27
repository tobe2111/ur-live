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
