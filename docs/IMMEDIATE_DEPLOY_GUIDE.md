# 🚀 즉시 실행 가이드 — 이번 세션 마무리

> 시크릿 값은 위 터미널 출력에 있습니다 (메시지 닫지 마세요).
>
> **소요 시간: 약 30분 (시크릿 + 마이그레이션 + 검증)**

---

## STEP 1: 시크릿 등록 (15분) — Cloudflare Pages

위 4개 값을 그대로 등록:

### 1-1. https://dash.cloudflare.com 접속

→ Workers & Pages → **ur-live** 클릭 → Settings → **Variables and Secrets**

### 1-2. 각 KEY 등록 (있으면 Edit, 없으면 Add)

| Variable name | Type | Value (위 출력에서 복사) |
|---|---|---|
| `JWT_SECRET` | Secret (encrypt) | `ep6dfaFSnScEeq7g7fW9GxEGyjbmkqEKnvRycxtwzPE=` |
| `REFRESH_TOKEN_SECRET` | Secret (encrypt) | `mwdp/VzxrMk/R3zcftbG8Ldu7OPc0/Rpl74tYNH5lRE=` |
| `INTERNAL_CRON_TOKEN` | Secret (encrypt) | `eadd2205d8e34747345d0125275c21e3ba45b20e7944949a4cb8674497ad75ab` |
| `TOSS_WEBHOOK_SECRET` | Secret (encrypt) | `hZ3z8SuUrIQwBmSEoI/YfgEBbxKOpaQcfj2Lo/6BniY=` |

→ 각 항목 [Save]

### 1-3. Toss Dashboard 에도 같은 값 등록

https://app.tosspayments.com → 개발 → 웹훅 → 시크릿:

→ `TOSS_WEBHOOK_SECRET` 값 (`hZ3z8...`) 입력

### 1-4. 재배포 (값 적용)

로컬 터미널에서:

```bash
git commit --allow-empty -m "deploy: apply rotated secrets (TD-002)"
git push origin main
```

→ GitHub Actions 가 자동 배포 (~2분)

---

## STEP 2: 외부 시크릿 재발급 (10분, 선택)

### 2-1. Firebase (가장 위험 — 즉시)

https://console.firebase.google.com → 프로젝트 → 설정 ⚙️ → 서비스 계정

1. **새 비공개 키 생성** → JSON 다운로드
2. JSON 내용에서 다음 값 복사:
   - `private_key` → Cloudflare 의 `FIREBASE_PRIVATE_KEY` (줄바꿈 그대로 `\n` 포함)
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `project_id` → `FIREBASE_PROJECT_ID`
3. **기존 키 비활성화** (콘솔에서 [삭제])

### 2-2. Toss API Key

https://app.tosspayments.com → 개발 → API 키 → **재발급** → `TOSS_SECRET_KEY` 갱신

### 2-3. Kakao REST API

https://developers.kakao.com → 앱 → 보안 → REST API 키 [재생성] → `KAKAO_REST_API_KEY` 갱신

---

## STEP 3: 마이그레이션 적용 (5분)

### 옵션 A: D1 권한 있는 경우 (권장)

```bash
# Cloudflare API Token 에 D1 Edit 권한이 있어야 함
for f in migrations/02{0,1,2}*.sql; do
  echo "=== $f ==="
  npx wrangler d1 execute toss-live-commerce-db --remote --file="$f"
done
```

### 옵션 B: D1 권한 없음 (응급)

배포 완료 후 (STEP 1-4 가 끝난 후):

```bash
# ADMIN_TOKEN: 어드민 로그인 후 localStorage('admin_token') 또는 직접 로그인
ADMIN_TOKEN="어드민_JWT_여기"

curl -X GET https://live.ur-team.com/api/_internal/repair-schema \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

→ `repair-schema` 가 누락된 컬럼/테이블 자동 추가.

---

## STEP 4: 검증 (2분)

### 4-1. 마이그레이션 적용 확인

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://live.ur-team.com/api/health/migrations | jq '.summary'
```

**기대:**
```json
{
  "total": 18,
  "applied": 18,
  "missing": 0,
  "errors": 0
}
```

`missing > 0` 시 → 응답의 `missing` 배열 보고 해당 마이그레이션 재적용.

### 4-2. JWT secret 적용 확인

```bash
# 잘못된 패스워드 → 401 (정상)
curl -X POST https://live.ur-team.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}' \
  -w "\nHTTP %{http_code}\n"
```

- `HTTP 401` → ✅ 정상 (rotation 적용됨)
- `HTTP 500` + "JWT_SECRET is not configured" → ❌ Cloudflare 등록 실패

### 4-3. KPI API 작동 확인

에이전시 로그인 (브라우저) 후:

```bash
AGENCY_TOKEN="에이전시_JWT_여기"

curl -H "Authorization: Bearer $AGENCY_TOKEN" \
  https://live.ur-team.com/api/agency/stats/kpi | jq '.data | keys'
```

**기대:** 6개 지표 키 (diamond_total, live_rate, ...)

### 4-4. /agency 대시보드 클릭 확인

브라우저로 `https://live.ur-team.com/agency` 접속:
- 사이드바에 "캠페인 & 영업" 그룹 + 4개 메뉴 보이면 ✅
- 핵심 지표 6 카드 + 의무 작업 진행률 보이면 ✅

---

## STEP 5: 문제 발생 시 즉시 OFF

신규 기능 중 하나가 문제면:

```bash
# 비상 모드 ON (모든 신규 cron OFF — 30초 안에 적용)
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enable": true}' \
  https://live.ur-team.com/api/admin/flags/emergency-mode
```

---

## STEP 6: 사용자 안내 (재로그인 알림)

JWT_SECRET 변경되면 **모든 기존 사용자 재로그인 필요**합니다.

권장 안내:
- 카카오 알림톡 / 인앱 배너로 "보안 업데이트로 재로그인 필요" 안내
- 점검 공지 (선택)

---

## 결론

위 순서대로 진행하면 **30분 안에 이번 세션 작업 100% 활성화**.

문제 시:
- `docs/SECRET_ROTATION_RUNBOOK.md` (시크릿 상세)
- `docs/MIGRATION_AND_ROLLBACK_RUNBOOK.md` (마이그레이션 + 롤백)

남은 작업 (선택, 아무때나):
- TD-001 (D1 Edit 권한) — `repair-schema` 대신 `wrangler` 직접 쓰고 싶으면
- TD-003 (유령 Workers 삭제) — 잠재 위험 제거
- R2 bucket 생성 — D1 백업 + 송장 R2 활성화
- TikTok 앱 등록 — TikTok 통합 활성화
