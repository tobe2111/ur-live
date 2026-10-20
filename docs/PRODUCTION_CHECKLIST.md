## 트래픽 급증 대응 체크리스트

### 1. 상시 모니터링
- [ ] Sentry 대시보드 (에러 비율)
- [ ] Cloudflare Analytics (요청 수, CPU, 대역폭)
- [ ] /admin/health 페이지 (주문/결제 처리량)

### 2. 조기 경보 (자동화)
- [ ] Sentry alert: error rate > 1% → Slack
- [ ] Cloudflare alert: 5xx > 10/min → Slack
- [ ] 결제 확정 지연 10분 → Slack

### 3. 대응 절차
1. /admin/health 확인
2. stuck_pending_orders > 10 → 결제 시스템 이슈 가능성
3. failed_webhooks > 5 → Toss 연동 이슈
4. /admin/flags/emergency-mode 활성화 (비핵심 기능 비활성)
5. Sentry에서 패턴 파악

### 4. 복구 후
- emergency-mode 해제
- failed webhook 재처리
- 포스트모템 작성

### 5. 부하 테스트
- `bash scripts/load-test.sh staging` — k6가 있으면 단계적 부하 (50→200→500 VU)
- k6 미설치 시 자동으로 `load-test-curl.sh` 로 폴백 (200 요청, 20 동시)
- 프로덕션 테스트는 `bash scripts/load-test.sh prod` 로 실행 (리허설 시에만 권장)
