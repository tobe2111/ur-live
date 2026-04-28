# 배포 액션 가이드 — 사용자 단계별 진행

이 문서는 코드로 자동화 불가능한 **사용자 측 Cloudflare Dashboard 작업**을 정리합니다.

각 단계는 독립적이며 개별 진행 가능합니다. **우선순위**대로 정렬했습니다.

---

## 🔴 1순위 — JWT_SECRET 회전 (선택, 보안 강화)

### 배경
2026-04-27 에 발견된 `/api/auth/id-token` IDOR 취약점 (commit `8cb3116` 으로 수정).

**왜 회전?**: 취약 기간 동안 누군가 임의 사용자의 backend JWT 를 발급받았을 가능성 0이 아님. JWT_SECRET 을 회전하면 그동안 발급된 모든 JWT 가 즉시 무효화됨 (= 모든 사용자 강제 재로그인).

### 단계
1. **새 시크릿 생성** (PowerShell):
   ```powershell
   $bytes = New-Object byte[] 64
   [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
   [Convert]::ToBase64String($bytes)
   ```

2. **Cloudflare Pages 등록**:
   - Workers & Pages → `ur-live` (Pages 프로젝트) → **Settings → Variables and Secrets**
   - `JWT_SECRET` 편집 → 새 값 붙여넣기 → Save
   - `REFRESH_TOKEN_SECRET` 도 동일하게 새 값으로 회전 권장 (두 시크릿이 한 쌍)

3. **재배포 트리거**:
   - 같은 페이지에서 **"Redeploy"** 클릭 (또는 자동 재배포 대기 5분)

4. **검증** (배포 후 즉시):
   ```bash
   # 모든 사용자/셀러/어드민 로그아웃 상태 확인
   # 본인이 다시 로그인 → 정상 동작 확인
   ```

### 영향
- 모든 활성 세션 무효 → 사용자 다시 로그인 필요
- 기존 발급된 세션 쿠키도 무효 → 사용자 측 즉시 로그아웃
- 운영 시간 외 진행 권장 (새벽 또는 트래픽 적은 시간대)

---

## 🔴 2순위 — TD-001: D1 Migration CI 권한 추가

### 배경
141 migration 파일 중 실제 적용 약 2개. CI 의 Cloudflare API token 에 D1 Edit 권한 없어 `migrate.yml` 실행 시 auth error → 응급 `repair-schema` / `repair-new-tables` endpoint 로 수동 처리 중.

### 단계
1. **Cloudflare Dashboard → My Profile → API Tokens**
2. 기존 `CLOUDFLARE_API_TOKEN` 편집 (또는 새 토큰 생성)
3. 권한에 추가:
   - **Account** → **D1** → **Edit**
4. 토큰 저장 후 GitHub Actions secret 갱신 (값 동일하면 skip)
5. 수동 실행: GitHub → Actions → `migrate.yml` → "Run workflow"

### 검증
1. Actions 로그에서 migration 적용 결과 확인
2. 또는 admin 으로 호출:
   ```bash
   curl -H "Authorization: Bearer <admin-token>" \
        https://live.ur-team.com/api/_internal/migration-status
   ```
   → `summary.applied` 가 `summary.total` 과 일치해야 함

### 효과 (자동 후속 가능)
- migration 0233 적용 → 스키마 이중 컬럼 (`stock_quantity`, `base_shipping_fee`) drop → TD-005 마무리
- 응급 `ensure*Columns/Tables` 패턴 10+ 곳 deprecate 가능

---

## 🟡 3순위 — TD-008: INTERNAL_CRON_TOKEN 등록

### 배경
`/api/orders/internal/auto-confirm` 등 cron 전용 엔드포인트가 토큰 인증을 기대하지만 미세팅 → cron 실행 시 500 발생.

### 단계
1. **시크릿 생성** (Linux/Mac):
   ```bash
   openssl rand -base64 32
   ```
   또는 PowerShell:
   ```powershell
   $bytes = New-Object byte[] 32
   [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
   [Convert]::ToBase64String($bytes)
   ```

2. **Cloudflare Pages 등록**:
   - `ur-live` (Pages) → Settings → Variables → Add
   - Name: `INTERNAL_CRON_TOKEN`
   - Value: 위에서 생성한 값
   - Type: **Secret** (encrypted)

3. **wrangler.toml 의 scheduled triggers 에 동일 토큰 사용 확인**:
   ```bash
   grep INTERNAL_CRON_TOKEN wrangler.toml
   ```
   값이 fetch 호출에 헤더로 들어가야 함 (`X-Internal-Token`).

### 검증
- 다음 cron 시간 (5분 마다 / 매일 18UTC) 후 Cloudflare Workers Logs 확인
- `[CronAuth] INTERNAL_CRON_TOKEN secret not configured` 로그가 사라져야 함

---

## 🟡 4순위 — ALIMTALK 환경변수 등록 (Magic Link 식사권 알림톡)

### 배경
Magic Link 식사권 플로우 (`aeab036`) 에서 사장님께 자동 알림톡을 발송하지만, `ALIMTALK_API_KEY` 미설정 시 silently skip.

### 단계 (Solapi 사용 가정 — 다른 provider 면 baseURL 변경 필요)
1. Solapi 가입 → API Key 발급 (https://console.solapi.com/)
2. **Cloudflare Pages 등록**:
   - `ALIMTALK_API_KEY` (secret) — Solapi API Key
   - `ALIMTALK_SENDER_KEY` (text) — 발신 번호 (예: `15441234`)
3. (Optional) 알림톡 템플릿 등록 후 ID 를 코드에 추가 — 없으면 LMS 로 fallback

### 검증
- 식사권 등록 후 `restaurant_phone` 으로 알림톡 수신 확인
- 셀러 대시보드 `/seller/group-buy` → "사장님께 알림톡 발송" 버튼 → toast "알림톡이 발송되었습니다"

### 임시 우회
환경변수 미설정 상태에서도 동작 가능: 셀러가 "복사" 버튼 → 카카오톡으로 사장님께 직접 전송.

---

## 🟢 5순위 — TD-003: 유령 Cloudflare 프로젝트 정리

### 배경
- `ur-live` Worker (Dashboard 첫 번째): GitHub 자동 배포되지만 secret 없음
- `ur-live-global` Worker: 49일간 "Latest build failed" 방치
- `ur-live-cleanup-cron` Worker: 용도 불명

위험: Worker 중 하나라도 잘못 트래픽 받으면 500 재발 가능.

### 단계
1. **Workers & Pages → `ur-live` (Worker, NOT Pages)** → Settings → Build → **Disconnect GitHub**
2. 1주일 관찰 후 문제 없으면 Worker 삭제
3. `ur-live-global` 빌드 실패 원인 확인:
   - Build logs 보고 → 의도적 사용 아니면 삭제
4. `ur-live-cleanup-cron` 실행 로그 확인:
   - 정상 동작 시 유지
   - 미사용/실패 시 삭제

### 검증
- 1주일 후 모든 인증 흐름 (admin/seller/agency 로그인) 정상 동작 확인
- Custom Domain (`live.ur-team.com`) 이 Pages 프로젝트에 연결되어 있는지 확인

---

## 📋 진행 추적 체크리스트

복사해서 진행 상황 기록에 사용:

```
[ ] 1. JWT_SECRET 회전 (+ REFRESH_TOKEN_SECRET)
    ↳ 새 시크릿 생성: ___________________
    ↳ 적용 시각: _______________________
    ↳ 본인 재로그인 확인: ______________

[ ] 2. TD-001 D1 Migration CI 권한
    ↳ API token 에 Account/D1/Edit 추가: __
    ↳ migrate.yml 수동 실행: _____________
    ↳ migration-status 검증: ____________

[ ] 3. TD-008 INTERNAL_CRON_TOKEN
    ↳ 시크릿 생성: _______________________
    ↳ Pages 등록: _______________________
    ↳ Cron 로그 정상 확인: _______________

[ ] 4. ALIMTALK 환경변수
    ↳ ALIMTALK_API_KEY 등록: _____________
    ↳ ALIMTALK_SENDER_KEY 등록: __________
    ↳ 알림톡 수신 테스트: _________________

[ ] 5. TD-003 유령 CF 프로젝트
    ↳ ur-live Worker disconnect: ________
    ↳ ur-live-global 처리: ______________
    ↳ ur-live-cleanup-cron 처리: ________
    ↳ 1주 안정 확인 후 삭제: _____________
```

---

## 🛠️ 검증 도구

배포 후 자동 검증: `bash scripts/verify-deploy.sh`

각 endpoint 가 정상 응답하는지 빠르게 확인합니다.
