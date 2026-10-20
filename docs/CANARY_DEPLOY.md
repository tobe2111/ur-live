# 카나리 배포 가이드

## 개요

Cloudflare Pages 의 Gradual Deployments 기능을 사용해 트래픽을 단계적으로 새 버전으로 전환한다.
이를 통해 프로덕션 사고 발생 시 영향 범위를 최소화하고, 빠른 롤백이 가능하다.

## 배포 파이프라인

```
코드 변경
  → 스테이징 배포 (ur-live-staging.pages.dev)
  → 스테이징 검증 (로드 테스트 + 스모크 테스트)
  → 카나리 배포 10%
  → 10분 모니터링 (에러율 < 0.1%, p95 < 2s)
  → 카나리 50%
  → 10분 모니터링
  → 100% 전환 (완전 배포)
```

## 스테이징 배포

```bash
bash scripts/deploy-staging.sh
```

URL: https://ur-live-staging.pages.dev

## Cloudflare Dashboard — Gradual Deployments 설정

### 접근 경로

1. https://dash.cloudflare.com 로그인
2. Workers & Pages → `ur-live` 프로젝트 선택
3. Deployments 탭 → 최신 배포 옆 `...` 메뉴 → "Create gradual rollout"

### 단계별 검증 기준

| 단계 | 트래픽 비율 | 대기 시간 | 통과 조건 |
|---|---|---|---|
| 초기 카나리 | 10% | 10분 | 에러율 < 0.1%, p95 < 2s |
| 중간 단계 | 50% | 10분 | 에러율 < 0.1%, p95 < 2s |
| 완전 배포 | 100% | — | — |

### CLI 로 Gradual Rollout

Cloudflare API 를 사용해 CLI 에서도 제어 가능:

```bash
# 현재 배포 ID 확인
curl -s "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/ur-live/deployments" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(dep['id'], dep.get('created_on','')[:10]) for dep in d['result'][:5]]"

# 트래픽 분배 설정 (10% → 새 버전)
# Dashboard 에서 수동 설정 권장 (API 미지원 구간 존재)
```

## 모니터링 (배포 중)

```bash
# Workers 실시간 로그
wrangler tail --project-name=ur-live

# 에러율 확인 (Cloudflare Analytics API)
curl -s "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/ur-live/analytics" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"

# 헬스 체크
curl -I https://live.ur-team.com/api/health

# Rate limit 헤더 확인
curl -I https://live.ur-team.com/api/products | grep X-RateLimit
```

## 롤백 방법

### 즉시 롤백 (Dashboard)

1. Workers & Pages → `ur-live` → Deployments
2. 이전 배포 옆 `...` → "Rollback to this deployment"
3. 확인 → 수 초 내 완료

### CLI 롤백

```bash
# 이전 배포 ID 확인 후 롤백
PREV_DEPLOYMENT_ID="<이전_배포_ID>"
curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/ur-live/deployments/${PREV_DEPLOYMENT_ID}/retry" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json"
```

### Git 롤백 (코드베이스 되돌리기)

```bash
# 이전 커밋으로 되돌리기 (새 커밋 생성 — revert 방식)
git revert HEAD --no-edit
git push origin main
# auto-merge-main.sh 가 자동으로 Cloudflare Pages 배포 트리거
```

## 롤백 판단 기준

다음 중 하나라도 해당하면 즉시 롤백:

- 에러율 > 1% (5분 이상 지속)
- p95 latency > 5s
- 결제/인증 엔드포인트 연속 실패
- Sentry 에서 새로운 critical 에러 급증

## 카나리 체크리스트

배포 전:
- [ ] 스테이징에서 로드 테스트 통과 (`k6 run tests/load/critical-paths.js`)
- [ ] TypeScript 에러 0 (`npx tsc --noEmit --skipLibCheck`)
- [ ] npm audit high/critical 0 (`bash scripts/check-npm-audit.sh`)

배포 중 (10% 단계):
- [ ] 에러율 < 0.1% (10분)
- [ ] p95 < 2s (10분)
- [ ] 결제 플로우 정상

배포 완료 후:
- [ ] `curl -I https://live.ur-team.com/api/health` → 200
- [ ] Rate limit 헤더 존재 확인
- [ ] Sentry 에서 새 에러 없음
