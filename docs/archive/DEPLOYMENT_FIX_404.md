# 404 Error Fix Documentation

## 문제 상황

**URL:** `https://live.ur-team.com/user/profile?firebase_token=...`

**에러:**
```
HTTP ERROR 404
페이지를 찾을 수 없음
```

**발생 시점:** 
- 카카오 로그인 후 리다이렉트 시
- React Router 경로 (e.g., `/user/profile`, `/cart`, `/checkout`) 직접 접근 시

---

## 원인 분석

### 1. **Hono Worker가 모든 요청을 가로챔**
   - `src/index.tsx`가 Cloudflare Pages Functions로 동작
   - Worker가 모든 HTTP 요청을 처리하려고 시도
   
### 2. **SPA Fallback 로직 부재**
   - Worker에 catch-all 핸들러가 없음
   - `/user/profile` 같은 클라이언트 라우트에 대한 처리 로직이 없음
   - 결과: 404 Not Found 응답

### 3. **React Router 라우팅 불가**
   - SPA는 `index.html`을 먼저 로드한 후 클라이언트에서 라우팅을 처리해야 함
   - Worker가 404를 반환하면 React Router가 실행되지 않음

---

## 해결 방법

### 📝 **코드 수정**

**파일:** `src/index.tsx`

**위치:** `app.onError()` 핸들러 **직전**에 추가

```typescript
// =====================================
// 🌐 SPA Fallback Handler
// =====================================
// All non-API, non-static routes should serve index.html
// This ensures React Router can handle client-side routing

app.get('*', serveStatic({ root: './' }));
app.get('*', async (c) => {
  const path = c.req.path;
  
  // Skip API routes (already handled above)
  if (path.startsWith('/api/') || path.startsWith('/auth/') || path.startsWith('/static/')) {
    return c.notFound();
  }
  
  // For all other routes, serve index.html to enable SPA routing
  console.log(`[SPA Fallback] Serving index.html for: ${path}`);
  return c.html(await c.env.ASSETS.fetch(new Request('https://dummy.com/index.html')).then(r => r.text()));
});
```

### 🔧 **동작 원리**

1. **첫 번째 `app.get('*')`:** 정적 파일 서빙 시도
   - `/assets/*`, `/favicon.ico` 등

2. **두 번째 `app.get('*')`:** SPA fallback
   - API/정적 경로가 아닌 경우 → `index.html` 반환
   - React Router가 클라이언트에서 라우팅 처리

3. **API 보호**
   - `/api/*`, `/auth/*`, `/static/*` → Worker가 직접 처리
   - 404 반환하여 fallback으로 넘어가지 않음

---

## 배포 절차

### 1️⃣ **빌드**
```bash
cd /home/user/webapp
npm run build:kr
```

### 2️⃣ **Git 커밋 & 푸시**
```bash
git add src/index.tsx dist/
git commit -m "fix(worker): Add SPA fallback handler to serve index.html for client routes"
git push origin main
```

### 3️⃣ **GitHub Actions 자동 배포**
- GitHub: https://github.com/tobe2111/ur-live/actions
- 예상 시간: 3~5분

### 4️⃣ **배포 확인**
```bash
# 메인 페이지 확인
curl -I https://live.ur-team.com/

# SPA 라우트 확인 (200 OK여야 함)
curl -I https://live.ur-team.com/user/profile
curl -I https://live.ur-team.com/cart
curl -I https://live.ur-team.com/checkout
```

---

## 테스트 시나리오

### ✅ **정상 동작 확인**

1. **직접 URL 접근**
   ```
   https://live.ur-team.com/user/profile
   → 200 OK (index.html 반환)
   → React Router가 /user/profile 렌더링
   ```

2. **카카오 로그인 플로우**
   ```
   https://live.ur-team.com/ 
   → 카카오 로그인 클릭
   → OAuth 인증
   → https://live.ur-team.com/user/profile?firebase_token=...
   → 200 OK
   → 프로필 페이지 정상 표시
   ```

3. **React Router 네비게이션**
   ```
   메인 페이지 → 장바구니 → 결제 → 주문내역
   → 모든 페이지 전환이 404 없이 정상 작동
   ```

4. **API 요청 보호**
   ```
   GET /api/products → Worker가 처리 (JSON 응답)
   GET /auth/kakao/callback → Worker가 처리
   GET /static/logo.png → 정적 파일 서빙
   ```

---

## Git Commit History

```
8965dc0 - fix(worker): Add SPA fallback handler to serve index.html for client routes
96dde05 - build: Production build for live.ur-team.com (React fix)
3c18ce3 - fix(react): CRITICAL - Eliminate React duplicate in dev mode
63ef97a - fix(vite): URGENT - Simplify manualChunks to prevent React duplicate
```

---

## 추가 참고 자료

### Cloudflare Pages Functions
- https://developers.cloudflare.com/pages/functions/

### Hono Framework
- https://hono.dev/docs/api/routing#routing-priority

### React Router
- https://reactrouter.com/en/main/routers/create-browser-router

---

## 문제 해결 체크리스트

- [x] Hono Worker에 SPA fallback 추가
- [x] `/api/*`, `/auth/*` 경로 보호
- [x] 빌드 및 배포 완료
- [x] GitHub Actions 자동 배포 설정
- [ ] 프로덕션에서 테스트 (5분 후)
- [ ] 카카오 로그인 → /user/profile 정상 작동 확인
- [ ] 모든 React Router 경로 접근 가능 확인

---

**작성일:** 2026-03-05  
**최종 업데이트:** 2026-03-05 02:30 UTC  
**배포 URL:** https://live.ur-team.com  
**커밋:** 8965dc0
