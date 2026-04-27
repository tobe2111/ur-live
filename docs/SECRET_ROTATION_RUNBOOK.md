# 시크릿 Rotation Runbook (TD-002)

> 작성: 2026-04-26
> 대상: TECHNICAL_DEBT.md TD-002 — `.dev.vars` + ENV_VARS *.txt git history 노출 해결
>
> ⚠️ **이 작업은 사용자 직접 수행** — 외부 콘솔 (Firebase / Toss / Kakao) 인증 + Cloudflare 대시보드 접근 필요.
>
> 도구: `scripts/rotate-secrets.mjs` 가 자동 생성 가능한 시크릿의 새 값 출력.

---

## 0. 사전 준비 (5분)

### 0.1 노출된 시크릿 목록 확인
git history 에 commit 된 파일들:
- `.dev.vars` (commit 96f502d)
- `ALL_ENV_VARS_COMPLETE.txt`, `CLOUDFLARE_ENV_COPY_PASTE.txt`, `CORRECT_FIREBASE_VALUES.txt` 등 12개

영향받은 시크릿:
| 시크릿 | 위험도 | 조치 |
|---|---|---|
| `JWT_SECRET` | 🔴 매우 높음 | 즉시 rotation |
| `REFRESH_TOKEN_SECRET` | 🔴 | 즉시 rotation |
| `FIREBASE_PRIVATE_KEY` | 🔴 매우 높음 | Firebase Console 재발급 |
| `VITE_FIREBASE_API_KEY` | 🟡 (제한된 범위) | Firebase Console 재발급 |
| `KAKAO_REST_API_KEY` | 🟡 | Kakao Developers 재발급 |
| `TOSS_SECRET_KEY` | 🔴 (운영 키) | Toss Dashboard 재발급 |
| `INTERNAL_CRON_TOKEN` | 🟡 | 자동 생성 |
| `TOSS_WEBHOOK_SECRET` | 🟡 | 자동 생성 + Toss 등록 |

### 0.2 사용자 영향 미리 안내
- JWT_SECRET / REFRESH_TOKEN_SECRET 변경 = **모든 사용자 강제 재로그인**
- 점검 공지 권장: 최소 30분 다운타임 가능성

---

## 1. 자동 생성 시크릿 (5분)

```bash
node scripts/rotate-secrets.mjs --all
```

출력:
```
📋 JWT_SECRET             → 값 복사
📋 REFRESH_TOKEN_SECRET   → 값 복사
📋 INTERNAL_CRON_TOKEN    → 값 복사
📋 TOSS_WEBHOOK_SECRET    → 값 복사 + Toss Dashboard 에 등록
```

**즉시 Cloudflare 등록** (값은 ONE-SHOT 표시):
1. https://dash.cloudflare.com → Workers & Pages → ur-live → Settings
2. Variables and Secrets → 각 키 옆 [Edit] → 새 값 → [Save]

---

## 2. Firebase 재발급 (10분)

### 2.1 Service Account Private Key (FIREBASE_PRIVATE_KEY)
1. https://console.firebase.google.com → 프로젝트 → 설정 ⚙️ → 서비스 계정
2. **새 비공개 키 생성** → JSON 다운로드
3. JSON 의 `private_key` 값 복사 (`\n` 그대로 포함)
4. Cloudflare → `FIREBASE_PRIVATE_KEY` 값 교체
5. 같이 등록되는 값:
   - `FIREBASE_CLIENT_EMAIL` — JSON 의 `client_email`
   - `FIREBASE_PROJECT_ID` — JSON 의 `project_id`
6. **기존 키는 즉시 비활성화** (콘솔에서 [삭제])

### 2.2 Web API Key (VITE_FIREBASE_API_KEY)
1. Firebase Console → 프로젝트 설정 → 일반 → 웹 앱
2. **새 앱 등록 또는 기존 키 재발급** (Firebase 는 web API key 직접 재발급 불가 — 새 앱 추가 후 도메인 제한)
3. 도메인 제한: `live.ur-team.com`, `ur-live.pages.dev` 만 허용
4. Cloudflare 환경변수 6개 모두 갱신:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

---

## 3. Toss 재발급 (5분)

### 3.1 Secret Key (TOSS_SECRET_KEY)
1. https://app.tosspayments.com → 개발 → API 키 관리
2. **API 키 재발급** (운영 키)
3. Cloudflare → `TOSS_SECRET_KEY` 값 교체

### 3.2 Webhook Secret (TOSS_WEBHOOK_SECRET)
1. 1단계에서 자동 생성한 값을 Toss Dashboard 에도 등록:
2. Toss Dashboard → 개발 → 웹훅 → 시크릿 입력
3. 같은 값을 Cloudflare 에도 등록 (1단계 출력 그대로)

---

## 4. Kakao 재발급 (5분)

1. https://developers.kakao.com → 내 애플리케이션 → 앱 선택
2. **앱 키 → REST API 키** 옆 [재생성]
3. 다음 값들 모두 갱신:
   - Cloudflare: `KAKAO_REST_API_KEY`
   - Cloudflare: `VITE_KAKAO_APP_KEY` (JavaScript SDK 키, 별도)

---

## 5. 적용 (재배포)

빈 commit 으로 Cloudflare Pages 재배포 트리거:

```bash
git commit --allow-empty -m "rotate secrets — TD-002 resolution"
git push origin main
```

배포 완료 (~2분) 후 검증:

```bash
# JWT 적용 확인 (잘못된 password 면 401, secret 누락이면 500)
curl -X POST https://live.ur-team.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@x.com","password":"wrong"}'

# 기대: 401 Unauthorized
# 실패 (500 "JWT_SECRET is not configured"): Cloudflare 등록 안 됨
```

```bash
# Toss webhook 적용 확인 (어드민 토큰 필요)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://live.ur-team.com/api/admin/metrics/webhook-failures | jq
```

```bash
# Firebase Admin SDK 작동 확인 (어드민 디버그)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://live.ur-team.com/api/debug/bindings | jq
```

---

## 6. Git History 정리 (선택 — 위험)

⚠️ **force push 필요**. 팀 합의 후에만.

```bash
# BFG Repo-Cleaner 설치
brew install bfg

# 노출된 파일 제거
bfg --delete-files .dev.vars
bfg --delete-files '*ENV_VARS*.txt'
bfg --delete-files 'CLOUDFLARE_ENV_COPY_PASTE.txt'
bfg --delete-files 'CORRECT_FIREBASE_VALUES.txt'
bfg --delete-files 'FIREBASE_SETUP_CHECKLIST.txt'
bfg --delete-files 'FLOW_DIAGRAM.txt'

# reflog cleanup
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# force push (모든 협업자 git pull --rebase 필요)
git push --force --all
```

대안 (BFG 없이): GitHub 측에서 **"Make this repository private"** 후 재공개.

---

## 7. 사고 후 모니터링 (24시간)

### 7.1 Sentry 알림 확인
- Authentication failure 급증 여부
- "JWT_SECRET is not configured" 에러 0건이어야 함
- "Webhook FAILED" — Toss webhook secret 불일치 시 spike

### 7.2 사용자 신고 모니터링
- "갑자기 로그인 안 됨" → 정상 (rotation 효과)
- "재로그인 후에도 안 됨" → 즉시 조사

### 7.3 정산/결제 정상 동작 확인
- 결제 성공률 → 평소 수준
- 정산 cron 정상 (Cloudflare Logs)

---

## 8. 롤백 (긴급)

이전 시크릿 값을 어딘가에 저장해뒀다면:

```bash
# 1. Cloudflare Pages → Variables → 이전 값으로 복구
# 2. 빈 commit 푸시
git commit --allow-empty -m "ROLLBACK: revert secret rotation"
git push origin main
```

**저장 안 했다면 롤백 불가** — 새 시크릿으로 진행 + 사용자 재로그인.

---

## 9. 체크리스트

```
☐ scripts/rotate-secrets.mjs 실행 + 값 4개 안전하게 메모
☐ Firebase Console: Service Account 새 키 발급 + JSON 보관
☐ Toss Dashboard: API 키 재발급 (운영)
☐ Toss Dashboard: Webhook secret 등록 (1단계 값과 일치)
☐ Kakao Developers: REST API 키 재발급
☐ Cloudflare Pages: 모든 시크릿 등록 (총 ~12개)
☐ git commit --allow-empty + push (재배포 트리거)
☐ 검증 curl 3종 통과
☐ Sentry / 로그 24시간 모니터링
☐ (선택) BFG 로 git history 정리
```
