# UR Live - TODO

**최종 업데이트**: 2026-03-25

---

## 🔴 Critical

### [ ] Drizzle schema vs 실제 SQL schema 불일치
- `src/shared/db/schema.ts`: 8개 테이블 (단순화된 버전)
- `migrations/`: 47개 테이블 (실제 운영 스키마)
- Drizzle을 실제 쿼리에 사용 중이라면 타입 불일치 오류 가능
- 실제로 Drizzle이 쿼리에 쓰이는지 확인 후 판단 필요

---

## 🟡 High

### [ ] 운영 E2E 테스트 (8개 시나리오)
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
