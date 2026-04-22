# 🏃 1인 운영 플레이북 (Solo Ops Playbook)

유어딜을 1인 사업으로 운영할 때 잠잘 수 있게 해주는 시스템 + 대응 가이드.

---

## 🎯 설계 원칙

1. **Silence is golden** — 문제 없으면 알림 없음
2. **Noisy only when necessary** — 진짜 문제면 즉시 깨움
3. **Self-healing first** — 수동 개입 없이 자동 복구
4. **Observable** — 새벽 3시에도 5분 안에 상황 파악 가능

---

## 🔔 자동 알림 채널 (Discord webhook 기반)

### 언제 알림이 오나

| 상황 | 알림 수준 | 시점 |
|------|----------|------|
| 5xx 1분 10건 스파이크 | 🚨 즉시 | 실시간 |
| DB latency > 500ms | ⚠️ 경고 | 매일 03:00 KST |
| 결제 실패율 > 5% | ⚠️ 경고 | 매일 03:00 KST |
| Secret 누락 | 🔴 긴급 | 매일 03:00 KST |
| Settlement cron 실패 | 🚨 즉시 | 실시간 |
| 전날 모두 정상 | ℹ️ 요약 | 매일 03:00 KST |

### Discord 세팅 (5분)

1. Discord 서버 → 채널 설정 → **통합** → **웹후크 생성**
2. 채널: `#ur-live-alerts` (권장)
3. 이름: `ur-live bot`
4. **웹후크 URL 복사**
5. Cloudflare Pages → ur-live → Settings → Variables and Secrets:
   ```
   DISCORD_WEBHOOK_URL = https://discord.com/api/webhooks/XXX/YYY
   ```
6. 1분 뒤 자동 재배포 → 첫 daily 알림은 다음날 03:00

---

## 🚨 긴급 상황 대응 플레이북

### 🔴 사이트 전체 다운 (500 연속)

**체크 순서 (3분 내):**
1. `/api/health` 접속 → 200 아니면 worker 자체 죽음
2. `/api/version` 접속 → secrets 7개 모두 true 확인
3. `/api/_internal/health-dashboard` → 정확한 원인 파악
4. Cloudflare Dashboard → Pages → ur-live → 최근 Deployments 실패 확인

**복구 옵션:**
- A. **Rollback**: Cloudflare Dashboard → 이전 deployment → "Rollback"
- B. **Emergency kill**: `/api/admin/flags/emergency-mode` (admin 로그인 후)
- C. **Secret 누락이면**: Pages Settings 에서 빠진 secret 재설정

---

### 🟡 특정 기능 에러 (ex. 로그인만 안 됨)

1. Discord 알림 내 **X-Request-Id** 확인
2. Cloudflare Dashboard → Workers Logs → Request ID 검색
3. 에러 메시지 확인
4. 해당 라우트 핸들러 디버그

---

### 💳 결제 급증 (공격 의심)

1. `/api/admin/flags/emergency-mode` → `payment_enabled: false`
2. Cloudflare WAF → Rate limiting 규칙 추가
3. Toss Payments Dashboard → 비정상 거래 차단 요청
4. 안정 후 kill switch 해제

---

### 📈 갑자기 트래픽 폭증

1. `/api/_internal/health-dashboard` → DB latency 확인
2. Slow query top 5 확인 → 인덱스 없는 쿼리면 추가
3. Edge cache 적용된 엔드포인트 확인 (`X-Cache-Status: HIT` 비율)
4. 부족하면 `/api/products` TTL 을 60s → 300s 로 증가

---

## 📊 매일 체크할 것 (자동화됨)

**03:00 KST 에 자동 실행 + Discord 알림**:
- DB latency
- Secret 존재 확인
- 전날 주문/결제 통계
- 5xx spike 집계
- 슬로우 쿼리 집계

**→ 알림이 조용하면 정상.** 이상 있을 때만 깨움.

---

## 📅 주간 루틴 (수동, 15분)

매주 월요일 09:00 에:

1. `https://live.ur-team.com/api/_internal/health-dashboard` 열기
2. 다음 지표 확인:
   - DB latency grade: excellent/good 이어야 함
   - Secrets health: complete 이어야 함
   - Last 24h paidOrders / last 24h orders = 전환율 (너무 낮으면 이슈)
   - slowQueriesLast24h: 평상시보다 많으면 조사
3. Cloudflare Analytics → 주간 requests/errors 추이
4. Sentry → 새로운 에러 유형 체크

---

## 📆 월간 루틴 (수동, 30분)

매월 1일:

1. `npm audit` 실행 → 새로운 CVE 있으면 조치
2. `npm outdated` → 주요 의존성 업데이트
3. `.env` 값 리뷰: secret 순환 필요한 것 있는지
4. TECHNICAL_DEBT.md 업데이트
5. Cloudflare 요금 확인 (급증하면 조사)
6. D1 backup 확인

---

## 🛡️ 사고 재발 방지

각 사고 후:
1. **Post-mortem** 짧게라도 작성 (5줄이라도)
2. 원인을 `TECHNICAL_DEBT.md` 또는 `CLAUDE.md` 에 기록
3. 같은 패턴 탐지하는 CI 테스트 추가 (가능하면)

---

## 🎖️ 황금 규칙 (solo founder 용)

1. **자동화 못하는 것은 하지 말라** — 매일 수동으로 체크하는 건 장기 유지 불가능
2. **완벽보다 복구 우선** — 버그는 나온다, 빨리 fix 할 수 있는 구조가 중요
3. **문서가 기억을 대체** — 6개월 뒤 자신이 지금 코드 이해 못 함. 주석/문서 소중
4. **외부 API 의존 최소화** — Toss/Kakao/Firebase 모두 down 될 수 있음
5. **비용은 성장 변수** — 월 요금 시각화 필수
6. **개인 핸드폰 번호로 cron failure 알림 받지 말 것** — 정신건강용

---

## 🆘 응급 연락처

- Cloudflare Support: https://dash.cloudflare.com/?to=/:account/support
- Toss Payments 개발자센터: https://developers.tosspayments.com
- Kakao Developers: https://devtalk.kakao.com
- Firebase: https://firebase.google.com/support

---

## 관련 문서

- `CLAUDE.md` — 개발 규칙
- `TECHNICAL_DEBT.md` — 남은 부채 추적
- `USER_ACTION_CHECKLIST.md` — 오늘 해야 할 Dashboard 작업
- `README.md` — 프로젝트 개요 (있다면)
