# 🚨 에러 발생 시 빠른 대응 플로우

**목적**: 프로덕션 에러 발생 시 빠르고 체계적으로 대응하여 사용자 영향 최소화

---

## ⚠️ **에러 심각도 분류**

### **🔴 Critical (즉시 대응 - 15분 이내)**
- 사이트 전체 다운 (5xx errors)
- 로그인 완전 불가
- 결제 프로세스 차단
- 데이터 손실 위험

### **🟡 High (빠른 대응 - 1시간 이내)**
- 특정 기능 작동 안 됨
- 일부 사용자 로그인 실패
- 성능 심각한 저하 (> 5s)
- 반복적 에러 (> 50회)

### **🟢 Medium (계획된 대응 - 1일 이내)**
- 간헐적 에러 (< 10회)
- UI 버그 (기능은 작동)
- 성능 미세 저하
- 사용자 불편 (우회 가능)

### **⚪ Low (다음 배포 시)**
- 콘솔 warning
- 사소한 UI 이슈
- 드문 edge case

---

## 🔥 **Critical: 즉시 대응 (15분)**

### **Step 1: 상황 파악 (2분)**

```bash
# 1. 사이트 접근 가능 여부
curl -I https://live.ur-team.com
# 200 OK → 사이트 살아있음
# 502/503 → 서버 다운

# 2. Sentry Issues 확인
https://sentry.io/ur-live/issues/
# 에러 메시지, 빈도, 영향받은 사용자 수

# 3. Cloudflare 상태
https://dash.cloudflare.com
# Analytics → 트래픽, 에러율
```

**판단 기준**:
```
5xx errors > 100/min  → 🚨 ROLLBACK
Auth failures > 90%   → 🚨 ROLLBACK
No response (timeout) → 🚨 ROLLBACK
```

---

### **Step 2: 즉시 조치 결정 (3분)**

#### **A. 롤백이 필요한 경우** (즉시 실행)

**조건**:
- 사이트 전체 다운
- 로그인 90% 이상 실패
- 결제 불가
- 데이터베이스 연결 실패

**실행**:
```bash
# 1. 이전 안정 버전으로 롤백
cd /home/user/webapp
git log --oneline -5
# beee06a - Phase 3 complete ← 안전한 버전

# 2. Cloudflare Pages에서 롤백
# Dashboard → Deployments → beee06a 선택 → "Rollback"

# 3. 확인
curl -I https://live.ur-team.com
# 200 OK 확인

# 4. 팀 알림
# Slack: "🚨 긴급 롤백 완료. 이전 안정 버전으로 복구"
```

**예상 시간**: 5분 이내

---

#### **B. 핫픽스가 필요한 경우** (긴급 수정)

**조건**:
- 특정 기능만 문제
- 간단한 수정으로 해결 가능 (< 10 lines)
- 사용자 영향 제한적

**실행**:
```bash
# 1. 에러 원인 파악 (Sentry)
# 예: "Cannot read property 'user' of undefined"
# 위치: src/components/TopNav.tsx:13

# 2. 긴급 수정
# 파일 열어서 null check 추가
const user = useAuth(state => state.user)
const isLoggedIn = user ? !!user : false  // ← null 체크 추가

# 3. 빠른 테스트
npm run build:kr
# 로컬에서 확인

# 4. 커밋 & 푸시
git add -A
git commit -m "hotfix: Add null check in TopNav"
git push origin main

# 5. Cloudflare 자동 배포 대기 (2-3분)

# 6. 배포 확인
curl https://live.ur-team.com
# Sentry에서 에러 사라짐 확인
```

**예상 시간**: 10-15분

---

### **Step 3: 사용자 알림 (2분)**

```markdown
# Slack/Discord 긴급 알림

🚨 **긴급 공지**

**상황**: [문제 설명]
예: 카카오 로그인 일시 불가

**영향**: [영향 범위]
예: 신규 사용자 로그인 불가 (기존 로그인 사용자는 정상)

**조치**: [대응 상황]
예: 긴급 수정 중, 5분 내 복구 예정

**우회 방법**: [임시 해결책]
예: 이메일 로그인 사용 가능

**업데이트**: 복구 완료 시 재공지

담당: @tech-team
시각: 2026-03-05 14:30
```

---

### **Step 4: 모니터링 강화 (8분)**

```bash
# 1. Sentry 실시간 모니터링
watch -n 30 "curl -s https://sentry.io/api/0/projects/ur-live/issues/?statsPeriod=1h | jq '.[] | {title, count}'"

# 2. Cloudflare 에러율 체크
# Analytics → Real-time view

# 3. 사용자 피드백 확인
# Slack #tech-bugs 채널 주시

# 4. 로그 tail
# Cloudflare Logs 확인
```

---

## 🟡 **High Priority: 빠른 대응 (1시간)**

### **Step 1: 에러 분석 (15분)**

#### **A. Sentry Issue 상세 분석**

```
Issue Details:
├─ Error Message: "User is not defined"
├─ Stack Trace:
│  ├─ TopNav.tsx:13
│  ├─ App.tsx:45
│  └─ index.tsx:20
├─ Breadcrumbs (사용자 행동):
│  ├─ 1. Page load: /
│  ├─ 2. Click: Login button
│  ├─ 3. Navigate: /login
│  └─ 4. Error: TopNav render
├─ User Context:
│  ├─ Browser: Chrome 120
│  ├─ OS: Windows 10
│  └─ User ID: (not logged in)
└─ Frequency: 15 times in 30 minutes
```

#### **B. 재현 시도**

```bash
# 1. 로컬 환경에서 재현
npm run dev

# 2. 동일한 시나리오 수행
# - 로그아웃 상태
# - / 페이지 접근
# - Login 버튼 클릭

# 3. Console 에러 확인
# 4. Stack trace 비교
```

---

### **Step 2: 수정 계획 (10분)**

#### **수정 방안 결정**:

```
Option A: 즉시 수정 (hotfix)
- 조건: 간단한 버그 (< 30 lines)
- 시간: 30분
- 위험: Low

Option B: 우회 방법 제공
- 조건: 복잡한 수정 필요
- 시간: 1-2일
- 위험: User inconvenience

Option C: 기능 비활성화
- 조건: 치명적 버그, 대안 없음
- 시간: 즉시
- 위험: Feature loss
```

**선택 기준**:
```
영향 사용자 > 100  → Option A (즉시 수정)
영향 사용자 < 100  → Option B (우회 제공)
보안 이슈         → Option C (비활성화)
```

---

### **Step 3: 수정 구현 (25분)**

#### **예제: TopNav null check 추가**

```typescript
// ❌ Before (에러 발생)
const user = useAuth(state => state.user)
const isLoggedIn = !!user

// ✅ After (수정)
const user = useAuth(state => state.user)
const isLoggedIn = user !== null && user !== undefined && !!user

// 또는 더 안전하게
const useAuth = isKorea() ? useAuthKR : useAuthWorld
const user = useAuth(state => state.user) ?? null
const isLoggedIn = Boolean(user)
```

#### **테스트**:
```bash
# 1. 로컬 테스트
npm run dev
# 모든 시나리오 재현

# 2. 빌드 테스트
npm run build:kr
# 에러 없이 빌드 성공

# 3. 커밋
git add src/components/main/TopNav.tsx
git commit -m "fix: Add robust null check in TopNav

- Issue: TypeError when user is undefined
- Root cause: Missing null check in isLoggedIn
- Solution: Added explicit null/undefined check
- Affected: TopNav component
- Impact: Login/logout state display

Fixes #123"
git push origin main
```

---

### **Step 4: 배포 & 검증 (10분)**

```bash
# 1. Cloudflare 자동 배포 대기
# ~2-3분

# 2. 배포 확인
curl -I https://live.ur-team.com

# 3. Sentry 에러 확인
# Issues → "User is not defined" 사라짐

# 4. 실제 테스트
# 브라우저에서 재현 시나리오 수행

# 5. 팀 알림
# Slack: "✅ TopNav null check 수정 완료. 배포 완료."
```

---

## 🟢 **Medium Priority: 계획된 대응 (1일)**

### **프로세스**:

1. **이슈 등록** (GitHub Issue)
```markdown
Title: [Bug] TopNav 로그인 상태 표시 간헐적 오류

Description:
- 증상: 로그인 후에도 간헐적으로 로그아웃 상태 표시
- 빈도: 10회/일
- 영향: 사용자 혼란 (기능은 정상)
- 우선순위: Medium

Steps to reproduce:
1. 로그인
2. 페이지 새로고침
3. TopNav 확인

Expected: 로그인 상태 표시
Actual: 간헐적으로 로그아웃 상태

Sentry: https://sentry.io/issues/123456
```

2. **수정 계획 수립**
   - 원인 분석 (1-2일)
   - 수정 방안 논의
   - 테스트 계획
   - 다음 배포 일정에 포함

3. **정기 배포에 포함**

---

## 🛠️ **디버깅 체크리스트**

### **에러 발생 시 확인 항목**:

#### **1. 환경 변수**
```bash
# Cloudflare Dashboard 확인
VITE_KAKAO_REST_API_KEY=?
VITE_FIREBASE_*=?
VITE_SENTRY_DSN=?

# 누락되면 기능 작동 안 함
```

#### **2. 빌드 로그**
```bash
# 최근 배포 로그 확인
# Cloudflare → Deployments → Latest → View logs

# 빌드 에러 확인
# TypeScript errors
# Missing dependencies
```

#### **3. API 상태**
```bash
# Backend health check
curl https://live.ur-team.com/api/health

# Specific endpoints
curl https://live.ur-team.com/api/users/role
curl https://live.ur-team.com/api/seller/login
```

#### **4. 브라우저 호환성**
```
Tested browsers:
- Chrome latest ✅
- Firefox latest ✅
- Safari latest ✅
- Mobile Safari ✅
- Mobile Chrome ✅
```

#### **5. 네트워크 타임아웃**
```javascript
// API timeout 설정 확인
// src/lib/api.ts
axios.defaults.timeout = 30000  // 30초

// Firebase timeout
// src/lib/firebase.ts
```

---

## 📋 **에러별 대응 가이드**

### **1. "User is not defined"**
```typescript
// 원인: Zustand store 초기화 전 접근
// 해결: isAuthReady 체크 추가

if (!isAuthReady) {
  return <LoadingSpinner />
}

const user = useAuth(state => state.user)
```

### **2. "Maximum update depth exceeded"**
```typescript
// 원인: 무한 리다이렉트 루프
// 해결: isLoading 체크

if (isLoading) {
  return <LoadingSpinner />  // 리다이렉트 차단
}

if (!user) {
  return <Navigate to="/login" />
}
```

### **3. "Kakao is not defined"**
```typescript
// 원인: Kakao SDK 로드 전 접근
// 해결: SDK 로드 확인

const [kakaoReady, setKakaoReady] = useState(false)

useEffect(() => {
  if (window.Kakao && !window.Kakao.isInitialized()) {
    window.Kakao.init(KAKAO_KEY)
    setKakaoReady(true)
  }
}, [])

if (!kakaoReady) {
  return <Button disabled>카카오 로딩 중...</Button>
}
```

### **4. "JWT token expired"**
```typescript
// 원인: Seller JWT 만료 (1시간)
// 해결: 자동 리프레시 또는 재로그인

axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // JWT 만료
      localStorage.clear()
      window.location.href = '/seller/login'
    }
    return Promise.reject(error)
  }
)
```

---

## ✅ **대응 완료 체크리스트**

- [ ] 에러 원인 파악 완료
- [ ] 수정 구현 및 테스트
- [ ] 커밋 & 푸시
- [ ] 배포 확인
- [ ] Sentry에서 에러 사라짐
- [ ] 사용자 테스트 정상
- [ ] 팀 알림 완료
- [ ] 사후 분석 문서 작성
- [ ] 재발 방지 대책 수립

---

**다음**: 장기 안정성 효과 분석 📈
