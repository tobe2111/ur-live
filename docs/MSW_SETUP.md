# MSW (Mock Service Worker) Setup Guide

## 📚 Overview

이 프로젝트는 **MSW (Mock Service Worker)**를 사용하여 테스트 환경에서 API 요청을 모킹합니다.

**마지막 업데이트**: 2026-03-07

---

## 🎯 왜 MSW인가?

### 기존 방식 vs MSW

| 방식 | 장점 | 단점 |
|------|------|------|
| **axios.mock / fetch.mock** | 간단 | 네트워크 레벨 검증 불가, 설정 복잡 |
| **MSW** | 네트워크 레벨 모킹, 실제와 유사, 재사용 가능 | 초기 설정 필요 |

### MSW의 장점

1. **실제와 동일한 네트워크 요청**: 실제 API 호출과 동일하게 작동
2. **재사용 가능**: 유닛 테스트, 통합 테스트, E2E 테스트 모두 사용 가능
3. **브라우저와 Node.js 모두 지원**: 개발 환경과 테스트 환경 모두 사용
4. **간단한 설정**: 핸들러만 정의하면 자동으로 요청 인터셉트

---

## 🛠️ 설치

### 1. MSW 설치

```bash
npm install -D msw@latest
```

**현재 버전**: `msw@2.x` (최신)

---

## 📁 프로젝트 구조

```
tests/
├── mocks/
│   ├── handlers.ts      # API 핸들러 정의
│   └── server.ts        # MSW 서버 설정
└── setup.ts             # 테스트 환경 설정 (MSW import)
```

---

## 🔧 설정 파일

### 1. handlers.ts

**목적**: API 엔드포인트와 응답 정의

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Products API
  http.get('/api/products', () => {
    return HttpResponse.json({
      products: [/* mock data */],
      total: 10,
    });
  }),

  // User API
  http.get('/api/user/profile', () => {
    return HttpResponse.json({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
    });
  }),

  // Error 응답 예시
  http.get('/api/error', () => {
    return new HttpResponse(null, { status: 500 });
  }),
];
```

### 2. server.ts

**목적**: Node.js 환경에서 MSW 서버 실행

```typescript
// tests/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// 모든 테스트 전에 서버 시작
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// 각 테스트 후 핸들러 리셋
afterEach(() => server.resetHandlers());

// 모든 테스트 후 서버 종료
afterAll(() => server.close());
```

### 3. setup.ts

**목적**: Vitest 설정 파일에 MSW 통합

```typescript
// tests/setup.ts
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// MSW 서버 Import (자동으로 beforeAll/afterEach/afterAll 실행)
import './mocks/server';

// ... 나머지 설정
```

---

## 📝 사용 방법

### 1. 기본 사용

MSW는 이미 설정되어 있으므로, 테스트에서 **별도 설정 없이** API 호출이 자동으로 모킹됩니다.

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProductList } from '@/components/ProductList';

describe('ProductList', () => {
  it('fetches and displays products', async () => {
    render(<ProductList />);
    
    // MSW가 자동으로 /api/products 요청을 가로채서 모킹
    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument();
    });
  });
});
```

### 2. 특정 테스트에서 핸들러 오버라이드

```typescript
import { server } from '@/tests/mocks/server';
import { http, HttpResponse } from 'msw';

it('handles error state', async () => {
  // 이 테스트에서만 에러 응답 반환
  server.use(
    http.get('/api/products', () => {
      return new HttpResponse(null, { status: 500 });
    })
  );
  
  render(<ProductList />);
  
  await waitFor(() => {
    expect(screen.getByText(/에러가 발생했습니다/)).toBeInTheDocument();
  });
});
```

### 3. 응답 지연 시뮬레이션

```typescript
import { delay } from 'msw';

server.use(
  http.get('/api/products', async () => {
    await delay(2000); // 2초 지연
    return HttpResponse.json({ products: [] });
  })
);
```

### 4. 동적 응답

```typescript
http.get('/api/products/:id', ({ params }) => {
  const { id } = params;
  
  if (id === '999') {
    return new HttpResponse(null, { status: 404 });
  }
  
  return HttpResponse.json({
    id: Number(id),
    name: `Product ${id}`,
  });
});
```

---

## 🗂️ 현재 정의된 API 핸들러

### Products API
- `GET /api/products` - 상품 목록 조회
- `GET /api/products/:id` - 상품 상세 조회

### User API
- `GET /api/user/profile` - 사용자 프로필 조회
- `PUT /api/user/profile` - 사용자 프로필 수정

### Orders API
- `GET /api/orders` - 주문 목록 조회
- `GET /api/orders/:id` - 주문 상세 조회

### Cart API
- `GET /api/cart` - 장바구니 조회
- `POST /api/cart` - 장바구니 추가
- `PUT /api/cart/:id` - 장바구니 수정
- `DELETE /api/cart/:id` - 장바구니 삭제

### Wishlist API
- `GET /api/wishlists` - 위시리스트 조회
- `POST /api/wishlists` - 위시리스트 추가
- `DELETE /api/wishlists/:id` - 위시리스트 삭제

### Search API
- `GET /api/search?q=query` - 상품 검색

### 기타
- `GET /api/error` - 에러 응답 테스트용
- `GET /api/slow` - 지연 응답 테스트용 (2초)

---

## ➕ 새로운 핸들러 추가하기

### 1. handlers.ts에 핸들러 추가

```typescript
// tests/mocks/handlers.ts
export const handlers = [
  // ... 기존 핸들러

  // 새로운 API 엔드포인트
  http.post('/api/checkout', async ({ request }) => {
    const body = await request.json();
    
    return HttpResponse.json(
      {
        success: true,
        orderId: 'ORD-12345',
        ...body,
      },
      { status: 201 }
    );
  }),
];
```

### 2. Mock 데이터 정의

```typescript
// Mock data at the top of handlers.ts
const mockPayments = [
  {
    id: 1,
    amount: 50000,
    status: 'completed',
    method: 'card',
  },
];

// Use in handler
http.get('/api/payments', () => {
  return HttpResponse.json({ payments: mockPayments });
});
```

---

## 🧪 테스트 실행

### 1. 모든 테스트 실행
```bash
npm test
```

### 2. Watch 모드
```bash
npm run test:watch
```

### 3. 커버리지 포함
```bash
npm run test:unit:coverage
```

MSW는 자동으로 모든 테스트에서 작동하므로 별도 설정이 필요 없습니다.

---

## 🐛 문제 해결

### 1. "Unhandled request" 경고

**문제**: 정의되지 않은 API 요청이 발생할 때 경고

**해결**:
1. `handlers.ts`에 해당 엔드포인트 추가
2. 또는 `server.ts`에서 `onUnhandledRequest: 'bypass'` 설정

```typescript
beforeAll(() => 
  server.listen({ onUnhandledRequest: 'bypass' })
);
```

### 2. 핸들러가 작동하지 않음

**확인사항**:
1. `tests/setup.ts`에 `import './mocks/server'` 있는지 확인
2. 엔드포인트 경로가 정확한지 확인 (`/api/products` vs `/products`)
3. HTTP 메서드가 일치하는지 확인 (GET, POST, PUT, DELETE)

### 3. TypeScript 에러

**문제**: `HttpResponse` 타입 에러

**해결**:
```typescript
// 올바른 import
import { http, HttpResponse } from 'msw';

// 잘못된 import (구버전)
import { rest } from 'msw'; // ❌ deprecated
```

---

## 📊 테스트 통계

**MSW 설정 완료 후**:
- **총 테스트**: 400개 (100% 통과)
- **평균 실행 시간**: 18.77초
- **API 모킹**: 모든 API 요청 자동 처리

---

## 🔗 참고 자료

- [MSW 공식 문서](https://mswjs.io/)
- [MSW v2 마이그레이션 가이드](https://mswjs.io/docs/migrations/1.x-to-2.x)
- [MSW GitHub](https://github.com/mswjs/msw)
- [Testing Library with MSW](https://testing-library.com/docs/react-testing-library/example-intro#mocking-http-requests)

---

## 📝 다음 단계

1. **통합 테스트 작성**: MSW를 활용한 API 통합 테스트
2. **E2E 테스트**: Playwright + MSW
3. **개발 환경 모킹**: 브라우저에서도 MSW 사용 (선택사항)

---

**작성자**: AI Development Team  
**버전**: 1.0.0  
**최종 업데이트**: 2026-03-07
