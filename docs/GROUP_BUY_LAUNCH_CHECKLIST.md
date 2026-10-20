# 공동구매 서비스 런칭 체크리스트

**최종 업데이트**: 2026-05-15
**목표**: 실제 셀러 + 첫 GMV 발생까지 1인 운영 가능 상태 점검

---

## 🚀 Pre-launch (사전 준비)

### 인프라 / 환경변수 (Cloudflare Dashboard)

- [ ] **JWT_SECRET** — Wrangler Secret 등록 (회전 시 ENV: production)
- [ ] **DATA_ENCRYPTION_KEY** — push subscription 암호화
- [ ] **VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT** — Web Push
- [ ] **TOSS_SECRET_KEY** — 결제 confirm
- [ ] **TOSS_CLIENT_KEY** — 클라이언트 (Vite ENV)
- [ ] **TURNSTILE_SECRET** — bot challenge (선택, 미설정 시 fail-open)
- [ ] **RESEND_API_KEY** — 영수증 이메일 (무료 100/일)
- [ ] **DISCORD_WEBHOOK_URL** — ledger / reconciliation alert
- [ ] **ALIMTALK_API_KEY / ALIMTALK_SENDER_KEY** — 사장님 Magic Link 알림톡 (선택)
- [ ] **AI binding** — Workers AI (메뉴 OCR + 분쟁 분류)
  - Cloudflare Dashboard → Pages → Settings → Bindings → AI 추가 (binding name: `AI`)
- [ ] **SESSION_KV / RATE_LIMIT_KV** — KV namespace bind 확인

### DB 마이그레이션 (D1 권한 없으면 repair-schema 응급)

- [ ] `audit_logs` 테이블 — middleware 자동 생성 (첫 호출 시)
- [ ] `disputes` 테이블 — 자동 생성
- [ ] `ledger_entries` 테이블 — 자동 생성
- [ ] `vouchers.applied_discount_pct / applied_price` — 자동 ALTER
- [ ] `products.group_buy_tiers / milestone_notified_*` — 자동 ALTER
- [ ] `sellers.totp_secret / totp_enabled` — 2FA 활성화 시 자동 ALTER

### 첫 셀러 가입 전 점검

- [ ] `/seller/register` 흐름 PC + 모바일 둘 다 테스트
- [ ] `/seller/meal-voucher/new` 카카오맵 검색 동작 확인
- [ ] OCR 메뉴판 사진 업로드 → 자동 입력 동작 (AI binding 필요)
- [ ] Magic Link 알림톡 발송 (ALIMTALK_API_KEY 필요)
- [ ] 첫 공구 등록 → `/group-buy/:id` 정상 노출
- [ ] KakaoLink share → `/api/og/group-buy/:id` 동적 OG 이미지 검증

---

## 🎯 첫 사용자 (베타 5-10명) 시점

### 모니터링

- [ ] `/admin/group-buy` 분석 탭 — 카테고리별 funnel 정상 표시
- [ ] `/admin/disputes` — 빈 상태 정상 (분쟁 없음)
- [ ] `/admin/health` — system health
- [ ] Discord webhook 수신 테스트 (anomaly cron 발생 시)

### 보안

- [ ] 본인 어드민 계정 2FA 활성화 (`/seller/2fa` 또는 admin 페이지)
- [ ] CSP / HSTS 정상 적용 확인 (browser DevTools)
- [ ] CSRF cookie 발급 확인 (`document.cookie`)

### 알림 채널

- [ ] Web Push 구독 → 첫 알림 수신 테스트
- [ ] Resend 영수증 이메일 → spam 폴더 안 가는지
- [ ] Alimtalk → 사장님 Magic Link 도달 (실 매장 1곳 테스트)

---

## 📊 베타 → 정식 (50-200 셀러)

### 데이터 정합성

- [ ] **ledger 정합성 cron 결과 확인** (`/admin/audit-log` 에서 매일 검증)
  - imbalance >= 1원 시 Discord alert → 수동 조정
- [ ] reconciliation cron — toss 누락 결제 자동 동기화 확인
- [ ] 자동 환불 cron — 미달성 공구 환불 정상

### 성능

- [ ] Web Vitals (`/admin` 에서 확인) — LCP < 2.5s, CLS < 0.1
- [ ] D1 쿼리 ms — 100ms 이상 query 발견 시 인덱스 추가
- [ ] Edge cache hit rate (CF Dashboard)

### 운영

- [ ] **셀러 churn alert** 매일 18시 처리 (에이전시 dashboard 확인)
- [ ] 분쟁 큐 처리 시간 < 24시간 (escalated 케이스)
- [ ] PG 수수료 vs commission 마진 모니터링 (월별)

---

## 🛠️ 운영 도구 (이미 구현됨)

| 도구 | 경로 | 용도 |
|---|---|---|
| 공구 모니터링 | `/admin/group-buy` | 진행/달성/실패 + 강제 환불 |
| 공구 분석 | `/admin/group-buy` (분석 탭) | 카테고리별 GMV / Top 10 / 일별 |
| 분쟁 큐 | `/admin/disputes` | AI 분류된 분쟁 처리 |
| 셀러 모니터 | `/admin/seller-approval` | 가입 승인 |
| 매출 분석 | `/admin/revenue` | 일별/월별 매출 |
| 결제 모니터 | `/admin/deals` | 충전 / 사용 |
| 운영 가이드 | `/admin/operations-guide` | DB 기반 가이드 (수정 가능) |
| 헬스 체크 | `/admin/health` | 시스템 상태 |

---

## 🚨 장애 대응

### 결제 실패 급증
1. Toss 페이먼츠 status 확인 (status.tosspayments.com)
2. `/admin/deals` 에서 실패 패턴 확인
3. reconciliation cron 다음 실행 (18시) 까지 대기 — 자동 동기화

### Ledger 불일치 alert
1. Discord alert 받으면 즉시 `/admin/audit-log` 에서 최근 1시간 액션 확인
2. `ledger_entries` 직접 조회: `SELECT * FROM ledger_entries WHERE created_at >= datetime('now', '-1 hour')`
3. 수동 조정 entry 추가 후 audit_log 기록

### 자동 환불 cron 실패
1. 18시 실행 후 1시간 내 결과 미수신 시 `/api/_internal/run-cron?name=group_buy_auto_refund` 수동 호출 (admin only)

### YouTube 라이브 송출 끊김
1. `/admin/live-monitor` 에서 stream 상태 확인
2. 셀러에게 OBS 재시작 안내
3. 5분 cron 이 자동 status 동기화 (yt-broadcast-end-detect)

---

## 📈 KPI (1인 운영 핵심 지표)

매일 확인:
- 진행 중 공구 수 (active)
- 어제 달성한 공구 수 (achieved daily)
- 어제 GMV / commission
- 분쟁 큐 escalated 건수
- 신규 셀러 가입 수

매주 확인:
- 셀러 churn risk 알림 (high) 명단
- 카테고리별 conversion rate
- 인플루언서 share → 가입 funnel

매월 확인:
- PG 수수료 vs commission 마진율
- 정산 완료 vs 보류 비율
- 알림톡 / 이메일 발송 비용 (선택적 운영)

---

## 🎁 다음 세션 (Post-launch polish)

이번 commit (2026-05-15) 까지 해결되지 않은 부채:
- TD-G01: `group-buy.routes.ts` 분리 (1446줄 → 4-5 파일)
- TD-G02: 12개 `as any` 캐스트 → 타입 정의
- TD-G04: 22개 console.* DEV 게이트
- 운영 1-2개월 후 실 데이터 기반 polish

---

**런칭 준비 완료 기준**: 위 Pre-launch 체크리스트 100%, 베타 시점 5명 이상 정상 결제 완료.
