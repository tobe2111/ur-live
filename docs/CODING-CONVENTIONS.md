# 코딩 컨벤션

## DB 스키마 참조

**모든 SQL 쿼리 작성 전 반드시 `src/shared/db/production-schema.ts`를 참조하세요.**

이 파일은 프로덕션 D1 DB의 실제 테이블 구조를 반영하는 Single Source of Truth입니다.

---

## SQL 작성 규칙

### 올바른 컬럼명 사용

```sql
-- products 테이블
SELECT stock FROM products;          -- O (stock)
SELECT stock_quantity FROM products; -- X (존재하지 않는 컬럼!)

SELECT is_active FROM products;      -- O (is_active, 0 또는 1)
SELECT status FROM products;         -- X (products에 status 컬럼 없음!)

-- donations 테이블
SELECT live_stream_id FROM donations;  -- O
SELECT stream_id FROM donations;       -- X

SELECT credit_amount FROM donations;   -- O
SELECT seller_amount FROM donations;   -- X

SELECT payment_status FROM donations;  -- O
SELECT status FROM donations;          -- X

-- order_items 테이블
SELECT * FROM order_items;             -- O (created_at 없음!)
SELECT created_at FROM order_items;    -- X (컬럼 없음!)
```

### 자주 실수하는 컬럼명 정리

| 테이블 | 올바른 컬럼 | 잘못된 컬럼 |
|--------|------------|------------|
| products | `stock` | ~~stock_quantity~~ |
| products | `is_active` | ~~status~~ |
| donations | `live_stream_id` | ~~stream_id~~ |
| donations | `credit_amount` | ~~seller_amount~~ |
| donations | `payment_status` | ~~status~~ |
| order_items | (없음) | ~~created_at~~ |

---

## API 라우트 구조

### features/ 폴더 패턴

각 기능 모듈은 다음 구조를 따릅니다:

```
src/features/{feature-name}/
├── api/
│   └── {feature-name}.routes.ts   # Hono 라우터 (API 엔드포인트)
├── components/                     # 프론트엔드 컴포넌트 (있는 경우)
├── hooks/                          # 커스텀 훅 (있는 경우)
└── types/                          # 타입 정의 (있는 경우)
```

### routes.ts 패턴

```typescript
import { Hono } from 'hono';
import type { Env } from '../../../worker/types/env';
import { requireAuth, requireSeller } from '../../../worker/middleware/auth';

const app = new Hono<{ Bindings: Env }>();

// 공개 엔드포인트
app.get('/public-data', async (c) => {
  // ...
});

// 인증 필요 엔드포인트
app.get('/protected', requireAuth(), async (c) => {
  const user = c.get('user');
  // ...
});

// 셀러 전용
app.post('/seller-action', requireSeller(), async (c) => {
  // ...
});

export { app as featureRoutes };
```

### 라우트 등록 (worker/index.ts)

```typescript
import { featureRoutes } from '../features/{name}/api/{name}.routes';
app.route('/api/{path}', featureRoutes);
```

> **주의**: 동일 경로에 두 라우터를 등록하면 먼저 등록된 것이 매칭됩니다. 프론트 호출 경로와 백엔드 등록 경로가 반드시 일치해야 합니다.

---

## 인증

### requireAuth() 사용

```typescript
import { requireAuth, requireSeller, requireAdmin } from '../../../worker/middleware/auth';

// 모든 인증된 사용자
app.get('/data', requireAuth(), handler);

// 셀러 전용
app.get('/seller/data', requireSeller(), handler);

// 어드민 전용 (adminApp 하위에 등록 시 자동 적용)
app.get('/admin/data', requireAdmin(), handler);
```

### 토큰 구분
- **유저**: Firebase ID Token 또는 세션 쿠키
- **셀러**: `seller_token` (JWT, localStorage)
- **어드민**: `admin_token` (JWT, localStorage)

---

## 프론트엔드

### Tailwind CSS
- 모든 스타일은 Tailwind 유틸리티 클래스 사용
- 커스텀 CSS는 최소화

### 아이콘
- **lucide-react** 라이브러리 사용
- 예: `import { ShoppingCart, Heart, Search } from 'lucide-react'`

### 레이아웃 컴포넌트
- **셀러 페이지**: `SellerLayout` 컴포넌트로 감싸기
- **어드민 페이지**: `AdminLayout` 컴포넌트로 감싸기
- **일반 페이지**: `MobileLayout` 또는 `FullScreenLayout`

### 페이지 로딩
- 모든 페이지는 `lazy()` + `Suspense`로 로딩
- 코드 스플리팅 자동 적용

---

## ensureTable 패턴

마이그레이션 없이 테이블을 자동 생성하는 패턴:

```typescript
// API 핸들러 내에서
await env.DB.prepare(`
  CREATE TABLE IF NOT EXISTS {table_name} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ...
    created_at DATETIME DEFAULT (datetime('now'))
  )
`).run();
```

- D1 마이그레이션을 수동으로 실행하기 어려운 경우 사용
- 테이블이 이미 존재하면 무시됨
- 프로덕션에서 스키마 변경 시에는 마이그레이션 사용 권장

---

## 에러 처리

### 백엔드

```typescript
try {
  // 비즈니스 로직
} catch (error) {
  console.error('[Feature] Error:', error);
  return c.json({ success: false, error: 'Error message' }, 500);
}
```

- 글로벌 에러 핸들러: `worker/middleware/error-handler.ts`
- 에러 응답 형식: `{ success: false, error: string }`

### 프론트엔드

```typescript
try {
  const response = await api.get('/endpoint');
  // ...
} catch (error) {
  toast.error('에러 메시지');
  Sentry.captureException(error);
}
```

- **toast**: 사용자에게 에러 알림 (`useToast` 훅 또는 `ToastContainer`)
- **Sentry**: 에러 자동 수집 (`src/sentry.ts`에서 초기화)
- **ErrorBoundary**: React 렌더링 에러 포착 (`components/ErrorBoundary.tsx`)

---

## 레이아웃 규칙

### 일반 페이지
- `max-w-screen-sm` (640px) 중앙 정렬
- `MobileLayout` 컴포넌트 사용

### 전체화면 페이지
- `FullScreenLayout` 사용 (너비 제한 없음)
- 대상: 라이브, 체크아웃, 로그인, 결제, 임베드 등
- `fullScreenPrefixes`로 분기

---

## fixed 요소 스타일링

`BottomNav`, `FloatingActionBar` 등 `position: fixed` 요소는 반드시 모바일 레이아웃 너비에 맞춰야 합니다:

```tsx
<div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-screen-sm">
  {/* 내용 */}
</div>
```

- `left-1/2 -translate-x-1/2`: 중앙 정렬
- `max-w-screen-sm`: 640px 너비 제한
- `w-full`: 기본 전체 너비 (max-width로 제한)

> **주의**: `fixed` 대신 `sticky`를 사용하면 스크롤 컨테이너에 따라 동작이 달라질 수 있습니다. 글로벌 네비게이션에는 `fixed`를 사용하세요.
