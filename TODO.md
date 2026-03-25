# UR Live - TODO

**최종 업데이트**: 2026-03-25

---

## 🔴 Critical (차단 중)

### [ ] D1 Migration 정리 및 운영 적용 확인

**문제 1 - package.json DB 이름 불일치**
```json
// 현재 (잘못됨)
"db:migrate": "wrangler d1 execute marketplace-db --local ..."
"db:migrate:prod": "wrangler d1 execute marketplace-db --file ..."

// 올바른 이름 (wrangler.toml 기준)
database_name = "toss-live-commerce-db"
```
→ `package.json`의 모든 `marketplace-db`를 `toss-live-commerce-db`로 수정 필요

**문제 2 - 운영 D1에 전체 migration 적용 여부 불명확**
- 파일 0001 ~ 0117 (77개) 존재
- 실제 운영 DB에 몇 번까지 적용됐는지 알 수 없음
- 확인 방법:
  ```bash
  wrangler d1 execute toss-live-commerce-db --command "SELECT name FROM sqlite_master WHERE type='table'"
  ```

**문제 3 - Drizzle schema vs 실제 SQL schema 불일치**
- `src/shared/db/schema.ts`: 8개 테이블 (단순화된 버전)
- `migrations/`: 25+ 테이블 (실제 운영 스키마)
- Drizzle을 실제 쿼리에 사용 중이라면 타입 불일치 오류 가능

---

## 🟡 High

### [ ] Cloudflare Pages 환경 변수 설정
- `VITE_SENTRY_DSN` 추가 (현재 Sentry Mock mode로 동작 중)
- `VITE_SENTRY_ENVIRONMENT=production`
- 설정 후 Retry deployment 필요

### [ ] 운영 배포 후 E2E 테스트 (8개 시나리오)
- Kakao 로그인
- Email 회원가입 & 로그인
- Checkout 인증 가드
- Seller JWT 인증
- Admin 인증
- Route Guards
- TopNav 상태 업데이트
- Product Detail 조건부 인증

---

## 🟢 Medium

### [ ] 비용 모니터링 설정
- Cloudflare Dashboard → Billing → Usage Alerts 설정
- Durable Objects 사용량 기준점 설정 ($10 초과 시 알림)

### [ ] seed 데이터 정리
- `migrations/002_seed.sql`, `0103_add_bcrypt_test_accounts.sql` 등 테스트 계정이 운영 DB에 포함되어 있을 수 있음
- 운영 환경에서 테스트 계정 삭제 여부 확인

---

## ✅ 완료

- [x] Zustand 마이그레이션
- [x] Sentry 통합 (코드)
- [x] Cloudflare Region 런타임 분기
- [x] Firebase Realtime DB → Durable Objects WebSocket 교체
- [x] Admin 대시보드 orders 500 오류 수정 (`payment_method` 컬럼 추가, migration 0117)
- [x] Admin 대시보드 UI 리디자인
- [x] Durable Objects 기반 멀티셀러 라이브 스트림 구현

---

## 📎 참고

- 운영 사이트: https://live.ur-team.com
- Cloudflare Dashboard: https://dash.cloudflare.com
- Sentry: https://o4510992097935360.sentry.io/
- D1 migration 스크립트: `scripts/migrate-all.sh`
- 이전 TODO 기록: `docs/archive/`
