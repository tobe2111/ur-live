# 로드 테스트

## 파일 구조

| 파일 | 목적 |
|---|---|
| `critical-paths.js` | 핵심 경로 성능 검증 (홈 / 상품 / 스트림 / 헬스 / 인증 가드) |
| `auth-flow.js` | 인증 흐름 (로그인 / 토큰 검증) 부하 테스트 |
| `rate-limiter.js` | Rate limiter 스트레스 테스트 (429 반환 검증) |

## 설치

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# 기타: https://k6.io/docs/get-started/installation/
```

## 실행

```bash
# 핵심 경로 — 프로덕션
k6 run tests/load/critical-paths.js --env BASE_URL=https://live.ur-team.com

# 핵심 경로 — 스테이징 (권장: 프로덕션 배포 전 검증)
k6 run tests/load/critical-paths.js --env BASE_URL=https://ur-live-staging.pages.dev

# 인증 플로우
k6 run tests/load/auth-flow.js --env BASE_URL=https://ur-live-staging.pages.dev

# Rate limiter
k6 run tests/load/rate-limiter.js --env BASE_URL=https://ur-live-staging.pages.dev

# 기존 스크립트 (더 단순한 버전)
bash scripts/load-test.sh staging
bash scripts/load-test.sh prod
```

## 결과 해석

| 지표 | 정상 | 주의 | 즉시 조사 |
|---|---|---|---|
| `http_req_duration p95` | < 2s | 2–5s | > 5s |
| `http_req_failed` | < 1% | 1–5% | > 5% |
| `home_duration p95` | < 500ms | 500ms–1s | > 1s |
| `products_duration p95` | < 200ms | 200–500ms | > 500ms |
| `health_duration p95` | < 50ms | 50–200ms | > 200ms |
| `auth_guard_401` | > 99% | — | < 99% (보안 구멍) |

## 임계값 실패 시 대응

- **p95 > 2s**: Cloudflare Analytics에서 Worker CPU time 확인, D1 쿼리 최적화
- **에러율 > 1%**: Workers 로그 확인 (`wrangler tail --project-name=ur-live`)
- **auth_guard_401 < 99%**: 즉시 API 인증 검사 (`bash scripts/check-api-auth.sh`)

## CI 통합

```yaml
# GitHub Actions 예시
- name: Load test (staging)
  run: |
    brew install k6
    k6 run tests/load/critical-paths.js \
      --env BASE_URL=https://ur-live-staging.pages.dev \
      --out json=load-test-results.json
```
