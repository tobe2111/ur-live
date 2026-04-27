# 🚀 즉시 실행 가이드 — 이번 세션 마무리

> ⚠️ **이전 버전 (commit 204f2f9) 에 시크릿 평문 포함됨** — git history 정리 필요.
> 새 시크릿 값은 **별도 채널 (메신저/로컬 터미널)** 로 사용자에게 전달.
>
> **소요 시간: 약 30분**

---

## 새 시크릿 생성 (사용자 본인 환경에서)

```bash
node scripts/rotate-secrets.mjs --all
```

→ 4개 값 출력. **이 값들은 ONE-SHOT** — 즉시 Cloudflare 에 등록 후 터미널 닫기.

---

## STEP 1: Cloudflare Pages 시크릿 등록 (15분)

### 1-1. https://dash.cloudflare.com → Workers & Pages → **ur-live** → Settings → **Variables and Secrets**

### 1-2. 위 출력에서 4개 값을 그대로 복사하여 등록 (Type: Secret/encrypt)

| Variable name | 출처 |
|---|---|
| `JWT_SECRET` | rotate-secrets.mjs 출력 |
| `REFRESH_TOKEN_SECRET` | rotate-secrets.mjs 출력 |
| `INTERNAL_CRON_TOKEN` | rotate-secrets.mjs 출력 |
| `TOSS_WEBHOOK_SECRET` | rotate-secrets.mjs 출력 |

### 1-3. Toss Dashboard 동기화

https://app.tosspayments.com → 개발 → 웹훅 → 시크릿 → 위 `TOSS_WEBHOOK_SECRET` 값 입력

### 1-4. 재배포 (값 적용)

```bash
git commit --allow-empty -m "deploy: apply rotated secrets"
git push origin main
```

→ GitHub Actions 자동 배포 (~2분)

---

## STEP 2: 외부 시크릿 재발급 (10분, 권장)

### Firebase
https://console.firebase.google.com → 프로젝트 → 설정 ⚙️ → 서비스 계정 → **새 비공개 키 생성**

JSON 다운로드 후 다음 값을 Cloudflare 에 등록:
- `private_key` → `FIREBASE_PRIVATE_KEY` (개행 그대로)
- `client_email` → `FIREBASE_CLIENT_EMAIL`
- `project_id` → `FIREBASE_PROJECT_ID`

→ Firebase Console 에서 **기존 키 [삭제]** (중요)

### Toss
https://app.tosspayments.com → 개발 → API 키 → **재발급** → `TOSS_SECRET_KEY` 갱신

### Kakao
https://developers.kakao.com → 앱 → 보안 → REST API 키 [재생성] → `KAKAO_REST_API_KEY` 갱신

---

## STEP 3: 마이그레이션 적용 (5분)

### 옵션 A: D1 권한 있음 (권장)

```bash
for f in migrations/02{0,1,2}*.sql; do
  echo "=== $f ==="
  npx wrangler d1 execute toss-live-commerce-db --remote --file="$f"
done
```

### 옵션 B: 권한 없음 (응급)

배포 완료 후 (STEP 1-4 완료 후):

```bash
ADMIN_TOKEN="어드민_JWT"

curl -X GET https://live.ur-team.com/api/_internal/repair-schema \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## STEP 4: 검증 (2분)

### 4-1. 마이그레이션 적용 확인

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://live.ur-team.com/api/health/migrations | jq '.summary'
```

기대: `{ "applied": 18, "missing": 0 }`

### 4-2. JWT secret 적용 확인

```bash
curl -X POST https://live.ur-team.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"x@x.com","password":"wrong"}' \
  -w "\nHTTP %{http_code}\n"
```

- `HTTP 401` ✅ 정상
- `HTTP 500` + "JWT_SECRET is not configured" ❌ 등록 실패

### 4-3. 신규 페이지 확인

브라우저로 `https://live.ur-team.com/agency` →
- 사이드바 "캠페인 & 영업" 그룹 + 4개 메뉴
- 핵심 지표 6 카드 + 의무 작업 진행률

---

## STEP 5: 문제 시 즉시 OFF (kill switch)

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enable": true}' \
  https://live.ur-team.com/api/admin/flags/emergency-mode
```

→ 30초 안에 모든 신규 cron OFF.

---

## STEP 6: 사용자 안내

JWT_SECRET 변경 → **모든 사용자 재로그인 필요**.

알림톡 / 인앱 배너로 "보안 업데이트로 재로그인 필요" 안내.

---

## 추가 참고

- 시크릿 상세: `docs/SECRET_ROTATION_RUNBOOK.md`
- 마이그레이션 + 롤백: `docs/MIGRATION_AND_ROLLBACK_RUNBOOK.md`
- 검증 보고서: `docs/W3_VERIFICATION_REPORT.md`
- 세션 종합 요약: `docs/SESSION_2026-04-26_SUMMARY.md`

---

## 🚨 git history 정리 (이전 commit 204f2f9 시크릿 노출)

위 STEP 1 의 새 시크릿 등록 후, 이전 commit 의 노출 시크릿은 무효화됨.
하지만 git history 정리는 추가 권장:

```bash
# BFG (별도 설치)
bfg --delete-files IMMEDIATE_DEPLOY_GUIDE.md
git reflog expire --expire=now --all && git gc --prune=now
git push --force --all  # 팀 합의 후

# 또는 GitHub repo Private 후 재공개 (간단)
```
