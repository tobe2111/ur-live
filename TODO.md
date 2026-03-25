# UR Live - TODO

**최종 업데이트**: 2026-03-25

---

## 🟡 High

### [x] 운영 단위/통합 테스트 (595개 전체 통과) ✅

### [ ] 운영 E2E 테스트 - Cypress/Playwright (브라우저 필요, CI 환경에서 실행 권장)
- Kakao 로그인
- Email 회원가입 & 로그인
- Checkout 인증 가드
- Seller JWT 인증
- Admin 인증
- Route Guards
- TopNav 상태 업데이트
- Product Detail 조건부 인증

### [ ] 운영 DB 테스트 계정 정리
- `migrations/002_seed.sql`, `0103_add_bcrypt_test_accounts.sql` 테스트 계정이 운영 DB에 포함되어 있음
- 운영 환경에서 테스트 계정 삭제 여부 확인

---

## 🟢 Medium (나중에)

### [ ] Sentry 환경 변수 설정
- 실제 유저가 생기면 그때 켜도 됨
- Cloudflare Pages → Settings → Environment variables → Production
- `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT=production` 추가 후 Retry deployment

### [ ] Cloudflare 비용 알림 설정
- Cloudflare Dashboard → Billing → Usage Alerts
- Durable Objects $10 초과 시 알림

---

## ✅ 완료

- [x] Vitest 단위/통합 테스트 595개 전체 통과
  - Feature Flags `isFeatureEnabled` 해시 버킷 계산 버그 수정 (base flag 무시하고 rollout% 기준으로)
  - `logFeatureFlagStatus` test mode 조건 추가 (`import.meta.env.MODE === 'test'`)
  - `auth-api.ts` retry tracker 설계 버그 수정 (`>= 1` → `>= 2`, requestTracker dedup 충돌 해결)
  - Cart test 이중 throw 버그 수정
  - Auth-api timeout 테스트 `vi.advanceTimersByTimeAsync` + AbortSignal mock 적용
  - Cart integration 테스트 localStorage key 수정 (`user_id` → `lastLoginUid`)
  - LiveChatPanel username masking 반영 (`User1` → `U***1`)

- [x] Drizzle schema 불일치 확인 → **실제로 Drizzle 미사용** (false alarm)
  - 모든 Worker 라우트는 `src/worker/repositories/` 의 raw D1 SQL 쿼리 사용
  - `src/shared/db/schema.ts` + `src/shared/repositories/` 는 미완성 stub (실제 쿼리에 미연결)
  - `src/shared/repositories/index.ts` 에 명시적으로 "future-work stubs" 로 표기됨

- [x] D1 migration 운영 DB 적용 확인 (47개 테이블 정상)
- [x] D1 로컬 DB migration 전체 적용 (77개 파일)
- [x] package.json / migrate-all.sh DB 이름 오타 수정 (marketplace-db → toss-live-commerce-db)
- [x] migration 스크립트 Windows 호환 (bash → Node.js)
- [x] Zustand 마이그레이션
- [x] Sentry 통합 (코드)
- [x] Cloudflare Region 런타임 분기
- [x] Firebase Realtime DB → Durable Objects WebSocket 교체
- [x] Admin 대시보드 orders 500 오류 수정 (migration 0117)
- [x] Admin 대시보드 UI 리디자인
- [x] Durable Objects 기반 멀티셀러 라이브 스트림 구현

---

## 📎 참고

- 운영 사이트: https://live.ur-team.com
- Cloudflare Dashboard: https://dash.cloudflare.com
- Sentry: https://o4510992097935360.sentry.io/
- D1 migration 스크립트: `scripts/migrate-all.js`
- 이전 TODO 기록: `docs/archive/`
