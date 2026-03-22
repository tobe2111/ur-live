# 📊 Sentry 이벤트 추적 사용 가이드

> **작성일**: 2026-03-06
> **파일**: `src/lib/sentry-events.ts`
> **목적**: 비즈니스 로직의 핵심 이벤트를 Sentry에 자동 추적

---

## 🎯 개요

`SentryEvents` 서비스는 애플리케이션의 중요한 비즈니스 이벤트를 자동으로 Sentry에 전송하여 실시간 모니터링과 분석을 가능하게 합니다.

### 추적되는 이벤트 카테고리
- 🔐 **인증**: 로그인/로그아웃
- 💳 **결제**: 결제 시도/성공/실패
- 📺 **라이브 스트리밍**: 방송 시작/종료/에러
- 📊 **성능**: 페이지 로드, API 응답 시간
- 🛒 **커머스**: 장바구니, 주문 생성/취소

---

## 📖 사용 방법

### 1️⃣ 로그인 플로우에 추적 추가

```typescript
// src/features/auth/login-flow.service.ts
import { SentryEvents } from '@/lib/sentry-events';

export const LoginFlowService = {
  async loginWithKakaoToken(accessToken: string): Promise<void> {
    // 1. 로그인 시도 추적
    SentryEvents.loginAttempt('kakao');
    
    try {
      const { customToken, user } = await api.post('/api/auth/kakao/firebase', { accessToken });
      await signInWithCustomToken(auth, customToken);
      
      // 2. 로그인 성공 추적
      SentryEvents.loginSuccess('kakao', user.id);
      
      await getIdToken(auth.currentUser!, true);
    } catch (error) {
      // 3. 로그인 실패 추적
      SentryEvents.loginFailure('kakao', error as Error);
      throw error;
    }
  },

  async loginSeller(email: string, password: string) {
    SentryEvents.loginAttempt('seller');
    
    try {
      const { token, seller } = await api.post('/api/auth/seller/login', { email, password });
      localStorage.setItem('seller_token', token);
      
      SentryEvents.loginSuccess('seller', seller.id);
      
      return { token, seller };
    } catch (error) {
      SentryEvents.loginFailure('seller', error as Error);
      throw error;
    }
  },

  async logout(): Promise<void> {
    const user = auth.currentUser;
    if (user) {
      SentryEvents.logout(user.uid, 'user');
    }
    
    await signOut(auth);
    // ... 나머지 로그아웃 로직
  }
};
```

### 2️⃣ 결제 플로우에 추적 추가

```typescript
// src/features/payments/services/payment.service.ts
import { SentryEvents } from '@/lib/sentry-events';

export async function processTossPayment(orderId: string, amount: number) {
  // 1. 결제 시도 추적
  SentryEvents.paymentAttempt('toss', amount, orderId);
  
  try {
    const result = await tossPayments.requestPayment({
      amount,
      orderId,
      orderName: 'UR Live 상품 구매'
    });
    
    // 2. 결제 성공 추적
    SentryEvents.paymentSuccess('toss', orderId, amount);
    
    return result;
  } catch (error) {
    // 3. 결제 실패 추적
    SentryEvents.paymentFailure('toss', error as Error, amount, orderId);
    throw error;
  }
}
```

### 3️⃣ 라이브 스트리밍에 추적 추가

```typescript
// src/features/live/services/stream.service.ts
import { SentryEvents } from '@/lib/sentry-events';

export async function startLiveStream(sellerId: string, title: string) {
  try {
    const stream = await api.post('/api/live-streams', { sellerId, title });
    
    // 라이브 시작 추적
    SentryEvents.liveStreamStart(stream.id, sellerId, title);
    
    return stream;
  } catch (error) {
    SentryEvents.liveStreamError('pending', error as Error);
    throw error;
  }
}

export function endLiveStream(streamId: string, stats: { duration: number; viewerCount: number }) {
  // 라이브 종료 추적
  SentryEvents.liveStreamEnd(streamId, stats.duration, stats.viewerCount);
  
  return api.post(`/api/live-streams/${streamId}/end`, stats);
}
```

### 4️⃣ 페이지 로드 시간 추적

```typescript
// src/pages/LoginPage.tsx
import { useEffect } from 'react';
import { SentryEvents } from '@/lib/sentry-events';

export function LoginPage() {
  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const loadTime = performance.now() - startTime;
      SentryEvents.pageLoad('LoginPage', loadTime);
    };
  }, []);
  
  // ... 나머지 컴포넌트
}
```

### 5️⃣ API 응답 시간 추적

```typescript
// src/lib/api.ts
import axios from 'axios';
import { SentryEvents } from './sentry-events';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
});

// Request interceptor: 요청 시작 시간 기록
api.interceptors.request.use((config) => {
  config.metadata = { startTime: Date.now() };
  return config;
});

// Response interceptor: 응답 시간 추적
api.interceptors.response.use(
  (response) => {
    const duration = Date.now() - response.config.metadata.startTime;
    SentryEvents.apiResponseTime(
      response.config.url || '',
      response.config.method || 'GET',
      duration,
      response.status
    );
    return response;
  },
  (error) => {
    const duration = Date.now() - error.config?.metadata?.startTime;
    SentryEvents.apiResponseTime(
      error.config?.url || '',
      error.config?.method || 'GET',
      duration,
      error.response?.status || 0
    );
    return Promise.reject(error);
  }
);

export default api;
```

---

## 🎨 Sentry 대시보드 설정

### Step 1: Alert Rules 생성

#### 알림 1: 로그인 실패율 높음
```
조건:
- Event: login_failure
- Tag: login_type = *
- Threshold: 10건/5분

알림:
- Slack: #alerts-production
- Email: team@ur-team.com
```

#### 알림 2: 결제 실패 (즉시 알림)
```
조건:
- Event: payment_failure
- Tag: payment_method = *
- Threshold: 1건 (즉시)

알림:
- Slack: #alerts-critical
- Email: ops@ur-team.com
```

#### 알림 3: 느린 페이지 로드
```
조건:
- Message: "Slow page load"
- Level: warning
- Threshold: 5건/10분

알림:
- Slack: #performance
```

### Step 2: 대시보드 위젯 생성

#### 위젯 1: 로그인 성공률
```
Query: count() WHERE event:"login_success" / count() WHERE category:"auth"
Chart: Line (7일간)
```

#### 위젯 2: 결제 성공률
```
Query: count() WHERE event:"payment_success" / count() WHERE category:"payment"
Chart: Bar (24시간)
```

#### 위젯 3: 평균 페이지 로드 시간
```
Query: avg(load_time_ms) WHERE category:"performance"
Chart: Area (7일간)
```

#### 위젯 4: 라이브 스트림 현황
```
Query: count() WHERE event:"live_stream_start" - count() WHERE event:"live_stream_end"
Chart: Number (실시간)
```

---

## 📈 모니터링 체크리스트

### Daily (매일)
- [ ] 로그인 성공률 확인 (목표: >95%)
- [ ] 결제 성공률 확인 (목표: >98%)
- [ ] 평균 페이지 로드 시간 (목표: <2초)

### Weekly (매주)
- [ ] 느린 페이지 TOP 5 확인
- [ ] 느린 API TOP 5 확인
- [ ] 에러 발생 추이 분석

### Monthly (매월)
- [ ] Alert Rule 튜닝
- [ ] 대시보드 위젯 최적화
- [ ] 새로운 추적 이벤트 추가

---

## 🔗 참고 링크

- **Sentry 대시보드**: https://sentry.io/organizations/ur-team/projects/ur-live
- **Slack 채널**: #alerts-production, #performance
- **문서**: `REMAINING_ISSUES_AND_SOLUTIONS.md`

---

**작성자**: Claude (GenSpark AI Developer)
**최종 업데이트**: 2026-03-06
