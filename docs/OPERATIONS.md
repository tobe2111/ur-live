# 운영 가이드 (OPERATIONS)

> 이 문서는 ur-live 운영 담당자가 정기적으로 수행해야 할 작업과 즉시 액션이 필요한 상황의 대응 방법을 정리합니다.

## 🚀 신규 배포 후 1회 액션 (필수)

### 1. 스키마 마이그레이션 적용
이번 세션에서 추가된 신규 테이블/인덱스/컬럼을 production DB에 적용합니다.

```bash
# admin token 으로 호출
curl -X POST 'https://live.ur-team.com/api/_internal/repair-schema' \
  -H 'Authorization: Bearer <ADMIN_TOKEN>'
```

또는 어드민 로그인 후 브라우저에서:
```js
fetch('/api/_internal/repair-schema', {
  method: 'POST',
  headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
}).then(r => r.json()).then(console.log)
```

**적용되는 항목**:
- `seller_status_history`, `agency_status_history` 테이블
- `cron_failures`, `alimtalk_failures` 테이블
- `sellers.email`, `sellers.linked_user_id` UNIQUE INDEX
- `agencies.email`, `agencies.linked_user_id` UNIQUE INDEX
- `admins.is_active`, `admins.status`, `admins.deleted_at` 컬럼
- `agencies.is_active`, `agencies.deleted_at` 컬럼
- `live_streams.deleted_at` 컬럼

### 2. Cloudflare D1 자동 백업 활성화
1. Cloudflare Dashboard → Workers & Pages → D1 → `ur-live-db` 선택
2. Backups 탭 → "Enable scheduled backups"
3. 보존 기간: 30일 (free tier 기본) / 90일 (paid)

### 3. 필수 환경변수 등록 (CF Pages → Variables)
- `INTERNAL_CRON_TOKEN` — cron job 인증 (TD-008)
- `RATE_LIMIT_KV` 바인딩 — rate limit fail-open 방지
- `ALIGO_API_KEY`, `ALIGO_USER_ID`, `ALIGO_SENDER_KEY` — 알림톡
- `TURNSTILE_SECRET` — 봇 차단 (선택)

---

## 📊 정기 모니터링 (매일/매주)

### 매일 확인 (admin 대시보드)
- **`/admin/system-monitoring`** — Cron 실패 + 알림톡 발송 실패
  - Cron 실패가 critical/error 면 즉시 조사
  - 알림톡 abandoned (3회 모두 실패) 가 누적되면 Aligo 키 확인
- **`/admin/seller-approval`** — 신규 셀러 가입 대기
- **`/admin/orders`** — 결제/배송 이상

### 매주 확인
- D1 백업 상태 (Cloudflare Dashboard)
- Cron 실패 누적 trend (`/admin/system-monitoring` → 해결됨 보기)
- `npx wrangler d1 info ur-live-db` — DB 크기 / 행 수

---

## 🚨 비상 대응

### A. 사용자가 "셀러 가입했는데 새로 등록하라고 함"
**원인**: 이메일/비번 셀러 가입 후 카카오 로그인 시 `linked_user_id` 미설정.

**해결**: 자동 처리됨 (2026-05-07 영구 fix). `my-seller-status` 가 이메일 매칭으로 자동 연결.

수동 확인:
```sql
SELECT id, email, linked_user_id, status FROM sellers WHERE email = '<사용자_이메일>';
SELECT id, email FROM users WHERE email = '<사용자_이메일>';
```
`linked_user_id` 가 NULL 이면 사용자가 카카오 로그인 1회 하면 자동 연결.

### B. 결제는 됐는데 주문이 안 됐다고 함
**원인**: Toss webhook 실패 또는 race condition.

**해결**:
1. `/admin/orders` 에서 주문번호로 검색
2. Toss Dashboard → 결제 내역에서 paymentKey 확인
3. 수동 confirm: `POST /api/payments/confirm` 재호출 (idempotent — 안전)

### C. 라이브 방송 종료 안 됨
**원인**: YouTube API 일시 오류.

**해결**:
- 자동: 2026-05-07 fallback 적용 (legacy alias 자동 시도)
- 수동: `/admin/live-monitor` 에서 강제 종료 가능

### D. 알림톡 발송 실패 (사용자 신고)
**원인**: Aligo API 일시 오류 / 잔액 부족 / 템플릿 미승인.

**해결**:
- 자동: 5분마다 retry cron (max 3회, exponential backoff)
- 수동: `/admin/system-monitoring` → 알림톡 탭 → "즉시 재시도" 버튼

### E. Cron 실패가 누적됨
**원인**: DB 일시 오류 / 외부 API 장애 / 코드 버그.

**해결**:
1. `/admin/system-monitoring` → Cron 탭에서 실패 메시지 확인
2. critical (정산 등) → 즉시 코드 검토
3. error/warning → 누적 빈도 보고 판단

---

## 🔄 정기 작업 (수동/cron)

### 수동 실행 가능한 cron
```bash
# DB 백업 (보조 — Cloudflare 자체 backup 우선)
./scripts/backup-d1.sh
./scripts/backup-d1.sh --upload-r2  # R2 업로드 시

# Status 표준화 (선택, backup 후 실행)
npx wrangler d1 execute ur-live-db --remote --file=./scripts/migrate-status-standardization.sql

# 가이드 자동 참조 재생성
npm run generate:guide-refs
```

### 자동 cron (wrangler.toml)
| 주기 | 작업 | 모니터링 |
|---|---|---|
| `*/5 * * * *` | scheduled-cleanup, pk-battles-tick, **retry-alimtalk** | system-monitoring |
| `0 * * * *` | anomaly-detect | admin alerts |
| `0 18 * * *` | auto-settlement, expired-voucher-refund | system-monitoring |
| `0 0 * * *` | daily-self-diagnostic, agency-tier-eval | discord alert |

---

## 🛡️ 데이터 안전성 보장

### 절대 hard-delete 안 되는 것
- `users`, `sellers`, `agencies`, `admins` — soft-delete만 (status='deleted' + suffix)
- `live_streams` — soft-delete (status='deleted' + ended_at + deleted_at)
- `orders`, `chat_messages`, `audit_logs` — append-only (DELETE 금지)

### 자동 변경 이력 기록
- `seller_status_history` — pending/approved/suspended/rejected 모든 변경
- `agency_status_history` — 동일
- `audit_logs` — admin 액션 36곳

### UNIQUE 보호
- `sellers.email` (NULL 제외)
- `sellers.linked_user_id` (NULL 제외)
- `agencies.email`, `agencies.linked_user_id`
- `users.kakao_id` (NULL 제외)

---

## 📞 긴급 연락

- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Toss Payments Dashboard**: https://api.tosspayments.com
- **Aligo Console**: https://smartconsole.aligo.in
- **Sentry (오류 추적)**: https://sentry.io

---

## 📝 변경 이력
- 2026-05-07: 신규 작성 — 운영 가이드 통합 + 자동 모니터링 시스템 도입
