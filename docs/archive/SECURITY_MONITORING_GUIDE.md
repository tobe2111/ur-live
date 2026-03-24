# 보안 모니터링 & 에러 트래킹 설정 가이드

## 📋 개요

이 가이드는 UR LIVE 프로젝트에서 다음 기능을 설정하는 방법을 설명합니다:
1. **Discord Webhook 보안 모니터링** - 실시간 로그인 알림 및 보안 이벤트
2. **Sentry 에러 트래킹** - 프론트엔드 에러 수집 및 모니터링

---

## 1️⃣ Discord Webhook 보안 모니터링

### 📊 감지 기능
- ✅ **로그인 성공** (관리자만)
- ⚠️ **로그인 실패** (비밀번호 오류, 존재하지 않는 계정)
- 🚨 **의심스러운 로그인**:
  - 5분 내 3회 이상 로그인 실패
  - 비정상적인 User Agent (봇, 스크립트)
  - 관리자 로그인 (항상 알림)
- ❌ **JWT 검증 실패**
- 🚫 **Rate Limit 초과**

### 🔧 설정 방법

#### Step 1: Discord Webhook URL 생성

1. Discord 서버 설정 → 연동 → Webhooks
2. "새 Webhook" 클릭
3. Webhook 이름 설정 (예: "UR LIVE Security")
4. Webhook URL 복사

#### Step 2: Cloudflare Pages Secret 설정

```bash
# 프로덕션 환경
npx wrangler pages secret put DISCORD_WEBHOOK_URL --project-name ur-live
# 입력 프롬프트가 나오면 Webhook URL 붙여넣기
```

#### Step 3: 로컬 개발 환경 설정 (선택사항)

`.dev.vars` 파일에 추가:
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

⚠️ **주의**: `.dev.vars`는 절대 Git에 커밋하지 마세요!

### 📤 알림 예시

#### ✅ 로그인 성공 (관리자)
```
✅ 로그인 성공

사용자가 성공적으로 로그인했습니다.

사용자: admin
사용자 타입: admin
IP 주소: 123.456.789.012
User Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)...
시간: 2026-02-24T09:30:00.000Z
```

#### 🚨 의심스러운 로그인
```
🚨 의심스러운 로그인 감지

⚠️ 5분 내 3회 이상 실패 또는 의심스러운 패턴

사용자: admin
사용자 타입: admin
IP 주소: 123.456.789.012
User Agent: python-requests/2.28.0
시간: 2026-02-24T09:30:00.000Z
최근 실패 횟수: 3
```

### 🛠️ 커스터마이징

`src/lib/discord-monitoring.ts` 파일에서 다음을 수정할 수 있습니다:
- 의심스러운 로그인 감지 기준 (현재: 5분 내 3회 실패)
- 알림 색상 및 제목
- 알림 필드 (IP, User Agent 등)

---

## 2️⃣ Sentry 에러 트래킹

### 📊 수집 데이터
- ✅ **JavaScript 에러** (런타임 에러, unhandled exceptions)
- ✅ **네트워크 에러** (API 호출 실패)
- ✅ **사용자 컨텍스트** (User ID, Email, User Type)
- ✅ **Performance Monitoring** (페이지 로드 시간, API 응답 시간)
- ✅ **Session Replay** (에러 발생 시 사용자 행동 재생)

### 🔧 설정 방법

#### Step 1: Sentry 프로젝트 생성

1. https://sentry.io 에서 계정 생성
2. "Create Project" 클릭
3. 플랫폼: "React" 선택
4. 프로젝트 이름: "ur-live-frontend"
5. DSN (Data Source Name) 복사

예시 DSN:
```
https://abc123def456@o123456.ingest.sentry.io/7890123
```

#### Step 2: 환경 변수 설정

**프로덕션 빌드용 (`.env.production`)**:
```
VITE_SENTRY_DSN=https://abc123def456@o123456.ingest.sentry.io/7890123
VITE_SENTRY_ENVIRONMENT=production
```

**로컬 개발용 (`.env.development` 또는 `.dev.vars`)**:
```
VITE_SENTRY_DSN=  # 비워두면 Mock 모드 (콘솔 로그만)
VITE_SENTRY_ENVIRONMENT=development
```

#### Step 3: 배포

환경 변수 설정 후 빌드 & 배포:
```bash
npm run build
npx wrangler pages deploy dist --project-name ur-live
```

### 📤 Sentry에서 확인 가능한 정보

#### 에러 이벤트
- **에러 메시지**: "Cannot read property 'name' of undefined"
- **스택 트레이스**: 정확한 파일 및 라인 번호
- **사용자 정보**: User ID, Email, User Type
- **브라우저 정보**: Chrome 120.0, Windows 10
- **URL**: https://live.ur-team.com/admin/products
- **Session Replay**: 에러 발생 직전 사용자 행동 비디오

#### 성능 모니터링
- **Page Load**: 평균 2.5초
- **API Calls**: `/api/products` 평균 150ms
- **Slow Transactions**: 3초 이상 걸린 요청 알림

### 🎯 주요 기능

#### 1. 자동 에러 캡처
```tsx
// 자동으로 캡처됨
throw new Error('Something went wrong');
```

#### 2. 수동 에러 캡처
```tsx
import { captureError } from '@/lib/sentry';

try {
  // 코드
} catch (error) {
  captureError(error, {
    component: 'ProductList',
    action: 'fetch_products'
  });
}
```

#### 3. 커스텀 메시지
```tsx
import { captureMessage } from '@/lib/sentry';

captureMessage('User clicked checkout button', 'info');
```

#### 4. 사용자 컨텍스트 (자동 설정)
```tsx
// 로그인 시 자동으로 설정됨 (AuthContext에서 처리)
// 수동 설정:
import { setSentryUser } from '@/lib/sentry';

setSentryUser({
  id: '123',
  email: 'user@example.com',
  username: 'john_doe',
  userType: 'seller'
});
```

### 🚫 필터링 (불필요한 에러 제외)

다음 에러는 Sentry로 전송되지 않습니다:
- ✅ 개발 환경의 모든 에러 (콘솔 로그만)
- ✅ `ResizeObserver` 에러 (브라우저 내부 에러)
- ✅ 네트워크 에러 (사용자 인터넷 문제)

### 📊 샘플링 비율

**Performance Monitoring**: 10% of transactions (비용 절감)
- 1,000개 트랜잭션 중 100개만 Sentry로 전송
- 충분한 샘플 크기로 성능 분석 가능

**Session Replay**:
- 일반 세션: 10% 샘플링
- 에러 발생 세션: 100% 녹화

---

## 🧪 테스트

### Discord 알림 테스트

#### 로그인 실패 테스트
```bash
curl -X POST https://live.ur-team.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "wrong_user", "password": "wrong_pass", "userType": "admin"}'

# Discord에서 "⚠️ 로그인 실패" 알림 확인
```

#### 의심스러운 로그인 테스트 (5분 내 3회 실패)
```bash
for i in {1..3}; do
  curl -X POST https://live.ur-team.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username": "admin", "password": "wrong", "userType": "admin"}'
  sleep 1
done

# Discord에서 "🚨 의심스러운 로그인 감지" 알림 확인
```

#### 관리자 로그인 성공 테스트
```bash
curl -X POST https://live.ur-team.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123", "userType": "admin"}'

# Discord에서 "✅ 로그인 성공" 알림 확인
```

### Sentry 에러 테스트

1. 브라우저에서 https://live.ur-team.com 접속
2. 개발자 콘솔에서 테스트 에러 발생:
```javascript
throw new Error('Sentry test error');
```
3. Sentry 대시보드에서 에러 확인

---

## 🔐 보안 주의사항

### Discord Webhook URL
- ✅ **절대 공개 저장소에 커밋하지 마세요**
- ✅ Cloudflare Pages Secrets로 관리
- ✅ `.dev.vars`는 `.gitignore`에 포함

### Sentry DSN
- ✅ 클라이언트 사이드에 노출되어도 안전 (읽기 전용)
- ✅ 하지만 `.env.production`은 `.gitignore`에 포함 권장

---

## 📈 모니터링 대시보드

### Discord
- 실시간 알림 채널 생성 권장
- 채널 이름: `#security-alerts` 또는 `#ur-live-monitoring`
- 알림 빈도: 로우/미디엄 (관리자 로그인, 의심스러운 패턴만)

### Sentry
- **Issues** 탭: 발생한 에러 목록
- **Performance** 탭: API 응답 시간, 페이지 로드 시간
- **Releases** 탭: 배포 버전별 에러 추적
- **Alerts** 설정: 새 에러 발생 시 이메일/Slack 알림

---

## 🎯 다음 단계

1. **Discord Webhook 설정** (즉시)
   - Webhook URL 생성
   - Cloudflare Pages Secret 설정
   - 테스트 로그인으로 알림 확인

2. **Sentry 프로젝트 생성** (즉시)
   - Sentry 계정 생성
   - DSN 발급
   - 환경 변수 설정 및 배포

3. **모니터링 채널 구성** (1일)
   - Discord 채널 생성 및 권한 설정
   - Sentry Alert 규칙 설정

4. **정기 리뷰** (주간)
   - Discord 알림 패턴 분석
   - Sentry 에러 트렌드 확인
   - 필요 시 감지 기준 조정

---

**작성일**: 2026-02-24  
**작성자**: AI Developer Assistant  
**버전**: 1.0
