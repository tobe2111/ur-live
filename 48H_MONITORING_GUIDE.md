# 📊 48시간 모니터링 포인트

**목적**: 배포 후 초기 48시간 동안 집중 모니터링으로 숨은 에러 조기 발견

---

## ⏰ **모니터링 타임라인**

```
Hour 0  (배포 직후)  → 즉시 체크 (30분)
Hour 1-2           → 집중 모니터링 (매 30분)
Hour 3-6           → 주기적 체크 (매 1시간)
Hour 7-24          → 정기 체크 (매 3시간)
Hour 25-48         → 일일 체크 (아침/저녁)
```

---

## 🔥 **Hour 0: 배포 직후 (30분 집중)**

### **1. 즉시 확인 (5분 이내)**

#### **A. 사이트 접근 테스트**
```bash
# 1. 기본 페이지 로드 확인
curl -I https://live.ur-team.com
# Expected: 200 OK

# 2. 주요 페이지 응답 시간
curl -w "@curl-format.txt" -o /dev/null -s https://live.ur-team.com/login
curl -w "@curl-format.txt" -o /dev/null -s https://live.ur-team.com/register

# 3. API health check
curl https://live.ur-team.com/api/health
```

**예상 결과**:
- Status: 200 OK
- Response time: < 2초
- No 500/502 errors

#### **B. Console 에러 체크**
```javascript
// 브라우저 DevTools Console에서
// 1. 로그인 페이지 로드
// 2. 에러 메시지 확인 (빨간색)
// 3. 특히 이것들 체크:
//    - "useAuth is not a function" ❌
//    - "Cannot read property 'user' of undefined" ❌
//    - "Maximum update depth exceeded" ❌ (무한 루프)
```

**정상 로그**:
```
[Vite] connected
[Sentry] ✅ Initialized for kr
[useAuthKR] 🔄 Initializing auth
[useAuthKR] ✅ Auth ready
```

---

### **2. Critical Path 테스트 (10분)**

#### **✅ Must Pass (하나라도 실패하면 롤백)**

| Test | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| Login Page | 접근 | 3초 이내 로드 | - | ⏳ |
| Kakao Login | 클릭 | Redirect 정상 | - | ⏳ |
| Email Login | 입력 후 Submit | Dashboard로 이동 | - | ⏳ |
| Logout | 클릭 | Login 페이지 이동 | - | ⏳ |
| Protected Route | /checkout (로그아웃 상태) | /login 리다이렉트 | - | ⏳ |

**실패 시 즉시 롤백!**

---

### **3. Sentry Dashboard 확인 (5분)**

**접속**: https://sentry.io → Projects → ur-live

#### **초기 체크 항목**:

```
Issues (에러 목록):
├─ 🔴 Critical: 0 expected (즉시 조사)
├─ 🟡 Warning: < 5 acceptable
└─ 🟢 Info: any

Performance:
├─ LCP (Largest Contentful Paint): < 2.5s
├─ FID (First Input Delay): < 100ms
└─ CLS (Cumulative Layout Shift): < 0.1

Transactions:
├─ /login: < 2s
├─ /checkout: < 3s
└─ /seller: < 2s
```

**알람 설정 확인**:
- [ ] Slack 알림 테스트 (테스트 에러 발생시켜보기)
- [ ] Email 알림 설정 확인

---

### **4. 실사용자 피드백 준비 (10분)**

#### **A. 모니터링 링크 준비**

```markdown
# 배포 알림 템플릿 (Slack/Discord)

🚀 **UR Live 배포 완료** (2026-03-05 12:00)

📍 **버전**: Phase 3 & 4 Complete (Zustand 마이그레이션)
🔗 **사이트**: https://live.ur-team.com
📊 **모니터링**: https://sentry.io/ur-live

✅ **주요 변경사항**:
- AuthContext → Zustand 마이그레이션 완료
- 성능 개선 (70% re-render 감소)
- 코드 정리 (11,771 lines 삭제)

🧪 **테스트 부탁**:
1. 카카오 로그인 테스트
2. 장바구니 → 결제 플로우
3. 이상한 점 발견 시 즉시 보고!

🐛 **버그 제보**: #tech-bugs 채널
⏰ **집중 모니터링**: 48시간
```

#### **B. 빠른 롤백 준비**

```bash
# 이전 버전 커밋 해시 기록
git log --oneline -5

# 예: beee06a (Phase 3 완료) ← 이전 안정 버전
```

---

## 🕐 **Hour 1-2: 집중 모니터링 (매 30분)**

### **체크 항목**:

#### **1. Sentry Issues**
```
New Errors:
├─ 0 issues → ✅ Perfect
├─ 1-3 issues → ⚠️ 조사
└─ 4+ issues → 🚨 Alert!
```

**체크 내용**:
- Error message
- Stack trace (어디서 발생?)
- Breadcrumbs (사용자가 무엇을 했는지)
- Affected users (몇 명?)
- Frequency (얼마나 자주?)

#### **2. Cloudflare Analytics**

**접속**: https://dash.cloudflare.com → Analytics

```
Requests:
├─ Status 200: > 95%
├─ Status 4xx: < 3%
└─ Status 5xx: < 1%

Response Time:
├─ p50: < 500ms
├─ p95: < 2s
└─ p99: < 5s
```

**알람 조건**:
- 5xx errors > 10 in 5 minutes → 🚨
- Response time p95 > 5s → ⚠️

#### **3. 사용자 행동 패턴**

```javascript
// Sentry Breadcrumbs에서 확인
Top User Flows:
1. / → /login → (kakao) → /user/profile
2. / → /browse → /product/123 → /checkout
3. / → /seller/login → /seller

Anomalies (이상 패턴):
- Login loop (user stuck)
- Repeated 401 errors
- Checkout abandonment
```

---

## 🕒 **Hour 3-6: 주기적 체크 (매 1시간)**

### **모니터링 대시보드 체크리스트**:

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **Sentry Issues** | < 5 | - | ⏳ |
| **Error Rate** | < 0.1% | - | ⏳ |
| **Avg Response Time** | < 1s | - | ⏳ |
| **Auth Success Rate** | > 95% | - | ⏳ |
| **Checkout Completion** | > 60% | - | ⏳ |

### **특별 관찰 항목**:

#### **1. Kakao 로그인 성공률**
```
Success: login_success events
Failure: login_failure events

Success Rate = Success / (Success + Failure) * 100%
Target: > 95%
```

#### **2. Seller JWT 인증**
```
Check:
- JWT 토큰 만료 에러 (401)
- Invalid token 에러
- Seller dashboard load failures
```

#### **3. Route Guard 리다이렉트**
```
Normal:
- /checkout (not logged in) → /login ✅

Abnormal:
- /login → /checkout → /login → ... (loop) ❌
```

---

## 🕕 **Hour 7-24: 정기 체크 (매 3시간)**

### **체크 포인트**:

#### **오전 (09:00)**
- [ ] Sentry Issues 리뷰 (밤새 쌓인 에러)
- [ ] Slack #tech-bugs 채널 체크
- [ ] 사용자 피드백 확인

#### **점심 (12:00)**
- [ ] Cloudflare Analytics 트래픽 확인
- [ ] 성능 메트릭 (LCP, FID, CLS)
- [ ] API 응답 시간

#### **오후 (15:00)**
- [ ] Sentry Issues 새로운 에러
- [ ] 특이 사용자 행동 패턴
- [ ] Checkout 완료율

#### **저녁 (18:00)**
- [ ] 피크 시간 트래픽 처리
- [ ] Error spike 체크
- [ ] 성능 저하 확인

#### **밤 (21:00)**
- [ ] 일일 요약 작성
- [ ] Critical issues 해결 확인
- [ ] 다음 날 모니터링 계획

---

## 📅 **Hour 25-48: 일일 체크**

### **Day 2 모니터링**:

#### **아침 체크 (09:00)**
```
Daily Report:
├─ Total Errors: < 50
├─ Critical Issues: 0
├─ Auth Success Rate: > 95%
├─ Avg Response Time: < 1s
└─ User Complaints: 0
```

#### **저녁 체크 (18:00)**
```
Performance Trends:
├─ Error rate: Stable or decreasing
├─ Response time: Consistent
├─ User engagement: Normal
└─ No new critical issues
```

---

## 🎯 **핵심 메트릭 (KPIs)**

### **24시간 목표**:

| KPI | Target | Critical Threshold |
|-----|--------|--------------------|
| **Uptime** | 99.9% | < 99% → 🚨 |
| **Error Rate** | < 0.1% | > 0.5% → 🚨 |
| **Auth Success** | > 95% | < 90% → 🚨 |
| **Avg Response** | < 1s | > 3s → ⚠️ |
| **5xx Errors** | < 10 | > 50 → 🚨 |

### **48시간 목표**:

```
Stability Check:
✅ No critical issues for 24h
✅ Error rate declining
✅ No user complaints
✅ Performance stable
✅ All tests passing

→ Migration SUCCESS 🎉
```

---

## 📊 **모니터링 도구 체크리스트**

### **필수 도구**:

- [ ] **Sentry Dashboard** (에러 추적)
  - 링크: https://sentry.io/ur-live
  - 알림: Slack #tech-alerts

- [ ] **Cloudflare Analytics** (트래픽, 성능)
  - 링크: https://dash.cloudflare.com
  - 메트릭: Requests, Response Time, Errors

- [ ] **Browser DevTools** (실시간 디버깅)
  - Console: 에러 로그
  - Network: API 호출
  - Performance: 렌더링

- [ ] **Slack/Discord** (사용자 피드백)
  - 채널: #tech-bugs, #user-feedback

---

## 🔔 **알람 설정**

### **Critical Alerts (즉시 대응)**:

```yaml
Alert Rules:
  - name: High Error Rate
    condition: error_count > 20 in 5 minutes
    action: Slack @team-lead, PagerDuty
    
  - name: Service Down
    condition: 5xx_errors > 50 in 1 minute
    action: Slack @on-call, PagerDuty HIGH
    
  - name: Auth Failure Spike
    condition: login_failure > 10 in 5 minutes
    action: Slack #tech-alerts
```

### **Warning Alerts (모니터링)**:

```yaml
Warning Rules:
  - name: Slow Response
    condition: p95_response_time > 3s
    action: Slack #tech-monitoring
    
  - name: Error Increase
    condition: error_rate increase > 50%
    action: Slack #tech-monitoring
```

---

## ✅ **48시간 완료 체크리스트**

- [ ] 0시간: 배포 직후 즉시 테스트 완료
- [ ] 1-2시간: 집중 모니터링, 에러 없음
- [ ] 3-6시간: 주기적 체크, 안정적
- [ ] 7-24시간: 정기 체크, 정상
- [ ] 25-48시간: 일일 체크, 문제 없음
- [ ] Sentry: < 50 total errors
- [ ] Cloudflare: > 99% uptime
- [ ] 사용자 피드백: No complaints
- [ ] 성능: Stable or improved

**✅ All checked → Migration SUCCESS 🎉**

---

**다음 단계**: 에러 발생 시 빠른 대응 플로우 📋
