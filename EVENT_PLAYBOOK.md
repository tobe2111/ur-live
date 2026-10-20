# 🎯 대형 이벤트 대비 플레이북

동시 1000명 이상 접속이 예상되는 이벤트 (라이브 방송, 프로모션 오픈, 인플루언서 공동구매 등) 진행 시 사용하는 체크리스트.

---

## 📅 D-7 (이벤트 1주 전)

### 1. Load test 실행
```bash
# k6 설치 (한 번만)
brew install k6  # Mac
# or: apt-get install k6  # Linux

# 이벤트 시뮬레이션
BASE_URL=https://live.ur-team.com k6 run tests/load/event-stress-test.js
```

**통과 기준:**
- p95 응답 < 2000ms
- 서버 5xx 에러율 < 1%
- Rate limiter 가 과도 요청 적절히 차단하는지 (429 응답 확인)

**실패 시 조치:**
- p95 초과: edge cache TTL 확장 (`app.use('/api/products', edgeCache(120))`)
- 5xx 많음: Slow query 확인 `/api/_internal/health-dashboard`
- 거의 0 429: rate limiter 너무 느슨함 — max 값 낮춤

### 2. 인프라 상태 확인
```
https://live.ur-team.com/api/version
```
- `secrets` 모두 `true` 인지
- `version` 이 최신 hash 인지

```
https://live.ur-team.com/api/_internal/health-dashboard
```
- `db.latencyGrade` = `excellent` 또는 `good`
- `secrets.health` = `complete`

### 3. DB 스키마 확정
```
https://live.ur-team.com/api/_internal/repair-schema
```
- 누락된 컬럼/테이블 전부 `exists` 여야 함
- `added` 나오면 이번 기회에 추가됨을 확인

### 4. 백업 확인
- 최근 D1 백업 존재 여부 확인
- 사용자별로 중요 데이터 export 보관 권장

---

## 📅 D-1 (이벤트 전날)

### 1. 트래픽 제한 조정
평상시 rate limit 이 이벤트엔 너무 빡빡할 수 있음:
```
/api/products — rate limit 60/60s → 이벤트 시 문제 없음 (edge cache HIT)
/api/auth/login — 10/300s → 유지 (공격 방지)
/api/orders POST — 상황에 따라 조정
```

### 2. 알림 채널 활성화
- Discord `DISCORD_WEBHOOK_URL` 설정 확인
- 테스트 알림 발송: 브라우저에서 `/api/admin/flags/emergency-mode` 호출하며 확인

### 3. Emergency Mode 훈련
**테스트 순서 (실제 토글하지 말 것 — 문서 숙지만):**
1. 어드민 로그인
2. `POST /api/admin/flags/emergency-mode` body `{"enable": true}` 
3. → 리뷰/채팅/푸시/실시간 시청자 수 **off**
4. → 결제/로그인/장바구니는 **계속 작동**
5. 안정화되면 `{"enable": false}` 로 복귀

**이벤트 당일 활성화 조건:**
- 5xx 에러 1분에 50건 이상
- DB latency 1초 이상 지속
- Slow query 가 모든 요청의 20% 이상

---

## 📅 D-Day (이벤트 당일)

### T-30분: 마지막 점검
```
1. https://live.ur-team.com/api/_internal/smoke-test 실행 → 모두 5xx 0
2. https://live.ur-team.com/api/_internal/health-dashboard 확인
3. Discord 채널 연결 상태 확인 (테스트 메시지)
4. 어드민 대시보드 로그인 준비
```

### T-10분: 마지막 대기
- 브라우저 탭 3개 준비:
  1. Health dashboard (주기적 새로고침)
  2. Discord (알림 대기)
  3. 어드민 feature flags 페이지 (kill switch 대기)

### T-0: 이벤트 시작
**모니터링 4가지:**

| 지표 | 기준 | 위험 시 조치 |
|------|------|------------|
| 5xx 에러율 | <1% | Emergency mode 토글 |
| DB latency | <500ms | Edge cache 확인 |
| 응답 시간 p95 | <2s | 트래픽 줄 때까지 대기 |
| Rate limit 429 | 정상 (공격 차단) | 수치 참고만 |

### 이벤트 중 — 실시간 대응

**🟡 경고 (관찰 강화):**
- 5xx 에러율 0.5~1%
- DB latency 200~500ms

→ 계속 모니터링. 10분 내 호전되지 않으면 조치.

**🔴 비상 (즉시 대응):**
- 5xx 에러율 > 1%
- DB latency > 1s 지속
- Discord 긴급 알림 발생

**조치 순서:**
1. **Emergency Mode 활성화** (1분 내 전파):
   ```
   POST /api/admin/flags/emergency-mode
   Body: {"enable": true}
   ```
2. **영향:** 리뷰, 채팅, 검색 자동완성, 실시간 시청자 수 OFF
3. **유지:** 결제, 로그인, 장바구니, 주문은 계속 작동
4. **효과:** D1 부하 ~50% 감소, 핵심 기능 보존

5. **그래도 안 되면:**
   - Cloudflare Dashboard → Pages → ur-live → **Rollback** 이전 배포로
   - 또는 특정 문제 엔드포인트 찾아서 해당 feature 만 추가 비활성화

### 이벤트 종료 후: 정상화
```
POST /api/admin/flags/emergency-mode
Body: {"enable": false}
```

---

## 📅 D+1 (이벤트 다음날)

### 1. 리뷰
`/api/_internal/health-dashboard` 에서:
- 전날 주문: 얼마나 증가?
- 결제 전환율: 평소 대비?
- 5xx spike: 몇 번 발생?
- Slow query: 어떤 쿼리가 느렸나?

### 2. Post-mortem 작성 (장애 있었을 경우)
5줄이라도 기록:
```
- 이벤트: [이름]
- 일시: YYYY-MM-DD HH:MM
- 피크 VUs: [숫자]
- 발생한 이슈: [설명]
- 대응: [무엇을 했나]
- 교훈: [다음 이벤트에 적용할 것]
```

### 3. 기술 부채 반영
발견된 병목은 `TECHNICAL_DEBT.md` 에 추가.

---

## 🎚 긴급 비상 연락처

- Cloudflare Support: https://dash.cloudflare.com/?to=/:account/support
- Toss Payments: https://developers.tosspayments.com
- Kakao Developers: https://devtalk.kakao.com

---

## ⚙️ 자동화된 안전망 (이미 배치됨)

이벤트 중 **자동으로** 작동하는 것:
- 5xx 1분 10건 이상 → Discord 즉시 알림
- Slow query 200ms 초과 → 자동 기록
- Rate limiter → 악성 트래픽 자동 차단
- Circuit breaker → 외부 API 장애 전파 방지
- Edge cache → D1 부하 80% 우회
- Daily self-diagnostic → 다음 날 자동 리포트

**→ 사용자가 할 일: 모니터링 + Emergency mode 판단.**

---

## 🏁 성공 기준

이벤트가 끝났을 때:
- [ ] 5xx 에러율 < 1%
- [ ] 결제 성공률 > 95%
- [ ] p95 응답 시간 < 2s
- [ ] Discord 긴급 알림 < 3회
- [ ] Post-mortem 작성 (장애 있었다면)

위 5개 모두 충족 = 완벽한 이벤트 ✅
