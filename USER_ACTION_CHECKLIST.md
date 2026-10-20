# 사용자 Dashboard 작업 체크리스트

Claude 가 코드로 해결할 수 없는 Dashboard 작업들을 우선순위별로 정리.

---

## 🔴 Critical (당장 해야 함)

### ☐ 1. `/api/_internal/repair-schema` 1회 호출
**어디서:** 브라우저에서 `https://live.ur-team.com/api/_internal/repair-schema` 열기
**왜:** 이번 세션에서 추가된 48개 컬럼 + 14개 테이블 확인/생성
**소요 시간:** 10초

---

### ☐ 2. CLOUDFLARE_API_TOKEN 에 D1 Edit 권한 추가
**어디서:** https://dash.cloudflare.com/profile/api-tokens
**순서:**
1. CI에서 쓰는 토큰 옆 `⋯` → **Edit**
2. Permissions → **+ Add more**
3. `Account` | `D1` | `Edit` 선택
4. **Continue to summary** → **Update Token**
**왜:** 이후 migration 자동 실행, Pages 쓰기 작업 가능
**소요 시간:** 3분

---

### ☐ 3. 비밀값 5개 Rotation (Git history 노출)

**Cloudflare Pages** → **ur-live** → **Settings → Variables and Secrets**

**3-1. JWT_SECRET 교체**
```
JWT_SECRET = YiXorQ7veam3W4/Y9woD/yNuQPoJG1/87fOd9Tpzcq8=
```

**3-2. REFRESH_TOKEN_SECRET 교체**
```
REFRESH_TOKEN_SECRET = +VJyeeTA1imGHwh0xuqV/7Em27Rnz3BQTa+eiOwDq68=
```

⚠️ 위 2개 교체 시 **로그인된 모든 세션 무효화**. 사용자 재로그인 필요.

**3-3. FIREBASE_PRIVATE_KEY 재발급** (가장 중요)
- https://console.firebase.google.com → 프로젝트 설정 → 서비스 계정
- **새 비공개 키 생성** → JSON 다운로드
- 기존 키 → "키 취소"
- JSON 내 `private_key` 값을 Pages 에 그대로 붙여넣기

**3-4. KAKAO_REST_API_KEY 재발급**
- https://developers.kakao.com/console/app
- 앱 선택 → 앱 키 → **REST API 키 재발급**

**3-5. TOSS_SECRET_KEY 확인**
- 현재 `test_gsk_...` (테스트 키) 인지 확인
- Production 키라면 https://developers.tosspayments.com 에서 재발급
- 테스트 키라면 무시 OK

**소요 시간:** 30분

---

### ☐ 4. 유령 Cloudflare 프로젝트 정리

**Workers & Pages Overview:**
- `ur-live` (Worker, 첫 번째 — `ur-live.jiwon-1a2.workers.dev`)
  - Settings → Build → **Disconnect GitHub**
  - 1주일 관찰 후 문제 없으면 Settings → General → **Delete**
- `ur-live-global` (49일 전 빌드 실패)
  - Deployments → 최근 실패 로그 확인
  - 필요 없으면 Settings → General → **Delete**
- `ur-live-cleanup-cron`
  - 실행 로그 확인
  - 쓸모 있으면 유지, 아니면 Delete

**소요 시간:** 20분

---

## 🟡 High (이번 주 안에)

### ☐ 5. `/api/_internal/smoke-test` + `?chunk=1` 전수 검증
**왜:** 스키마 복구 후 모든 API 정상 확인
**소요 시간:** 1분

---

### ☐ 6. 실제 로그인 3종 테스트
- `/admin/login` — `tobe2111@naver.com` / `358533aa!!`
- `/seller/login` — 실제 셀러 계정
- `/login` — 카카오 로그인 → 프로필/주문 조회
**소요 시간:** 5분

---

### ☐ 7. 실제 주문 1건 E2E 테스트
장바구니 → 결제(테스트 카드) → 주문 확인 → 취소 테스트
**소요 시간:** 10분

---

## 🟢 Medium (이번 달 안에)

### ☐ 8. GitHub Actions 에서 Migration 일괄 실행
API Token D1 권한 추가(☐ 2) 완료 후:
- GitHub → Actions → "D1 Database Migration"
- 파일명: `migrations/0205_products_ranking_stats.sql` (또는 필요한 최신)
- Run workflow

### ☐ 9. INTERNAL_CRON_TOKEN 세팅
```bash
wrangler secret put INTERNAL_CRON_TOKEN
# 값: openssl rand -base64 32
```
Pages Dashboard 에도 동일 추가.

### ☐ 10. Git History 정리 (선택)
```bash
# BFG 설치 (Mac)
brew install bfg

# .dev.vars 전부 제거
bfg --delete-files .dev.vars

# Force push (팀원 있으면 협의 먼저)
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force --all
```

---

## ⚪ Low (분기 내)

### ☐ 11. Sentry Alert 설정
5xx 발생 시 슬랙/이메일 알림 — 이번 같은 대장애 조기 감지.

### ☐ 12. 모니터링 대시보드
Cloudflare Analytics → 에러율, 응답시간 추적.

### ☐ 13. E2E 테스트 자동화
Playwright 로 결제/주문/로그인 흐름 자동 테스트.

---

## ✅ 완료 시 체크

- ☐ ☐ 1~4 (Critical) 완료 → 사이트 운영 안정
- ☐ ☐ 5~7 (High) 완료 → 기능 검증 완료
- ☐ ☐ 8~10 (Medium) 완료 → 인프라 자동화
- ☐ ☐ 11~13 (Low) 완료 → 장기 운영 체계

---

## 질문/문의

- 기술 부채 상세: `TECHNICAL_DEBT.md`
- 프로젝트 규칙: `CLAUDE.md`
- 배포 진단: `https://live.ur-team.com/api/version` (secrets 모두 true 인지)
