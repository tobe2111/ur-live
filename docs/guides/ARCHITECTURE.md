# 아키텍처 가이드

## 전체 구조

```
브라우저 (React SPA)
    │
    ├── Cloudflare Pages (정적 파일 서빙)
    │       └── dist/client/
    │
    └── Cloudflare Worker (API + 비즈니스 로직)
            ├── Hono 라우터
            ├── D1 SQLite (구조화 데이터)
            └── Firebase RTDB (실시간 채팅)
```

## 리전별 동작

| 리전 | 도메인 | 인증 | 결제 |
|------|--------|------|------|
| KR | live.ur-team.com | Firebase + Kakao OAuth | Toss Payments |
| Global | world.ur-team.com | Firebase + Google OAuth | Stripe |

리전 감지: `src/config/region.ts` — 호스트명 패턴 매칭

## 인증 플로우

```
사용자 로그인
    │
    ├── 이메일/비밀번호 → Firebase Auth → ID Token
    ├── 카카오 → Kakao OAuth → Firebase Custom Token → ID Token
    └── Google → Firebase Auth → ID Token

ID Token → 모든 API 요청 헤더 (Authorization: Bearer <token>)
    │
    └── Worker auth 미들웨어 → Firebase 공개 JWK 검증 → userId 추출
```

## 데이터 흐름

```
프론트엔드 (Zustand Store)
    │
    ├── API 요청 → src/lib/api.ts (axios, 인터셉터 포함)
    │       └── Worker routes → repositories → D1 SQLite
    │
    └── 실시간 채팅 → Firebase RTDB (직접 연결)
```

## 결제 플로우 (Toss Payments)

```
CheckoutPage
    │
    ├── TossPaymentWidget (SDK) → 결제창
    │       └── 사용자 결제 완료
    │
    ├── POST /api/payments/confirm → Toss API 검증 → 주문 생성
    │
    └── Toss Webhook → POST /api/payments/webhook (HMAC 검증)
            └── 주문 상태 업데이트 (DONE/CANCELLED/FAILED)
```

## 주요 패턴

### API 라우트 패턴 (Worker)
```typescript
// src/worker/routes/example.routes.ts
router.get('/items', requireAuth, async (c) => {
  const userId = c.get('userId')  // auth 미들웨어가 주입
  const { DB } = c.env
  const items = await DB.prepare('SELECT * FROM items WHERE user_id = ?')
    .bind(userId).all()
  return c.json({ success: true, data: items.results })
})
```

### Zustand Store 패턴 (프론트엔드)
```typescript
// src/shared/stores/useAuthKR.ts
export const useAuthKR = create<AuthState>()(
  persist((set, get) => ({
    user: null,
    isLoading: true,
    // Firebase 상태 변화 구독
  }), { name: 'auth-kr' })
)
```

### 에러 처리 패턴
```typescript
try {
  const result = await someOperation()
  return c.json({ success: true, data: result })
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : '알 수 없는 오류'
  console.error('[Route] Error:', message)
  return c.json({ success: false, error: message }, 500)
}
```
